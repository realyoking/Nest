import './_env.mjs';
// HK helpers (pure) + live public data (HKO, KMB, Citybus, MTR, 1823). Live tests run unless NO_LIVE=1.
// node --test test/hk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { normWarnsum, newWarnings, warnSig, schoolArrangement, suspensionItems, parse1823, upcomingHolidays, leavePlan, normMtr, hkoTime, parseMtrCsv } from '../src/lib/hk.js';
import { hkRoute } from '../api/_hk.js';

const NOW = Date.parse('2026-10-18T05:00:00Z');
test('HKO time + warnsum + new-warning detection', () => {
  assert.equal(hkoTime('Sun 2026-10-18 8:15 AM HKT (UTC+08:00)'), Date.parse('2026-10-18T00:15:00Z'));
  assert.equal(hkoTime('Sun 2026-10-18 12:45 PM HKT (UTC+08:00)'), Date.parse('2026-10-18T04:45:00Z'));
  const cur = normWarnsum({
    WRAIN: { name: 'Rainstorm Warning Signal', code: 'WRAINR', type: 'Red', actionCode: 'ISSUE', issueTime: 'Sun 2026-10-18 9:00 AM HKT (UTC+08:00)' },
    WTCSGNL: { name: 'Tropical Cyclone Warning Signal', code: 'TC8NE', type: 'No. 8 Northeast Gale or Storm Signal', actionCode: 'ISSUE', issueTime: 'Sun 2026-10-18 8:40 AM HKT (UTC+08:00)' },
    WFIRE: { name: 'Fire Danger Warning', code: 'WFIREY', type: 'Yellow', actionCode: 'CANCEL', issueTime: 'Sun 2026-10-18 6:00 AM HKT (UTC+08:00)' },
  });
  assert.deepEqual(cur.map((w) => w.code), ['WRAINR', 'TC8NE']); // cancelled dropped, severe first
  assert.equal(newWarnings(cur, []).length, 2);
  assert.equal(newWarnings(cur, cur.map(warnSig)).length, 0);
  const amber = normWarnsum({ WRAIN: { name: 'R', code: 'WRAINA', actionCode: 'ISSUE', issueTime: 'Sun 2026-10-18 8:00 AM HKT (UTC+08:00)' } });
  assert.deepEqual(newWarnings(cur, amber.map(warnSig)).map((w) => w.code), ['WRAINR', 'TC8NE']); // upgrade = new
  assert.equal(schoolArrangement(cur, 'en').level, 3);
  assert.match(schoolArrangement(cur, 'zh-Hant').text, /停課/);
  assert.equal(schoolArrangement([{ code: 'WFIREY' }]), null);
  const rss = '<item><title><![CDATA[Classes of all day schools are suspended tomorrow]]></title><link>https://www.info.gov.hk/x</link><pubDate>Sun, 18 Oct 2026 10:00:00 +0800</pubDate></item><item><title><![CDATA[Other]]></title><pubDate>Sun, 18 Oct 2026 10:00:00 +0800</pubDate></item>';
  assert.equal(suspensionItems(rss, NOW).length, 1);
});
test('holidays + leave plan + MTR parsing', () => {
  const pub = parse1823({ vcalendar: [{ vevent: [{ dtstart: ['20261019', { value: 'DATE' }], dtend: ['20261020', { value: 'DATE' }], summary: '重陽節翌日' }] }] });
  assert.deepEqual(pub, [{ date: '2026-10-19', end: '2026-10-20', name: '重陽節翌日' }]);
  assert.equal(upcomingHolidays(pub, NOW, 7)[0].inDays, 1);
  const etas = [NOW + 3 * 60e3, NOW + 9 * 60e3, NOW + 20 * 60e3];
  assert.equal(leavePlan(etas, { walk: 5 }, NOW).catchAt, NOW + 9 * 60e3);
  // arrive by 13:40 with a 25 min ride → latest departure 13:15 → catch 13:09 (leave 13:04)
  const p = leavePlan(etas, { walk: 5, arriveBy: '13:40', journey: 25 }, NOW);
  assert.equal(p.catchAt, NOW + 9 * 60e3); assert.equal(p.late, false);
  assert.equal(leavePlan(etas, { walk: 5, arriveBy: '13:20', journey: 25 }, NOW).late, true);
  const m = normMtr({ status: 1, isdelay: 'N', data: { 'TWL-TST': { UP: [{ time: '2026-10-18 13:05:00', dest: 'TSW', plat: '1', valid: 'Y' }] } } }, 'TWL', 'TST');
  assert.equal(m.UP[0].t, Date.parse('2026-10-18T05:05:00Z'));
  assert.equal(parseMtrCsv('"Line Code","Direction","Station Code","Station ID","Chinese Name","English Name","Sequence"\n"TKL","DT","POA","52","寶琳","Po Lam",1.00\n"TKL","TKS-DT","LHP","53","康城","LOHAS Park",1.00')[0].stations.length, 2);
});

