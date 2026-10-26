import './_env.mjs';
// Unified identity (2026-10-18): profile validation, public view, account kinds, banner geometry.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProfilePatch, publicProfile, accountKind, handleProblem, normHandle, cleanLinks, PUBLIC_FIELDS } from '../src/lib/profile.js';
import { cropRectAspect, clampOffsetAspect } from '../src/lib/avatar.js';
import { profileId, publicCreator } from '../api/_plugins.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

test('handles: normalised, validated, reserved', () => {
  assert.equal(normHandle(' @Study_Buddy '), 'study_buddy');
  assert.equal(handleProblem('ab'), 'bad_handle');
  assert.equal(handleProblem('has-dash'), 'bad_handle');
  assert.equal(handleProblem(''), 'handle_required');
  assert.equal(handleProblem('nest'), 'handle_taken');
  assert.equal(handleProblem('nest', { admin: true }), '');
  assert.equal(handleProblem('a'.repeat(21)), 'bad_handle');
  assert.equal(handleProblem('kid_2026'), '');
});

test('profile patch: partial, cleaned, limits, bad images rejected', () => {
  assert.deepEqual(cleanProfilePatch({ name: '  Mia \n W ' }), { name: 'Mia W' });
  const p = cleanProfilePatch({ handle: '@Mia', bio: 'x'.repeat(400), photo: PNG, banner: '' });
  assert.equal(p.handle, 'mia'); assert.equal(p.bio.length, 160); assert.equal(p.photo, PNG); assert.equal(p.banner, '');
  assert.throws(() => cleanProfilePatch({ photo: 'https://evil/x.png' }), /bad_photo/);
  assert.throws(() => cleanProfilePatch({ banner: 'data:image/svg+xml;base64,PHN2Zz4=' }), /bad_banner/);
  assert.throws(() => cleanProfilePatch({ banner: 'data:image/png;base64,' + 'A'.repeat(170000) }), /bad_banner/);
  assert.throws(() => cleanProfilePatch({ handle: 'admin' }), (e) => e.status === 409 && e.code === 'handle_taken');
  assert.ok(!('family' in cleanProfilePatch({ family: 'x', email: 'a@b.c', school: 'y' })));
});

test('links: https only, ≤4, no credentials', () => {
  const l = cleanLinks([{ url: 'http://a.com' }, { url: 'javascript:alert(1)' }, { url: 'https://u:p@x.com' }, { url: 'https://youtube.com/@me', label: '' },
    { url: 'https://a.com/1' }, { url: 'https://a.com/2' }, { url: 'https://a.com/3' }, { url: 'https://a.com/4' }]);
  assert.equal(l.length, 4); assert.equal(l[0].label, 'youtube.com'); assert.ok(l.every((x) => x.url.startsWith('https://')));
});

test('public view exposes only public fields (never family / school / email)', () => {
  const raw = { uid: 'u1', handle: 'mia', name: 'Mia', photo: PNG, bio: 'hi', links: [], verified: true, email: 'a@b.c', familyId: 'f1', school: 'X', at: 1, banned: false };
  const p = publicProfile(raw);
  assert.deepEqual(Object.keys(p).sort(), [...PUBLIC_FIELDS].sort());
  assert.equal(publicProfile({ ...raw, banned: true }), null);
  assert.equal(publicProfile({ uid: 'u', pfp: PNG }).photo, PNG); // legacy creator photo
  const pc = publicCreator(raw);
  assert.equal(pc.pfp, PNG); assert.ok(!('email' in pc) && !('familyId' in pc) && !('school' in pc));
});

test('account kinds — one definition for admin Overview / Users / Home card', () => {
  assert.equal(accountKind('someone@gmail.com'), 'real');
  assert.equal(accountKind('nest-test-owner@nest-test.invalid'), 'test');
  assert.equal(accountKind('nest-dev-61ca3a5b@nest-test.invalid'), 'test');
  assert.equal(accountKind('nest.e2e.test1017@example.com'), 'test');
  assert.equal(accountKind('nest-ledger@system.heynest.invalid'), 'system');
  assert.equal(accountKind('wl-abc@waitlist.heynest.invalid'), 'system');
  assert.equal(accountKind('NEST@official.heynest.invalid'), 'official');
});

test('official account maps to the first-party Nest profile', () => {
  assert.equal(profileId('officialUid0000000000000001'), 'nest-official');
  assert.equal(profileId('abc'), 'abc');
});

test('banner crop geometry 3:1', () => {
  const r = cropRectAspect(1200, 1200, 3, { zoom: 1 });
  assert.equal(r.sw, 1200); assert.equal(r.sh, 400); assert.equal(r.sy, 400);
  const w = cropRectAspect(3000, 500, 3, { zoom: 2, x: 0.5 });
  assert.equal(w.sh, 250); assert.equal(w.sw, 750); assert.ok(w.sx >= 0 && w.sx + w.sw <= 3000);
  const c = clampOffsetAspect(1200, 1200, 3, 1, 5, 5);
  assert.equal(c.x, 0); assert.equal(c.y, 1);
});

test('cleanup targets: only stray test accounts; kept test, official, system, real untouched; mixed families skipped', async () => {
  const { cleanupTargets } = await import('../api/ops.js');
  const auth = [
    { localId: 'real1', email: 'someone@gmail.com' }, { localId: 'own', email: 'nest-test-owner@nest-test.invalid' }, { localId: 'mem', email: 'nest-test-member@nest-test.invalid' },
    { localId: 'officialUid0000000000000001', email: 'nest@official.heynest.invalid' }, { localId: 'led', email: 'nest-ledger@system.heynest.invalid' },
    { localId: 'dev1', email: 'nest-dev-61ca3a5b@nest-test.invalid' }, { localId: 'dev2', email: 'nest-dev-36ab75f8@nest-test.invalid' }, { localId: 'e2e', email: 'nest.e2e.test1017@example.com' },
  ];
  const fams = [
    { id: 'dev33fc8ae5433e4003', data: { ownerId: 'dev1', memberIds: ['dev1', 'dev2'] } },
    { id: 'testFamily000000001', data: { ownerId: 'own', memberIds: ['own', 'mem'] } },
    { id: 'real', data: { ownerId: 'real1', memberIds: ['real1'] } },
    { id: 'mixed', data: { ownerId: 'dev2', memberIds: ['dev2', 'real1'] } },
    { id: 'orphan', data: { ownerId: 'ghost', memberIds: ['ghost'] } },
    { id: 'official', data: { ownerId: 'officialUid0000000000000001', memberIds: ['officialUid0000000000000001'] } },
  ];
  const t = cleanupTargets(auth, fams);
  assert.deepEqual(t.accounts.map((a) => a.uid).sort(), ['dev1', 'dev2', 'e2e']);
  assert.deepEqual(t.families.sort(), ['dev33fc8ae5433e4003', 'orphan']);
  assert.deepEqual(t.skippedFamilies, ['mixed']);
});
