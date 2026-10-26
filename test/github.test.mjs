import './_env.mjs';
// Run 13 — GitHub connection via api/ops.js (op=github-*): not-configured fallback, signed state + cookie binding,
// encrypted server-side token store, auto-refresh / refresh failure → disconnected, policy (owner / adult / parental),
// confirm-gated write tools, revoke on disconnect, audit, feature flag. Google + GitHub are mocked in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { docs, idToken } = await import('./fixtures/google-mock.mjs');
const { policyFor, isMinor, seal, unseal, signState, readState, READ_TOOLS, WRITE_TOOLS, CALLBACK, SCOPES } = await import('../api/_github.js');
const ops = (await import('../api/ops.js')).default;
const D = 'projects/nest-test-project/databases/(default)/documents';
const put = (path, fields) => docs.set(`${D}/${path}`, { fields, updateTime: `seed${Math.random()}` });

// ---- GitHub mock ----
const gh = { calls: [], tokenN: 0, refreshFail: false, revoked: [], files: {}, userStatus: 200 };
const prevFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' ? input : input.url);
  const J = (status, body, headers = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  if (url.startsWith('https://github.com/login/oauth/access_token')) {
    const b = JSON.parse(init.body); gh.calls.push(['token', b.grant_type || 'code']);
    assert.equal(b.client_secret, 'test-gh-secret');
    if (b.grant_type === 'refresh_token') { if (gh.refreshFail) return J(200, { error: 'bad_refresh_token' }); gh.tokenN += 1; return J(200, { access_token: `ghu_new${gh.tokenN}`, expires_in: 28800, refresh_token: `ghr_new${gh.tokenN}`, refresh_token_expires_in: 15811200, scope: 'repo,read:user,user:email' }); }
    if (b.code !== 'goodcode') return J(200, { error: 'bad_verification_code' });
    assert.equal(b.redirect_uri, 'https://heynest.vercel.app/api/github/callback');
    return J(200, { access_token: 'ghu_first', expires_in: 28800, refresh_token: 'ghr_first', refresh_token_expires_in: 15811200, scope: 'repo,read:user,user:email', token_type: 'bearer' });
  }
  if (url.startsWith('https://api.github.com/')) {
    const path = url.slice('https://api.github.com'.length); const m = init.method || 'GET';
    gh.calls.push([m, path, (init.headers?.authorization || '').slice(0, 14)]);
    if (path.startsWith('/applications/')) { gh.revoked.push(JSON.parse(init.body).access_token); assert.match(init.headers.authorization, /^Basic /); return J(204); }
    if (path === '/user') return J(gh.userStatus, { login: 'octo-kid', id: 42, avatar_url: 'https://avatars.githubusercontent.com/u/42' }, { 'x-oauth-scopes': 'repo, read:user, user:email' });
    if (path.startsWith('/user/repos') && m === 'GET') return J(200, [{ full_name: 'octo-kid/site', private: false, default_branch: 'main', html_url: 'https://github.com/octo-kid/site' }]);
    if (path === '/user/repos' && m === 'POST') { const b = JSON.parse(init.body); return J(201, { full_name: `octo-kid/${b.name}`, private: b.private, default_branch: 'main' }); }
    if (/\/contents\//.test(path) && m === 'GET') { const k = path.split('/contents/')[1].split('?')[0]; return gh.files[k] ? J(200, { type: 'file', path: k, sha: 'oldsha', size: 5, content: Buffer.from(gh.files[k]).toString('base64') }) : J(404, { message: 'Not Found' }); }
    if (/\/contents\//.test(path) && m === 'PUT') { const k = path.split('/contents/')[1]; const b = JSON.parse(init.body); gh.files[k] = Buffer.from(b.content, 'base64').toString(); return J(200, { commit: { sha: 'c1' }, content: { html_url: 'x' } }); }
    return J(404, { message: 'Not Found' });
  }
  return prevFetch(input, init);
};

process.env.TOKEN_ENC_KEY = Buffer.alloc(32, 9).toString('base64');
const call = async (path, { method = 'GET', token, body, cookie, host = 'heynest.vercel.app' } = {}) => {
  const r = await ops(new Request(`https://${host}${path}`, { method, redirect: 'manual', headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, text: t, json: j, headers: r.headers };
};

// family: owner (14, student, but owner), adult parent, student child
put('users/ownerUid0001', { familyId: 'fam1', role: 'student' });
put('users/parentUid001', { familyId: 'fam1', role: 'parent' });
put('users/childUid0001', { familyId: 'fam1', role: 'student' });
put('families/fam1', { ownerId: 'ownerUid0001', memberIds: ['ownerUid0001', 'parentUid001', 'childUid0001'] });
put('families/fam1/members/ownerUid0001', { role: 'student', birthday: '2012-01-01' });
put('families/fam1/members/parentUid001', { role: 'parent', birthday: '1980-05-05' });
put('families/fam1/members/childUid0001', { role: 'student', birthday: '2013-03-03' });
const OWNER = await idToken('owner@nest-test.invalid', 'ownerUid0001');
const PARENT = await idToken('parent@nest-test.invalid', 'parentUid001');
const CHILD = await idToken('child@nest-test.invalid', 'childUid0001');
const ghStore = () => docs.get(`${D}/users/uid_nestgithub`)?.fields || {};

test('pure: policy, minors, seal/unseal bound to uid, signed state with expiry', async () => {
  assert.equal(policyFor({ admin: true }).allowed, true);
  assert.equal(policyFor({ uid: 'a', fid: null }).why, 'no_family');
  assert.equal(policyFor({ uid: 'a', fid: 'f', family: { ownerId: 'a' }, member: { role: 'student' } }).why, 'owner');
  assert.equal(policyFor({ uid: 'b', fid: 'f', family: { ownerId: 'a' }, member: { role: 'parent', birthday: '1980-01-01' } }).why, 'adult');
  assert.equal(policyFor({ uid: 'b', fid: 'f', family: { ownerId: 'a' }, member: { role: 'parent', birthday: '2012-01-01' } }).why, 'parental_required'); // minor "parent"
  assert.equal(policyFor({ uid: 'c', fid: 'f', family: { ownerId: 'a' }, member: { role: 'student' } }).why, 'parental_required');
  assert.equal(policyFor({ uid: 'c', fid: 'f', family: { ownerId: 'a' }, member: { role: 'student' }, allow: { fid: 'f' } }).why, 'parental');
  assert.equal(policyFor({ uid: 'c', fid: 'f', family: { ownerId: 'a' }, member: { role: 'student' }, allow: { fid: 'other' } }).allowed, false);
  assert.ok(isMinor('2010-12-31', Date.parse('2026-10-19T12:00:00+08:00')) && !isMinor('2008-10-19', Date.parse('2026-10-19T12:00:00+08:00')) && !isMinor(''));
  const blob = await seal({ a: 'secret-access' }, 'u1');
  assert.ok(!blob.includes('secret-access'));
  assert.equal((await unseal(blob, 'u1')).a, 'secret-access');
  await assert.rejects(unseal(blob, 'u2')); // AAD binds the blob to its user
  const st = await signState({ uid: 'u1', exp: Date.now() + 1000 });
  assert.equal((await readState(st)).uid, 'u1');
  assert.equal(await readState(st.slice(0, -2) + 'xx'), null);
  assert.equal(await readState(await signState({ uid: 'u1', exp: Date.now() - 1 })), null);
  assert.equal(CALLBACK, 'https://heynest.vercel.app/api/github/callback');
  assert.deepEqual(SCOPES, ['repo', 'read:user', 'user:email']);
  assert.ok(READ_TOOLS.length && WRITE_TOOLS.length && ![...READ_TOOLS, ...WRITE_TOOLS].some((t) => /delete|remove/.test(t)), 'no delete tools');
});

test('not configured: graceful everywhere, never 404', async () => {
  delete process.env.GITHUB_CLIENT_ID; delete process.env.GITHUB_CLIENT_SECRET;
  const s = await call('/api/ops?op=github-start');
  assert.equal(s.status, 302); assert.match(s.headers.get('location'), /\/app\/connections\?svc=github&github=not_configured/);
  const cb = await call('/api/ops?op=github-callback&code=x&state=y');
  assert.equal(cb.status, 400, 'bad state rejected even before GitHub env is set'); assert.match(cb.text, /已被拒絕/);
  assert.match((await call('/api/ops?op=github-callback&error=access_denied')).headers.get('location'), /github=not_configured/);
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST', token: OWNER })).json.error, 'not_configured');
  const st = await call('/api/ops?op=github-status', { token: OWNER });
  assert.equal(st.status, 200); assert.equal(st.json.configured, false);
  assert.equal((await call('/api/ops?op=github-status')).status, 401);
});

test('connect flow: ticket → cookie + authorize redirect; callback checks state + cookie; tokens encrypted server-side', async () => {
  process.env.GITHUB_CLIENT_ID = 'Iv1.testclient'; process.env.GITHUB_CLIENT_SECRET = 'test-gh-secret';
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST' })).status, 401);
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST', token: CHILD })).json.error, 'parental_required');
  const st0 = await call('/api/ops?op=github-status', { token: OWNER });
  assert.deepEqual([st0.json.configured, st0.json.allowed, st0.json.connected, st0.json.owner], [true, true, false, true]);
  const start = await call('/api/ops?op=github-start', { method: 'POST', token: OWNER });
  assert.equal(start.status, 200); assert.match(start.json.url, /^https:\/\/heynest\.vercel\.app\/api\/github\/start\?t=/);
  const nav = await call(start.json.url.replace('https://heynest.vercel.app/api/github/start?', '/api/ops?op=github-start&'));
  assert.equal(nav.status, 302);
  const loc = new URL(nav.headers.get('location'));
  assert.equal(loc.origin + loc.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://heynest.vercel.app/api/github/callback');
  assert.equal(loc.searchParams.get('scope'), 'repo read:user user:email');
  assert.equal(loc.searchParams.get('client_id'), 'Iv1.testclient');
  const cookie = nav.headers.get('set-cookie'); assert.match(cookie, /^nest_gh=[A-Za-z0-9_-]+; Path=\/api\/github; Max-Age=900; HttpOnly; Secure; SameSite=Lax/);
  const ck = cookie.split(';')[0]; const state = loc.searchParams.get('state');
  // bad / tampered state, missing or wrong cookie, expired ticket → rejected
  assert.equal((await call(`/api/ops?op=github-callback&code=goodcode&state=garbage`, { cookie: ck })).status, 400);
  assert.equal((await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(state.slice(0, -3) + 'abc')}`, { cookie: ck })).status, 400);
  assert.equal((await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(state)}`)).status, 400);
  assert.equal((await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(state)}`, { cookie: 'nest_gh=other' })).status, 400);
  assert.match((await call('/api/ops?op=github-start&t=bogus')).headers.get('location'), /github=expired/);
  assert.match((await call('/api/ops?op=github-callback&error=access_denied')).headers.get('location'), /github=denied/);
  // good
  const ok = await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(state)}`, { cookie: ck });
  assert.equal(ok.status, 302); assert.match(ok.headers.get('location'), /^https:\/\/heynest\.vercel\.app\/app\/connections\?svc=github&github=connected/); assert.match(ok.headers.get('set-cookie'), /Max-Age=0/);
  const u = ghStore().u.ownerUid0001;
  assert.equal(u.status, 'connected'); assert.equal(u.login, 'octo-kid');
  const raw = JSON.stringify(ghStore());
  assert.ok(!raw.includes('ghu_first') && !raw.includes('ghr_first'), 'tokens never stored in plaintext');
  assert.ok(u.accessExp > Date.now() + 7 * 3600e3 && u.refreshExp > Date.now() + 150 * 864e5);
  // status never carries a token
  const st = await call('/api/ops?op=github-status', { token: OWNER });
  assert.equal(st.json.connected, true); assert.equal(st.json.login, 'octo-kid');
  assert.ok(!/ghu_|ghr_|enc/.test(st.text));
  assert.ok(Object.values(ghStore().log).some((e) => e.action === 'connect'));
});

test('tools: reads run, writes need confirm, no deletes; auto-refresh near expiry; audit without content', async () => {
  const r = await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'repos.list' } });
  assert.equal(r.status, 200); assert.equal(r.json.result.repos[0].full_name, 'octo-kid/site');
  assert.equal(gh.calls.at(-1)[2], 'Bearer ghu_fir');
  assert.equal((await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'file.put', args: { repo: 'octo-kid/site', path: 'index.html', content: '<h1>hi</h1>' } } })).json.error, 'needs_confirm');
  assert.equal((await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'repo.delete', args: { repo: 'octo-kid/site' }, confirm: true } })).json.error, 'unknown_tool');
  assert.equal((await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'file.put', args: { repo: 'octo-kid/site', path: '../x', content: 'x' }, confirm: true } })).json.error, 'bad_path');
  const w = await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'file.put', args: { repo: 'octo-kid/site', path: 'index.html', content: '<h1>SECRETCONTENT</h1>', message: 'Add page' }, confirm: true } });
  assert.equal(w.status, 200, w.text); assert.equal(gh.files['index.html'], '<h1>SECRETCONTENT</h1>');
  const logs = Object.values(ghStore().log);
  assert.ok(logs.some((e) => e.action === 'tool:file.put' && /octo-kid\/site index\.html/.test(e.detail)));
  assert.ok(!JSON.stringify(logs).includes('SECRETCONTENT'));
  // force near-expiry → refresh before the call
  const { ledgerTx } = await import('../api/_ops-lib.js');
  const cur = await unseal(ghStore().u.ownerUid0001.enc, 'ownerUid0001');
  const soon = await seal({ ...cur, accessExp: Date.now() + 60e3 }, 'ownerUid0001');
  await ledgerTx(() => ({ entries: [[['u', 'ownerUid0001', 'enc'], soon]], result: true }), { which: 'github' });
  await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'repos.list' } });
  assert.deepEqual(gh.calls.filter((c) => c[0] === 'token').at(-1), ['token', 'refresh_token']);
  assert.equal(gh.calls.at(-1)[2], 'Bearer ghu_new');
  // refresh failure → disconnected
  const again = await unseal(ghStore().u.ownerUid0001.enc, 'ownerUid0001');
  await ledgerTx(() => ({ entries: [[['u', 'ownerUid0001', 'enc'], ''], [['u', 'ownerUid0001', 'enc'], null]], result: true }), { which: 'github' }).catch(() => {});
  await ledgerTx(async () => ({ entries: [[['u', 'ownerUid0001', 'enc'], await seal({ ...again, accessExp: Date.now() - 1 }, 'ownerUid0001')]], result: true }), { which: 'github' });
  gh.refreshFail = true;
  const f = await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'repos.list' } });
  assert.equal(f.status, 401); assert.equal(f.json.error, 'github_reauth');
  assert.equal(ghStore().u.ownerUid0001.status, 'disconnected'); assert.equal(ghStore().u.ownerUid0001.enc, null);
  assert.ok(Object.values(ghStore().log).some((e) => e.action === 'refresh-failed'));
  gh.refreshFail = false;
});

