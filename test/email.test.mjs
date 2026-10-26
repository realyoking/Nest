import './_env.mjs';
// Run 18 — email verification by 6-digit code + Resend password-reset emails (api/_email.js, api/_email-tpl.js,
// src/lib/email-verify-core.js). In-memory Firestore / Identity Toolkit admin / OAuth token / Resend mocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { generateKeyPair, exportPKCS8 } from 'jose';
const { idToken } = await import('./fixtures/google-mock.mjs');
const { verifyEmail, resetEmail, emailLang, EMAIL_LOGO } = await import('../api/_email-tpl.js');
const core = await import('../src/lib/email-verify-core.js');
const E = await import('../api/_email.js');
const { verifyToken } = await import('../api/_ops-lib.js');

// ---- service account + mocks ----
const { privateKey } = await generateKeyPair('RS256', { extractable: true });
const SA = { client_email: 'sa@nest-test-project.iam.gserviceaccount.com', private_key_id: 'k', private_key: await exportPKCS8(privateKey) };
const store = new Map(); let tick = 0; // name → { data, updateTime }
const sent = []; const idt = []; const users = new Map();
let resendFail = false;
const mockFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' ? input : input.url);
  const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url === 'https://oauth2.googleapis.com/token') return J(200, { access_token: 'sa-token', expires_in: 3600 });
  if (url === 'https://api.resend.com/emails') {
    assert.match(init.headers.authorization, /^Bearer re_test/);
    if (resendFail) return J(500, { name: 'internal' });
    const b = JSON.parse(init.body); sent.push(b); return J(200, { id: `em_${sent.length}` });
  }
  if (url.includes('identitytoolkit.googleapis.com/v1/projects/')) {
    assert.equal(init.headers.authorization, 'Bearer sa-token');
    const b = JSON.parse(init.body); const op = url.split('/').pop(); idt.push([op, b]);
    if (op === 'accounts:lookup') return J(200, b.email ? { users: [...users.values()].filter((u) => u.email === b.email[0]) } : { users: users.has(b.localId[0]) ? [users.get(b.localId[0])] : [] });
    if (op === 'accounts:update') { const u = users.get(b.localId); u.emailVerified = b.emailVerified; return J(200, { localId: b.localId }); }
    if (op === 'accounts:sendOobCode') {
      if (![...users.values()].some((u) => u.email === b.email)) return J(400, { error: { message: 'SOMETHING_ELSE' } }); // unknown users must be caught by the lookup first
      return J(200, { email: b.email, oobLink: `https://nest-test-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=OOB-${b.email.length}&apiKey=test-api-key&lang=en` });
    }
  }
  if (url.includes('firestore.googleapis.com') && url.includes('nestEmailCodes')) {
    const name = decodeURIComponent(url.split('/v1/')[1].split('?')[0]); const d = store.get(name);
    if (!d) return J(404, { error: { status: 'NOT_FOUND' } });
    const { enc } = await import('../api/_ops-lib.js');
    return J(200, { name, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, enc(v)])), updateTime: d.updateTime });
  }
  if (url.includes('firestore.googleapis.com') && url.endsWith(':commit') && /nestEmailCodes/.test(init.body)) {
    const { decFields } = await import('../api/_ops-lib.js');
    for (const w of JSON.parse(init.body).writes) {
      const name = w.update?.name || w.delete; const cur = store.get(name); const pre = w.currentDocument || {};
      if (pre.exists === false && cur) return J(409, { error: { status: 'ALREADY_EXISTS' } });
      if (pre.updateTime && cur?.updateTime !== pre.updateTime) return J(400, { error: { status: 'FAILED_PRECONDITION' } });
      if (w.delete) store.delete(name); else store.set(name, { data: decFields(w.update.fields), updateTime: `u${++tick}` });
    }
    return J(200, {});
  }
  return mockFetch(input, init);
};
const env = (on) => { if (on) { process.env.RESEND_API_KEY = 're_test_x'; process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SA); } else { delete process.env.RESEND_API_KEY; } };
const req = (ip = '1.2.3.4') => new Request('https://nesty.cyou/api/app/x', { method: 'POST', headers: { 'x-forwarded-for': ip } });
const body = async (r) => ({ status: r.status, ...(await r.json()) });
const caller = async (email, uid, verified = false, provider = 'password') => ({ ...(await verifyToken(await idToken(email, uid, verified))), provider });
const docOf = (uid) => store.get(`projects/nest-test-project/databases/(default)/documents/nestEmailCodes/${uid}`)?.data;

