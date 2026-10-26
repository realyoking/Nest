import './_env.mjs';
// Run 19 — op=status-all (api/_status.js): one CDN-cached call for every server-side status check, booleans only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const { statusAll, statusAllResponse, within, STATUS_HEADERS } = await import('../api/_status.js');

const ENV = { AGNES_API_KEY: 'k-secret', VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'q', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'gs-secret', TOKEN_ENC_KEY: 'e' };
const resp = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
function mockFetch(over = {}) {
  const calls = [];
  const f = async (url, opt = {}) => {
    calls.push(String(url));
    for (const [k, v] of Object.entries(over)) if (String(url).includes(k)) return typeof v === 'function' ? v(url, opt) : v;
    if (url.includes('firestore.googleapis.com')) return resp(200, { documents: [] });
    if (url.includes('agnes-ai.com/v1/models')) return resp(200, { data: [{ id: 'agnes-3.0-flash' }] });
    if (url.includes('oauth2.googleapis.com/token')) return resp(400, { error: 'invalid_grant', error_description: 'Malformed auth code.' });
    throw new Error('unexpected ' + url);
  };
  return { f, calls };
}
const base = (o = {}) => ({ env: ENV, saToken: async () => 'sa-tok', hasSA: () => true, ms: 300, ...o });

test('status-all: all healthy → booleans true, one shared SA token, minimal Firestore reads', async () => {
  const { f, calls } = mockFetch(); let tokCalls = 0;
  const out = await statusAll(base({ f, saToken: async () => { tokCalls++; return 'sa-tok'; } }));
  assert.deepEqual(Object.keys(out).sort(), ['ai', 'app', 'checkedAt', 'google', 'ok', 'push']);
  assert.equal(out.ok, true); assert.equal(out.app, true); assert.equal(out.ai, true); assert.equal(out.push, true); assert.equal(out.google, true);
  assert.ok(!Number.isNaN(Date.parse(out.checkedAt)));
  assert.equal(tokCalls, 1);
  const fsCalls = calls.filter((u) => u.includes('firestore'));
  assert.equal(fsCalls.length, 2); for (const u of fsCalls) assert.match(u, /pageSize=1&mask\.fieldPaths=__name__/);
  assert.ok(!JSON.stringify(out).includes('secret') && !JSON.stringify(out).includes('sa-tok'));
});

test('status-all: each failure flips only its own boolean', async () => {
  let o = await statusAll(base({ f: mockFetch({ 'agnes-ai.com': resp(200, { data: [{ id: 'other' }] }) }).f }));
  assert.deepEqual([o.app, o.ai, o.push, o.google, o.ok], [true, false, true, true, false]);
  o = await statusAll(base({ f: mockFetch({ 'oauth2.googleapis.com/token': resp(401, { error: 'invalid_client' }) }).f }));
  assert.deepEqual([o.app, o.ai, o.push, o.google], [true, true, true, false]);
  o = await statusAll(base({ f: mockFetch({ 'oauth2.googleapis.com/token': resp(200, { access_token: 'x' }) }).f }));
  assert.equal(o.google, false, 'a dummy code must never succeed');
  o = await statusAll(base({ f: mockFetch({ 'documents/users': resp(403, {}) }).f }));
  assert.deepEqual([o.app, o.push], [true, false]);
  o = await statusAll(base({ f: mockFetch().f, env: { ...ENV, VAPID_PRIVATE_KEY: '' } }));
  assert.deepEqual([o.app, o.push], [true, false]);
  o = await statusAll(base({ f: mockFetch().f, hasSA: () => false }));
  assert.deepEqual([o.app, o.ai, o.push, o.google], [false, true, false, true]);
  o = await statusAll(base({ f: mockFetch().f, saToken: async () => { throw new Error('sa_token_failed'); } }));
  assert.deepEqual([o.app, o.push, o.ai], [false, false, true]);
  o = await statusAll(base({ f: mockFetch().f, env: {} }));
  assert.deepEqual([o.ai, o.push, o.google], [false, false, false]);
});