test('parental control: only the owner switches it; child can connect after; off disconnects the child', async () => {
  assert.equal((await call('/api/ops?op=github-parental', { method: 'POST', token: PARENT, body: { uid: 'childUid0001', allow: true } })).json.error, 'owner_only');
  assert.equal((await call('/api/ops?op=github-parental', { method: 'POST', token: OWNER, body: { uid: 'strangerUid99', allow: true } })).status, 404);
  assert.equal((await call('/api/ops?op=github-parental', { method: 'POST', token: OWNER, body: { uid: 'childUid0001', allow: true } })).status, 200);
  assert.equal((await call('/api/ops?op=github-status', { token: CHILD })).json.why, 'parental');
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST', token: CHILD })).status, 200);
  assert.ok('childUid0001' in (await call('/api/ops?op=github-status', { token: OWNER })).json.parental);
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST', token: PARENT })).status, 200); // adult parent
  await call('/api/ops?op=github-parental', { method: 'POST', token: OWNER, body: { uid: 'childUid0001', allow: false } });
  assert.equal((await call('/api/ops?op=github-start', { method: 'POST', token: CHILD })).json.error, 'parental_required');
  assert.ok(Object.values(ghStore().log).some((e) => e.action === 'parental-allow') && Object.values(ghStore().log).some((e) => e.action === 'parental-deny'));
});

