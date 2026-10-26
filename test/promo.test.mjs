import './_env.mjs';
// node --test test/promo.test.mjs
// Unit tests (always) + a live integration test of the atomic claim against the real ledger doc using a throw-away
// promo key (never "beta"), run only when NEST_LEDGER_SECRET is set. The test key is deleted afterwards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlan, isAdminClaims, addMonths, promoState, claimPromo, ledgerSession, ledgerWrite, readLedger, PROMO_MAX } from '../api/_ops-lib.js';

const NOW = Date.UTC(2026, 9, 18, 4, 0, 0);

test('resolvePlan: beta gift makes the whole family Pro until expiry, then reverts', () => {
  const ledger = { promos: { beta: { claims: { famA: { uid: 'u1', at: NOW, until: addMonths(NOW, 1) } } } } };
  const on = resolvePlan('free', ledger, 'famA', NOW);
  assert.equal(on.id, 'pro'); assert.equal(on.source, 'beta'); assert.equal(on.until, Date.UTC(2026, 10, 18, 4));
  // Any member of famA resolves through the family id, so this is the same for every member.
  const expired = resolvePlan('free', ledger, 'famA', Date.UTC(2026, 10, 18, 4) + 1);
  assert.equal(expired.id, 'free');
  const past = { promos: { beta: { claims: { famA: { until: NOW - 1000 } } } } };
  assert.equal(resolvePlan('free', past, 'famA', NOW).id, 'free');
  assert.equal(resolvePlan('free', ledger, 'otherFam', NOW).id, 'free');
  assert.equal(resolvePlan('starter', past, 'famA', NOW).id, 'starter');
});

test('resolvePlan: admin grant wins when later; revoked/expired grant ignored', () => {
  const l = { grants: { f: { until: NOW + 90 * 864e5 } }, promos: { beta: { claims: { f: { until: NOW + 30 * 864e5 } } } } };
  const r = resolvePlan('free', l, 'f', NOW);
  assert.equal(r.source, 'grant'); assert.equal(r.until, NOW + 90 * 864e5);
  assert.equal(resolvePlan('free', { grants: { f: { until: NOW - 1 } } }, 'f', NOW).id, 'free');
});

test('addMonths clamps month ends', () => {
  assert.equal(new Date(addMonths(Date.UTC(2027, 0, 31))).toISOString().slice(0, 10), '2027-02-28');
  assert.equal(new Date(addMonths(Date.UTC(2026, 9, 18))).toISOString().slice(0, 10), '2026-11-18');
});

test('isAdminClaims: allowlist + verified email only', () => {
  assert.equal(isAdminClaims({ email: 'admin@nest.example', emailVerified: true }), true);
  assert.equal(isAdminClaims({ email: 'Admin@Nest.Example', emailVerified: true }), true);
  assert.equal(isAdminClaims({ email: 'admin@nest.example', emailVerified: false }), false);
  assert.equal(isAdminClaims({ email: 'someone@gmail.com', emailVerified: true }), false);
  assert.equal(isAdminClaims({ email: 'proedttdude@gmail.com', emailVerified: true }), false);
  assert.equal(isAdminClaims(null), false);
});

test('promoState defaults to 10 open slots', () => {
  const s = promoState({});
  assert.deepEqual([s.max, s.claimed, s.remaining, s.open], [PROMO_MAX, 0, 10, true]);
});

const live = process.env.NEST_LEDGER_SECRET ? test : test.skip;
live('LIVE: atomic claim caps at 10 under 15 concurrent families; double claims refused', async () => {
  const key = `t${Date.now().toString(36)}`;
  const session = await ledgerSession('ledger');
  try {
    const fids = Array.from({ length: 15 }, (_, i) => `testfam${i}`);
    const res = await Promise.all(fids.map((fid, i) => claimPromo({ key, fid, uid: `testuid${i}`, session })));
    const ok = res.filter((r) => r.status === 'claimed');
    const full = res.filter((r) => r.status === 'full');
    assert.equal(ok.length, 10, JSON.stringify(res.map((r) => r.status)));
    assert.equal(full.length, 5);
    const winner = fids[res.findIndex((r) => r.status === 'claimed')];
    const again = await claimPromo({ key, fid: winner, uid: 'someoneElse', session });
    assert.equal(again.status, 'already');
    const doc = await readLedger({ maxAge: 0 });
    const st = promoState(doc, key);
    assert.equal(st.claimed, 10); assert.equal(Object.keys(st.claims).length, 10); assert.equal(st.remaining, 0);
    // Same family again and same user with another family on a fresh key with room.
    const key2 = `${key}b`;
    try {
      assert.equal((await claimPromo({ key: key2, fid: 'famX', uid: 'u1', session })).status, 'claimed');
      assert.equal((await claimPromo({ key: key2, fid: 'famX', uid: 'u2', session })).status, 'already');
      assert.equal((await claimPromo({ key: key2, fid: 'famY', uid: 'u1', session })).status, 'already_user');
      assert.equal(promoState(await readLedger({ maxAge: 0 }), key2).claimed, 1);
    } finally { await ledgerWrite([[['promos', key2], undefined]], 'ledger'); }
  } finally {
    await ledgerWrite([[['promos', key], undefined]], 'ledger');
  }
  const after = await readLedger({ maxAge: 0 });
  assert.equal(after?.promos?.[key], undefined);
  const beta = promoState(after, 'beta');
  console.log('live beta counter after test:', JSON.stringify({ claimed: beta.claimed, remaining: beta.remaining }));
});
