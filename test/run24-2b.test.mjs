import './_env.mjs';
// Run 24 step 2b: 全家檔案 (family drive) — ops, permissions, quota, chunking, cleanup, server route membership checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { driveOp, memoryStore, LIMITS, kindOf, cleanName, chunkCount, sortItems, searchItems, sanitizeDoc, docText, pathOf, b64Bytes } from '../src/lib/drive.js';
import { R24 } from '../src/lib/strings-run24.js';

const F = 'f1';
const ctx = (uid = 'u1', role = 'parent', isOwner = false, now = 1e12) => ({ fid: F, uid, member: { role }, isOwner, now: () => now });
const b64 = (n, fill = 65) => Buffer.alloc(n, fill).toString('base64');
async function upload(st, c, name, size, parent = '') {
  const n = chunkCount(size); let r; let id = '';
  for (let k = 0; k < n; k++) {
    const len = Math.min(LIMITS.chunk, size - k * LIMITS.chunk);
    r = await driveOp(st, c, k === 0 ? { action: 'put', n: 0, name, size, mime: '', parent, data: b64(len) } : { action: 'put', n: k, id, data: b64(len) });
    if (r.status !== 200) return r; id = r.body.id;
  }
  return r;
}

test('kinds, names, chunk maths', () => {
  assert.equal(kindOf('a.PDF'), 'pdf'); assert.equal(kindOf('x', 'image/png'), 'image'); assert.equal(kindOf('v.mov'), 'video');
  assert.equal(kindOf('s.m4a'), 'audio'); assert.equal(kindOf('r.docx'), 'office'); assert.equal(kindOf('z.zip'), 'archive'); assert.equal(kindOf('q.bin'), 'other');
  assert.equal(cleanName('  a/b\\c\n '), 'a b c'); assert.equal(cleanName('x'.repeat(300)).length, LIMITS.nameMax);
  assert.equal(chunkCount(1), 1); assert.equal(chunkCount(LIMITS.chunk), 1); assert.equal(chunkCount(LIMITS.chunk + 1), 2);
  assert.equal(b64Bytes(b64(5)), 5); assert.equal(b64Bytes(b64(6)), 6); assert.equal(b64Bytes(b64(7)), 7);
  assert.equal(LIMITS.fileMax, 8 * 1024 * 1024); assert.equal(LIMITS.familyMax, 50 * 1024 * 1024); assert.equal(LIMITS.chunk, 512 * 1024);
});

test('folders: create nested, rename, move (no cycles), breadcrumb path, delete removes descendants', async () => {
  const st = memoryStore(); const c = ctx();
  const a = (await driveOp(st, c, { action: 'mkdir', name: '學校' })).body.item;
  const b = (await driveOp(st, c, { action: 'mkdir', name: '中三', parent: a.id })).body.item;
  const d = (await driveOp(st, c, { action: 'mkdir', name: '深', parent: b.id })).body.item;
  assert.equal((await driveOp(st, c, { action: 'mkdir', name: 'x', parent: 'nope' })).status, 400);
  assert.equal((await driveOp(st, c, { action: 'mkdir', name: '  ' })).body.error, 'name');
  assert.equal((await driveOp(st, c, { action: 'rename', id: b.id, name: '中三工作紙' })).body.item.name, '中三工作紙');
  assert.equal((await driveOp(st, c, { action: 'move', id: a.id, parent: d.id })).body.error, 'parent'); // into own descendant
  assert.equal((await driveOp(st, c, { action: 'move', id: a.id, parent: a.id })).body.error, 'parent');
  const items = (await driveOp(st, c, { action: 'list' })).body.items;
  assert.deepEqual(pathOf(items, d.id).map((x) => x.name), ['學校', '中三工作紙', '深']);
  assert.equal((await driveOp(st, c, { action: 'move', id: d.id, parent: '' })).body.item.parent, '');
  const f = await upload(st, c, 'n.pdf', 1000, b.id); assert.equal(f.status, 200);
  const del = await driveOp(st, c, { action: 'delete', id: a.id });
  assert.equal(del.body.deleted.length, 3); // a, b, file
  assert.equal(st._chunks.size, 0);
  assert.deepEqual((await driveOp(st, c, { action: 'list' })).body.items.map((x) => x.name), ['深']);
});

test('depth limit', async () => {
  const st = memoryStore(); const c = ctx(); let p = '';
  for (let i = 0; i < LIMITS.depth; i++) p = (await driveOp(st, c, { action: 'mkdir', name: `L${i}`, parent: p })).body.item.id;
  assert.equal((await driveOp(st, c, { action: 'mkdir', name: 'too', parent: p })).body.error, 'too_deep');
});

