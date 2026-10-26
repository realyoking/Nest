import './_env.mjs';
// Run 8b: admin config, announcements, promo codes, gate (maintenance / suspended / revoked / signup / flags), admin-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  readConfig, applyConfigPatch, publicConfig, limitsFor, gateCaller, cleanAnnouncement, annEligible, pickAnnouncements, annText, cleanCode, codeState, MODEL, FLAG_KEYS, MODE_FLAG,
} from '../src/lib/admin-config.js';
import { planOf } from '../src/lib/plans.js';
import { STRINGS } from '../src/lib/strings.js';
import { COLLOQUIAL } from './zh-hk.test.mjs';

const H = 3600e3; const D = 24 * H;

test('config: defaults, validated patches, model is never configurable, limits override', () => {
  const c0 = readConfig({});
  assert.ok(FLAG_KEYS.every((k) => c0.flags[k] === true));
  assert.equal(c0.maintenance.on, false); assert.equal(c0.signup.open, true);
  const c1 = applyConfigPatch({}, { flags: { pluginStore: false, bogus: false }, model: 'agnes-3.0-pro', ai: { model: 'x', limits: { free: { daily: 5, weekly: 20 }, pro: { daily: 'abc' } }, promptAdd: 'Be brief.' }, maintenance: { on: true, msg: { 'zh-Hant': '維護中' } }, signup: { open: false }, defaults: { lang: 'en', theme: 'dark' } }, 1000);
  assert.equal(c1.flags.pluginStore, false); assert.equal('bogus' in c1.flags, false);
  assert.equal(JSON.stringify(c1).includes('agnes-3.0-pro'), false); assert.equal('model' in c1, false); assert.equal('model' in c1.ai, false);
  assert.deepEqual(c1.ai.limits, { free: { daily: 5, weekly: 20 } });
  assert.equal(c1.signup.closedAt, 1000); assert.equal(c1.rev, 1);
  assert.deepEqual(c1.defaults, { lang: 'en', theme: 'dark' });
  const lim = limitsFor(planOf('free'), c1); assert.equal(lim.daily, 5); assert.equal(lim.weekly, 20);
  assert.equal(limitsFor(planOf('pro'), c1).daily, planOf('pro').daily);
  const c2 = applyConfigPatch(c1, { ai: { limits: { free: null } }, signup: { open: true } });
  assert.deepEqual(c2.ai.limits, {}); assert.equal(c2.signup.closedAt, null); assert.equal(c2.rev, 2);
  assert.equal(MODEL, 'agnes-3.0-flash');
  // public config: maintenance hidden for admins (bypass flag instead)
  assert.equal(publicConfig(c1).maintenance.on, true); assert.equal(publicConfig(c1, { admin: true }).maintenance.on, false); assert.equal(publicConfig(c1, { admin: true }).maintenance.bypass, true);
  assert.deepEqual(MODE_FLAG, { chat: 'aiChat', tutor: 'tutor', quiz: 'quiz' });
});

test('gate: maintenance (admins bypass), suspended, revoked sessions, signup-closed, feature flags', () => {
  const c = { uid: 'u1', iat: 2000 };
  assert.equal(gateCaller({ c }), null);
  const maint = { maintenance: { on: true, msg: { 'zh-Hant': '維護中', en: 'Down' } } };
  assert.deepEqual(gateCaller({ c, cfg: maint, lang: 'en' }), { status: 503, error: 'maintenance', message: 'Down' });
  assert.equal(gateCaller({ c, cfg: maint, admin: true }), null);
  assert.equal(gateCaller({ c, ledger: { disabled: { u1: { at: 1 } } } }).error, 'account_disabled');
  assert.equal(gateCaller({ c, ledger: { disabled: { u1: { at: 1 } } } }).status, 403);
  assert.equal(gateCaller({ c, ledger: { revoked: { u1: { at: 2500e3 } } } }).error, 'session_revoked'); // token issued before revoke
  assert.equal(gateCaller({ c: { uid: 'u1', iat: 3000 }, ledger: { revoked: { u1: { at: 2500e3 } } } }), null); // signed in again after
  assert.equal(gateCaller({ c, ledger: { signupBlocked: { u1: { at: 1 } } } }).error, 'signup_closed');
  const off = { flags: { pluginStore: false, aiChat: false } };
  assert.deepEqual(gateCaller({ c, cfg: off, feature: 'pluginStore' }), { status: 403, error: 'feature_disabled', feature: 'pluginStore' });
  assert.equal(gateCaller({ c, cfg: off, feature: 'tutor' }), null);
  assert.equal(gateCaller({ c, cfg: off, feature: 'aiChat', admin: true }), null);
});