// ---------- live ----------
function fakeRes() {
  const r = { statusCode: 0, headers: {}, body: '' };
  return { r, res: { set statusCode(v) { r.statusCode = v; }, setHeader: (k, v) => { r.headers[k] = v; }, end: (b) => { r.body = b; } } };
}
async function call(op, params = {}) {
  const { r, res } = fakeRes();
  await hkRoute(op, new URLSearchParams(params), res);
  return { status: r.statusCode, json: JSON.parse(r.body), headers: r.headers };
}
const live = process.env.NO_LIVE ? test.skip : test;
live('live: HKO warnings + weather', async () => {
  const w = await call('hk-warn', { lang: 'zh-Hant' });
  assert.equal(w.status, 200); assert.ok(Array.isArray(w.json.warnings)); assert.match(w.headers['cache-control'], /s-maxage=30/);
  const wx = await call('hk-weather', { lang: 'en' });
  assert.equal(wx.status, 200); assert.equal(typeof wx.json.temp, 'number'); assert.ok(wx.json.today?.max);
  console.log('  warnings now:', w.json.warnings.map((x) => `${x.code} ${x.name}${x.type ? ' ' + x.type : ''}`).join(', ') || 'none', '| temp', wx.json.temp, '| today', wx.json.today.min, '-', wx.json.today.max);
});
live('live: 1823 holidays', async () => {
  const h = await call('hk-holidays', { lang: 'zh-Hant' });
  assert.equal(h.status, 200); assert.ok(h.json.publicHolidays.length > 30); assert.ok(h.json.school.length >= 4);
  console.log('  next holidays:', upcomingHolidays(h.json.publicHolidays, Date.now(), 70).map((x) => `${x.date} ${x.name}`).join(', '));
});
live('live: KMB route → stops → ETA', async () => {
  const r = await call('hk-routes', { co: 'kmb', route: '1A' });
  assert.ok(r.json.routes.length >= 2);
  const st = await call('hk-stops', { co: 'kmb', route: '1A', dir: r.json.routes[0].dir, svc: r.json.routes[0].svc });
  assert.ok(st.json.stops.length > 10); assert.ok(st.json.stops[0].tc);
  const e = await call('hk-eta', { items: `kmb:1A:${r.json.routes[0].dir}:${r.json.routes[0].svc}:${st.json.stops[2].id}` });
  assert.equal(e.status, 200); assert.ok(Array.isArray(e.json.items[0].etas));
  console.log('  KMB 1A @', st.json.stops[2].tc, '→', e.json.items[0].etas.slice(0, 3).map((x) => new Date(x.t + 8 * 3600e3).toISOString().slice(11, 16)).join(' '));
});
live('live: Citybus route → stops → ETA', async () => {
  const r = await call('hk-routes', { co: 'ctb', route: '1' });
  assert.ok(r.json.routes.length >= 1);
  const st = await call('hk-stops', { co: 'ctb', route: '1', dir: 'O' });
  assert.ok(st.json.stops.length > 5); assert.ok(st.json.stops[0].tc);
  const e = await call('hk-eta', { items: `ctb:1:O:${st.json.stops[1].id}` });
  assert.equal(e.status, 200); assert.ok(Array.isArray(e.json.items[0].etas));
  console.log('  CTB 1 @', st.json.stops[1].tc, '→', e.json.items[0].etas.slice(0, 3).map((x) => new Date(x.t + 8 * 3600e3).toISOString().slice(11, 16)).join(' '));
});
live('live: MTR lines + next train + status', async () => {
  const m = await call('hk-mtr');
  assert.ok(m.json.lines.length >= 9); assert.ok(m.json.status?.TWL?.status);
  const e = await call('hk-eta', { items: 'mtr:TWL:TST' });
  assert.ok(e.json.items[0].mtr); assert.ok(e.json.mtrStatus?.TWL);
  console.log('  MTR TWL TST UP:', e.json.items[0].mtr.UP.slice(0, 3).map((x) => new Date(x.t + 8 * 3600e3).toISOString().slice(11, 16)).join(' '), '| status', e.json.mtrStatus.TWL.status);
});
