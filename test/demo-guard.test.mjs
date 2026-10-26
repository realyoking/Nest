import './_env.mjs';
// Run 10 regression: the landing demo must never change the real account (the '@mum' incident).
import test from 'node:test'; import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path';

// Minimal browser shims before importing the guard.
class MemStorage { constructor() { this.m = new Map(); } get length() { return this.m.size; } key(i) { return [...this.m.keys()][i] ?? null; } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } removeItem(k) { this.m.delete(k); } }
globalThis.Storage = MemStorage;
const calls = [];
globalThis.window = { location: { href: 'https://heynest.vercel.app/', origin: 'https://heynest.vercel.app', pathname: '/' }, fetch: async (u, i) => { calls.push([String(u), i]); return { ok: true }; }, Storage: MemStorage };
window.localStorage = new MemStorage(); window.sessionStorage = new MemStorage();
const G = await import('../src/lib/demo-guard.js');

test('fetch: authorized /api calls are refused while the demo is mounted, allowed after', async () => {
  const release = G.enterDemo();
  await assert.rejects(window.fetch('/api/plugins/profile-save', { method: 'POST', headers: { authorization: 'Bearer real' } }), (e) => e.code === 'demo_blocked');
  await assert.rejects(window.fetch('https://heynest.vercel.app/api/chat', { headers: { Authorization: 'Bearer x' } }), (e) => e.code === 'demo_blocked');
  await window.fetch('/api/promo'); // public, no token → allowed
  assert.equal(calls.length, 1);
  release();
  await window.fetch('/api/plugins/profile-save', { method: 'POST', headers: { authorization: 'Bearer real' } });
  assert.equal(calls.length, 2);
  release(); // double release is harmless
  assert.equal(G.demoActive(), false);
});

test('storage: demo writes to nest.* keys stay in memory; device language stays real', () => {
  window.localStorage.setItem('nest.brief.realuid', 'REAL');
  const release = G.enterDemo();
  window.localStorage.setItem('nest.brief.realuid', 'DEMO');
  window.localStorage.setItem('nest.handle', 'mum');
  window.sessionStorage.removeItem('nest.x');
  window.localStorage.setItem('nest.lang', 'en');
  assert.equal(window.localStorage.getItem('nest.brief.realuid'), 'DEMO'); // the demo sees its own value
  release();
  assert.equal(window.localStorage.getItem('nest.brief.realuid'), 'REAL');
  assert.equal(window.localStorage.getItem('nest.handle'), null);
  assert.equal(window.localStorage.getItem('nest.lang'), 'en');
});

test('cleanDemoKeys removes demo-scoped keys once', () => {
  const s = new MemStorage(); s.setItem('nest.brief.u1', '1'); s.setItem('nest.plan.f1', '1'); s.setItem('nest.chat.side', '1'); s.setItem('firebase:x', '1');
  assert.deepEqual(G.cleanDemoKeys(s).sort(), ['nest.brief.u1', 'nest.plan.f1']);
  assert.equal(s.getItem('nest.chat.side'), '1'); assert.equal(s.getItem('firebase:x'), '1');
  s.setItem('nest.brief.u1', '2'); assert.deepEqual(G.cleanDemoKeys(s), []); // once per device
});

const root = path.resolve(new URL('..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
test('backend.js wraps EVERY backend.real export, tokens + writes guarded', () => {
  const real = [...read('src/lib/backend.real.js').matchAll(/^export (?:async )?(?:function|const|let) ([A-Za-z0-9_]+)/gm)].map((m) => m[1]).sort();
  const wrapped = [...read('src/lib/backend.js').matchAll(/^export const ([A-Za-z0-9_]+) =/gm)].map((m) => m[1]).filter((n) => n !== 'GUARDED_EXPORTS').sort();
  assert.deepEqual(wrapped, real);
  const b = read('src/lib/backend.js');
  for (const n of ['saveProfile', 'updateMyMember', 'deleteAccount', 'addReminder', 'signOut', 'changePassword']) assert.match(b, new RegExp(`export const ${n} = guard\\('${n}'\\)`));
  assert.match(b, /export const getIdToken = \(\) => \(demoActive\(\)/);
  assert.match(b, /export const currentUser = \(\) => \(demoActive\(\) \? null/);
});
test('only backend.js imports backend.real.js', () => {
  const offenders = [];
  (function walk(d) { for (const f of fs.readdirSync(path.join(root, d))) { const p = path.join(d, f); if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else if (/\.(js|jsx)$/.test(f) && p !== path.join('src', 'lib', 'backend.js') && /backend\.real\.js['"]/.test(read(p))) offenders.push(p); } })('src');
  assert.deepEqual(offenders, []);
});
test('demo mounts the guard; Settings never saves the public profile in the demo; plugin API uses the in-memory store in the demo', () => {
  assert.match(read('src/components/DemoApp.jsx'), /enterDemo\(\)/);
  assert.match(read('src/pages/app/Settings.jsx'), /if \(!demo && \(pub \|\| h\)\)/);
  assert.match(read('src/lib/plugins/api.js'), /if \(MOCK \|\| demoActive\(\)\) return mock\(op, body\)/);
  assert.match(read('src/lib/plugins/api.js'), /'x-nest-origin'/);
});
test('server: profile-save / creator-save refuse calls without the real-app marker', () => {
  const s = read('api/_plugins.js');
  assert.match(s, /PROFILE_WRITE_OPS = new Set\(\['profile-save', 'creator-save'\]\)/);
  assert.match(s, /PROFILE_WRITE_OPS\.has\(name\) && req\.headers\.get\('x-nest-origin'\) !== 'app'\) return json\(403, \{ error: 'origin_required' \}\)/);
});
