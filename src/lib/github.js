// Client side of the GitHub connection (Run 13). Every call goes to /api/github/:op (api/_github.js via ops.js) with the
// user's Firebase ID token. The browser never sees a GitHub token: the server keeps them encrypted and acts on our behalf.
import { call } from './calendar.js';
import { MOCK } from './backend.js';

let cache = { at: 0, st: null };
const listeners = new Set();
export const onGithubChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const changed = (st) => { cache = { at: Date.now(), st }; listeners.forEach((f) => { try { f(st); } catch {} }); };
// Synchronous last-known status (agent context reads this; null until the first fetch).
export const cachedGithub = () => cache.st;

const MOCK_ST = { configured: false, allowed: false, why: 'not_configured', connected: false };
export async function githubStatus({ maxAge = 60e3 } = {}) {
  if (MOCK) return MOCK_ST;
  if (cache.st && Date.now() - cache.at < maxAge) return cache.st;
  const st = await call('/api/github/status', {});
  changed(st);
  return st;
}
// Starts the OAuth flow: the server hands back a short-lived signed URL; navigating to it sets the state cookie and
// redirects to GitHub, which returns to /api/github/callback and then to 連接 (?svc=github&github=connected).
export async function githubConnect() {
  const { url } = await call('/api/github/start', {});
  if (!/^(https:\/\/heynest\.vercel\.app)?\/api\/github\/start\?t=/.test(url || '')) throw Object.assign(new Error('bad_start'), { code: 'bad_start' });
  window.location.assign(url);
}
export async function githubDisconnect() { const r = await call('/api/github/disconnect', {}); changed({ ...(cache.st || {}), connected: false, login: '' }); return r; }
export async function githubRefresh() { const st = await call('/api/github/refresh', {}); changed(st); return st; }
export async function githubParental(uid, allow) { const r = await call('/api/github/parental', { uid, allow }); cache.at = 0; return r; }
export async function githubTool(tool, args = {}, { confirm = false } = {}) {
  try { return (await call('/api/github/tool', { tool, args, confirm })).result; }
  catch (e) { if (['github_reauth', 'github_not_connected'].includes(e.code)) changed({ ...(cache.st || {}), connected: false }); throw e; }
}

export { GH_READ, GH_WRITE, GH_TYPES, validGithubAction, githubArgs, githubNote, ghNeedsConfirm, ghIsRead } from './github-core.js';
