// Client for /api/plugins/* (server: api/_plugins.js via api/ops.js). The mock build uses an in-memory store with the
// first-party seeds so screenshots run without a network.
import { getIdToken, MOCK } from '../backend.js';
import { SEEDS, NEST_CREATOR } from './seeds.js';
import { validateBundle, CATEGORIES } from './manifest.js';
import { cleanListingPatch, needsListingReview } from './listing.js';
import { reportGate } from '../gate-errors.js';
import { demoActive } from '../demo-guard.js';
// Run 10: profile writes carry an explicit real-app marker; the server refuses profile-save / creator-save without it.
const appOrigin = () => { try { return !demoActive() && /^\/(app|admin)(\/|$)/.test(window.location.pathname) ? 'app' : ''; } catch { return ''; } };

export class PluginError extends Error { constructor(code, info = {}) { super(code); this.code = code; Object.assign(this, info); } }

async function call(op, body = {}) {
  if (MOCK || demoActive()) return mock(op, body); // landing demo: in-memory seeds, never the real account
  const token = await getIdToken();
  let r;
  const origin = appOrigin();
  try {
    r = await fetch(`/api/plugins/${op}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...(origin ? { 'x-nest-origin': origin } : {}) }, body: JSON.stringify(body) });
  } catch { throw new PluginError('network'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new PluginError(d.error || `http_${r.status}`, { status: r.status, errors: d.errors, ...(d.feature ? { feature: d.feature } : {}), ...(d.message ? { gateMessage: d.message } : {}) }); reportGate(err); throw err; }
  return d;
}

export const storeList = () => call('store');
export const pluginDetail = (id) => call('detail', { id });
export const creatorProfile = (handle) => call('creator', { handle });
export const fetchBundles = (ids) => call('bundle', { ids });
export const installPlugin = (id, { granted = [], acceptUnverified = false, acceptHighRisk = false, dev = false, v } = {}) => call('install', { id, granted, acceptUnverified, acceptHighRisk, dev, v });
export const uninstallPlugin = (id) => call('uninstall', { id });
export const saveReview = (id, stars, text) => call('review', { id, stars, text });
export const deleteReview = (id) => call('review', { id, remove: true });
export const reportPlugin = (id, reason, reviewKey) => call('report', { id, reason, reviewKey });
export const studioMe = () => call('me');
// Unified public profile (Settings 個人資料 = creator profile). See src/lib/profile.js / api/_plugins.js.
export const profileMe = () => call('profile-me');
export const profileSave = (patch) => call('profile-save', patch);
export const profileCheck = (handle) => call('profile-check', { handle });
export const profileView = (q) => call('profile', q);
const badgeCache = new Map(); // uid → { v, h, at }
export async function fetchBadges(uids = []) {
  const want = [...new Set(uids.filter(Boolean))];
  const now = Date.now();
  const miss = want.filter((u) => !badgeCache.has(u) || now - badgeCache.get(u).at > 5 * 60e3);
  if (miss.length) {
    try {
      const d = await call('badges', { uids: miss.slice(0, 60) });
      for (const u of miss) badgeCache.set(u, { ...(d.badges?.[u] || { v: false, h: '' }), at: now });
    } catch {}
  }
  return Object.fromEntries(want.filter((u) => badgeCache.has(u)).map((u) => [u, badgeCache.get(u)]));
}
export const dropBadge = (uid) => badgeCache.delete(uid);
export const saveCreator = (p) => call('creator-save', p);
export const saveDraft = (bundle, { shots, video } = {}) => call('save', { bundle, shots, video });
export const submitPlugin = (id, changelog = '') => call('submit', { id, changelog });
// Studio projects (owner only; api/_plugins.js prj-*).
export const projectList = () => call('prj-list');
export const projectGet = (id) => call('prj-get', { id });
export const projectCreate = (body) => call('prj-create', body);
export const projectCommit = (body) => call('prj-commit', body);
export const projectRename = (id, name) => call('prj-rename', { id, name });
export const projectDelete = (id) => call('prj-delete', { id });
export const projectVersion = (id, n) => call('prj-version', { id, n });
// Server-served plugin data (api/calendar.js op=pdata): Gmail / Classroom summaries and Nest calendar writes.
export async function pluginData(pid, method, params = {}) {
  if (MOCK || demoActive()) return mockData(pid, method, params);
  const token = await getIdToken();
  let r;
  try { r = await fetch('/api/pdata', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ pid, method, params }) }); }
  catch { throw new PluginError('network'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new PluginError(d.error || `http_${r.status}`, { status: r.status, ...(d.feature ? { feature: d.feature } : {}) }); reportGate(err); throw err; }
  return d;
}
function mockData(pid, method, params) {
  if (method === 'gmail.summary') return { items: [{ from: 'School Office', subject: 'Parents’ day reply slip', snippet: 'Please return the slip by Friday…', date: Date.now() - 3600e3, unread: true }].slice(0, params.limit || 5) };
  if (method === 'classroom.list') return { items: [{ course: 'S3 English', title: 'Book report', due: Date.now() + 2 * 864e5, late: false }] };
  if (method === 'calendar.create') return { id: `e${Date.now().toString(16).padStart(20, '0').slice(-20)}` };
  return { ok: true };
}
export const removePlugin = (id) => call('remove', { id });
// Published listing editor (owner only): { id, descZh, desc, features, category, links, icon, shots:[{keep|img, alt}] }.
export const saveListing = (body) => call('listing', body);
export const adminPlugins = () => call('admin-list');
export const adminVersion = (id, v, listing = true) => call('admin-version', { id, v, listing });
export const adminPluginAction = (body) => call('admin-action', body);

// ---------------- mock (vite --mode mock only) ----------------
// Headless tests call the mock API directly (e.g. a non-owner listing save must be rejected).
if (MOCK && typeof window !== 'undefined') window.__nestMockPluginApi = (op, b) => mock(op, b).then((r) => ({ ok: true, r }), (e) => ({ ok: false, code: e.code, status: e.status }));
const M = { plugins: null, creators: {}, reviews: {}, installs: {}, me: null, versions: {}, projects: {} };
function mockVersion(x, bundle, kind, msg) {
  const n = (x.vn || 0) + 1; x.vn = n;
  x.vlist = [...(x.vlist || []), { n, kind, msg, at: Date.now(), size: JSON.stringify(bundle).length }];
  x.versions[n] = { kind, msg, at: Date.now(), bundle: JSON.parse(JSON.stringify(bundle)) };
  return n;
}
function mockInit() {
  if (M.plugins) return;
  M.creators[NEST_CREATOR.uid] = { ...NEST_CREATOR };
  M.creators.u7 = { uid: 'u7', handle: 'studybuddy', bio: 'S3 student. I make little study tools.', pfp: '', verified: false };
  const ratings = { 'sky-theme': [5, 5, 4, 5], 'dark-mode': [5, 4, 5], pomodoro: [5, 5, 5, 4, 5], countdown: [4, 5], 'daily-quote': [5, 4], 'rounded-fonts': [4, 5, 4] };
  const installs = { 'sky-theme': 1240, 'dark-mode': 2310, pomodoro: 1880, countdown: 960, 'daily-quote': 720, 'rounded-fonts': 540 };
  M.plugins = SEEDS.map((s, i) => {
    const m = validateBundle(s).bundle.manifest;
    M.versions[`${s.id}:1`] = { manifest: m, html: s.html, css: s.css, js: s.js, size: 0 };
    const r = ratings[s.id] || [];
    M.reviews[s.id] = r.map((stars, k) => ({ key: `k${k}`, stars, text: k === 0 ? (m.nameZh ? '好用，簡單清楚。' : 'Nice and simple.') : '', at: Date.now() - (k + 1) * 864e5, by: `#${(1234 + k * 977).toString(16).slice(-4)}` }));
    return { id: s.id, name: m.name, nameZh: m.nameZh, desc: m.description, descZh: m.descriptionZh, icon: m.icon, category: m.category, creatorUid: NEST_CREATOR.uid, verified: true, safe: true, featured: !!s.featured, firstParty: true, installs: installs[s.id] || 100, caps: m.capabilities, perms: m.permissions, version: m.version, publishedAt: Date.now() - (10 - i) * 864e5, updatedAt: Date.now() - i * 3600e3, listed: true, live: 1, draftV: 1, shots: s.shots, video: '', settings: m.settings, tab: m.tab || null, widget: m.widget || null };
  });
  // One community plugin (not labelled Safe) so the store / warning flows can be shot.
  const flash = { id: 'flashcard-flip', name: 'Flashcard Flip', nameZh: '快閃字卡', version: '1.0.0', category: 'study', capabilities: ['widget'], permissions: ['reminders.write'], description: 'Flip a vocabulary card on Home.', descriptionZh: '在主頁翻一張生字卡。', widget: { title: 'Flashcards', titleZh: '字卡', height: 120 } };
  const fm = validateBundle({ manifest: flash, html: '<p style="font-weight:800">apple — 蘋果</p>', css: '', js: '' }).bundle.manifest;
  M.versions['flashcard-flip:1'] = { manifest: fm, html: '<p style="font-weight:800;margin:0">apple — 蘋果</p>', css: '', js: '' };
  M.plugins.push({ id: 'flashcard-flip', name: fm.name, nameZh: fm.nameZh, desc: fm.description, descZh: fm.descriptionZh, icon: '', category: 'study', creatorUid: 'u7', verified: false, safe: false, featured: false, installs: 32, caps: fm.capabilities, perms: fm.permissions, version: '1.0.0', publishedAt: Date.now() - 864e5, updatedAt: Date.now(), listed: true, live: 1, draftV: 1, shots: [], video: '', settings: [], widget: fm.widget });
  M.reviews['flashcard-flip'] = [];
  try { for (const id of JSON.parse(localStorage.getItem('nest.mock.plugins') || '[]')) M.installs[id] = true; } catch {}
  // Listing edits survive a reload in the mock build (sessionStorage), so reload persistence can be tested headless.
  try { const L = JSON.parse(sessionStorage.getItem('nest.mock.listing') || '{}'); for (const p of M.plugins) if (L[p.id]) Object.assign(p, L[p.id]); } catch {}
}
function mockKeepListing(p) {
  try { const L = JSON.parse(sessionStorage.getItem('nest.mock.listing') || '{}'); const { descZh, desc, features, category, links, icon, shots, shotAlts, listingAt, listingPending, listingReview } = p; L[p.id] = { descZh, desc, features, category, links, icon, shots, shotAlts, listingAt, listingPending, listingReview }; sessionStorage.setItem('nest.mock.listing', JSON.stringify(L)); } catch {}
}
const cardOf = (p) => {
  const r = M.reviews[p.id] || [];
  const cr = M.creators[p.creatorUid];
  return { ...p, rating: r.length ? Math.round((r.reduce((a, x) => a + x.stars, 0) / r.length) * 10) / 10 : 0, ratingCount: r.length, creator: cr ? { handle: cr.handle, verified: !!cr.verified, pfp: cr.pfp || '' } : null };
};
async function mock(op, b) {
  mockInit();
  await new Promise((r) => setTimeout(r, 60));
  const find = (id) => M.plugins.find((p) => p.id === id);
  switch (op) {
    case 'store': return { plugins: M.plugins.filter((p) => p.listed).map(cardOf), categories: CATEGORIES };
    case 'detail': { const p = find(b.id); if (!p) throw new PluginError('not_found'); const reviews = M.reviews[p.id] || []; const mine = p.creatorUid === 'u1' || (window.__nestMockOwner && p.creatorUid === window.__nestMockOwner); return { plugin: { ...cardOf(p), size: 4200, links: p.links || [], features: p.features ?? p.featuresM ?? '', ...(mine ? { mine: true, listingReview: p.listingReview || '', needsReview: !!(p.verified || p.firstParty || p.safe), listingAt: p.listingAt || 0 } : {}) }, shots: p.shots || [], shotAlts: p.shotAlts || (p.shots || []).map(() => ''), reviews, creator: M.creators[p.creatorUid], myReview: reviews.find((r) => r.mine) || null, installed: !!M.installs[p.id], canReview: !!M.installs[p.id] && p.creatorUid !== 'u1' }; }
    case 'creator': { const cr = Object.values(M.creators).find((c) => c.handle === b.handle); if (!cr) throw new PluginError('not_found'); return { creator: { ...cr, photo: cr.photo || cr.pfp || '', links: cr.links || [] }, mine: cr.uid === 'u1', plugins: M.plugins.filter((p) => p.creatorUid === cr.uid && p.listed).map(cardOf) }; }
    case 'bundle': { const out = {}; for (const w of b.ids || []) { const id = w.id || w; const p = find(id); const v = M.versions[`${id}:${w.dev && w.v ? w.v : p?.live || p?.draftV}`]; out[id] = p && v ? { v: w.dev && w.v ? w.v : p.live || p.draftV, ...v, safe: p.safe, verified: p.verified, dev: !p.listed } : { removed: true }; } return { bundles: out }; }
    case 'install': {
      const p = find(b.id); if (!p) throw new PluginError('not_found');
      const v = M.versions[`${p.id}:${b.dev && b.v ? b.v : p.live || p.draftV}`];
      if ((v.manifest.permissions || []).some((x) => !(b.granted || []).includes(x))) throw new PluginError('needs_permission_approval');
      if (!p.safe && !b.acceptUnverified) throw new PluginError('needs_unverified_ack');
      if (!M.installs[p.id] && !b.dev) p.installs++;
      M.installs[p.id] = true;
      return { ok: true, bundle: { v: b.dev && b.v ? b.v : p.live || p.draftV, ...v, safe: p.safe, verified: p.verified }, granted: b.granted || [] };
    }
    case 'uninstall': delete M.installs[b.id]; return { ok: true };
    case 'review': { const l = (M.reviews[b.id] = (M.reviews[b.id] || []).filter((r) => !r.mine)); if (!b.remove) l.unshift({ key: 'mine', mine: true, stars: b.stars, text: b.text || '', at: Date.now(), by: '@demo' }); return { ok: true }; }
    case 'report': return { ok: true };
    case 'me': return { creator: M.me, plugins: M.plugins.filter((p) => p.creatorUid === 'u1').map((p) => ({ ...cardOf(p), review: p.review || 'none', pendingV: p.pendingV || 0 })) };
    case 'profile-me': return { profile: M.me ? { ...M.me, photo: M.me.photo || M.me.pfp || '' } : null };
    case 'profile-save': { const cur = M.me || { uid: 'u1', handle: '', name: '', photo: '', banner: '', bio: '', links: [], verified: false }; if (b.handle && Object.values(M.creators).some((c) => c.handle === b.handle && c.uid !== 'u1')) throw new PluginError('handle_taken'); M.me = { ...cur, ...b }; M.me.pfp = M.me.photo; M.creators.u1 = M.me; return { ok: true, profile: M.me }; }
    case 'profile-check': { const h = String(b.handle || '').toLowerCase(); if (!/^[a-z0-9_]{3,20}$/.test(h)) return { ok: false, reason: 'bad_handle' }; return Object.values(M.creators).some((c) => c.handle === h && c.uid !== 'u1') || ['nest', 'admin'].includes(h) ? { ok: false, reason: 'handle_taken' } : { ok: true }; }
    case 'profile': { const cr = b.handle ? Object.values(M.creators).find((c) => c.handle === b.handle) : M.creators[b.uid]; if (!cr) throw new PluginError('not_found'); const prof = { ...cr, photo: cr.photo || cr.pfp || '', name: cr.name || '', links: cr.links || [], banner: cr.banner || '' }; return { profile: prof, creator: prof, mine: cr.uid === 'u1', plugins: M.plugins.filter((p) => p.creatorUid === cr.uid && p.listed).map(cardOf) }; }
    case 'badges': { const out = {}; for (const u of b.uids || []) { const cr = M.creators[u]; if (cr) out[u] = { v: !!cr.verified, h: cr.handle }; } if ((b.uids || []).includes('u3')) out.u3 = { v: true, h: 'chanpapa' }; return { badges: out }; }
    case 'creator-save': M.me = { uid: 'u1', handle: b.handle, bio: b.bio, pfp: b.pfp || '', verified: false }; M.creators.u1 = M.me; return { ok: true, creator: M.me };
    case 'save': {
      const v = validateBundle(b.bundle); if (!v.ok) throw new PluginError('invalid_bundle', { errors: v.errors });
      const m = v.bundle.manifest; let p = find(m.id);
      if (p && p.creatorUid !== 'u1') throw new PluginError('id_taken');
      if (!p) { p = { id: m.id, creatorUid: 'u1', listed: false, live: 0, draftV: 0, installs: 0, verified: false, safe: false, shots: [], review: 'none' }; M.plugins.push(p); }
      p.draftV = (p.draftV || 0) + 1; Object.assign(p, { name: m.name, nameZh: m.nameZh, desc: m.description, descZh: m.descriptionZh, icon: m.icon || '', category: m.category, caps: m.capabilities, perms: m.permissions, version: m.version, updatedAt: Date.now(), shots: b.shots || p.shots });
      M.versions[`${m.id}:${p.draftV}`] = { manifest: m, html: v.bundle.html, css: v.bundle.css, js: v.bundle.js };
      return { ok: true, id: m.id, v: p.draftV };
    }
    case 'submit': { const p = find(b.id); p.review = 'pending'; p.pendingV = p.draftV; p.pendingNotes = b.changelog || ''; return { ok: true, review: 'pending' }; }
    case 'prj-list': return { projects: Object.values(M.projects).map(({ bundle, turns, versions, ...x }) => x).sort((a, b) => b.updatedAt - a.updatedAt) };
    case 'prj-get': { const x = M.projects[b.id]; if (!x) throw new PluginError('not_found'); const { bundle, turns, versions, ...meta } = x; return { project: meta, bundle, turns }; }
    case 'prj-create': { const id = `p${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`; const now = Date.now(); const x = { id, name: b.name || 'Plugin', pid: b.bundle?.manifest?.id || '', icon: '', vn: 0, vlist: [], turnN: 0, summary: '', sumN: 0, createdAt: now, updatedAt: now, bundle: b.bundle || null, turns: [], versions: {} }; if (b.bundle) mockVersion(x, b.bundle, b.kind || 'import', b.msg || ''); M.projects[id] = x; const { bundle, turns, versions, ...meta } = x; return { ok: true, project: meta }; }
    case 'prj-commit': { const x = M.projects[b.id]; if (!x) throw new PluginError('not_found'); let v = 0; if (b.bundle && JSON.stringify(b.bundle) !== JSON.stringify(x.bundle)) { v = mockVersion(x, b.bundle, b.kind || 'manual', b.msg || ''); x.bundle = b.bundle; x.pid = b.bundle.manifest?.id || x.pid; } x.turns.push(...(b.turns || []).map((t) => (t.role === 'ai' && v && !t.err ? { ...t, v } : t))); if (typeof b.summary === 'string') { x.summary = b.summary; x.sumN = b.sumN || 0; } if (b.name) x.name = b.name; x.updatedAt = Date.now(); x.turnN = x.turns.length; const { bundle, turns, versions, ...meta } = x; return { ok: true, v, project: meta }; }
    case 'prj-rename': M.projects[b.id].name = b.name; return { ok: true, name: b.name };
    case 'prj-delete': delete M.projects[b.id]; return { ok: true };
    case 'prj-version': { const x = M.projects[b.id]; const v = x?.versions[b.n]; if (!v) throw new PluginError('no_version'); return { n: b.n, ...v }; }
    case 'remove': M.plugins = M.plugins.filter((p) => p.id !== b.id); return { ok: true };
    case 'listing': {
      const p = find(b.id); if (!p) throw new PluginError('not_found');
      if (p.creatorUid !== 'u1' && !(window.__nestMockOwner && p.creatorUid === window.__nestMockOwner)) throw new PluginError('not_owner', { status: 403 });
      const cur = (p.shots || []).length; const { patch, errors } = cleanListingPatch(b, { current: cur, currentIcon: p.icon || '' });
      if (errors.length) throw new PluginError('invalid_listing', { errors });
      const review = needsListingReview({ ...p, firstParty: p.firstParty, verified: p.verified, safeV: p.safe ? 1 : 0, live: 1 }, (x) => !!x.safeV);
      const shots = patch.shots ? patch.shots.map((x) => ('keep' in x ? p.shots[x.keep] : x.img)) : null;
      const alts = patch.shots ? patch.shots.map((x) => x.alt || '') : null;
      const { shots: _s, ...fields } = patch;
      if (review) { p.listingPending = { ...fields, shots, alts }; p.listingReview = 'pending'; mockKeepListing(p); return { ok: true, review: 'pending' }; }
      Object.assign(p, fields); if (shots) { p.shots = shots; p.shotAlts = alts; } p.listingAt = Date.now(); mockKeepListing(p);
      return { ok: true, review: 'applied', shots: (p.shots || []).length };
    }
    case 'admin-list': return { plugins: M.plugins.map((p) => ({ ...cardOf(p), review: p.review || 'approved', pendingV: p.pendingV || 0, live: p.live, draftV: p.draftV })), reports: [], creators: Object.values(M.creators).map((c) => ({ ...c, plugins: M.plugins.filter((p) => p.creatorUid === c.uid).length })) };
    case 'admin-version': { const p = find(b.id); const v = M.versions[`${b.id}:${b.v || p.pendingV || p.live}`]; return { v: b.v || p.pendingV || p.live, version: v, shots: p.shots, video: '' }; }
    case 'admin-action': { const p = find(b.id); if (p && b.type === 'safe') p.safe = b.on !== false; if (p && b.type === 'approve') { p.live = p.pendingV; p.pendingV = 0; p.review = 'approved'; p.listed = true; } return { ok: true }; }
    default: throw new PluginError('not_found');
  }
}
