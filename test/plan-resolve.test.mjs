import './_env.mjs';
// One effective-plan resolver for server + client (2026-10-18): free, pro (family plan), beta gift, admin grant, expired grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlan, effectivePlan, planLabelParts, planHeader, parsePlanHeader, hkYmd } from '../src/lib/plan-resolve.js';
import { resolvePlan as serverResolve } from '../api/_ops-lib.js';
import { STRINGS } from '../src/lib/strings.js';

const NOW = Date.UTC(2026, 9, 18, 14, 0);
const BETA_UNTIL = Date.UTC(2026, 10, 18, 10, 47, 50); // 2026-11-18 18:47:50 HKT
const tr = (lang) => (k, v = {}) => String(k.split('.').reduce((o, x) => o?.[x], STRINGS[lang]) ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');

test('server and client import the same resolver', () => assert.equal(serverResolve, resolvePlan));
test('free / pro / beta / grant / expired', () => {
  assert.deepEqual(resolvePlan('free', {}, 'f1', NOW).id, 'free');
  assert.equal(resolvePlan('pro', {}, 'f1', NOW).source, 'plan');
  const beta = resolvePlan('free', { promos: { beta: { claims: { f1: { until: BETA_UNTIL } } } } }, 'f1', NOW);
  assert.equal(beta.id, 'pro'); assert.equal(beta.source, 'beta'); assert.equal(beta.until, BETA_UNTIL);
  const grant = resolvePlan('free', { grants: { f1: { until: NOW + 864e5 } } }, 'f1', NOW);
  assert.equal(grant.source, 'grant');
  const expired = resolvePlan('free', { grants: { f1: { until: NOW - 1000 } } }, 'f1', NOW);
  assert.equal(expired.id, 'free'); assert.equal(expired.ended, NOW - 1000);
  assert.equal(resolvePlan(undefined, null, null, NOW).id, 'free');
});
test('client effective plan follows the server answer; unknown never shows Free', () => {
  const fam = { plan: 'free' };
  const unknown = effectivePlan(fam, null, NOW);
  assert.equal(unknown.known, false);
  assert.equal(planLabelParts(unknown, tr('zh-Hant')).full, '…');
  const info = parsePlanHeader(planHeader(resolvePlan('free', { promos: { beta: { claims: { f1: { until: BETA_UNTIL } } } } }, 'f1', NOW)));
  const e = effectivePlan(fam, info, NOW);
  assert.equal(e.plan.id, 'pro'); assert.equal(e.plan.daily, 800);
  assert.equal(planLabelParts(e, tr('zh-Hant')).full, 'Pro · Beta 至 2026-11-18');
  assert.equal(planLabelParts(e, tr('en')).full, 'Pro · Beta until 2026-11-18');
  assert.equal(planLabelParts(effectivePlan({ plan: 'pro' }, null, NOW), tr('zh-Hant')).full, 'Pro · 家庭方案');
  const g = effectivePlan(fam, { plan: 'pro', source: 'grant', until: NOW + 864e5 }, NOW);
  assert.match(planLabelParts(g, tr('zh-Hant')).full, /^Pro · 獲贈至 2026-10-19( 22:00)?$/);
  // A cached grant that has since expired drops back by itself.
  const old = effectivePlan(fam, { plan: 'pro', source: 'grant', until: NOW - 1 }, NOW);
  assert.equal(old.plan.id, 'free'); assert.match(planLabelParts(old, tr('zh-Hant')).full, /Pro 已於 .* 結束/);
  assert.equal(hkYmd(BETA_UNTIL), '2026-11-18');
});
