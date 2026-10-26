// GitHub connection (Run 13) — served by api/ops.js through the vercel.json rewrite
//   /api/github/:op → /api/ops?op=github-:op        (NO extra serverless function: 12/12 on Hobby)
// OAuth App, callback EXACTLY https://heynest.vercel.app/api/github/callback (unchanged after the Run 15 move to nesty.cyou:
// the start/callback hop always runs on heynest.vercel.app — /api/* is exempt from the host 301 — and then returns to the
// origin the user started from, carried in the signed ticket/state as `o`). Env (Vercel, never in code):
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, TOKEN_ENC_KEY (32 random bytes, base64 — shared with the Google flow).
// Missing env → every op answers a graceful "not_configured" (JSON 503, or a redirect back to 連接 for browser GETs), never 404.
//
// Tokens: the app uses "Expire user access tokens" — access_token (~8 h) + refresh_token (~6 months). Both are encrypted
// together with AES-256-GCM (TOKEN_ENC_KEY, AAD "nest-gh1|<uid>") and stored ONLY server-side, in the doc of the system
// account nest-github@system.heynest.invalid (users/{systemUid}: only the server can sign in as it). They never reach the
// browser or an AI prompt. getAccess() refreshes ~10 min before expiry; a failed refresh marks the account disconnected.
// OAuth state = HMAC-SHA256-signed {uid, nonce, exp}, bound to an HttpOnly cookie holding the nonce (login-CSRF guard).
// Who may connect: admins, the family owner, or an adult parent; a student / minor only after the family owner turns on
// the parental switch (allow.<uid>). Admin feature flag `github` (admin-config FLAGS) switches the whole thing off.
// Every write tool needs `confirm: true` (sent only after the user taps Confirm on the in-chat card); there are NO delete tools.
// Audit: every connect / refresh failure / disconnect / write / parental change → `log` map in the same system doc.
import { json, callerOf, isAdminClaims, fsGet, ledgerTx, readLedger } from './_ops-lib.js';
import { gate } from './_admin.js';
import { GITHUB_ORIGIN, RETURN_ORIGINS, SITE } from '../src/site.js';

export const ORIGIN = GITHUB_ORIGIN; // https://heynest.vercel.app — the registered callback host
export const CALLBACK = `${ORIGIN}/api/github/callback`;
export const SCOPES = ['repo', 'read:user', 'user:email'];
const CONN = '/app/connections';
const UA = 'Nest (+https://nesty.cyou)';
const STATE_TTL = 10 * 60e3;
const REFRESH_EARLY = 10 * 60e3;
const COOKIE = 'nest_gh';
const W = 'github'; // ledger session name → nest-github@system.heynest.invalid

const env = () => ({ id: process.env.GITHUB_CLIENT_ID || '', secret: process.env.GITHUB_CLIENT_SECRET || '', key: process.env.TOKEN_ENC_KEY || '' });
export const configured = () => { const e = env(); return !!(e.id && e.secret && e.key); };

// ---------- crypto (Web Crypto: ops.js runs on the edge runtime) ----------
const te = new TextEncoder(); const td = new TextDecoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4)), (c) => c.charCodeAt(0));
const rawKey = () => {
  const b = Uint8Array.from(atob(env().key || ''), (c) => c.charCodeAt(0));
  if (b.length !== 32) throw Object.assign(new Error('enc_key'), { status: 503 });
  return b;
};
const aesKey = () => crypto.subtle.importKey('raw', rawKey(), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function macKey() {
  const k = await crypto.subtle.importKey('raw', rawKey(), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const d = await crypto.subtle.sign('HMAC', k, te.encode('nest-github-state-v1'));
  return crypto.subtle.importKey('raw', d, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function seal(obj, uid) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(`nest-gh1|${uid}`) }, await aesKey(), te.encode(JSON.stringify(obj)));
  return `g1.${b64u(iv)}.${b64u(ct)}`;
}
export async function unseal(blob, uid) {
  const [v, iv, ct] = String(blob || '').split('.');
  if (v !== 'g1' || !iv || !ct) throw new Error('bad_blob');
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64u(iv), additionalData: te.encode(`nest-gh1|${uid}`) }, await aesKey(), unb64u(ct));
  return JSON.parse(td.decode(pt));
}
export async function signState(obj) {
  const body = b64u(te.encode(JSON.stringify(obj)));
  return `${body}.${b64u(await crypto.subtle.sign('HMAC', await macKey(), te.encode(body)))}`;
}
export async function readState(s, now = Date.now()) {
  const [body, sig] = String(s || '').split('.');
  if (!body || !sig || body.length > 2000) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await macKey(), unb64u(sig), te.encode(body)); } catch { return null; }
  if (!ok) return null;
  try { const o = JSON.parse(td.decode(unb64u(body))); return o && Number(o.exp) > now ? o : null; } catch { return null; }
}
const nonce = () => b64u(crypto.getRandomValues(new Uint8Array(18)));
const cookieOf = (req, name) => (String(req.headers.get('cookie') || '').split(/;\s*/).find((x) => x.startsWith(`${name}=`)) || '').slice(name.length + 1);