// ---------- pure ----------
test('needsVerify: only NEW email/password sign-ups; Google/Apple, linked, old, test/system/official accounts skip', () => {
  const T = core.VERIFY_CUTOFF + 60e3;
  const u = (o) => ({ email: 'kid@example.com', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: { creationTime: new Date(T).toUTCString() }, ...o });
  assert.equal(core.needsVerify(u({})), true);
  assert.equal(core.needsVerify(u({ emailVerified: true })), false);
  assert.equal(core.needsVerify(u({ providerData: [{ providerId: 'google.com' }] })), false);
  assert.equal(core.needsVerify(u({ providerData: [{ providerId: 'apple.com' }] })), false);
  assert.equal(core.needsVerify(u({ providerData: [{ providerId: 'password' }, { providerId: 'google.com' }] })), false);
  assert.equal(core.needsVerify(u({ metadata: { creationTime: new Date(core.VERIFY_CUTOFF - 1000).toUTCString() } })), false, 'existing accounts are never locked out');
  for (const e of ['nest-test-owner@nest-test.invalid', 'nest-test-member@nest-test.invalid', 'nest@official.heynest.invalid', 'nest-index@system.heynest.invalid']) assert.equal(core.needsVerify(u({ email: e })), false, e);
  assert.equal(core.needsVerify(null), false); assert.equal(core.needsVerify(u({ metadata: {} })), false);
});
test('codes: 6 digits from crypto, uniform (no modulo bias), clean + constant-time compare', () => {
  const seen = new Set(); for (let i = 0; i < 300; i++) { const c = core.makeCode(); assert.match(c, /^\d{6}$/); seen.add(c); }
  assert.ok(seen.size > 290);
  let calls = 0; assert.equal(core.makeCode(() => [++calls === 1 ? 4294967295 : 7]), '000007', 'values above the unbiased limit are rejected');
  assert.equal(core.cleanCode(' 48-29 13x9'), '482913'); assert.ok(core.sameHex('ab12', 'ab12')); assert.ok(!core.sameHex('ab12', 'ab13')); assert.ok(!core.sameHex('', ''));
  assert.equal(core.maskEmail('pqrstuvwxyz+nest18@gmail.com'), 'p••••••8@gmail.com');
});
test('templates: code in subject, 6 tiles, hosted logo, email-safe HTML, plain text; zh-Hant / zh-Hans / en, others → en', () => {
  const a = verifyEmail({ code: '482913', lang: 'zh-Hant' });
  assert.equal(a.subject, '你的 Nest 驗證碼：482913');
  assert.ok(a.html.includes('確認你的電郵地址') && a.html.includes('10 分鐘內有效 · 只可使用一次') && a.html.includes('Nest 職員絕不會向你索取'));
  assert.equal((a.html.match(/class="nest-tile"/g) || []).length, 6);
  assert.ok(a.html.includes(EMAIL_LOGO) && EMAIL_LOGO === 'https://nesty.cyou/email/nest-logo.png');
  assert.ok(a.html.includes('https://nesty.cyou/app?verify=1') && a.html.includes('https://nesty.cyou/zh-hant/privacy') && a.html.includes('https://nesty.cyou/zh-hant/terms'));
  assert.ok(!/<script|<link[^>]+stylesheet|javascript:|<form/i.test(a.html), 'no scripts / external CSS');
  assert.ok(a.html.length < 60000, 'well under Gmail’s 102 KB clipping');
  assert.match(a.text, /482913/); assert.ok(!/<[a-z]/i.test(a.text));
  const b = verifyEmail({ code: '000001', lang: 'en' }); assert.equal(b.subject, 'Your Nest code: 000001'); assert.ok(b.html.includes('Confirm your email') && b.html.includes('lang="en"'));
  const c = verifyEmail({ code: '123456', lang: 'zh-Hans' }); assert.equal(c.subject, '你的 Nest 验证码：123456'); assert.ok(c.html.includes('确认你的邮箱地址') && !c.html.includes('驗證'));
  assert.equal(emailLang('ja'), 'en'); assert.equal(verifyEmail({ code: '1', lang: 'fr' }).subject, 'Your Nest code: 1');
  const r = resetEmail({ link: 'https://nesty.cyou/auth/action?mode=resetPassword&oobCode=X&lang=zh-Hant', email: 'a@b.co', lang: 'zh-Hant' });
  assert.equal(r.subject, '重設你的 Nest 密碼'); assert.ok(r.html.includes('a@b.co') && r.html.includes('oobCode=X') && r.text.includes('oobCode=X'));
  // HK 書面語: no colloquial Cantonese in the zh-Hant copy
  assert.ok(!/[嘅咗啲喺冇嚟咁]/.test(a.html + r.html));
});

