import './_env.mjs';
// Run 8b wrap-up: friendly client lines for the admin-config gate codes (src/lib/gate-errors.js) + server wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/strings.js';
import { hansDict } from '../src/lib/hans.js';
import { gateErrorText, isGateError, GATE_CODES } from '../src/lib/gate-errors.js';

const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
const mkT = (dict) => (k, p = {}) => { const v = get(dict, k); return typeof v === 'string' ? v.replace(/\{(\w+)\}/g, (_, n) => p[n] ?? '') : k; };
const HANT = mkT(STRINGS['zh-Hant']); const EN = mkT(STRINGS.en); const HANS = mkT(hansDict(STRINGS['zh-Hant']));

test('every gate code has a zh-Hant (書面語), zh-Hans and en line', () => {
  for (const code of GATE_CODES) for (const [t, name] of [[HANT, 'zh-Hant'], [HANS, 'zh-Hans'], [EN, 'en']]) {
    const s = gateErrorText({ code }, t);
    assert.ok(s && !s.startsWith('acfg.'), `${name} ${code}`);
    if (name !== 'en') assert.doesNotMatch(s, /[咗嘅唔係喺佢冇嚟]/, `${name} ${code}: colloquial`);
  }
  assert.match(gateErrorText({ code: 'session_revoked' }, HANS), /为保障账户安全|帐户|账户/);
});
test('maintenance carries the admin message; feature_disabled names the feature', () => {
  assert.equal(gateErrorText({ code: 'maintenance', message: '預計 30 分鐘後回來。' }, HANT), 'Nest 正在維護，暫時未能使用，請稍後再試。 預計 30 分鐘後回來。');
  assert.equal(gateErrorText({ code: 'maintenance', gateMessage: 'Back soon.' }, EN), 'Nest is under maintenance right now. Please try again a little later. Back soon.');
  assert.equal(gateErrorText({ code: 'maintenance', message: 'maintenance' }, HANT), 'Nest 正在維護，暫時未能使用，請稍後再試。');
  assert.equal(gateErrorText({ code: 'feature_disabled', feature: 'tutor' }, HANT), '「功課導師」暫時停用，請稍後再試。');
  assert.equal(gateErrorText({ code: 'feature_disabled', feature: 'studio' }, EN), '“Creator Studio” is switched off for now. Please try again later.');
  assert.equal(gateErrorText({ code: 'feature_disabled', feature: 'nope' }, HANT), '這個功能暫時停用，請稍後再試。');
});
test('non-gate errors fall through (null)', () => {
  for (const e of [null, {}, { code: 'limit_reached' }, { code: 'network' }, { code: 'oauth/access_denied' }]) assert.equal(gateErrorText(e, HANT), null);
  assert.equal(isGateError({ error: 'account_disabled' }), true);
  assert.equal(isGateError({ code: 'bad_code' }), false);
});
test('Node endpoints use the shared access check; OAuth callback and cron do not', () => {
  const src = (p) => fs.readFileSync(new URL(`../api/${p}`, import.meta.url), 'utf8');
  for (const p of ['calendar.js', 'google/token.js', 'google/status.js', 'google/disconnect.js', 'oauth/start.js', 'push/subscribe.js', 'push/test.js']) assert.match(src(p), /accessGate\(me/, p);
  for (const p of ['oauth/callback.js', 'push/cron.js']) assert.doesNotMatch(src(p), /accessGate/, p);
  // removal-only calls stay possible while suspended / in maintenance (never for a revoked session)
  assert.match(src('google/disconnect.js'), /soft: \['maintenance', 'account_disabled', 'signup_closed'\]/);
  assert.match(src('push/subscribe.js'), /req\.method === 'DELETE' \? \['maintenance', 'account_disabled', 'signup_closed'\]/);
  const files = fs.readdirSync(new URL('../api/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js') && !f.split('/').some((x) => x.startsWith('_')));
  assert.equal(files.length, 12, 'Hobby plan: 12 functions');
});