// ---------- responses ----------
const redirect = (to, headers = {}) => new Response(null, { status: 302, headers: { location: to, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', ...headers } });
// `o` = the origin the user started from (allow-listed). No `o` → relative (stays on this host, which 301s to nesty.cyou).
export const returnOrigin = (o) => (RETURN_ORIGINS.includes(o) ? (o === `https://www.${new URL(SITE).host}` ? SITE : o) : '');
const back = (code, headers, o = '') => redirect(`${returnOrigin(o)}${CONN}?svc=github&github=${encodeURIComponent(code)}`, headers);
const reqOrigin = (req) => { try { const h = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || new URL(req.url).host).split(',')[0].trim().toLowerCase(); return returnOrigin(`https://${h}`); } catch { return ''; } };
const clearCookie = `${COOKIE}=; Path=/api/github; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
function rejectPage(code) {
  const html = `<!doctype html><html lang="zh-Hant-HK"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GitHub 連接失敗 · Nest</title></head><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;line-height:1.6"><h1 style="font-size:20px">未能連接 GitHub</h1><p>這個連接要求無效或已過期（${code}），為保障帳戶安全已被拒絕。請返回 Nest 再試一次。</p><p>This GitHub sign-in request was invalid or expired and has been rejected. Go back to Nest and try again.</p><p><a href="${CONN}?svc=github">返回「連接」· Back to Connections</a></p></body></html>`;
  return new Response(html, { status: 400, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'set-cookie': clearCookie } });
}

// ---------- store ----------
const readStore = () => readLedger({ which: W, maxAge: 0 });
const tx = (mutate) => ledgerTx(mutate, { which: W });
const logKey = (now) => `${now}${Math.random().toString(36).slice(2, 6)}`;
const logEntries = (doc, e, now = Date.now()) => {
  const keys = Object.keys(doc.log || {}).sort();
  const drop = keys.length >= 500 ? keys.slice(0, keys.length - 499) : [];
  return [...drop.map((k) => [['log', k], undefined]), [['log', logKey(now)], { at: now, ...e, detail: String(e.detail || '').slice(0, 300) }]];
};
export async function auditLog(e) { await tx((doc) => ({ entries: logEntries(doc, e), result: true })).catch(() => {}); }

// ---------- who may connect ----------
export const isMinor = (birthday, now = Date.now()) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthday || ''));
  if (!m) return false;
  const d = new Date(now + 8 * 3600e3); // HKT calendar
  let age = d.getUTCFullYear() - +m[1];
  if (d.getUTCMonth() + 1 < +m[2] || (d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() < +m[3])) age -= 1;
  return age < 18;
};
// Pure decision (unit-tested): who is allowed, and why not.
export function policyFor({ admin, uid, fid, family, member, allow }) {
  if (admin) return { allowed: true, why: 'admin' };
  if (!fid || !family) return { allowed: false, why: 'no_family' };
  if (family.ownerId === uid) return { allowed: true, why: 'owner' };
  const child = member?.role !== 'parent' || isMinor(member?.birthday);
  if (!child) return { allowed: true, why: 'adult' };
  if (allow && allow.fid === fid) return { allowed: true, why: 'parental' };
  return { allowed: false, why: 'parental_required' };
}
async function familyCtx(c) {
  const prof = (await fsGet(`users/${c.uid}`, c.token).catch(() => null))?.data || {};
  const fid = prof.familyId || null;
  if (!fid) return { fid: null };
  const [fam, mem] = await Promise.all([
    fsGet(`families/${fid}`, c.token).catch(() => null), fsGet(`families/${fid}/members/${c.uid}`, c.token).catch(() => null),
  ]);
  const family = fam?.data && (fam.data.memberIds || []).includes(c.uid) ? fam.data : null;
  return { fid: family ? fid : null, family, member: mem?.data || null };
}
async function policy(c, store) {
  const f = await familyCtx(c);
  return { ...f, ...policyFor({ admin: isAdminClaims(c), uid: c.uid, fid: f.fid, family: f.family, member: f.member, allow: store?.allow?.[c.uid] }) };
}