test('chunked upload: multi-chunk, in order, progress, read back, size checks', async () => {
  const st = memoryStore(); const c = ctx();
  const size = LIMITS.chunk * 2 + 10;
  const r = await upload(st, c, 'big.mp4', size);
  assert.equal(r.status, 200); assert.equal(r.body.got, 3); assert.equal(r.body.item.kind, 'video'); assert.equal(r.body.item.status, 'ready');
  assert.equal(r.body.item.recv, undefined); // internal counter never sent
  const g = await driveOp(st, c, { action: 'get-chunk', id: r.body.id, n: 2 });
  assert.equal(Buffer.from(g.body.data, 'base64').length, 10);
  assert.equal((await driveOp(st, c, { action: 'get-chunk', id: r.body.id, n: 3 })).body.error, 'bad_chunk');
  // out of order
  const s0 = await driveOp(st, c, { action: 'put', n: 0, name: 'o.bin', size: LIMITS.chunk * 2, data: b64(LIMITS.chunk) });
  assert.equal((await driveOp(st, c, { action: 'put', n: 2, id: s0.body.id, data: b64(10) })).status, 409);
  // another member cannot continue someone else's upload
  assert.equal((await driveOp(st, ctx('u2'), { action: 'put', n: 1, id: s0.body.id, data: b64(LIMITS.chunk) })).status, 404);
  // declared size smaller than what is sent
  assert.equal((await driveOp(st, c, { action: 'put', n: 0, name: 'lie.bin', size: 5, data: b64(LIMITS.chunk) })).body.error, 'size_mismatch');
  assert.equal((await driveOp(st, c, { action: 'put', n: 0, name: 'bad.bin', size: 5, data: 'abc$' })).body.error, 'bad_chunk');
  assert.equal((await driveOp(st, c, { action: 'put', n: 0, name: 'big.bin', size: LIMITS.chunk + 1, data: b64(LIMITS.chunk + 3) })).body.error, 'bad_chunk');
  // half-finished uploads are hidden from the list
  assert.ok(!(await driveOp(st, c, { action: 'list' })).body.items.some((x) => x.name === 'o.bin'));
});

test('limits: 8 MB per file, 50 MB per family; quota counts in-progress uploads', async () => {
  const st = memoryStore(); const c = ctx();
  const r = await driveOp(st, c, { action: 'put', n: 0, name: 'huge.zip', size: LIMITS.fileMax + 1, data: b64(10) });
  assert.equal(r.status, 413); assert.equal(r.body.error, 'file_too_large');
  // fill to 48 MB with metadata-only items
  const full = memoryStore({ [F]: Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, kind: 'other', name: `x${i}`, parent: '', size: 8 * 1024 * 1024, chunks: 16, status: 'ready', createdBy: 'u1' })) });
  const r2 = await driveOp(full, c, { action: 'put', n: 0, name: 'a.bin', size: 3 * 1024 * 1024, data: b64(LIMITS.chunk) });
  assert.equal(r2.body.error, 'family_full');
  assert.equal((await driveOp(full, c, { action: 'list' })).body.used, 48 * 1024 * 1024);
  const r3 = await driveOp(full, c, { action: 'put', n: 0, name: 'b.bin', size: 1024, data: b64(1024) }); assert.equal(r3.status, 200);
  void st;
});

test('abandoned uploads are cleaned (chunks removed) on list after 30 min', async () => {
  const st = memoryStore(); let now = 1e12; const c = { ...ctx(), now: () => now };
  const s0 = await driveOp(st, c, { action: 'put', n: 0, name: 'o.bin', size: LIMITS.chunk * 2, data: b64(LIMITS.chunk) });
  assert.equal(st._chunks.size, 1);
  now += 31 * 60e3;
  const l = await driveOp(st, c, { action: 'list' }); assert.equal(l.body.cleaned, 1); assert.equal(st._chunks.size, 0); assert.equal(await st.get(F, s0.body.id), null);
});

test('permissions: guests read only; children edit only their own; parents and owner edit all', async () => {
  const st = memoryStore(); const kid = ctx('k1', 'child'); const kid2 = ctx('k2', 'child'); const dad = ctx('p1', 'parent'); const guest = ctx('g1', 'guest'); const owner = ctx('o1', 'child', true);
  const doc = (await driveOp(st, kid, { action: 'doc-new', name: '筆記', html: '<p>hi</p>' })).body.item;
  assert.equal((await driveOp(st, guest, { action: 'mkdir', name: 'x' })).status, 403);
  assert.equal((await driveOp(st, guest, { action: 'list' })).status, 200);
  assert.equal((await driveOp(st, guest, { action: 'get-doc', id: doc.id })).status, 200);
  assert.equal((await driveOp(st, kid2, { action: 'rename', id: doc.id, name: 'y' })).status, 403);
  assert.equal((await driveOp(st, kid2, { action: 'delete', id: doc.id })).status, 403);
  assert.equal((await driveOp(st, dad, { action: 'rename', id: doc.id, name: '爸改' })).status, 200);
  assert.equal((await driveOp(st, owner, { action: 'doc-save', id: doc.id, html: '<p>ok</p>' })).status, 200);
  // a folder holding a sibling's file cannot be deleted by another child
  const fo = (await driveOp(st, kid2, { action: 'mkdir', name: 'share' })).body.item;
  await driveOp(st, kid, { action: 'move', id: doc.id, parent: fo.id });
  assert.equal((await driveOp(st, kid2, { action: 'delete', id: fo.id })).body.error, 'forbidden_inside');
  assert.equal((await driveOp(st, kid, { action: 'delete', id: doc.id })).status, 200);
  assert.equal(st._chunks.size, 0); // doc HTML removed too
});