test('disconnect revokes the grant at GitHub and clears the tokens; feature flag off blocks start', async () => {
  // reconnect owner
  const start = await call('/api/ops?op=github-start', { method: 'POST', token: OWNER });
  const nav = await call(start.json.url.replace('https://heynest.vercel.app/api/github/start?', '/api/ops?op=github-start&'));
  const state = new URL(nav.headers.get('location')).searchParams.get('state');
  await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(state)}`, { cookie: nav.headers.get('set-cookie').split(';')[0] });
  assert.equal(ghStore().u.ownerUid0001.status, 'connected');
  const d = await call('/api/ops?op=github-disconnect', { method: 'POST', token: OWNER });
  assert.equal(d.status, 200); assert.equal(d.json.revoked, true);
  assert.equal(gh.revoked.at(-1), 'ghu_first');
  assert.ok(gh.calls.some((c) => c[0] === 'DELETE' && c[1] === '/applications/Iv1.testclient/grant'));
  assert.equal(ghStore().u?.ownerUid0001, undefined);
  assert.equal((await call('/api/ops?op=github-tool', { method: 'POST', token: OWNER, body: { tool: 'repos.list' } })).json.error, 'github_not_connected');
  // admin audit view: admins only
  const ADMIN = await idToken('nest@official.heynest.invalid', 'officialUid0000000000000001', false);
  assert.equal((await call('/api/ops?op=github-audit', { token: OWNER })).status, 404);
  const a = await call('/api/ops?op=github-audit', { token: ADMIN });
  assert.equal(a.status, 200); assert.ok(a.json.log.some((e) => e.action === 'disconnect')); assert.ok(!/ghu_|ghr_/.test(a.text));
  // flag off
  const { ledgerTx } = await import('../api/_ops-lib.js');
  const { dropConfigCache } = await import('../api/_admin.js').catch(() => ({}));
  await ledgerTx((doc) => ({ entries: [[['cfg'], { ...(doc.cfg || {}), flags: { ...(doc.cfg?.flags || {}), github: false } }]], result: true }), { which: 'config' });
  dropConfigCache?.();
  const blocked = await call('/api/ops?op=github-start', { method: 'POST', token: OWNER });
  assert.equal(blocked.status, 403); assert.equal(blocked.json.error, 'feature_disabled');
  assert.equal((await call('/api/ops?op=github-status', { token: OWNER })).json.why, 'feature_disabled');
  await ledgerTx((doc) => ({ entries: [[['cfg', 'flags', 'github'], true]], result: true }), { which: 'config' });
  dropConfigCache?.();
});

test('routing: vercel.json rewrite before catch-alls, still 12 functions, no hardcoded GitHub secrets', () => {
  const v = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url)));
  const i = v.rewrites.findIndex((r) => r.source === '/api/github/:op');
  assert.ok(i >= 0); assert.equal(v.rewrites[i].destination, '/api/ops?op=github-:op');
  assert.ok(i < v.rewrites.findIndex((r) => r.destination === '/spa.html'));
  const src = fs.readFileSync(new URL('../api/_github.js', import.meta.url), 'utf8');
  assert.ok(!/gh[opsu]_[A-Za-z0-9]{20,}|client_secret\s*[:=]\s*['"][^'"]+['"]/.test(src));
  const fns = fs.readdirSync(new URL('../api', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js') && !f.split('/').pop().startsWith('_'));
  assert.equal(fns.length, 12, fns.join(','));
});

test('agent side: GitHub writes always confirm, reads never; validation; prompt only when connected; notes carry no token', async () => {
  const { ghNeedsConfirm, ghIsRead, validGithubAction, githubNote, GH_TYPES } = await import('../src/lib/github-core.js');
  for (const t of ['github.createRepo', 'github.putFile', 'github.commit', 'github.branch', 'github.pr', 'github.pages']) { assert.ok(ghNeedsConfirm({ type: t }), t); assert.ok(!ghIsRead({ type: t })); }
  for (const t of ['github.repos', 'github.search', 'github.read', 'github.tree', 'github.branches']) { assert.ok(!ghNeedsConfirm({ type: t }), t); assert.ok(ghIsRead({ type: t })); }
  assert.ok(!GH_TYPES.some((t) => /delete|remove/i.test(t)));
  assert.ok(validGithubAction({ type: 'github.commit', repo: 'octo-kid/site', files: [{ path: 'index.html', content: '<h1>x</h1>' }] }));
  assert.ok(!validGithubAction({ type: 'github.commit', repo: 'bad repo', files: [{ path: 'a', content: 'x' }] }));
  assert.ok(!validGithubAction({ type: 'github.commit', repo: 'a/b', files: [] }));
  assert.ok(!validGithubAction({ type: 'github.createRepo', name: 'has space' }));
  assert.match(githubNote({ type: 'github.read', repo: 'a/b' }, { path: 'x.js', size: 3, content: 'abc' }), /file a\/b\/x\.js/);
  const { systemPrompt } = await import('../api/chat.js');
  const on = systemPrompt('chat', 'zh-Hant', { github: { connected: true, login: 'octo-kid' } });
  assert.ok(on.includes('github.commit') && on.includes('@octo-kid') && /confirm card/.test(on) && /Never delete anything/.test(on));
  assert.ok(!systemPrompt('chat', 'zh-Hant', {}).includes('github.'));
  assert.ok(!systemPrompt('chat', 'zh-Hant', { github: { connected: false } }).includes('github.'));
});

// Run 15: app on nesty.cyou — the hop still runs on heynest.vercel.app (registered callback, cookie host) and lands back on nesty.cyou.
test('github connect started on nesty.cyou returns to https://nesty.cyou/app/connections', async () => {
  const start = await call('/api/ops?op=github-start', { method: 'POST', token: OWNER, host: 'nesty.cyou' });
  assert.equal(start.status, 200); assert.match(start.json.url, /^https:\/\/heynest\.vercel\.app\/api\/github\/start\?t=/);
  const nav = await call(start.json.url.replace('https://heynest.vercel.app/api/github/start?', '/api/ops?op=github-start&'));
  const loc = new URL(nav.headers.get('location'));
  assert.equal(loc.searchParams.get('redirect_uri'), 'https://heynest.vercel.app/api/github/callback');
  const ck = nav.headers.get('set-cookie').split(';')[0];
  const ok = await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(loc.searchParams.get('state'))}`, { cookie: ck });
  assert.equal(ok.headers.get('location'), 'https://nesty.cyou/app/connections?svc=github&github=connected');
  // an unknown host never becomes a return target
  const evil = await call('/api/ops?op=github-start', { method: 'POST', token: OWNER, host: 'evil.example' });
  const nav2 = await call(evil.json.url.replace('https://heynest.vercel.app/api/github/start?', '/api/ops?op=github-start&'));
  const loc2 = new URL(nav2.headers.get('location'));
  const ok2 = await call(`/api/ops?op=github-callback&code=goodcode&state=${encodeURIComponent(loc2.searchParams.get('state'))}`, { cookie: nav2.headers.get('set-cookie').split(';')[0] });
  assert.equal(ok2.headers.get('location'), '/app/connections?svc=github&github=connected');
});