// ---------- GitHub HTTP ----------
async function oauthToken(params) {
  const e = env();
  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': UA },
    body: JSON.stringify({ client_id: e.id, client_secret: e.secret, ...params }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error || !d.access_token) throw Object.assign(new Error(d.error || `token_${r.status}`), { status: 502, gh: d.error || '' });
  return d;
}
const tokenRecord = (d, now = Date.now()) => ({
  a: d.access_token, r: d.refresh_token || '',
  accessExp: d.expires_in ? now + Number(d.expires_in) * 1000 : null,
  refreshExp: d.refresh_token_expires_in ? now + Number(d.refresh_token_expires_in) * 1000 : null,
  scopes: String(d.scope || '').split(/[,\s]+/).filter(Boolean),
});
export async function gh(token, method, path, body, { raw = false } = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    method, headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', authorization: `Bearer ${token}`, 'user-agent': UA, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return r;
  const d = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(r.status === 401 ? 'github_reauth' : r.status === 404 ? 'github_not_found' : r.status === 403 ? 'github_forbidden' : r.status === 422 ? 'github_invalid' : 'github_error'), { status: r.status === 401 ? 401 : r.status >= 500 ? 502 : r.status, detail: String(d.message || '').slice(0, 200) });
  return d;
}

// Saved account → a usable access token (refreshing when close to expiry). Refresh failure → disconnected + audit.
export async function getAccess(uid, email, now = Date.now()) {
  const store = await readStore();
  const u = store.u?.[uid];
  if (!u || u.status !== 'connected' || !u.enc) throw Object.assign(new Error('github_not_connected'), { status: 409 });
  const t = await unseal(u.enc, uid);
  if (!t.accessExp || t.accessExp - now > REFRESH_EARLY) return { token: t.a, login: u.login };
  return { token: (await refreshNow(uid, email, t, now)).a, login: u.login };
}
async function refreshNow(uid, email, t, now = Date.now()) {
  try {
    if (!t.r || (t.refreshExp && t.refreshExp < now)) throw Object.assign(new Error('refresh_expired'), { gh: 'refresh_expired' });
    const d = await oauthToken({ grant_type: 'refresh_token', refresh_token: t.r });
    const n = tokenRecord(d, now);
    if (!n.r) n.r = t.r;
    if (!n.refreshExp) n.refreshExp = t.refreshExp;
    if (!n.scopes.length) n.scopes = t.scopes || [];
    const enc = await seal(n, uid);
    await tx((doc) => ({ entries: [[['u', uid, 'enc'], enc], [['u', uid, 'accessExp'], n.accessExp], [['u', uid, 'refreshExp'], n.refreshExp], [['u', uid, 'refreshedAt'], now]], result: true }));
    return n;
  } catch (e) {
    await tx((doc) => ({ entries: [[['u', uid], { ...(doc.u?.[uid] || {}), enc: null, status: 'disconnected', reason: 'refresh_failed', at: now }], ...logEntries(doc, { uid, email, action: 'refresh-failed', detail: String(e.gh || e.message || '') }, now)], result: true })).catch(() => {});
    throw Object.assign(new Error('github_reauth'), { status: 401 });
  }
}

