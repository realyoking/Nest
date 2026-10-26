// Nest Plugin Store — server side (no new function: routed through api/ops.js, op=plug-*; vercel.json rewrites
// /api/plugins/:op → /api/ops?op=plug-:op). Storage: Firestore via the service account (FIREBASE_SERVICE_ACCOUNT).
// None of these collections has a client rule, so the default-deny ruleset blocks every client read/write:
//   nestPlugins/{pid}                 listing + state (creatorUid, listed, live, draftV, pendingV, review, safeV, verified, ...)
//   nestPlugins/{pid}/versions/{v}    {manifest, html, css, js, size, at}
//   nestPlugins/{pid}/media/s{i}      {img, alt}  (screenshots, ≤6; listing editor may reorder / replace / delete)
//   nestPlugins/{pid}/media/q{i}      {img, alt}  (screenshots of a listing change waiting for admin re-review)
//   nestPlugins/{pid}/reviews/{uid}   {uid, stars, text, at}
//   nestPlugins/{pid}/installs/{uid}  {at, v, granted[], ack}
//   nestPluginReports/{rid}           {kind, pid, reviewUid, reason, by, at, status}
//   nestCreators/{uid}                ONE public profile per user (unified identity, src/lib/profile.js):
//                                     {uid, handle, name, photo, bio, links[], hasBanner, verified, banned, at}  (`pfp` = legacy photo)
//   nestCreators/{uid}/media/banner   {img}  (3:1 banner, kept out of the main doc so store listings stay small)
//   nestHandles/{handle}              {uid}  (uniqueness, create-only precondition)
//   nestMeta/plugins                  {seedV}
//   nestStudio/{uid}/projects/{id}    Studio project (owner only): {id, name, pid, bundleJson, summary, sumN, vn, vlist[{n,kind,msg,at,size}], turnN, createdAt, updatedAt}
//   nestStudio/{uid}/projects/{id}/thread/main     {turns:[{role:user|ai|edit|system, text, at, v?, err?, errors?}]}  (≤80, older ones live in `summary`)
//   nestStudio/{uid}/projects/{id}/versions/{n}    {n, kind: ai|manual|restore|import|template, msg, at, size, bundleJson}  (≤60 kept)
// Every write is checked here: caller from a verified Firebase ID token; admin = isAdminClaims (allowlist + verified email),
// everyone else gets 404 for admin ops. Admin actions are appended to the existing admin log (ledger `log`).
import { json, callerOf, isAdminClaims, isOfficialClaims, OFFICIAL, fsGet, fsCommit, docName, pathsWrite, enc, decFields, DOCS, serviceToken, hasServiceAccount, listCollection, ledgerTx, sha256hex } from './_ops-lib.js';
import { HIGH_DATA } from '../src/lib/plugins/permissions.js';
import { PROJECT_LIMITS, bundleJson, parseBundleJson, cleanWorkingBundle, cleanTurn, projectName, cleanChangelog } from '../src/lib/plugins/project.js';
import { validateBundle, cleanShot, cleanVideo, cleanIcon, LIMITS, CATEGORIES } from '../src/lib/plugins/manifest.js';
import { SEEDS, SEED_VERSION, NEST_CREATOR } from '../src/lib/plugins/seeds.js';
import { cleanListingPatch, needsListingReview, LISTING_LIMITS } from '../src/lib/plugins/listing.js';
import { cleanProfilePatch, publicProfile, normHandle, handleProblem, HANDLE_RE as PROFILE_HANDLE_RE } from '../src/lib/profile.js';

const P = 'nestPlugins';
const ID_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
export const HANDLE_RE = PROFILE_HANDLE_RE;
// The official Nest account (OFFICIAL.uid) owns the first-party "Nest" creator record.
export const profileId = (uid) => (uid === OFFICIAL.uid ? NEST_CREATOR.uid : uid);
const err = (status, code) => Object.assign(new Error(code), { status });

// ---------- tiny Firestore helpers (service account) ----------
const fieldsOf = (o) => enc(o).mapValue.fields;
const setW = (path, obj, pre) => ({ update: { name: docName(path), fields: fieldsOf(obj) }, ...(pre ? { currentDocument: pre } : {}) });
const patchW = (path, obj, pre) => ({ ...pathsWrite(docName(path), Object.entries(obj).map(([k, v]) => [[k], v])), ...(pre ? { currentDocument: pre } : {}) });
const delW = (path) => ({ delete: docName(path) });
const incW = (path, field, n = 1) => ({ transform: { document: docName(path), fieldTransforms: [{ fieldPath: field, increment: { integerValue: String(n) } }] } });
async function sa() {
  if (!hasServiceAccount()) throw err(503, 'store_not_configured');
  return serviceToken();
}
async function commit(writes, tok) {
  const r = await fsCommit(writes, tok);
  if (!r.ok) { const e = err(r.code === 409 || r.status === 'ALREADY_EXISTS' ? 409 : r.status === 'FAILED_PRECONDITION' || r.status === 'NOT_FOUND' ? 409 : 502, r.status === 'ALREADY_EXISTS' ? 'exists' : 'write_failed'); e.detail = r.status; throw e; }
}
const get = async (path, tok) => (await fsGet(path, tok))?.data || null;

// ---------- rate limits (per isolate, best effort) ----------
const hits = new Map();
export function rateOk(key, max, ms, now = Date.now()) {
  const l = (hits.get(key) || []).filter((t) => now - t < ms);
  if (l.length >= max) { hits.set(key, l); return false; }
  l.push(now); hits.set(key, l);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return true;
}
const limit = (c, op, max, ms) => { if (!rateOk(`${c.uid}|${op}`, max, ms)) throw err(429, 'rate_limited'); };

// ---------- pure helpers (unit-tested) ----------
export const anonLabel = async (uid) => `#${(await sha256hex(`nest-review|${uid}`)).slice(0, 4)}`;
export const isListed = (p, creator) => !!p && p.listed === true && Number(p.live) > 0 && !p.deleted && !creator?.banned;
export const isSafe = (p) => !!p && Number(p.safeV) > 0 && Number(p.safeV) === Number(p.live);
// Which version a caller may load: own drafts (creator), any (admin), otherwise only the live listed version.
export function versionFor(p, { uid, admin = false, creatorBanned = false } = {}, wantV) {
  if (!p || p.deleted) return null;
  const own = p.creatorUid && p.creatorUid === uid;
  const v = Number(wantV) || 0;
  if (v && (own || admin) && v >= 1 && v <= Number(p.draftV || p.live || 0)) return v;
  if (isListed(p, { banned: creatorBanned })) return Number(p.live);
  if (own && Number(p.draftV) > 0) return Number(p.draftV);
  return null;
}
export const card = (p, creators = {}) => ({
  id: p.id, name: p.name, nameZh: p.nameZh || '', desc: p.desc || '', descZh: p.descZh || '', icon: p.icon || '', category: p.category,
  creatorUid: p.creatorUid, creator: creators[p.creatorUid] ? { handle: creators[p.creatorUid].handle, name: creators[p.creatorUid].name || '', verified: !!creators[p.creatorUid].verified, pfp: creators[p.creatorUid].photo || creators[p.creatorUid].pfp || '' } : null,
  verified: !!p.verified, safe: isSafe(p), featured: !!p.featured, firstParty: !!p.firstParty,
  installs: Number(p.installs) || 0, rating: p.ratingCount ? Math.round((p.ratingSum / p.ratingCount) * 10) / 10 : 0, ratingCount: Number(p.ratingCount) || 0,
  publishedAt: Number(p.publishedAt) || 0, updatedAt: Number(p.updatedAt) || 0, caps: p.caps || [], perms: p.perms || [], version: p.version || '',
  reasons: p.reasons && typeof p.reasons === 'object' ? p.reasons : {}, domains: Array.isArray(p.domains) ? p.domains : [],
});
export function cleanCreatorInput(b = {}) {
  const handle = String(b.handle || '').trim().toLowerCase().replace(/^@/, '');
  if (!HANDLE_RE.test(handle)) throw err(400, 'bad_handle');
  const bio = String(b.bio || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, LIMITS.bio);
  const pfp = b.pfp ? cleanIcon(b.pfp) : '';
  if (b.pfp && !pfp) throw err(400, 'bad_pfp');
  return { handle, bio, pfp };
}