// ---------- server flow ----------
test('not configured → 503 email_not_configured (app falls back to Firebase emails)', async () => {
  env(false);
  const c = await caller('n1@example.com', 'u_n1');
  assert.equal((await body(await E.verifySend(c, req(), {}))).error, 'email_not_configured');
  assert.equal((await body(await E.resetSend(req(), { email: 'n1@example.com' }))).error, 'email_not_configured');
});
test('verify: send → hash only stored → cooldown → wrong codes count down → lockout → resend → correct code verifies once', async () => {
  env(true); E._resetLimits();
  users.set('u_kid', { localId: 'u_kid', email: 'kid@example.com', emailVerified: false });
  const c = await caller('kid@example.com', 'u_kid');
  const t0 = Date.parse('2026-10-20T12:00:00Z');
  const s1 = await body(await E.verifySend(c, req(), { lang: 'zh-Hant' }, t0));
  assert.equal(s1.status, 200, JSON.stringify(s1)); assert.equal(s1.cooldown, 60); assert.equal(s1.expiresIn, 600); assert.equal(s1.to, 'k•d@example.com');
  const mail = sent.at(-1); assert.equal(mail.from, 'Nesty <noreply@nesty.cyou>'); assert.deepEqual(mail.to, ['kid@example.com']);
  const code = mail.subject.match(/(\d{6})$/)[1]; assert.ok(mail.html.includes('lang="zh-Hant-HK"') && mail.text.includes(code));
  const d = docOf('u_kid'); assert.ok(d.h && d.h.length === 64 && !JSON.stringify(d).includes(code), 'only an HMAC is stored'); assert.equal(d.exp, t0 + 600e3); assert.equal(d.att, 0);
  // cooldown
  const s2 = await body(await E.verifySend(c, req(), {}, t0 + 30e3)); assert.equal(s2.status, 429); assert.equal(s2.error, 'cooldown'); assert.equal(s2.retryAfter, 30);
  // wrong codes
  const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 1; i <= 4; i++) { const w = await body(await E.verifyCheck(c, req(), { code: wrong }, t0 + 1000 * i)); assert.equal(w.error, 'wrong_code'); assert.equal(w.left, 5 - i); }
  const w5 = await body(await E.verifyCheck(c, req(), { code: wrong }, t0 + 6000)); assert.equal(w5.error, 'too_many_attempts');
  const w6 = await body(await E.verifyCheck(c, req(), { code }, t0 + 7000)); assert.equal(w6.error, 'too_many_attempts', 'even the right code is refused after 5 misses');
  assert.equal(users.get('u_kid').emailVerified, false);
  // resend after the cooldown → new code, attempts reset
  const s3 = await body(await E.verifySend(c, req(), { lang: 'en' }, t0 + 61e3)); assert.equal(s3.status, 200);
  const code2 = sent.at(-1).subject.match(/(\d{6})$/)[1]; assert.match(sent.at(-1).subject, /^Your Nest code: /);
  assert.equal((await body(await E.verifyCheck(c, req(), { code: '12' }, t0 + 62e3))).error, 'bad_code');
  const ok = await body(await E.verifyCheck(c, req(), { code: ` ${code2.slice(0, 3)} ${code2.slice(3)} ` }, t0 + 63e3));
  assert.equal(ok.status, 200); assert.equal(ok.verified, true);
  assert.deepEqual(idt.filter(([op]) => op === 'accounts:update').at(-1), ['accounts:update', { localId: 'u_kid', emailVerified: true }]);
  assert.equal(users.get('u_kid').emailVerified, true); assert.equal(docOf('u_kid'), undefined, 'code burned');
  assert.equal((await body(await E.verifyCheck(c, req(), { code: code2 }, t0 + 64e3))).error, 'no_code', 'one-time');
  // already verified on the server → no email
  const n = sent.length; const s4 = await body(await E.verifySend(c, req(), {}, t0 + 200e3)); assert.equal(s4.verified, true); assert.equal(sent.length, n);
});
test('verify: expiry, hourly send cap, Google accounts and exempt addresses refused, Resend failure surfaces', async () => {
  env(true); E._resetLimits();
  users.set('u_e', { localId: 'u_e', email: 'e@example.com', emailVerified: false });
  const c = await caller('e@example.com', 'u_e'); const t0 = Date.parse('2026-10-21T00:00:00Z');
  await E.verifySend(c, req('9.9.9.1'), {}, t0); const code = sent.at(-1).subject.slice(-6);
  assert.equal((await body(await E.verifyCheck(c, req(), { code }, t0 + 601e3))).error, 'expired');
  for (let i = 1; i < 5; i++) assert.equal((await E.verifySend(c, req('9.9.9.1'), {}, t0 + i * 61e3)).status, 200);
  const cap = await body(await E.verifySend(c, req('9.9.9.1'), {}, t0 + 5 * 61e3)); assert.equal(cap.error, 'too_many_sends'); assert.ok(cap.retryAfter > 0);
  assert.equal((await body(await E.verifySend(await caller('g@example.com', 'u_g', false, 'google.com'), req(), {}))).error, 'not_password_account');
  assert.equal((await body(await E.verifySend(await caller('nest-test-owner@nest-test.invalid', 'u_t'), req(), {}))).error, 'exempt');
  users.set('u_f', { localId: 'u_f', email: 'f@example.com', emailVerified: false }); resendFail = true;
  assert.equal((await body(await E.verifySend(await caller('f@example.com', 'u_f'), req('7.7.7.7'), {}, t0))).error, 'send_failed'); resendFail = false;
  // per-IP limit
  E._resetLimits(); let last;
  for (let i = 0; i < 13; i++) { users.set(`u_ip${i}`, { localId: `u_ip${i}`, email: `ip${i}@example.com`, emailVerified: false }); last = await E.verifySend(await caller(`ip${i}@example.com`, `u_ip${i}`), req('5.5.5.5'), {}, t0); }
  assert.equal(last.status, 429);
});
test('reset: oob link from the service account → rewritten to nesty.cyou/auth/action in the user’s language; no enumeration', async () => {
  env(true); E._resetLimits();
  users.set('u_r', { localId: 'u_r', email: 'mum@example.com', emailVerified: true });
  const t0 = Date.parse('2026-10-22T00:00:00Z');
  const r = await body(await E.resetSend(req('2.2.2.2'), { email: ' Mum@Example.com ', lang: 'zh-Hans' }, t0)); assert.equal(r.status, 200);
  assert.deepEqual(idt.at(-1), ['accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email: 'mum@example.com', returnOobLink: true }]);
  const m = sent.at(-1); assert.equal(m.subject, '重设你的 Nest 密码'); assert.deepEqual(m.to, ['mum@example.com']);
  assert.ok(m.html.includes('https://nesty.cyou/auth/action?mode=resetPassword&amp;oobCode=OOB-15&amp;lang=zh-Hans'), 'link rewritten to nesty.cyou');
  assert.ok(!m.html.includes('firebaseapp.com') && !m.text.includes('firebaseapp.com') && !m.text.includes('apiKey'));
  assert.equal((await body(await E.resetSend(req('2.2.2.2'), { email: 'mum@example.com' }, t0 + 10e3))).error, 'cooldown');
  const n = sent.length;
  assert.equal((await body(await E.resetSend(req('2.2.2.3'), { email: 'nobody@example.com' }, t0))).status, 200, 'unknown address looks the same');
  assert.equal((await body(await E.resetSend(req('2.2.2.4'), { email: 'nest-test-owner@nest-test.invalid' }, t0))).status, 200);
  assert.equal(sent.length, n, 'no email for unknown or test addresses');
  assert.equal((await body(await E.resetSend(req('2.2.2.5'), { email: 'not-an-email' }, t0))).error, 'bad_email');
});
test('routing through api/ops.js: POST only, 401 without a token, reset is public; client wiring + fallbacks present', async () => {
  env(true); E._resetLimits();
  const { default: handler } = await import('../api/ops.js');
  const call = (op, init) => handler(new Request(`https://nesty.cyou/api/ops?op=${op}`, init));
  assert.equal((await call('app-verify-send', { method: 'GET' })).status, 405);
  assert.equal((await call('app-verify-send', { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await call('app-verify-check', { method: 'POST', body: '{"code":"123456"}' })).status, 401);
  assert.equal((await call('app-reset-send', { method: 'POST', body: '{"email":"x"}' })).status, 400);
  const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8')); assert.ok(vj.rewrites.some((r) => r.source === '/api/app/:op' && r.destination === '/api/ops?op=app-:op'));
  const cl = fs.readFileSync('src/lib/email-verify.js', 'utf8'); assert.match(cl, /sendEmailVerification/); assert.match(cl, /sendPasswordResetEmail|resetPasswordFallback/);
  const app = fs.readFileSync('src/App.jsx', 'utf8'); assert.match(app, /needsVerify\(s\.user\)/);
  const ui = fs.readFileSync('src/pages/VerifyEmail.jsx', 'utf8');
  for (const k of ['inputMode="numeric"', "'one-time-code'", 'onPaste', 'prefers-reduced-motion', 'vf-shake']) assert.ok(ui.includes(k) || fs.readFileSync('src/styles.css', 'utf8').includes(k), k);
  assert.ok(fs.existsSync('public/email/nest-logo.png'));
  // still 12 serverless functions
  const fns = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = `${d}/${f}`; if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('_') && f.endsWith('.js')) fns.push(p); } })('api');
  assert.equal(fns.length, 12);
});
