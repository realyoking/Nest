import { isTestDomainEmail } from './test-domains.js';
// Unified identity (2026-10-18): ONE public profile record per user = server collection nestCreators/{uid}
// (handle, name, photo, banner, bio, links, verified). Settings → 個人資料 (name + photo) and the plugin creator profile
// both read and write it through /api/plugins/profile-*. The public view exposes ONLY these fields + listed plugins —
// never family, school, email or anything else. Pure helpers shared by browser, server and tests.
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
export const RESERVED_HANDLES = ['nest', 'admin', 'nestteam', 'official', 'support', 'heynest', 'moderator', 'system', 'root', 'help', 'api', 'beta', 'test'];
export const PROFILE_LIMITS = { name: 40, bio: 160, links: 4, linkLabel: 24, linkUrl: 200, photo: 70_000, banner: 160_000 };
export const PUBLIC_FIELDS = ['uid', 'handle', 'name', 'photo', 'banner', 'bio', 'links', 'verified'];

export const normHandle = (h) => String(h || '').trim().toLowerCase().replace(/^@/, '');
export function handleProblem(h, { admin = false } = {}) {
  const x = normHandle(h);
  if (!x) return 'handle_required';
  if (!HANDLE_RE.test(x)) return 'bad_handle';
  if (!admin && RESERVED_HANDLES.includes(x)) return 'handle_taken';
  return '';
}
const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const IMG = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const cleanImage = (v, max) => (typeof v === 'string' && IMG.test(v) && v.length <= max ? v : '');
export function cleanLinks(list) {
  const out = [];
  for (const l of Array.isArray(list) ? list : []) {
    const url = String(l?.url || '').trim();
    let u; try { u = new URL(url); } catch { continue; }
    if (u.protocol !== 'https:' || url.length > PROFILE_LIMITS.linkUrl || u.username || u.password) continue;
    out.push({ label: clean(l.label || u.hostname.replace(/^www\./, ''), PROFILE_LIMITS.linkLabel), url: u.href });
    if (out.length >= PROFILE_LIMITS.links) break;
  }
  return out;
}
// Partial update: only the keys present in `b` are validated and returned. Throws { code } on a bad value.
export function cleanProfilePatch(b = {}, { admin = false } = {}) {
  const out = {};
  const bad = (code) => { throw Object.assign(new Error(code), { status: 400, code }); };
  if ('handle' in b) { const p = handleProblem(b.handle, { admin }); if (p) throw Object.assign(new Error(p), { status: p === 'handle_taken' ? 409 : 400, code: p }); out.handle = normHandle(b.handle); }
  if ('name' in b) out.name = clean(b.name, PROFILE_LIMITS.name);
  if ('bio' in b) out.bio = String(b.bio ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, PROFILE_LIMITS.bio);
  if ('photo' in b) { out.photo = b.photo ? cleanImage(b.photo, PROFILE_LIMITS.photo) : ''; if (b.photo && !out.photo) bad('bad_photo'); }
  if ('banner' in b) { out.banner = b.banner ? cleanImage(b.banner, PROFILE_LIMITS.banner) : ''; if (b.banner && !out.banner) bad('bad_banner'); }
  if ('links' in b) out.links = cleanLinks(b.links);
  return out;
}
// What anyone else may see. Older creator records stored the picture as `pfp`.
export function publicProfile(c) {
  if (!c || c.banned) return null;
  return { uid: c.uid, handle: c.handle || '', name: c.name || '', photo: c.photo || c.pfp || '', banner: c.banner || '', bio: c.bio || '', links: Array.isArray(c.links) ? c.links : [], verified: !!c.verified };
}
// Account kinds — ONE definition for admin Overview, Users tab, Home admin card and promo eligibility.
export const OFFICIAL_EMAIL = 'nest@official.heynest.invalid';
export function accountKind(email) {
  const e = String(email || '').trim().toLowerCase();
  if (e === OFFICIAL_EMAIL) return 'official';
  if (/@(system|waitlist)\.heynest\.invalid$/.test(e)) return 'system';
  if (isTestDomainEmail(e) || /@example\.(com|org|net)$/.test(e)) return 'test'; // RFC 2606 example domains are never real users
  return 'real';
}

// Settings → 更改密碼: at least 10 characters with letters and digits. → '' | 'short' | 'mix'
export const pwProblem = (pw) => (String(pw || '').length < 10 ? 'short' : !/[A-Za-z]/.test(pw) || !/\d/.test(pw) ? 'mix' : '');