test('announcements: validation, targeting, scheduling, dismissal + "don\'t show again", priority', () => {
  const base = { text: { 'zh-Hant': { title: '新功能', body: '**AI** 可以畫圖', cta: '看看' }, en: { title: 'New', body: 'Draw', cta: 'See' } }, link: '/app/agent', status: 'live', priority: 10 };
  assert.equal(cleanAnnouncement({}).error, 'title_required');
  assert.equal(cleanAnnouncement({ ...base, link: 'javascript:alert(1)' }).error, 'bad_link');
  assert.equal(cleanAnnouncement({ ...base, start: 2000, end: 1000 }).error, 'bad_schedule');
  assert.equal(cleanAnnouncement({ ...base, audience: { type: 'plan', plans: ['gold'] } }).error, 'bad_audience');
  const A = (x) => ({ ...cleanAnnouncement({ ...base, ...x }).ann, id: x.id || 'aaaaaa' });
  const u = { uid: 'Uabcdefghij12', email: 'kid@example.com', plan: 'free', lang: 'zh-Hant', createdAt: 0 };
  const now = 100 * D;
  assert.equal(annEligible(A({}), u, now), true);
  assert.equal(annEligible(A({ status: 'paused' }), u, now), false);
  assert.equal(annEligible(A({ status: 'draft' }), u, now), false);
  assert.equal(annEligible(A({ start: now + H }), u, now), false); // scheduled
  assert.equal(annEligible(A({ start: now - H, end: now + H }), u, now), true);
  assert.equal(annEligible(A({ end: now - 1 }), u, now), false); // ended
  assert.equal(annEligible(A({ audience: { type: 'plan', plans: ['pro'] } }), u, now), false);
  assert.equal(annEligible(A({ audience: { type: 'plan', plans: ['pro'] } }), { ...u, plan: 'pro' }, now), true);
  assert.equal(annEligible(A({ audience: { type: 'lang', langs: ['en'] } }), u, now), false);
  assert.equal(annEligible(A({ audience: { type: 'lang', langs: ['zh-Hant', 'zh-Hans'] } }), u, now), true);
  assert.equal(annEligible(A({ audience: { type: 'new', days: 7 } }), { ...u, createdAt: now - 3 * D }, now), true);
  assert.equal(annEligible(A({ audience: { type: 'new', days: 7 } }), { ...u, createdAt: now - 30 * D }, now), false);
  assert.equal(annEligible(A({ audience: { type: 'user', users: ['KID@example.com'] } }), u, now), true); // email, case-insensitive
  assert.equal(annEligible(A({ audience: { type: 'user', users: ['Uabcdefghij12'] } }), u, now), true); // uid
  assert.equal(annEligible(A({ audience: { type: 'user', users: ['other@example.com'] } }), u, now), false);
  // dismissal: hidden ~a day, "never" for good; a non-dismissible one always shows; highest priority first
  const list = [A({ id: 'aaaaa1', priority: 10 }), A({ id: 'aaaaa2', priority: 90 }), A({ id: 'aaaaa3', priority: 50, dismissible: false })];
  assert.deepEqual(pickAnnouncements(list, u, {}, now).map((a) => a.id), ['aaaaa2', 'aaaaa3', 'aaaaa1']);
  const st = { aaaaa2: { d: now - H }, aaaaa1: { d: now - 2 * D, n: true }, aaaaa3: { d: now, n: true } };
  assert.deepEqual(pickAnnouncements(list, u, st, now).map((a) => a.id), ['aaaaa3']);
  assert.deepEqual(pickAnnouncements(list, u, { aaaaa2: { d: now - 2 * D } }, now).map((a) => a.id), ['aaaaa2', 'aaaaa3', 'aaaaa1']); // back after a day
  // language fallback: zh-Hans → zh-Hant, missing en → zh-Hant
  assert.equal(annText(A({}), 'zh-Hans').title, '新功能');
  assert.equal(annText(A({ text: { 'zh-Hant': { title: '只有中文' } } }), 'en').title, '只有中文');
});