test('status-all: a hanging check times out to false without delaying the others', async () => {
  const hang = (u, opt) => new Promise((_, rej) => opt.signal?.addEventListener('abort', () => rej(new Error('aborted'))));
  const t0 = Date.now();
  const o = await statusAll(base({ f: mockFetch({ 'agnes-ai.com': hang }).f, ms: 200 }));
  assert.ok(Date.now() - t0 < 1500, 'bounded by the per-check timeout');
  assert.deepEqual([o.app, o.ai, o.push, o.google], [true, false, true, true]);
  assert.equal(await within(50, () => new Promise(() => {})), false);
  assert.equal(await within(50, async () => { throw new Error('x'); }), false);
  assert.equal(await within(50, async () => 'yes'), false, 'only literal true counts');
});

test('status-all response: always 200, CDN-cacheable headers, HEAD has no body', async () => {
  const opts = base({ f: mockFetch({ 'agnes-ai.com': resp(500, {}) }).f });
  const r = await statusAllResponse(new Request('https://nesty.cyou/api/ops?op=status-all'), opts);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'public, max-age=30');
  assert.match(r.headers.get('vercel-cdn-cache-control'), /^max-age=60\b/);
  assert.match(r.headers.get('vercel-cdn-cache-control'), /stale-while-revalidate/);
  assert.ok(!r.headers.get('set-cookie')); assert.ok(!/cookie|authorization/i.test(r.headers.get('vary') || ''));
  const b = await r.json(); assert.equal(b.ai, false); assert.equal(b.ok, false);
  const h = await statusAllResponse(new Request('https://nesty.cyou/api/ops?op=status-all', { method: 'HEAD' }), opts);
  assert.equal(h.status, 200); assert.equal(await h.text(), '');
  assert.deepEqual(STATUS_HEADERS['access-control-allow-origin'], '*');
});

test('ops.js routes op=status-all (GET/HEAD) and keeps the old health ops', () => {
  const src = fs.readFileSync(new URL('../api/ops.js', import.meta.url), 'utf8');
  assert.match(src, /op === 'status-all' && \(req\.method === 'GET' \|\| req\.method === 'HEAD'\)\) return await statusAllResponse\(req\)/);
  assert.match(src, /op === 'status-ai'/); assert.match(src, /op === 'promo-health'/);
  assert.match(fs.readFileSync(new URL('../api/push/cron.js', import.meta.url), 'utf8'), /q\.get\('health'\) === '1'/);
  assert.match(fs.readFileSync(new URL('../api/oauth/callback.js', import.meta.url), 'utf8'), /p\.get\('health'\)/);
});

test('status page: only status-all for Nest functions, 2-min poll paused when hidden, 3 languages kept', () => {
  const st = fs.readFileSync(new URL('../public/status.html', import.meta.url), 'utf8');
  const api = [...st.matchAll(/['"](\/api\/[^'"]*)['"]/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(api)], ['/api/ops?op=status-all']);
  assert.ok(!/status-all[^'"]*[?&]t=/.test(st) && !/ALL \+/.test(st), 'no cache-buster on the shared URL');
  assert.ok(!st.includes("get('/app"), 'separate HEAD /app check dropped');
  assert.match(st, /EVERY = 120000/); assert.ok(!/60000\)/.test(st));
  assert.match(st, /document\.hidden\) stop\(\)/); assert.match(st, /else \{ runAll\(\); start\(\); \}/);
  for (const k of ["'zh-Hant': {", "'zh-Hans': {", 'en: {']) assert.ok(st.includes(k), k);
  for (const n of ['每 2 分鐘', '每 2 分钟', 'every 2 minutes']) assert.ok(st.includes(n), n);
  for (const id of ['website', 'app', 'ai', 'signin', 'push', 'google']) assert.ok(st.includes(`id: '${id}'`), id);
});

test('vercel.json: /api/ops is not rewritten or given no-store headers that would block the CDN', () => {
  const cfg = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  for (const h of cfg.headers) assert.ok(!/^\/api|^\/\(\.\*\)$/.test(h.source) || h.has, `header rule ${h.source}`);
  for (const r of cfg.rewrites) assert.ok(!/^\/api\/ops/.test(r.source), r.source);
});
