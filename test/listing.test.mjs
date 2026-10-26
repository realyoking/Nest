import './_env.mjs';
// Published-plugin listing editor: input cleaning, owner-only access, review policy (normal → applied, Safe/Verified → pending).
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanListingPatch, cropRect, ratioFor, cleanLink, LISTING_LIMITS, needsListingReview } from '../src/lib/plugins/listing.js';
import { listingOps, listingAccess, isSafe, ADMIN_PLUGIN_ACTIONS } from '../api/_plugins.js';
import { LIMITS } from '../src/lib/plugins/manifest.js';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const WEBP = 'data:image/webp;base64,UklGRg==';

test('clean patch: fields, links https only, icon raster only, shots keep/new/alt/order', () => {
  const { patch, errors } = cleanListingPatch({ descZh: ' 一個小工具\r\n\n\n\n第二行 ', desc: 'x'.repeat(900), features: 'a\n\n b \nc', category: 'study', links: [{ label: '網站', url: 'https://example.com/a' }], icon: PNG,
    shots: [{ keep: 1, alt: '主頁' }, { img: WEBP, alt: 'x'.repeat(300) }, { keep: 0 }] }, { current: 2 });
  assert.deepEqual(errors, []);
  assert.equal(patch.descZh, '一個小工具\n\n第二行');
  assert.equal(patch.desc.length, LISTING_LIMITS.desc);
  assert.equal(patch.features, 'a\nb\nc');
  assert.deepEqual(patch.shots.map((x) => x.keep ?? 'new'), [1, 'new', 0]);
  assert.equal(patch.shots[1].alt.length, LISTING_LIMITS.alt);
  assert.deepEqual(cleanListingPatch({ links: [{ url: 'http://x.com' }] }).errors, ['bad_link']);
  assert.deepEqual(cleanListingPatch({ links: [{ url: 'javascript:alert(1)' }] }).errors, ['bad_link']);
  assert.equal(cleanLink({ url: 'https://user:pw@x.com' }), null);
  assert.deepEqual(cleanListingPatch({ icon: 'data:image/svg+xml;base64,PHN2Zz4=' }).errors, ['bad_icon']);
  assert.deepEqual(cleanListingPatch({ category: 'evil' }).errors, ['bad_category']);
  assert.deepEqual(cleanListingPatch({ shots: Array(7).fill({ img: PNG }) }).errors, ['too_many_shots']);
  assert.deepEqual(cleanListingPatch({ shots: [{ keep: 3 }] }, { current: 2 }).errors, ['bad_shot_ref']);
  assert.deepEqual(cleanListingPatch({ shots: [{ keep: 0 }, { keep: 0 }] }, { current: 2 }).errors, ['bad_shot_ref']);
  assert.deepEqual(cleanListingPatch({ shots: [{ img: 'data:image/png;base64,' + 'A'.repeat(LISTING_LIMITS.shot) }] }).errors, ['shot_too_large']);
  assert.deepEqual(cleanListingPatch({ shots: [{ img: '<svg onload=alert(1)>' }] }).errors, ['bad_screenshot']);
  assert.deepEqual(cleanListingPatch({ shots: [] }).patch.shots, []);
  assert.equal(LIMITS.shots, 6);
});

test('crop to standard ratios', () => {
  assert.equal(ratioFor(1920, 1080), 'landscape'); assert.equal(ratioFor(1170, 2532), 'portrait');
  assert.deepEqual(cropRect(1920, 1080, 'landscape'), { sx: 96, sy: 0, sw: 1728, sh: 1080 });
  assert.deepEqual(cropRect(1170, 2532, 'portrait'), { sx: 0, sy: 226, sw: 1170, sh: 2080 });
});

test('owner-only access (server check)', () => {
  const p = { id: 'my-plug', creatorUid: 'u1', live: 2 };
  assert.equal(listingAccess(p, 'u1'), '');
  assert.equal(listingAccess(p, 'u2'), 'not_owner');
  assert.equal(listingAccess(p, ''), 'not_owner');
  assert.equal(listingAccess({ ...p, live: 0 }, 'u1'), 'not_published');
  assert.equal(listingAccess({ ...p, deleted: true }, 'u1'), 'not_found');
  assert.equal(listingAccess(p, 'u1', { banned: true }), 'banned');
  assert.equal(listingAccess(null, 'u1'), 'not_found');
});

test('review policy: normal plugin applied now; Safe / Verified / first-party → pending (q-screenshots), live untouched', () => {
  const now = 1;
  const normal = { id: 'my-plug', creatorUid: 'u1', live: 2, safeV: 0, verified: false, shotsN: 3 };
  const patch = cleanListingPatch({ descZh: '新介紹', shots: [{ keep: 2, alt: 'c' }, { img: PNG, alt: 'n' }, { keep: 0, alt: 'a' }] }, { current: 3 }).patch;
  const a = listingOps(normal, patch, ['IMG2', '', 'IMG0'], { now, uid: 'u1' });
  assert.equal(a.review, false); assert.equal(a.shotsN, 3);
  assert.deepEqual(a.ops.filter((o) => o.set).map((o) => [o.set.split('/').pop(), o.data.img, o.data.alt]), [['s0', 'IMG2', 'c'], ['s1', PNG, 'n'], ['s2', 'IMG0', 'a']]);
  assert.deepEqual(a.ops.filter((o) => o.del).map((o) => o.del.split('/').pop()), ['s3', 's4', 's5']);
  const pa = a.ops.find((o) => o.patch).data; assert.equal(pa.descZh, '新介紹'); assert.equal(pa.shotsN, 3); assert.equal(pa.listingAt, now);
  // delete all screenshots
  const del = listingOps(normal, cleanListingPatch({ shots: [] }, { current: 3 }).patch, [], { now });
  assert.equal(del.shotsN, 0); assert.equal(del.ops.filter((o) => o.del).length, 6);
  for (const special of [{ ...normal, safeV: 2 }, { ...normal, verified: true }, { ...normal, firstParty: true }]) {
    assert.equal(needsListingReview(special, isSafe), true);
    const r = listingOps(special, patch, ['IMG2', '', 'IMG0'], { now, uid: 'u1' });
    assert.equal(r.review, true);
    assert.ok(r.ops.filter((o) => o.set).every((o) => /\/media\/q\d$/.test(o.set)), 'pending shots go to q*');
    const pd = r.ops.find((o) => o.patch).data;
    assert.equal(pd.listingReview, 'pending'); assert.equal(pd.listingPending.descZh, '新介紹'); assert.equal(pd.listingPending.shotsN, 3);
    assert.equal(pd.descZh, undefined, 'live description unchanged until approved');
  }
  assert.equal(needsListingReview({ ...normal, safeV: 1 }, isSafe), false, 'Safe label of an older version does not count');
  assert.throws(() => listingOps(normal, patch, ['', '', ''], { now }), /shot_missing/);
  assert.ok(ADMIN_PLUGIN_ACTIONS.includes('approve-listing') && ADMIN_PLUGIN_ACTIONS.includes('reject-listing'));
});
