import './_env.mjs';
// Run 11: region data, packs, gating helpers, AI context, onboarding/settings wiring, demo-pollution helpers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COUNTRIES, PACKS, normRegion, regionName, flagOf, regionSearch, packFor, hkFeatures, staticHolidays, suggestRegion, regionContext, setActiveRegion, getActiveRegion } from '../src/lib/regions/index.js';
import { HOLIDAYS } from '../src/lib/regions/holidays.js';
import { LAND } from '../src/lib/regions/land.js';
import { project, unproject, nearestRegion } from '../src/lib/regions/geo.js';

test('all ISO 3166-1 alpha-2 regions (249), unique, with names in 3 languages', () => {
  assert.equal(COUNTRIES.length, 249);
  assert.equal(new Set(COUNTRIES.map((r) => r[0])).size, 249);
  for (const r of COUNTRIES) { assert.match(r[0], /^[A-Z]{2}$/); assert.ok(r[3] && r[4] && r[5], r[0]); assert.ok(Math.abs(r[1]) <= 90 && Math.abs(r[2]) <= 180, r[0]); }
  assert.equal(regionName('HK', 'zh-Hant'), '香港'); assert.equal(regionName('MO', 'zh-Hant'), '澳門'); assert.equal(regionName('TW', 'zh-Hant'), '台灣');
  assert.equal(regionName('HK', 'zh-Hans'), '香港'); assert.equal(regionName('TW', 'en'), 'Taiwan'); assert.equal(regionName('IT', 'zh-Hant'), '意大利');
  assert.equal(flagOf('JP'), '🇯🇵'); assert.equal(normRegion('gb'), 'GB'); assert.equal(normRegion('XK'), ''); assert.equal(normRegion('ZZ'), '');
});
test('search: code, names, aliases', () => {
  assert.equal(regionSearch('uk', 'en')[0].code, 'GB');
  assert.equal(regionSearch('日本', 'zh-Hant')[0].code, 'JP');
  assert.equal(regionSearch('macau', 'en')[0].code, 'MO');
  assert.ok(regionSearch('台湾', 'zh-Hans').some((x) => x.code === 'TW'));
  assert.equal(regionSearch('', 'en').length, 249);
});
test('15 packs + EU base + global fallback', () => {
  for (const c of ['HK', 'MO', 'CN', 'TW', 'SG', 'JP', 'KR', 'US', 'GB', 'AU', 'CA', 'DE', 'FR', 'IN', 'MY']) {
    const p = packFor(c); assert.ok(p.hasPack, c); assert.ok(p.emergency?.note, c); assert.ok(p.currency, c); assert.ok(p.weather?.url?.startsWith('http'), c); assert.ok(p.exams.length, c);
    assert.ok([1, 7].includes(p.firstDay), c); assert.ok(['C', 'F'].includes(p.temp), c);
  }
  assert.equal(packFor('US').temp, 'F'); assert.equal(packFor('US').emergency.all, '911'); assert.equal(packFor('GB').emergency.all, '999 or 112'); assert.equal(packFor('AU').emergency.all, '000');
  assert.equal(packFor('CN').noGoogle, true); assert.ok(packFor('CN').transport.every((x) => !/google/i.test(x.url)));
  assert.equal(packFor('IT').eu, true); assert.equal(packFor('IT').currency, 'EUR'); assert.equal(packFor('IT').emergency.all, '112');
  assert.equal(packFor('BR').hasPack, false); assert.equal(packFor('BR').id, 'BR'); assert.equal(packFor('').id, 'GLOBAL');
});
test('HK-only gating helper', () => {
  assert.equal(hkFeatures('HK'), true); for (const c of ['MO', 'GB', 'US', 'CN', '']) assert.equal(hkFeatures(c), false);
  assert.equal(PACKS.HK.live.transport, true); assert.ok(!PACKS.GB.live);
});
test('static holidays: nationwide rows, sorted window, no CN/SG/KR 2027 guesses', () => {
  for (const [c, rows] of Object.entries(HOLIDAYS)) for (const [d, n] of rows) { assert.match(d, /^\d{4}-\d{2}-\d{2}$/); assert.ok(n, c); }
  for (const c of ['CN', 'SG', 'KR']) assert.ok(HOLIDAYS[c].every(([d]) => d < '2027'), c);
  assert.ok(!HOLIDAYS.HK && !HOLIDAYS.MO && !HOLIDAYS.TW && !HOLIDAYS.IN && !HOLIDAYS.MY);
  const us = staticHolidays('US', Date.UTC(2026, 9, 19), 60).map((h) => h.date);
  assert.ok(us.includes('2026-11-26')); // Thanksgiving 2026
  assert.deepEqual(staticHolidays('HK'), []);
});
test('suggestRegion from time zone, then language region', () => {
  assert.equal(suggestRegion({ tz: 'Europe/London', languages: [] }), 'GB');
  assert.equal(suggestRegion({ tz: 'Asia/Hong_Kong', languages: ['en-US'] }), 'HK');
  assert.equal(suggestRegion({ tz: 'Etc/UTC', languages: ['fr-CA'] }), 'CA');
  assert.equal(suggestRegion({ tz: 'Etc/UTC', languages: ['en'] }), '');
});
test('AI context: region named, no HK assumption outside HK', () => {
  const gb = regionContext('GB', { tz: 'Europe/London' });
  assert.match(gb, /United Kingdom \(GB\)/); assert.match(gb, /999 or 112/); assert.match(gb, /GCSE/); assert.match(gb, /Met Office/); assert.match(gb, /do NOT apply/); assert.match(gb, /week starts Monday/);
  assert.match(regionContext('US'), /°F/); assert.match(regionContext('CN'), /not Google/);
  assert.match(regionContext('HK'), /Hong Kong live data/); assert.match(regionContext(''), /not set/);
  assert.match(regionContext('BR'), /Brazil/);
  setActiveRegion('jp'); assert.equal(getActiveRegion(), 'JP'); setActiveRegion(''); assert.equal(getActiveRegion(), '');
});
test('globe math: projection round trip + nearest region', () => {
  const [x, y, d] = project(22.3, 114.2, 22.3, 114.2); assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && d > 0.999);
  const p = project(35, 139, 30, 120); const back = unproject(p[0], p[1], 30, 120);
  assert.ok(Math.abs(back[0] - 35) < 1e-6 && Math.abs(back[1] - 139) < 1e-6);
  assert.equal(unproject(1.2, 0, 0, 0), null);
  assert.equal(nearestRegion(36.2, 138.2), 'JP'); assert.equal(nearestRegion(0, -140), null);
  assert.ok(LAND.rings.length > 100);
});
test('wiring: required onboarding step, gate, settings, AI body, server prompt', () => {
  const ob = fs.readFileSync('src/pages/Onboarding.jsx', 'utf8');
  assert.match(ob, /TOTAL = 7/); assert.match(ob, /disabled=\{!region\}/); assert.match(ob, /saveProfile\(s\.user\.uid, \{ region, regionAt/);
  const shell = fs.readFileSync('src/components/AppShell.jsx', 'utf8');
  assert.match(shell, /!demo && s\.profile && !region\) return <RegionGate/); assert.match(shell, /HK_ONLY = \['transport'\]/);
  const gate = fs.readFileSync('src/components/RegionGate.jsx', 'utf8');
  assert.equal((gate.match(/import\('\.\/RegionPicker\.jsx'\)/g) || []).length, 1); assert.match(gate, /data-testid="region-save"/);
  assert.match(fs.readFileSync('src/lib/ai.js', 'utf8'), /region: getActiveRegion\(\)/);
  const chat = fs.readFileSync('api/chat.js', 'utf8');
  assert.match(chat, /hkLive = !region \|\| region === 'HK'/); assert.match(chat, /transportQuery\(lastUser\) : null/); assert.match(chat, /regionContext\(rg/);
  const home = fs.readFileSync('src/components/HomeCards.jsx', 'utf8'); assert.match(home, /hkOn = mock \|\| !region \|\| hkFeatures\(region\)/);
  assert.equal(fs.readdirSync('api').filter((f) => f.endsWith('.js') && !f.startsWith('_')).length + fs.readdirSync('api/google').length + fs.readdirSync('api/oauth').length + fs.readdirSync('api/push').length, 12);
});