test('documents: sanitised on the server, text extract, checklist state kept', async () => {
  const st = memoryStore(); const c = ctx();
  const html = '<h2 onclick="x()">Trip</h2><script>alert(1)</script><ul><li data-check="1" style="color:red">Passports</li><li data-check="0">Chargers</li></ul><p><b>8</b> <i>am</i><a href="javascript:1">l</a><img src=x onerror=1></p>';
  const d = (await driveOp(st, c, { action: 'doc-new', name: 'Trip', html })).body.item;
  const g = await driveOp(st, c, { action: 'get-doc', id: d.id });
  assert.equal(g.body.html, '<h2>Trip</h2><ul><li data-check="1">Passports</li><li data-check="0">Chargers</li></ul><p><b>8</b> <i>am</i>l</p>');
  assert.ok(!/script|onclick|onerror|javascript|style=/i.test(g.body.html));
  assert.match(d.text, /Trip\nPassports\nChargers/);
  assert.equal(docText('a&amp;b<br>c'), 'a&b\nc');
  assert.ok(sanitizeDoc('x'.repeat(LIMITS.docMax + 50)).length <= LIMITS.docMax);
  assert.equal((await driveOp(st, c, { action: 'get-chunk', id: d.id, n: 0 })).status, 404);
});

test('sort (folders first) + search', () => {
  const items = [{ id: 1, kind: 'pdf', name: 'b', size: 5, updatedAt: 3 }, { id: 2, kind: 'folder', name: 'z', size: 0, updatedAt: 1 }, { id: 3, kind: 'image', name: 'a10', size: 9, updatedAt: 2 }, { id: 4, kind: 'image', name: 'a9', size: 1, updatedAt: 4 }];
  assert.deepEqual(sortItems(items, 'name').map((x) => x.name), ['z', 'a9', 'a10', 'b']);
  assert.deepEqual(sortItems(items, 'size', 'desc').map((x) => x.id), [2, 3, 1, 4]);
  assert.deepEqual(sortItems(items, 'date').map((x) => x.id), [2, 3, 1, 4]);
  assert.deepEqual(sortItems(items, 'type').map((x) => x.id), [2, 4, 3, 1]);
  assert.deepEqual(searchItems([{ name: 'Physics', text: '' }, { name: 'x', text: 'physics notes' }, { name: 'y' }], 'PHYS').length, 2);
});

test('server route: verifies caller family membership before any op; chunks never readable by client rules', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT ||= '{}';
  const { driveRoute } = await import('../api/_run24.js');
  const store = memoryStore();
  const db = { 'users/u1': { familyId: F }, [`families/${F}`]: { memberIds: ['u1'], ownerId: 'u1' }, [`families/${F}/members/u1`]: { role: 'parent' }, 'users/u9': { familyId: F }, 'users/u8': {} };
  const get = async (p) => (db[p] ? { data: db[p] } : null);
  const call = async (uid, body) => { const r = await driveRoute({ uid, token: 't' }, body, { get, store, hasSa: () => true }); return { status: r.status, body: await r.json() }; };
  assert.equal((await call('u1', { action: 'mkdir', name: 'A' })).status, 200);
  assert.equal((await call('u9', { action: 'list' })).body.error, 'not_member'); // claims the family but is not in memberIds
  assert.equal((await call('u8', { action: 'list' })).body.error, 'no_family');
  assert.equal((await call('u1', { action: 'list' })).body.items.length, 1);
  const r503 = await driveRoute({ uid: 'u1' }, {}, { get, store, hasSa: () => false }); assert.equal(r503.status, 503);
  const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
  assert.ok(!/match \/\{document=\*\*\}/.test(rules));
  assert.ok(!/match \/drive|match \/driveChunks/.test(rules.replace(/\/\/.*$/gm, '')) || /driveChunks\/\{[^}]+\}\s*\{\s*allow read, write: if false/.test(rules));
  const ops = fs.readFileSync(new URL('../api/ops.js', import.meta.url), 'utf8');
  assert.match(ops, /op === 'app-drive'[\s\S]{0,300}callerOf\(req\)[\s\S]{0,200}driveRoute/);
});

test('drive strings exist in zh-Hant / en / th with the same keys', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  const zh = keys(R24['zh-Hant'].drive); assert.ok(zh.length > 40);
  assert.deepEqual(keys(R24.en.drive), zh); assert.deepEqual(keys(R24.th.drive), zh);
  assert.ok(!/[们这说个]/.test(JSON.stringify(R24['zh-Hant'].drive))); // Traditional, not Simplified
});