// ---------- seeding (idempotent, first-party "Nest" creator) ----------
let seededAt = 0;
async function ensureSeeds(tok) {
  if (Date.now() - seededAt < 10 * 60e3) return;
  const meta = await get('nestMeta/plugins', tok);
  if (Number(meta?.seedV) >= SEED_VERSION) { seededAt = Date.now(); return; }
  const now = Date.now();
  const writes = [
    setW(`nestCreators/${NEST_CREATOR.uid}`, { ...NEST_CREATOR, banned: false, at: now }),
    setW(`nestHandles/${NEST_CREATOR.handle}`, { uid: NEST_CREATOR.uid }),
  ];
  for (const s of SEEDS) {
    const v = validateBundle(s);
    if (!v.ok) continue;
    const m = v.bundle.manifest;
    const cur = await get(`${P}/${s.id}`, tok);
    const ver = Number(cur?.live) || 1; // first-party code is updated in place; clients re-fetch bundles on every app load
    writes.push(patchW(`${P}/${s.id}`, {
      id: s.id, name: m.name, nameZh: m.nameZh || '', desc: m.description, descZh: m.descriptionZh || '', icon: m.icon || '', category: m.category,
      caps: m.capabilities, perms: m.permissions, version: m.version, creatorUid: NEST_CREATOR.uid, listed: true, deleted: false,
      live: ver, draftV: ver, pendingV: 0, review: 'approved', safeV: ver, verified: true, featured: !!s.featured, firstParty: true,
      shotsN: s.shots.length, video: s.video || '', publishedAt: cur?.publishedAt || now, updatedAt: now,
    }));
    writes.push(setW(`${P}/${s.id}/versions/${ver}`, { manifest: m, html: v.bundle.html, css: v.bundle.css, js: v.bundle.js, size: v.size, at: now, by: NEST_CREATOR.uid }));
    s.shots.forEach((img, i) => writes.push(setW(`${P}/${s.id}/media/s${i}`, { img })));
  }
  writes.push(setW('nestMeta/plugins', { seedV: SEED_VERSION, at: now }));
  await commit(writes, tok);
  storeCache = null; seededAt = Date.now();
}

// ---------- store listing ----------
let storeCache = null;
async function loadAll(tok, { fresh = false } = {}) {
  if (!fresh && storeCache && Date.now() - storeCache.at < 15e3) return storeCache;
  const [plugins, creators] = await Promise.all([listCollection(P, tok), listCollection('nestCreators', tok)]);
  storeCache = { at: Date.now(), plugins: plugins.map((x) => ({ ...x.data, id: x.id })), creators: Object.fromEntries(creators.map((x) => [x.id, x.data])) };
  return storeCache;
}
// Public view of a profile (never family / school / email). `pfp` kept as an alias of `photo` for older clients.
export const publicCreator = (c) => { const p = publicProfile(c); return p ? { ...p, pfp: p.photo } : null; };

async function store(c, tok) {
  await ensureSeeds(tok).catch(() => {});
  const all = await loadAll(tok);
  const list = all.plugins.filter((p) => isListed(p, all.creators[p.creatorUid])).map((p) => card(p, all.creators));
  return json(200, { plugins: list, categories: CATEGORIES });
}

export const reviewKey = async (uid) => (await sha256hex(`nest-rk|${uid}`)).slice(0, 16);
async function reviewsOf(pid, tok, all, me = '') {
  const rows = (await listCollection(`${P}/${pid}/reviews`, tok, 400)).map((x) => x.data).filter((r) => r && r.stars);
  rows.sort((a, b) => b.at - a.at);
  return Promise.all(rows.slice(0, 60).map(async (r) => ({
    key: await reviewKey(r.uid), mine: r.uid === me, stars: r.stars, text: r.text || '', at: r.at, edited: !!r.edited,
    by: all.creators[r.uid]?.handle && !all.creators[r.uid]?.banned ? `@${all.creators[r.uid].handle}` : await anonLabel(r.uid),
    verified: !!(all.creators[r.uid]?.handle && !all.creators[r.uid]?.banned && all.creators[r.uid]?.verified),
  })));
}

async function detail(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  const all = await loadAll(tok);
  const p = all.plugins.find((x) => x.id === id);
  const admin = isAdminClaims(c);
  const own = p?.creatorUid === c.uid;
  if (!p || p.deleted || (!isListed(p, all.creators[p.creatorUid]) && !own && !admin)) throw err(404, 'not_found');
  const [reviews, media, inst] = await Promise.all([
    reviewsOf(id, tok, all, c.uid),
    Promise.all(Array.from({ length: Math.min(LISTING_LIMITS.shots, Number(p.shotsN) || 0) }, (_, i) => get(`${P}/${id}/media/s${i}`, tok).catch(() => null))),
    get(`${P}/${id}/installs/${c.uid}`, tok).catch(() => null),
  ]);
  const ownerView = own || profileId(c.uid) === p.creatorUid;
  const ver = await get(`${P}/${id}/versions/${versionFor(p, { uid: c.uid, admin }) || p.live}`, tok).catch(() => null);
  return json(200, {
    plugin: { ...card(p, all.creators), liveV: Number(p.live) || 0, changelog: (Array.isArray(p.changelog) ? p.changelog : []).slice(0, 10).map((x) => ({ version: String(x.version || ''), notes: String(x.notes || ''), at: Number(x.at) || 0 })), video: p.video || '', listed: isListed(p, all.creators[p.creatorUid]), size: ver?.size || 0, settings: ver?.manifest?.settings || [], tab: ver?.manifest?.tab || null, widget: ver?.manifest?.widget || null,
      ...(ver?.manifest ? { perms: ver.manifest.permissions || p.perms || [], caps: ver.manifest.capabilities || p.caps || [], reasons: ver.manifest.permissionReasons || {}, domains: ver.manifest.network?.domains || [], features: ver.manifest.features || '' } : {}),
      ...(typeof p.features === 'string' && p.listingAt ? { features: p.features } : {}), links: Array.isArray(p.links) ? p.links.slice(0, LISTING_LIMITS.links) : [],
      ...(ownerView ? { mine: true, listingReview: p.listingReview || '', listingRejectReason: p.listingRejectReason || '', listingAt: Number(p.listingAt) || 0, needsReview: needsListingReview(p, isSafe) } : {}) },
    shots: media.map((m) => m?.img).filter(Boolean), shotAlts: media.filter((m) => m?.img).map((m) => String(m.alt || '')), reviews, creator: publicCreator(all.creators[p.creatorUid]),
    myReview: reviews.find((r) => r.mine) || null, installed: !!inst && !inst.removed, canReview: !!inst && !own,
  });
}