test('promo codes: validation + state; BETA is reserved and only ever paused', () => {
  assert.equal(cleanCode({ code: 'x' }).error, 'bad_code');
  assert.equal(cleanCode({ code: 'spring-2027', months: 99, max: 0 }).def.months, 24);
  assert.equal(cleanCode({ code: 'spring-2027' }).code, 'SPRING-2027');
  assert.deepEqual(codeState({ max: 2, uses: { f1: {} } }, 0), { used: 1, max: 2, remaining: 1, open: true });
  assert.equal(codeState({ max: 2, uses: { f1: {} }, disabled: true }).open, false);
  assert.equal(codeState({ max: 2, expires: 10 }, 20).open, false);
  const src = fs.readFileSync('api/_admin.js', 'utf8');
  assert.match(src, /\[\['codes', code, 'disabled'\], op === 'disable'\]/); // dot-path write: only the flag
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /\[\s*'promos'/); // admin code never writes the BETA ledger
  assert.match(src, /if \(r\.code === 'BETA'\) return json\(409, \{ error: 'reserved' \}\)/);
  assert.match(src, /Math\.max\(now, Number\(g\?\.until\) \|\| 0\)/); // a code never shortens an existing grant
});

test('server wiring: gate in chat / plugins / ops; model fixed; 12 functions; rewrite /api/app', () => {
  const chat = fs.readFileSync('api/chat.js', 'utf8');
  assert.match(chat, /gateCaller\(\{ c: claims, ledger: ledger0, cfg: cfgRaw, admin: isAdm, feature: isPlugin \? 'studio' : MODE_FLAG\[mode\]/);
  assert.match(chat, /limitsFor\(planOf\(rplan\.id\), cfgRaw\)/);
  assert.match(chat, /cfg\.flags\.wikipedia/); assert.match(chat, /cfg\.flags\.attachments/); assert.match(chat, /cfg\.flags\.visuals/);
  assert.match(fs.readFileSync('api/_plugins.js', 'utf8'), /feature: STUDIO_OPS\.has\(name\) \? 'studio' : STORE_OPS\.has\(name\) \? 'pluginStore'/);
  const ops = fs.readFileSync('api/ops.js', 'utf8');
  for (const op of ['admin-config', 'admin-ann', 'admin-translate', 'admin-codes', 'admin-revoke']) assert.ok(ops.indexOf(`'${op}'`) > ops.indexOf("if (!isAdminClaims(c)) return notFound();"), `${op} behind the admin check`);
  assert.match(fs.readFileSync('api/_admin.js', 'utf8'), /model: MODEL, stream: false/);
  const fns = fs.readdirSync('api', { recursive: true }).filter((f) => /\.js$/.test(f) && !/(^|\/)_/.test(f));
  assert.equal(fns.length, 12);
  const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.ok(vj.rewrites.some((r) => r.source === '/api/app/:op' && r.destination === '/api/ops?op=app-:op'));
});

test('admin-only: /api/admin/* and plugin admin ops answer 404 without a valid admin token; public config works', async () => {
  const { default: handler } = await import('../api/ops.js');
  const req = (op, method = 'GET', auth = '', body) => new Request(`https://nest.test/api/ops?op=${op}`, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: body ? JSON.stringify(body) : undefined });
  for (const op of ['admin-config', 'admin-ann', 'admin-codes', 'admin-overview', 'admin-whoami']) {
    assert.equal((await handler(req(op))).status, 404, op);
    assert.equal((await handler(req(op, 'GET', 'Bearer not-a-real-token'))).status, 404, `${op} bad token`);
  }
  for (const op of ['admin-config', 'admin-ann', 'admin-translate', 'admin-codes', 'admin-revoke', 'admin-action']) assert.equal((await handler(req(op, 'POST', 'Bearer x.y.z', { patch: { maintenance: { on: true } } }))).status, 404, `${op} POST`);
  assert.equal((await handler(req('plug-admin-list', 'POST', 'Bearer x.y.z', {}))).status, 404);
  assert.equal((await handler(req('app-ann', 'POST', '', { id: 'aaaaaa', ev: 'seen' }))).status, 401);
  const r = await handler(req('app-config'));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.model, 'agnes-3.0-flash'); assert.equal(j.admin, false); assert.equal(j.flags.aiChat, true); assert.equal(j.announcements, undefined);
});

test('strings: announcement + config UI strings are HK 書面語', () => {
  const flat = (o, out = []) => { for (const v of Object.values(o || {})) typeof v === 'string' ? out.push(v) : flat(v, out); return out; };
  const z = STRINGS['zh-Hant'];
  const bad = flat({ ann: z.ann, acfg: z.acfg, adm2: z.adm2 }).filter((v) => COLLOQUIAL.test(v));
  assert.deepEqual(bad, []);
  for (const k of ['ann', 'acfg', 'adm2']) assert.ok(STRINGS.en[k], k);
});