// ---------- AI tools ----------
const REPO_RE = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const BRANCH_RE = /^(?!\/|.*\/\/|.*\.\.|.*\/$|.*\.lock$)[A-Za-z0-9._\/-]{1,200}$/;
const pathOk = (p) => typeof p === 'string' && p.length > 0 && p.length <= 400 && !p.startsWith('/') && !p.split('/').some((s) => s === '' || s === '.' || s === '..') && !/[\u0000-\u001f\\]/.test(p);
const MAX_FILE = 1024 * 1024; const MAX_FILES = 60;
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const b64 = (s) => { const bytes = te.encode(String(s)); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const enc = encodeURIComponent;
const repoPath = (repo) => { if (!REPO_RE.test(String(repo || ''))) throw bad('bad_repo'); return repo.split('/').map(enc).join('/'); };
const filePath = (p) => { if (!pathOk(p)) throw bad('bad_path'); return p.split('/').map(enc).join('/'); };
const slimRepo = (r) => ({ full_name: r.full_name, private: !!r.private, description: String(r.description || '').slice(0, 140), default_branch: r.default_branch, html_url: r.html_url, updated_at: r.updated_at, language: r.language || '' });

export const READ_TOOLS = ['repos.list', 'repos.search', 'file.read', 'tree.list', 'branches.list'];
export const WRITE_TOOLS = ['repo.create', 'file.put', 'files.commit', 'branch.create', 'pr.create', 'pages.enable'];

export async function runTool(token, login, tool, a = {}) {
  switch (tool) {
    case 'repos.list': {
      const d = await gh(token, 'GET', `/user/repos?per_page=30&sort=updated&affiliation=owner,collaborator,organization_member&page=${Math.max(1, Math.min(10, Number(a.page) || 1))}`);
      return { repos: d.map(slimRepo) };
    }
    case 'repos.search': {
      const q = String(a.q || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120); if (!q) throw bad('bad_query');
      const d = await gh(token, 'GET', `/search/repositories?per_page=20&q=${enc(`${q} user:${login} fork:true`)}`);
      return { repos: (d.items || []).map(slimRepo), total: d.total_count || 0 };
    }
    case 'file.read': {
      const d = await gh(token, 'GET', `/repos/${repoPath(a.repo)}/contents/${filePath(a.path)}${a.ref ? `?ref=${enc(String(a.ref).slice(0, 200))}` : ''}`);
      if (Array.isArray(d)) return { dir: d.slice(0, 200).map((x) => ({ name: x.name, path: x.path, type: x.type, size: x.size })) };
      if (d.type !== 'file') throw bad('not_a_file');
      if (d.size > 400 * 1024) return { path: d.path, size: d.size, tooLarge: true, html_url: d.html_url };
      const bin = atob(String(d.content || '').replace(/\n/g, ''));
      const text = td.decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
      return { path: d.path, size: d.size, sha: d.sha, html_url: d.html_url, content: text.slice(0, 200000), truncated: text.length > 200000 };
    }
    case 'tree.list': {
      const d = await gh(token, 'GET', `/repos/${repoPath(a.repo)}/contents/${a.path ? filePath(a.path) : ''}${a.ref ? `?ref=${enc(String(a.ref).slice(0, 200))}` : ''}`);
      return { entries: (Array.isArray(d) ? d : [d]).slice(0, 300).map((x) => ({ name: x.name, path: x.path, type: x.type, size: x.size })) };
    }
    case 'branches.list': {
      const d = await gh(token, 'GET', `/repos/${repoPath(a.repo)}/branches?per_page=100`);
      return { branches: d.map((b) => b.name) };
    }
    case 'repo.create': {
      if (!NAME_RE.test(String(a.name || ''))) throw bad('bad_name');
      const d = await gh(token, 'POST', '/user/repos', { name: a.name, description: String(a.description || '').slice(0, 300), private: a.private !== false, auto_init: a.autoInit !== false });
      return { repo: slimRepo(d) };
    }
    case 'file.put': {
      const p = filePath(a.path); const rp = repoPath(a.repo);
      const content = String(a.content ?? ''); if (te.encode(content).length > MAX_FILE) throw bad('file_too_large');
      if (a.branch && !BRANCH_RE.test(String(a.branch))) throw bad('bad_branch');
      let sha;
      try { const cur = await gh(token, 'GET', `/repos/${rp}/contents/${p}${a.branch ? `?ref=${enc(a.branch)}` : ''}`); if (!Array.isArray(cur)) sha = cur.sha; } catch (e) { if (e.message !== 'github_not_found') throw e; }
      const d = await gh(token, 'PUT', `/repos/${rp}/contents/${p}`, { message: String(a.message || `Update ${a.path} via Nest`).slice(0, 300), content: b64(content), ...(sha ? { sha } : {}), ...(a.branch ? { branch: a.branch } : {}) });
      return { path: a.path, updated: !!sha, commit: d.commit?.sha, html_url: d.content?.html_url };
    }
    case 'files.commit': {
      // Several files in ONE commit (git data API) — used to "generate a site / code into a repo".
      const rp = repoPath(a.repo);
      const files = Array.isArray(a.files) ? a.files : [];
      if (!files.length || files.length > MAX_FILES) throw bad('bad_files');
      let total = 0;
      for (const f of files) { if (!pathOk(f?.path)) throw bad('bad_path'); total += te.encode(String(f.content ?? '')).length; if (total > 4 * MAX_FILE) throw bad('files_too_large'); }
      const repo = await gh(token, 'GET', `/repos/${rp}`);
      const branch = a.branch ? String(a.branch) : repo.default_branch;
      if (!BRANCH_RE.test(branch)) throw bad('bad_branch');
      let parent = null; let baseTree;
      try { const ref = await gh(token, 'GET', `/repos/${rp}/git/ref/heads/${branch.split('/').map(enc).join('/')}`); parent = ref.object.sha; baseTree = (await gh(token, 'GET', `/repos/${rp}/git/commits/${parent}`)).tree.sha; }
      catch (e) { if (e.message !== 'github_not_found' && e.message !== 'github_invalid') throw e; }
      if (!parent) { // empty repo: the contents API creates the first commit, then continue on top of it
        const first = files[0];
        await gh(token, 'PUT', `/repos/${rp}/contents/${filePath(first.path)}`, { message: String(a.message || 'Initial commit via Nest').slice(0, 300), content: b64(first.content ?? ''), branch });
        if (files.length === 1) return { branch, files: 1 };
        const ref = await gh(token, 'GET', `/repos/${rp}/git/ref/heads/${branch.split('/').map(enc).join('/')}`); parent = ref.object.sha; baseTree = (await gh(token, 'GET', `/repos/${rp}/git/commits/${parent}`)).tree.sha;
      }
      const tree = await gh(token, 'POST', `/repos/${rp}/git/trees`, { base_tree: baseTree, tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: String(f.content ?? '') })) });
      const commit = await gh(token, 'POST', `/repos/${rp}/git/commits`, { message: String(a.message || 'Update via Nest').slice(0, 300), tree: tree.sha, parents: [parent] });
      await gh(token, 'PATCH', `/repos/${rp}/git/refs/heads/${branch.split('/').map(enc).join('/')}`, { sha: commit.sha, force: false });
      return { branch, files: files.length, commit: commit.sha, html_url: `https://github.com/${a.repo}/commit/${commit.sha}` };
    }
    case 'branch.create': {
      const rp = repoPath(a.repo);
      if (!BRANCH_RE.test(String(a.name || ''))) throw bad('bad_branch');
      const from = a.from ? String(a.from) : (await gh(token, 'GET', `/repos/${rp}`)).default_branch;
      if (!BRANCH_RE.test(from)) throw bad('bad_branch');
      const ref = await gh(token, 'GET', `/repos/${rp}/git/ref/heads/${from.split('/').map(enc).join('/')}`);
      await gh(token, 'POST', `/repos/${rp}/git/refs`, { ref: `refs/heads/${a.name}`, sha: ref.object.sha });
      return { branch: a.name, from };
    }
    case 'pr.create': {
      const rp = repoPath(a.repo);
      for (const b of [a.head, a.base]) if (!BRANCH_RE.test(String(b || ''))) throw bad('bad_branch');
      const d = await gh(token, 'POST', `/repos/${rp}/pulls`, { title: String(a.title || '').slice(0, 250) || 'Changes from Nest', head: a.head, base: a.base, body: String(a.body || '').slice(0, 20000) });
      return { number: d.number, html_url: d.html_url };
    }
    case 'pages.enable': {
      const rp = repoPath(a.repo);
      const branch = a.branch ? String(a.branch) : (await gh(token, 'GET', `/repos/${rp}`)).default_branch;
      if (!BRANCH_RE.test(branch)) throw bad('bad_branch');
      const path = a.path === '/docs' ? '/docs' : '/';
      try { const d = await gh(token, 'POST', `/repos/${rp}/pages`, { source: { branch, path } }); return { html_url: d.html_url, status: d.status || 'building' }; }
      catch (e) { if (e.status === 409 || e.message === 'github_invalid') { const d = await gh(token, 'GET', `/repos/${rp}/pages`); return { html_url: d.html_url, status: d.status, already: true }; } throw e; }
    }
    default: throw bad('unknown_tool');
  }
}
// Short, content-free description for the audit log.
const toolDetail = (tool, a = {}) => [a.repo || a.name || '', a.path || '', a.branch ? `@${a.branch}` : '', Array.isArray(a.files) ? `${a.files.length} files` : '', a.head ? `${a.head}→${a.base}` : ''].filter(Boolean).join(' ').slice(0, 200) || tool;