async function creatorPage(c, tok, b) {
  const h = normHandle(b.handle);
  if (!HANDLE_RE.test(h)) throw err(400, 'bad_handle');
  const all = await loadAll(tok);
  const cr = Object.values(all.creators).find((x) => x.handle === h && !x.banned);
  if (!cr) throw err(404, 'not_found');
  const banner = cr.hasBanner ? (await get(`nestCreators/${cr.uid}/media/banner`, tok).catch(() => null))?.img || '' : '';
  const prof = { ...publicCreator(cr), banner };
  return json(200, { creator: prof, profile: prof, mine: profileId(c.uid) === cr.uid, plugins: all.plugins.filter((p) => p.creatorUid === cr.uid && isListed(p, cr)).map((p) => card(p, all.creators)) });
}

// ---------- unified profile (Settings 個人資料 = creator profile) ----------
async function ownProfile(id, tok, cur) {
  const d = cur === undefined ? await get(`nestCreators/${id}`, tok) : cur;
  if (!d) return null;
  const banner = d.hasBanner ? (await get(`nestCreators/${id}/media/banner`, tok).catch(() => null))?.img || '' : '';
  return { ...publicProfile({ ...d, banned: false }), banner, banned: !!d.banned };
}
async function profileMe(c, tok) {
  return json(200, { profile: await ownProfile(profileId(c.uid), tok) });
}
async function profileCheck(c, tok, b) {
  limit(c, 'hcheck', 60, 60e3);
  const h = normHandle(b.handle);
  const p = handleProblem(h, { admin: isAdminClaims(c) });
  if (p) return json(200, { ok: false, reason: p });
  const taken = await get(`nestHandles/${h}`, tok);
  return json(200, { ok: !taken || taken.uid === profileId(c.uid), reason: taken && taken.uid !== profileId(c.uid) ? 'handle_taken' : '' });
}
export async function saveProfilePatch(id, tok, patch) {
  const cur = await get(`nestCreators/${id}`, tok);
  if (cur?.banned) throw err(403, 'banned');
  const now = Date.now();
  const writes = [];
  if ('handle' in patch && patch.handle !== cur?.handle) {
    const taken = await get(`nestHandles/${patch.handle}`, tok);
    if (taken && taken.uid !== id) throw err(409, 'handle_taken');
    writes.push(setW(`nestHandles/${patch.handle}`, { uid: id }, taken ? undefined : { exists: false }));
    if (cur?.handle) writes.push(delW(`nestHandles/${cur.handle}`));
  }
  const doc = { ...patch };
  if ('banner' in doc) {
    writes.push(doc.banner ? setW(`nestCreators/${id}/media/banner`, { img: doc.banner }) : delW(`nestCreators/${id}/media/banner`));
    doc.hasBanner = !!doc.banner; doc.bannerAt = now; delete doc.banner;
  }
  if ('photo' in doc) doc.pfp = ''; // legacy field never shadows a removed photo
  const base = cur ? {} : { verified: false, banned: false, at: now };
  writes.push(patchW(`nestCreators/${id}`, { ...base, ...doc, uid: id, updatedAt: now }));
  try { await commit(writes, tok); } catch (e) { if (e.status === 409) throw err(409, 'handle_taken'); throw e; }
  storeCache = null;
  return ownProfile(id, tok);
}
async function profileSave(c, tok, b) {
  limit(c, 'profile', 20, 60e3);
  const patch = cleanProfilePatch(b || {}, { admin: isAdminClaims(c) });
  if (!Object.keys(patch).length) return json(200, { ok: true, profile: await ownProfile(profileId(c.uid), tok) });
  return json(200, { ok: true, profile: await saveProfilePatch(profileId(c.uid), tok, patch) });
}
// Public profile by handle (or by uid for the invite page). Only the public fields.
async function profileView(c, tok, b) {
  if (b.handle) return creatorPage(c, tok, b);
  const uid = String(b.uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
  if (!uid) throw err(400, 'bad_target');
  const d = await get(`nestCreators/${profileId(uid)}`, tok);
  const p = publicProfile(d);
  if (!p || (!p.handle && !p.verified)) throw err(404, 'not_found');
  return json(200, { profile: { ...p, pfp: p.photo } });
}
// Verified badges for a list of uids (family members, reminder chips, invites). Booleans + public handle only.
async function badges(c, tok, b) {
  const uids = (Array.isArray(b.uids) ? b.uids : []).map((x) => String(x || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128)).filter(Boolean).slice(0, 60);
  const all = await loadAll(tok);
  const out = {};
  for (const u of uids) {
    const cr = all.creators[profileId(u)];
    if (cr && !cr.banned && (cr.verified || cr.handle)) out[u] = { v: !!cr.verified, h: cr.handle || '' };
  }
  return json(200, { badges: out });
}

// ---------- bundles / installs ----------
async function bundleOf(p, v, tok) {
  const d = await get(`${P}/${p.id}/versions/${v}`, tok);
  if (!d) return null;
  return { v, manifest: d.manifest, html: d.html || '', css: d.css || '', js: d.js || '', safe: isSafe(p) && v === Number(p.live), verified: !!p.verified, dev: v !== Number(p.live) || !p.listed };
}
async function bundles(c, tok, b) {
  const want = (Array.isArray(b.ids) ? b.ids : []).slice(0, 30);
  const all = await loadAll(tok);
  const admin = isAdminClaims(c);
  const out = {};
  await Promise.all(want.map(async (w) => {
    const id = String(w?.id || w || ''); if (!ID_RE.test(id)) return;
    const p = all.plugins.find((x) => x.id === id);
    const v = versionFor(p, { uid: c.uid, admin, creatorBanned: !!all.creators[p?.creatorUid]?.banned }, w?.dev ? w.v : 0);
    if (!v) { out[id] = { removed: true }; return; }
    out[id] = await bundleOf(p, v, tok).catch(() => null) || { removed: true };
  }));
  return json(200, { bundles: out });
}

async function install(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  limit(c, 'install', 20, 60e3);
  const all = await loadAll(tok);
  const p = all.plugins.find((x) => x.id === id);
  const own = p?.creatorUid === c.uid;
  const dev = !!b.dev && (own || isAdminClaims(c));
  const v = versionFor(p, { uid: c.uid, admin: isAdminClaims(c), creatorBanned: !!all.creators[p?.creatorUid]?.banned }, dev ? (b.v || p?.draftV) : 0);
  if (!v) throw err(404, 'not_found');
  const bun = await bundleOf(p, v, tok);
  if (!bun) throw err(404, 'not_found');
  // Server-enforced consent: every declared permission must be in `granted`, and a plugin not labelled Safe needs
  // the explicit "not verified by Nest" acknowledgement.
  const perms = bun.manifest?.permissions || [];
  const granted = (Array.isArray(b.granted) ? b.granted : []).filter((x) => perms.includes(x));
  if (perms.some((x) => !granted.includes(x))) throw err(412, 'needs_permission_approval');
  if (!bun.safe && b.acceptUnverified !== true) throw err(412, 'needs_unverified_ack');
  // Connected accounts / family records on a plugin Nest has not labelled Safe: a second, explicit acknowledgement.
  const high = perms.filter((x) => HIGH_DATA.includes(x));
  if (!bun.safe && high.length && b.acceptHighRisk !== true) throw err(412, 'needs_high_risk_ack');
  const prev = await get(`${P}/${id}/installs/${c.uid}`, tok);
  const writes = [setW(`${P}/${id}/installs/${c.uid}`, { at: prev?.at || Date.now(), v, granted, ack: !bun.safe, ackHigh: !bun.safe && high.length ? high : [], dev, removed: false, updatedAt: Date.now() })];
  const counted = (!prev || prev.removed) && !dev;
  if (counted) writes.push(incW(`${P}/${id}`, 'installs', 1));
  await commit(writes, tok);
  if (counted) storeCache = null;
  return json(200, { ok: true, bundle: bun, granted });
}
async function uninstall(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  // Uninstall: install record marked removed (permissions revoked: granted = []), install count decremented once.
  const prev = await get(`${P}/${id}/installs/${c.uid}`, tok);
  if (prev && !prev.removed) {
    const w = [patchW(`${P}/${id}/installs/${c.uid}`, { removed: true, granted: [], updatedAt: Date.now() })];
    if (!prev.dev) w.push(incW(`${P}/${id}`, 'installs', -1));
    await commit(w, tok);
    storeCache = null;
  }
  return json(200, { ok: true });
}

// ---------- reviews / reports ----------
async function recomputeRating(pid, tok) {
  const rows = (await listCollection(`${P}/${pid}/reviews`, tok, 2000)).map((x) => x.data).filter((r) => r?.stars >= 1);
  await commit([patchW(`${P}/${pid}`, { ratingSum: rows.reduce((a, r) => a + Number(r.stars), 0), ratingCount: rows.length })], tok);
  storeCache = null;
}
async function review(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  limit(c, 'review', 8, 60e3);
  const me = await get(`nestCreators/${c.uid}`, tok);
  if (me?.banned) throw err(403, 'banned');
  const p = await get(`${P}/${id}`, tok);
  if (!p || p.deleted) throw err(404, 'not_found');
  if (p.creatorUid === c.uid) throw err(403, 'own_plugin');
  const inst = await get(`${P}/${id}/installs/${c.uid}`, tok);
  if (!inst) throw err(403, 'install_first');
  if (b.remove) { await commit([delW(`${P}/${id}/reviews/${c.uid}`)], tok); await recomputeRating(id, tok); return json(200, { ok: true }); }
  const stars = Math.round(Number(b.stars));
  if (!(stars >= 1 && stars <= 5)) throw err(400, 'bad_stars');
  const text = String(b.text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, LIMITS.review);
  const prev = await get(`${P}/${id}/reviews/${c.uid}`, tok);
  await commit([setW(`${P}/${id}/reviews/${c.uid}`, { uid: c.uid, stars, text, at: Date.now(), firstAt: prev?.firstAt || prev?.at || Date.now(), edited: !!prev })], tok);
  await recomputeRating(id, tok);
  return json(200, { ok: true });
}
async function report(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  limit(c, 'report', 5, 10 * 60e3);
  // Reviews are identified publicly by an opaque key (never the reviewer's uid); resolve it here.
  let reviewUid = '';
  if (b.reviewKey) {
    const key = String(b.reviewKey).replace(/[^a-f0-9]/g, '').slice(0, 16);
    for (const r of (await listCollection(`${P}/${id}/reviews`, tok, 2000)).map((x) => x.data)) if (r?.uid && await reviewKey(r.uid) === key) { reviewUid = r.uid; break; }
    if (!reviewUid) throw err(404, 'not_found');
  }
  const reason = String(b.reason || '').trim().slice(0, 400);
  if (!reason) throw err(400, 'reason_required');
  const rid = `r${Date.now().toString(36)}${(await sha256hex(`${c.uid}|${id}|${reviewUid}|${Date.now()}`)).slice(0, 8)}`;
  await commit([setW(`nestPluginReports/${rid}`, { kind: reviewUid ? 'review' : 'plugin', pid: id, reviewUid, reason, by: c.uid, at: Date.now(), status: 'open' })], tok);
  return json(200, { ok: true });
}

// ---------- creators / studio ----------
async function me(c, tok) {
  const [cr, all] = await Promise.all([get(`nestCreators/${profileId(c.uid)}`, tok), loadAll(tok, { fresh: true })]);
  const mine = all.plugins.filter((p) => (p.creatorUid === c.uid || p.creatorUid === profileId(c.uid)) && !p.deleted).map((p) => ({
    ...card(p, all.creators), listed: isListed(p, cr), live: Number(p.live) || 0, draftV: Number(p.draftV) || 0, pendingV: Number(p.pendingV) || 0,
    review: p.review || 'none', rejectReason: p.rejectReason || '', video: p.video || '', pendingNotes: p.pendingNotes || '',
    changelog: (Array.isArray(p.changelog) ? p.changelog : []).slice(0, 10),
  }));
  return json(200, { creator: cr ? { ...publicCreator(cr), banned: !!cr.banned } : null, plugins: mine.sort((a, b) => b.updatedAt - a.updatedAt) });
}
// Studio "creator profile" = the same unified profile (handle, bio, photo). Kept for older clients.
async function creatorSave(c, tok, b) {
  limit(c, 'creator', 10, 60e3);
  const patch = cleanProfilePatch({ handle: b.handle, bio: b.bio, ...(b.name != null ? { name: b.name } : {}) }, { admin: isAdminClaims(c) });
  if (b.pfp !== undefined) {
    const photo = b.pfp ? (cleanProfilePatch({ photo: b.pfp }).photo || '') : '';
    if (photo || !b.pfp) patch.photo = photo; else if (cleanIcon(b.pfp)) patch.photo = cleanIcon(b.pfp); else throw err(400, 'bad_pfp');
  }
  const prof = await saveProfilePatch(profileId(c.uid), tok, patch);
  return json(200, { ok: true, creator: { ...prof, pfp: prof.photo } });
}

async function save(c, tok, b) {
  limit(c, 'save', 20, 60e3);
  const cr = await get(`nestCreators/${c.uid}`, tok);
  if (!cr?.handle) throw err(409, 'needs_profile');
  if (cr.banned) throw err(403, 'banned');
  const v = validateBundle(b.bundle);
  if (!v.ok) return json(400, { error: 'invalid_bundle', errors: v.errors.slice(0, 12) });
  const m = v.bundle.manifest;
  const pid = m.id;
  const p = await get(`${P}/${pid}`, tok);
  if (p && p.creatorUid !== c.uid) throw err(409, 'id_taken');
  if (p?.deleted) throw err(409, 'id_taken');
  // Icons / screenshots / video
  const icon = cleanIcon(m.icon) || p?.icon || '';
  // Once the creator has edited the published listing (listing editor), Studio saves no longer overwrite its screenshots.
  const shotsIn = Array.isArray(b.shots) && !(Number(p?.live) && p?.listingAt) ? b.shots.slice(0, LIMITS.shots) : null;
  const shots = shotsIn ? shotsIn.map(cleanShot) : null;
  if (shots && shots.some((x) => !x)) throw err(400, 'bad_screenshot');
  const video = b.video != null ? cleanVideo(b.video) : p?.video || '';
  if (b.video && !video) throw err(400, 'bad_video');
  const now = Date.now();
  const draftV = Number(p?.draftV) || 0;
  const frozen = draftV && (draftV === Number(p?.live) || draftV === Number(p?.pendingV));
  const ver = !draftV ? 1 : frozen ? draftV + 1 : draftV;
  const writes = [
    setW(`${P}/${pid}/versions/${ver}`, { manifest: { ...m, icon }, html: v.bundle.html, css: v.bundle.css, js: v.bundle.js, size: v.size, at: now, by: c.uid }),
    p ? patchW(`${P}/${pid}`, { draftV: ver, updatedAt: now, ...(Number(p.live) ? {} : { name: m.name, nameZh: m.nameZh || '', desc: m.description, descZh: m.descriptionZh || '', icon, category: m.category, caps: m.capabilities, perms: m.permissions, version: m.version }), video, ...(shots ? { shotsN: shots.length } : {}) })
      : setW(`${P}/${pid}`, { id: pid, name: m.name, nameZh: m.nameZh || '', desc: m.description, descZh: m.descriptionZh || '', icon, category: m.category, caps: m.capabilities, perms: m.permissions, version: m.version,
        creatorUid: c.uid, listed: false, deleted: false, live: 0, draftV: ver, pendingV: 0, review: 'none', safeV: 0, verified: false, featured: false, firstParty: false,
        installs: 0, ratingSum: 0, ratingCount: 0, shotsN: shots ? shots.length : 0, video, createdAt: now, updatedAt: now, publishedAt: 0 }, { exists: false }),
  ];
  if (shots) {
    shots.forEach((img, i) => writes.push(setW(`${P}/${pid}/media/s${i}`, { img })));
    for (let i = shots.length; i < LIMITS.shots; i++) writes.push(delW(`${P}/${pid}/media/s${i}`));
  }
  try { await commit(writes, tok); } catch (e) { if (e.status === 409) throw err(409, 'id_taken'); throw e; }
  storeCache = null;
  return json(200, { ok: true, id: pid, v: ver, size: v.size });
}
async function submit(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  limit(c, 'submit', 6, 60e3);
  const p = await get(`${P}/${id}`, tok);
  if (!p || p.deleted || p.creatorUid !== c.uid) throw err(404, 'not_found');
  const cr = await get(`nestCreators/${c.uid}`, tok);
  if (cr?.banned) throw err(403, 'banned');
  if (!Number(p.draftV)) throw err(409, 'nothing_to_submit');
  if (Number(p.draftV) === Number(p.live)) throw err(409, 'already_live');
  // An update of a published plugin needs a new version string and a short changelog (shown to users after approval).
  const notes = cleanChangelog(b.changelog);
  if (Number(p.live) > 0) {
    if (!notes) throw err(400, 'changelog_required');
    const [dv, lv] = await Promise.all([get(`${P}/${id}/versions/${p.draftV}`, tok), get(`${P}/${id}/versions/${p.live}`, tok)]);
    if (dv?.manifest?.version && lv?.manifest?.version && dv.manifest.version === lv.manifest.version) throw err(409, 'bump_version');
  }
  await commit([
    patchW(`${P}/${id}`, { pendingV: Number(p.draftV), pendingNotes: notes, review: 'pending', rejectReason: '', submittedAt: Date.now(), updatedAt: Date.now() }),
    patchW(`${P}/${id}/versions/${p.draftV}`, { notes }),
  ], tok);
  storeCache = null;
  return json(200, { ok: true, review: 'pending', v: Number(p.draftV), update: Number(p.live) > 0 });
}
async function removeOwn(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  const p = await get(`${P}/${id}`, tok);
  if (!p || p.creatorUid !== c.uid) throw err(404, 'not_found');
  await commit([patchW(`${P}/${id}`, { deleted: true, listed: false, pendingV: 0, review: 'none', updatedAt: Date.now() })], tok);
  storeCache = null;
  return json(200, { ok: true });
}


// ---------- published listing editor (owner only; src/lib/plugins/listing.js) ----------
// Body: { id, descZh?, desc?, features?, category?, links?, icon?, shots?: [{keep:i|img, alt}] }.
// Normal plugins: applied to the live listing now. Safe / Verified / first-party: stored as listingPending + media/q{i}
// until an admin approves (admin-action approve-listing / reject-listing); the live listing stays as it was.
const LISTING_FIELDS = ['descZh', 'desc', 'features', 'category', 'links', 'icon'];
// Owner check (pure, unit-tested): only the plugin's creator (the official account acts for the first-party "Nest" creator).
export function listingAccess(p, uid, { banned = false } = {}) {
  if (!p || p.deleted) return 'not_found';
  if (!uid || p.creatorUid !== profileId(uid)) return 'not_owner';
  if (banned) return 'banned';
  if (!Number(p.live)) return 'not_published';
  return '';
}
// Pure plan of the change (unit-tested): ops = [{ set|del|patch: path, data }]. keptImgs[i] = current image for patch.shots[i].keep.
export function listingOps(p, patch, keptImgs = [], { now = Date.now(), uid = '' } = {}) {
  const id = p.id; const review = needsListingReview(p, isSafe);
  const ops = [];
  const fields = Object.fromEntries(LISTING_FIELDS.filter((k) => k in patch).map((k) => [k, patch[k]]));
  let shotsN;
  if (patch.shots) {
    const final = patch.shots.map((x, i) => ({ img: 'keep' in x ? keptImgs[i] || '' : x.img, alt: x.alt || '' }));
    if (final.some((x) => !x.img)) throw err(409, 'shot_missing');
    const pre = review ? 'q' : 's';
    final.forEach((x, i) => ops.push({ set: `${P}/${id}/media/${pre}${i}`, data: x }));
    for (let i = final.length; i < LISTING_LIMITS.shots; i++) ops.push({ del: `${P}/${id}/media/${pre}${i}` });
    shotsN = final.length;
  }
  if (review) ops.push({ patch: `${P}/${id}`, data: { listingPending: { ...fields, ...(shotsN != null ? { shotsN } : {}), at: now, by: uid }, listingReview: 'pending', listingRejectReason: '', updatedAt: now } });
  else ops.push({ patch: `${P}/${id}`, data: { ...fields, ...(shotsN != null ? { shotsN } : {}), listingAt: now, listingReview: '', updatedAt: now } });
  return { ops, review, shotsN };
}
const opsToWrites = (ops) => ops.map((o) => (o.set ? setW(o.set, o.data) : o.del ? delW(o.del) : patchW(o.patch, o.data)));
async function listingSave(c, tok, b) {
  limit(c, 'listing', 12, 60e3);
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  const p = await get(`${P}/${id}`, tok);
  const cr = p ? await get(`nestCreators/${p.creatorUid}`, tok) : null;
  const denied = listingAccess(p ? { ...p, id } : null, c.uid, { banned: !!cr?.banned });
  if (denied) throw err(denied === 'not_found' ? 404 : denied === 'not_published' ? 409 : 403, denied);
  const current = Math.min(LISTING_LIMITS.shots, Number(p.shotsN) || 0);
  const { patch, errors } = cleanListingPatch(b, { current, currentIcon: p.icon || '' });
  if (errors.length) return json(400, { error: 'invalid_listing', errors });
  if (!Object.keys(patch).length) return json(200, { ok: true, review: 'none', unchanged: true });
  const kept = patch.shots ? (await Promise.all(patch.shots.map((x) => ('keep' in x ? get(`${P}/${id}/media/s${x.keep}`, tok).catch(() => null) : null)))).map((d) => d?.img || '') : [];
  const plan = listingOps({ ...p, id }, patch, kept, { now: Date.now(), uid: c.uid });
  await commit(opsToWrites(plan.ops), tok);
  storeCache = null;
  return json(200, { ok: true, review: plan.review ? 'pending' : 'applied', shots: plan.shotsN ?? current });
}

// ---------- Studio projects (owner only, under the caller's uid) ----------
const PRJ_RE = /^p[0-9a-f]{12}$/;
const prjBase = (uid) => `nestStudio/${uid}/projects`;
const randHex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');
const PID_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const pidOf = (bundle) => (PID_RE.test(String(bundle?.manifest?.id || '')) ? bundle.manifest.id : '');
async function listMasked(path, tok, fields) {
  const q = fields.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fetch(`https://firestore.googleapis.com/v1/${DOCS()}/${path}?pageSize=100&${q}`, { headers: { authorization: `Bearer ${tok}` } });
  if (!r.ok) throw err(502, 'list_failed');
  return ((await r.json()).documents || []).map((x) => ({ id: x.name.split('/').pop(), data: decFields(x.fields) }));
}
const prjMeta = (d) => ({ id: d.id, name: d.name || '', pid: d.pid || '', icon: d.icon || '', vn: Number(d.vn) || 0, turnN: Number(d.turnN) || 0, createdAt: Number(d.createdAt) || 0, updatedAt: Number(d.updatedAt) || 0 });
const smallIcon = (b) => { const i = String(b?.manifest?.icon || ''); return /^data:image\//.test(i) && i.length <= 12000 ? i : ''; };
async function needPrj(c, tok, id) {
  if (!PRJ_RE.test(String(id || ''))) throw err(400, 'bad_id');
  const d = await get(`${prjBase(c.uid)}/${id}`, tok);
  if (!d) throw err(404, 'not_found');
  return d;
}
async function prjList(c, tok) {
  const rows = await listMasked(prjBase(c.uid), tok, ['id', 'name', 'pid', 'icon', 'vn', 'turnN', 'createdAt', 'updatedAt']);
  return json(200, { projects: rows.map((x) => prjMeta({ ...x.data, id: x.id })).sort((a, b) => b.updatedAt - a.updatedAt) });
}
async function prjGet(c, tok, b) {
  const d = await needPrj(c, tok, b.id);
  const th = await get(`${prjBase(c.uid)}/${d.id}/thread/main`, tok).catch(() => null);
  return json(200, { project: { ...prjMeta(d), summary: d.summary || '', sumN: Number(d.sumN) || 0, vlist: Array.isArray(d.vlist) ? d.vlist : [] }, bundle: parseBundleJson(d.bundleJson || ''), turns: Array.isArray(th?.turns) ? th.turns : [] });
}
function versionWrites(c, d, bundle, kind, msg, now) {
  const n = (Number(d?.vn) || 0) + 1;
  const bj = bundleJson(bundle);
  const entry = { n, kind, msg: String(msg || '').slice(0, PROJECT_LIMITS.msg), at: now, size: bj.length };
  const vlist = [...(Array.isArray(d?.vlist) ? d.vlist : []), entry];
  const drop = vlist.length > PROJECT_LIMITS.versions ? vlist.splice(0, vlist.length - PROJECT_LIMITS.versions) : [];
  return { n, vlist, bj, writes: [setW(`${prjBase(c.uid)}/${d.id}/versions/${n}`, { ...entry, bundleJson: bj }), ...drop.map((x) => delW(`${prjBase(c.uid)}/${d.id}/versions/${x.n}`))] };
}
const KINDS = ['ai', 'manual', 'restore', 'import', 'template'];
async function prjCreate(c, tok, b) {
  limit(c, 'prj-create', 10, 60e3);
  const existing = await listMasked(prjBase(c.uid), tok, ['id']);
  if (existing.length >= PROJECT_LIMITS.projects) throw err(409, 'too_many_projects');
  const id = `p${randHex(6)}`;
  const now = Date.now();
  const bundle = b.bundle ? cleanWorkingBundle(b.bundle) : null;
  if (b.bundle && !bundle) throw err(413, 'too_big');
  const d = { id, uid: c.uid, name: projectName(b.name, 'Plugin'), pid: pidOf(bundle), icon: smallIcon(bundle), summary: '', sumN: 0, vn: 0, vlist: [], turnN: 0, createdAt: now, updatedAt: now, bundleJson: bundle ? bundleJson(bundle) : '' };
  const writes = [];
  if (bundle) {
    const v = versionWrites(c, d, bundle, KINDS.includes(b.kind) ? b.kind : 'import', b.msg || '', now);
    d.vn = v.n; d.vlist = v.vlist; writes.push(...v.writes);
  }
  writes.unshift(setW(`${prjBase(c.uid)}/${id}`, d, { exists: false }));
  writes.push(setW(`${prjBase(c.uid)}/${id}/thread/main`, { turns: [] }));
  await commit(writes, tok);
  return json(200, { ok: true, project: { ...prjMeta(d), summary: '', sumN: 0, vlist: d.vlist } });
}
// One AI turn, a manual save, a restore or a template: append turns, optionally a new version of the working copy.
async function prjCommit(c, tok, b) {
  limit(c, 'prj-commit', 40, 60e3);
  const d = await needPrj(c, tok, b.id);
  const now = Date.now();
  const writes = [];
  const patch = { updatedAt: now };
  let n = 0;
  if (b.bundle) {
    const bundle = cleanWorkingBundle(b.bundle);
    if (!bundle) throw err(413, 'too_big');
    if (bundleJson(bundle) !== (d.bundleJson || '')) {
      const v = versionWrites(c, d, bundle, KINDS.includes(b.kind) ? b.kind : 'manual', b.msg || '', now);
      n = v.n; writes.push(...v.writes);
      Object.assign(patch, { bundleJson: v.bj, vn: v.n, vlist: v.vlist, pid: pidOf(bundle) || d.pid || '', icon: smallIcon(bundle) });
    }
  }
  const turns = (Array.isArray(b.turns) ? b.turns : []).slice(0, 6).map(cleanTurn).filter(Boolean).map((t) => (t.role === 'ai' && n && !t.err ? { ...t, v: n } : t));
  if (turns.length) {
    const th = await get(`${prjBase(c.uid)}/${d.id}/thread/main`, tok).catch(() => null);
    const all = [...(Array.isArray(th?.turns) ? th.turns : []), ...turns];
    const dropped = Math.max(0, all.length - PROJECT_LIMITS.turns);
    writes.push(setW(`${prjBase(c.uid)}/${d.id}/thread/main`, { turns: all.slice(dropped) }));
    patch.turnN = (Number(d.turnN) || 0) + turns.length;
    if (dropped) patch.sumN = Math.max(0, (Number(b.sumN ?? d.sumN) || 0) - dropped);
  }
  if (typeof b.summary === 'string') { patch.summary = b.summary.slice(0, PROJECT_LIMITS.summary); if (patch.sumN === undefined) patch.sumN = Math.max(0, Math.min(PROJECT_LIMITS.turns, Number(b.sumN) || 0)); }
  if (b.name) patch.name = projectName(b.name, d.name);
  writes.push(patchW(`${prjBase(c.uid)}/${d.id}`, patch));
  await commit(writes, tok);
  const nd = { ...d, ...patch };
  return json(200, { ok: true, v: n, project: { ...prjMeta(nd), summary: nd.summary || '', sumN: Number(nd.sumN) || 0, vlist: Array.isArray(nd.vlist) ? nd.vlist : [] } });
}
async function prjRename(c, tok, b) {
  const d = await needPrj(c, tok, b.id);
  const name = projectName(b.name, d.name);
  await commit([patchW(`${prjBase(c.uid)}/${d.id}`, { name, updatedAt: Date.now() })], tok);
  return json(200, { ok: true, name });
}
async function prjDelete(c, tok, b) {
  const d = await needPrj(c, tok, b.id);
  const writes = [delW(`${prjBase(c.uid)}/${d.id}/thread/main`), ...(Array.isArray(d.vlist) ? d.vlist : []).map((x) => delW(`${prjBase(c.uid)}/${d.id}/versions/${x.n}`)), delW(`${prjBase(c.uid)}/${d.id}`)];
  for (let i = 0; i < writes.length; i += 400) await commit(writes.slice(i, i + 400), tok);
  return json(200, { ok: true });
}
async function prjVersion(c, tok, b) {
  const d = await needPrj(c, tok, b.id);
  const n = Math.round(Number(b.n));
  if (!(d.vlist || []).some((x) => x.n === n)) throw err(404, 'no_version');
  const v = await get(`${prjBase(c.uid)}/${d.id}/versions/${n}`, tok);
  if (!v) throw err(404, 'no_version');
  return json(200, { n, kind: v.kind, msg: v.msg || '', at: v.at, bundle: parseBundleJson(v.bundleJson || '') });
}

// ---------- admin ----------
async function adminLog(c, action, target, detail) {
  const entry = { at: Date.now(), by: c.email, action, target, detail: String(detail || '').slice(0, 300) };
  await ledgerTx((doc) => ({ entries: [[['log'], [entry, ...(doc.log || [])].slice(0, 300)]], result: true })).catch(() => {});
}
async function adminList(c, tok) {
  const all = await loadAll(tok, { fresh: true });
  const reports = (await listCollection('nestPluginReports', tok, 500)).map((x) => ({ ...x.data, id: x.id })).filter((r) => r.status === 'open').sort((a, b) => b.at - a.at);
  const plugins = all.plugins.filter((p) => !p.deleted).map((p) => ({
    ...card(p, all.creators), listed: isListed(p, all.creators[p.creatorUid]), rawListed: !!p.listed, live: Number(p.live) || 0, draftV: Number(p.draftV) || 0, pendingV: Number(p.pendingV) || 0,
    review: p.review || 'none', rejectReason: p.rejectReason || '', submittedAt: Number(p.submittedAt) || 0, safeV: Number(p.safeV) || 0,
    isUpdate: Number(p.live) > 0 && Number(p.pendingV) > 0, pendingNotes: p.pendingNotes || '',
    listingPending: p.listingReview === 'pending' && p.listingPending ? { ...p.listingPending, by: undefined } : null,
    creatorBanned: !!all.creators[p.creatorUid]?.banned,
  })).sort((a, b) => (b.pendingV || b.listingPending ? 1 : 0) - (a.pendingV || a.listingPending ? 1 : 0) || b.updatedAt - a.updatedAt);
  const creators = Object.values(all.creators).map((x) => ({ uid: x.uid, handle: x.handle, name: x.name || '', bio: x.bio || '', pfp: x.photo || x.pfp || '', verified: !!x.verified, banned: !!x.banned, plugins: all.plugins.filter((p) => p.creatorUid === x.uid && !p.deleted).length }));
  return json(200, { plugins, reports, creators });
}
async function adminVersion(c, tok, b) {
  const id = String(b.id || ''); if (!ID_RE.test(id)) throw err(400, 'bad_id');
  const p = await get(`${P}/${id}`, tok);
  if (!p) throw err(404, 'not_found');
  const v = Number(b.v) || Number(p.pendingV) || Number(p.live) || Number(p.draftV);
  const [ver, media] = await Promise.all([get(`${P}/${id}/versions/${v}`, tok), Promise.all(Array.from({ length: Math.min(LIMITS.shots, Number(p.shotsN) || 0) }, (_, i) => get(`${P}/${id}/media/s${i}`, tok).catch(() => null)))]);
  if (!ver) throw err(404, 'no_version');
  const pendingShots = b.listing && p.listingPending?.shotsN != null ? (await Promise.all(Array.from({ length: p.listingPending.shotsN }, (_, i) => get(`${P}/${id}/media/q${i}`, tok).catch(() => null)))).map((m) => m?.img).filter(Boolean) : null;
  return json(200, { pendingShots, v, live: Number(p.live) || 0, version: { manifest: ver.manifest, html: ver.html, css: ver.css, js: ver.js, size: ver.size, at: ver.at, notes: ver.notes || '' }, shots: media.map((m) => m?.img).filter(Boolean), video: p.video || '' });
}
export const ADMIN_PLUGIN_ACTIONS = ['approve-listing', 'reject-listing', 'approve', 'reject', 'unpublish', 'republish', 'verify', 'safe', 'feature', 'verify-creator', 'ban', 'resolve-report', 'delete-review'];
async function adminAction(c, tok, b) {
  const type = String(b.type || '');
  if (!ADMIN_PLUGIN_ACTIONS.includes(type)) throw err(400, 'bad_action');
  const id = String(b.id || '');
  const on = b.on !== false;
  const reason = String(b.reason || '').trim().slice(0, 300);
  const uid = String(b.uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
  const now = Date.now();
  const needP = async () => { if (!ID_RE.test(id)) throw err(400, 'bad_id'); const p = await get(`${P}/${id}`, tok); if (!p) throw err(404, 'not_found'); return p; };
  let detail = '';
  if (type === 'approve') {
    const p = await needP();
    const v = Number(b.v) || Number(p.pendingV);
    if (!v) throw err(409, 'nothing_pending');
    const ver = await get(`${P}/${id}/versions/${v}`, tok);
    if (!ver) throw err(404, 'no_version');
    const m = ver.manifest;
    const changelog = [{ v, version: m.version || '', notes: String(ver.notes || p.pendingNotes || '').slice(0, 500), at: now }, ...(Array.isArray(p.changelog) ? p.changelog : []).filter((x) => x && x.v !== v)].slice(0, 20);
    await commit([patchW(`${P}/${id}`, { changelog, pendingNotes: '', live: v, pendingV: 0, review: 'approved', rejectReason: '', listed: true, name: m.name, nameZh: m.nameZh || '', ...(p.listingAt ? {} : { desc: m.description || '', descZh: m.descriptionZh || '', icon: m.icon || p.icon || '', category: m.category }), caps: m.capabilities, perms: m.permissions, version: m.version, reasons: m.permissionReasons || {}, domains: m.network?.domains || [], publishedAt: p.publishedAt || now, updatedAt: now, ...(b.keepSafe && Number(p.safeV) ? { safeV: v } : {}) })], tok);
    detail = `v${v} (${m.version})`;
  } else if (type === 'approve-listing') {
    const p = await needP();
    const L = p.listingPending;
    if (!L || p.listingReview !== 'pending') throw err(409, 'nothing_pending');
    const writes = [];
    if (L.shotsN != null) {
      const q = await Promise.all(Array.from({ length: L.shotsN }, (_, i) => get(`${P}/${id}/media/q${i}`, tok).catch(() => null)));
      if (q.some((x) => !x?.img)) throw err(409, 'shot_missing');
      q.forEach((x, i) => writes.push(setW(`${P}/${id}/media/s${i}`, { img: x.img, alt: x.alt || '' })));
      for (let i = L.shotsN; i < LISTING_LIMITS.shots; i++) writes.push(delW(`${P}/${id}/media/s${i}`));
    }
    for (let i = 0; i < LISTING_LIMITS.shots; i++) writes.push(delW(`${P}/${id}/media/q${i}`));
    const fields = Object.fromEntries(LISTING_FIELDS.filter((k) => k in L).map((k) => [k, L[k]]));
    writes.push(patchW(`${P}/${id}`, { ...fields, ...(L.shotsN != null ? { shotsN: L.shotsN } : {}), listingPending: null, listingReview: 'approved', listingAt: now, updatedAt: now }));
    await commit(writes, tok);
    detail = `listing (${Object.keys(fields).join(', ') || '-'}${L.shotsN != null ? `, ${L.shotsN} screenshots` : ''})`;
  } else if (type === 'reject-listing') {
    const p = await needP();
    if (!p.listingPending) throw err(409, 'nothing_pending');
    if (!reason) throw err(400, 'reason_required');
    const writes = Array.from({ length: LISTING_LIMITS.shots }, (_, i) => delW(`${P}/${id}/media/q${i}`));
    writes.push(patchW(`${P}/${id}`, { listingPending: null, listingReview: 'rejected', listingRejectReason: reason, updatedAt: now }));
    await commit(writes, tok);
    detail = `listing · ${reason}`;
  } else if (type === 'reject') {
    const p = await needP();
    if (!reason) throw err(400, 'reason_required');
    await commit([patchW(`${P}/${id}`, { pendingV: 0, review: 'rejected', rejectReason: reason, updatedAt: now })], tok);
    detail = `v${p.pendingV || '?'} · ${reason}`;
  } else if (type === 'unpublish' || type === 'republish') {
    const p = await needP();
    if (type === 'republish' && !Number(p.live)) throw err(409, 'never_approved');
    await commit([patchW(`${P}/${id}`, { listed: type === 'republish', updatedAt: now, ...(reason ? { unpublishReason: reason } : {}) })], tok);
    detail = reason;
  } else if (type === 'verify' || type === 'feature') {
    await needP();
    await commit([patchW(`${P}/${id}`, { [type === 'verify' ? 'verified' : 'featured']: on })], tok);
    detail = on ? 'on' : 'off';
  } else if (type === 'safe') {
    const p = await needP();
    if (on && !Number(p.live)) throw err(409, 'never_approved');
    await commit([patchW(`${P}/${id}`, { safeV: on ? Number(p.live) : 0 })], tok);
    detail = on ? `on (v${p.live})` : 'off';
  } else if (type === 'verify-creator' || type === 'ban') {
    if (!uid) throw err(400, 'bad_target');
    const cr = await get(`nestCreators/${uid}`, tok);
    if (!cr) throw err(404, 'not_found');
    if (type === 'ban' && uid === NEST_CREATOR.uid) throw err(400, 'cannot_ban_nest');
    await commit([patchW(`nestCreators/${uid}`, { [type === 'ban' ? 'banned' : 'verified']: on, updatedAt: now })], tok);
    detail = `${on ? 'on' : 'off'} @${cr.handle}${reason ? ` · ${reason}` : ''}`;
  } else if (type === 'resolve-report') {
    const rid = String(b.rid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 40);
    if (!rid) throw err(400, 'bad_target');
    await commit([patchW(`nestPluginReports/${rid}`, { status: 'resolved', resolvedBy: c.email, resolvedAt: now, note: reason })], tok);
    detail = `${rid}${reason ? ` · ${reason}` : ''}`;
  } else if (type === 'delete-review') {
    await needP();
    if (!uid) throw err(400, 'bad_target');
    await commit([delW(`${P}/${id}/reviews/${uid}`)], tok);
    await recomputeRating(id, tok);
    detail = `review by ${uid.slice(0, 6)}…`;
  }
  storeCache = null;
  await adminLog(c, `plugin-${type}`, id || uid, detail);
  return json(200, { ok: true });
}

// ---------- router (called by api/ops.js for op=plug-*) ----------
const USER_OPS = { store, detail, creator: creatorPage, profile: profileView, 'profile-me': profileMe, 'profile-save': profileSave, 'profile-check': profileCheck, badges, bundle: bundles, install, uninstall, review, report, me, 'creator-save': creatorSave, save, submit, remove: removeOwn,
  listing: listingSave, 'prj-list': prjList, 'prj-get': prjGet, 'prj-create': prjCreate, 'prj-commit': prjCommit, 'prj-rename': prjRename, 'prj-delete': prjDelete, 'prj-version': prjVersion };
const STORE_OPS = new Set(['store', 'detail', 'bundle', 'install', 'review', 'report', 'badges']);
const STUDIO_OPS = new Set(['save', 'submit', 'listing', 'creator-save', 'prj-list', 'prj-get', 'prj-create', 'prj-commit', 'prj-rename', 'prj-delete', 'prj-version']);
export const PROFILE_WRITE_OPS = new Set(['profile-save', 'creator-save']);
const ADMIN_OPS = { 'admin-list': adminList, 'admin-version': adminVersion, 'admin-action': adminAction };
export async function pluginOps(op, req) {
  const name = op.slice(5);
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const c = await callerOf(req);
  if (ADMIN_OPS[name]) {
    if (!isAdminClaims(c)) return json(404, { error: 'not_found' });
  } else if (!USER_OPS[name]) return json(404, { error: 'not_found' });
  if (!c) return json(401, { error: 'unauthorized' });
  if (/@(system|waitlist)\.heynest\.invalid$/i.test(c.email)) return json(403, { error: 'forbidden' });
  // Admin config gate (maintenance / suspended / revoked / feature flags pluginStore + studio). Admins bypass.
  if (!ADMIN_OPS[name]) {
    const { gate } = await import('./_admin.js');
    const g = await gate(c, { admin: isAdminClaims(c), feature: STUDIO_OPS.has(name) ? 'studio' : STORE_OPS.has(name) ? 'pluginStore' : null });
    if (g) return g;
  }
  // Run 10 ('@mum' incident): public-profile writes need the real-app marker the client sends only from /app or /admin
  // (never from the landing demo). Old cached clients without it get origin_required (reload fixes it).
  if (PROFILE_WRITE_OPS.has(name) && req.headers.get('x-nest-origin') !== 'app') return json(403, { error: 'origin_required' });
  const body = await req.json().catch(() => ({}));
  const tok = await sa();
  try {
    return await (ADMIN_OPS[name] || USER_OPS[name])(c, tok, body || {});
  } catch (e) {
    return json(e.status && e.status < 600 ? e.status : 500, { error: String(e.message || 'error').split(' ')[0], ...(e.detail ? { detail: e.detail } : {}) });
  }
}