// ---------- ops ----------
async function statusOp(c) {
  const store = await readStore().catch(() => ({}));
  const pol = await policy(c, store);
  const u = store.u?.[c.uid];
  const out = {
    configured: configured(), allowed: pol.allowed, why: pol.why, owner: pol.why === 'owner' || (pol.family && pol.family.ownerId === c.uid),
    connected: !!(u && u.status === 'connected' && u.enc), login: u?.login || '', avatar: u?.avatar || '', scopes: u?.scopes || [],
    accessExp: u?.accessExp || null, refreshExp: u?.refreshExp || null, since: u?.since || null, reason: u?.status === 'disconnected' ? u.reason || '' : '',
  };
  if (out.owner && pol.fid) out.parental = Object.fromEntries(Object.entries(store.allow || {}).filter(([, v]) => v && v.fid === pol.fid).map(([k, v]) => [k, { at: v.at }]));
  return json(200, out, { 'cache-control': 'no-store' });
}

async function startOp(c, req) {
  const store = await readStore().catch(() => ({}));
  const pol = await policy(c, store);
  if (!pol.allowed) return json(403, { error: pol.why });
  const n = nonce();
  const o = req ? reqOrigin(req) : '';
  const ticket = await signState({ k: 'ticket', uid: c.uid, email: c.email, n, o, exp: Date.now() + 5 * 60e3 });
  // Absolute: the nonce cookie must be set on the callback host (heynest.vercel.app), whatever host the app runs on.
  return json(200, { url: `${ORIGIN}/api/github/start?t=${enc(ticket)}` }, { 'cache-control': 'no-store' });
}
// Browser navigation: ticket → cookie + redirect to GitHub's consent page.
async function startNav(url) {
  const t = await readState(url.searchParams.get('t'));
  if (!t || t.k !== 'ticket') return back(url.searchParams.get('t') ? 'expired' : 'start');
  const state = await signState({ k: 'state', uid: t.uid, email: t.email, n: t.n, o: returnOrigin(t.o), exp: Date.now() + STATE_TTL });
  const q = new URLSearchParams({ client_id: env().id, redirect_uri: CALLBACK, scope: SCOPES.join(' '), state, allow_signup: 'true' });
  return redirect(`https://github.com/login/oauth/authorize?${q}`, { 'set-cookie': `${COOKIE}=${t.n}; Path=/api/github; Max-Age=900; HttpOnly; Secure; SameSite=Lax` });
}
async function callbackOp(req, url) {
  const st = await readState(url.searchParams.get('state'));
  if (url.searchParams.get('error')) return back(url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error', { 'set-cookie': clearCookie }, st?.k === 'state' ? st.o : '');
  if (!st || st.k !== 'state') return rejectPage('bad_state');
  const ck = cookieOf(req, COOKIE);
  if (!ck || ck !== st.n) return rejectPage('state_mismatch');
  const code = String(url.searchParams.get('code') || '');
  if (!/^[A-Za-z0-9_-]{4,100}$/.test(code)) return rejectPage('bad_code');
  const now = Date.now();
  let rec; let user;
  try {
    rec = tokenRecord(await oauthToken({ code, redirect_uri: CALLBACK }), now);
    const r = await gh(rec.a, 'GET', '/user', null, { raw: true });
    if (!r.ok) throw new Error(`user_${r.status}`);
    user = await r.json();
    const hdr = r.headers.get('x-oauth-scopes'); if (hdr != null && !rec.scopes.length) rec.scopes = hdr.split(/[,\s]+/).filter(Boolean);
  } catch { return back('error', { 'set-cookie': clearCookie }, st.o); }
  const blob = await seal(rec, st.uid);
  await tx((doc) => ({
    entries: [[['u', st.uid], { status: 'connected', enc: blob, login: String(user.login || ''), ghId: Number(user.id) || 0, avatar: String(user.avatar_url || '').slice(0, 300), scopes: rec.scopes, accessExp: rec.accessExp, refreshExp: rec.refreshExp, since: now, at: now, email: st.email }],
      ...logEntries(doc, { uid: st.uid, email: st.email, action: 'connect', detail: `@${user.login} scopes=${rec.scopes.join(',')}` }, now)],
    result: true,
  }));
  return back('connected', { 'set-cookie': clearCookie }, st.o);
}
async function refreshOp(c) {
  const store = await readStore();
  const u = store.u?.[c.uid];
  if (!u || u.status !== 'connected' || !u.enc) return json(409, { error: 'github_not_connected' });
  try { await refreshNow(c.uid, c.email, await unseal(u.enc, c.uid)); } catch (e) { return json(e.status || 502, { error: e.message }); }
  return statusOp(c);
}
// Revoke the grant at GitHub (DELETE /applications/{client_id}/grant), then clear the tokens.
async function disconnectOp(c) {
  const store = await readStore();
  const u = store.u?.[c.uid];
  let revoked = false;
  if (u?.enc) {
    try {
      let t = await unseal(u.enc, c.uid);
      if (t.accessExp && t.accessExp < Date.now() && t.r) { try { t = await refreshNow(c.uid, c.email, t); } catch {} }
      const e = env();
      const r = await fetch(`https://api.github.com/applications/${enc(e.id)}/grant`, {
        method: 'DELETE', headers: { accept: 'application/vnd.github+json', authorization: `Basic ${btoa(`${e.id}:${e.secret}`)}`, 'content-type': 'application/json', 'user-agent': UA, 'x-github-api-version': '2022-11-28' },
        body: JSON.stringify({ access_token: t.a }),
      });
      revoked = r.status === 204 || r.status === 404;
    } catch {}
  }
  await tx((doc) => ({ entries: [[['u', c.uid], undefined], ...logEntries(doc, { uid: c.uid, email: c.email, action: 'disconnect', detail: revoked ? 'grant revoked' : 'tokens cleared (revoke not confirmed)' })], result: true }));
  return json(200, { ok: true, revoked });
}
async function parentalOp(c, body) {
  const target = String(body?.uid || '');
  if (!/^[A-Za-z0-9]{10,40}$/.test(target) || target === c.uid) return json(400, { error: 'bad_uid' });
  const f = await familyCtx(c);
  if (!f.fid || f.family?.ownerId !== c.uid) return json(403, { error: 'owner_only' });
  if (!(f.family.memberIds || []).includes(target)) return json(404, { error: 'not_member' });
  const allow = body?.allow === true;
  const now = Date.now();
  await tx((doc) => ({ entries: [[['allow', target], allow ? { fid: f.fid, by: c.uid, at: now } : undefined], ...(allow ? [] : doc.u?.[target]?.status === 'connected' ? [[['u', target, 'status'], 'disconnected'], [['u', target, 'enc'], null], [['u', target, 'reason'], 'parental_off']] : []), ...logEntries(doc, { uid: c.uid, email: c.email, action: allow ? 'parental-allow' : 'parental-deny', detail: target }, now)], result: true }));
  return json(200, { ok: true, uid: target, allow });
}
async function toolOp(c, body) {
  const tool = String(body?.tool || '');
  const args = body?.args && typeof body.args === 'object' ? body.args : {};
  const write = WRITE_TOOLS.includes(tool);
  if (!write && !READ_TOOLS.includes(tool)) return json(400, { error: 'unknown_tool' });
  if (write && body?.confirm !== true) return json(409, { error: 'needs_confirm' });
  const store = await readStore();
  const pol = await policy(c, store);
  if (!pol.allowed) return json(403, { error: pol.why });
  let acc;
  try { acc = await getAccess(c.uid, c.email); } catch (e) { return json(e.status || 502, { error: e.message }); }
  try {
    const result = await runTool(acc.token, acc.login, tool, args);
    if (write) await auditLog({ uid: c.uid, email: c.email, action: `tool:${tool}`, detail: toolDetail(tool, args) });
    return json(200, { ok: true, tool, result }, { 'cache-control': 'no-store' });
  } catch (e) {
    if (e.message === 'github_reauth') await tx((doc) => ({ entries: [[['u', c.uid, 'status'], 'disconnected'], [['u', c.uid, 'enc'], null], [['u', c.uid, 'reason'], 'revoked'], ...logEntries(doc, { uid: c.uid, email: c.email, action: 'token-rejected', detail: tool })], result: true })).catch(() => {});
    if (write) await auditLog({ uid: c.uid, email: c.email, action: `tool-failed:${tool}`, detail: `${toolDetail(tool, args)} · ${e.message}` });
    return json(e.status && e.status < 600 ? e.status : 502, { error: e.message, ...(e.detail ? { detail: e.detail } : {}) });
  }
}
async function auditOp(c) {
  if (!isAdminClaims(c)) return json(404, { error: 'not_found' });
  const store = await readStore().catch(() => ({}));
  const log = Object.entries(store.log || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 200).map(([, v]) => v);
  const accounts = Object.values(store.u || {}).filter(Boolean).map((u) => ({ login: u.login, email: u.email, status: u.status, since: u.since, accessExp: u.accessExp }));
  return json(200, { configured: configured(), log, accounts }, { 'cache-control': 'no-store' });
}

// Entry from api/ops.js for op = github-*.
export async function githubOps(op, req, url) {
  const sub = op.slice('github-'.length);
  const nav = req.method === 'GET' && (sub === 'start' || sub === 'callback');
  // A callback with a bad / forged / expired state is rejected before anything else (needs only TOKEN_ENC_KEY).
  if (sub === 'callback' && req.method === 'GET' && !url.searchParams.get('error') && env().key) {
    let st = null; try { st = await readState(url.searchParams.get('state')); } catch {}
    if (!st || st.k !== 'state') return rejectPage('bad_state');
  }
  if (!configured()) {
    if (nav) return back('not_configured', sub === 'callback' ? { 'set-cookie': clearCookie } : {});
    if (sub === 'status') { const c = await callerOf(req); if (!c) return json(401, { error: 'unauthorized' }); return json(200, { configured: false, allowed: false, why: 'not_configured', connected: false }, { 'cache-control': 'no-store' }); }
    return json(503, { error: 'not_configured' });
  }
  if (sub === 'start' && req.method === 'GET') return startNav(url);
  if (sub === 'callback' && req.method === 'GET') return callbackOp(req, url);
  const c = await callerOf(req);
  if (!c) return json(401, { error: 'unauthorized' });
  if (sub === 'audit' && req.method === 'GET') return auditOp(c);
  if (sub === 'status' && (req.method === 'GET' || req.method === 'POST')) {
    const g = await gate(c, { admin: isAdminClaims(c), feature: 'github' });
    if (g) { const b = await g.clone().json().catch(() => ({})); return json(200, { configured: true, allowed: false, why: b.error || 'blocked', connected: false }, { 'cache-control': 'no-store' }); }
    return statusOp(c);
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (sub !== 'disconnect') { const g = await gate(c, { admin: isAdminClaims(c), feature: 'github' }); if (g) return g; }
  const body = await req.json().catch(() => ({}));
  if (sub === 'start') return startOp(c, req);
  if (sub === 'refresh') return refreshOp(c);
  if (sub === 'disconnect') return disconnectOp(c);
  if (sub === 'parental') return parentalOp(c, body);
  if (sub === 'tool') return toolOp(c, body);
  return json(404, { error: 'not_found' });
}
