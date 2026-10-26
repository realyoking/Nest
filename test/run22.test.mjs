import './_env.mjs';
// Run 22: holiday themes, gestures, micro-animation CSS rules, AI 助理 multi-send queue.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seasonFor, seasonWindows, parseOverride, resolveSeason, LNY, MID_AUTUMN, hkDay, seasonText } from '../src/lib/seasons.js';
import { lockAxis, swipeDecision, swipeOffset, pullDistance, pullReady, PULL_TRIGGER, backDecision, swipeBackAllowed, edgeStart } from '../src/lib/gestures.js';
import { enqueue, takeBatch, restore, combineBatch, lastTurn, QUEUE_MAX, BATCH_MAX } from '../src/lib/chat-queue.js';
import { systemPrompt, BATCH_RULE } from '../api/chat.js';

const at = (iso) => Date.parse(iso); // ISO with +08:00

test('seasons: Halloween / Christmas windows on the Hong Kong calendar', () => {
  assert.equal(seasonFor(at('2026-10-22T16:40:00+08:00')), 'halloween'); // today (Run 22)
  assert.equal(seasonFor(at('2026-10-31T23:59:00+08:00')), 'halloween');
  assert.equal(seasonFor(at('2026-11-01T23:59:00+08:00')), 'halloween');
  assert.equal(seasonFor(at('2026-11-02T00:00:00+08:00')), null);
  assert.equal(seasonFor(at('2026-10-16T23:59:00+08:00')), null);
  // HK midnight, not UTC midnight: 2026-10-16 17:00 UTC = 2026-10-17 01:00 HKT
  assert.equal(seasonFor(Date.UTC(2026, 9, 16, 17)), 'halloween');
  assert.equal(hkDay(Date.UTC(2026, 9, 16, 17)), '2026-10-17');
  assert.equal(seasonFor(at('2026-12-01T00:00:00+08:00')), 'christmas');
  assert.equal(seasonFor(at('2026-12-25T12:00:00+08:00')), 'christmas');
  assert.equal(seasonFor(at('2026-12-27T00:00:00+08:00')), null);
  assert.equal(seasonFor(at('2026-07-01T12:00:00+08:00')), null);
});

test('seasons: Lunar New Year + Mid-Autumn from the table (gazetted HK dates 2026–2030)', () => {
  // HK Government general holidays: LNY day 1
  assert.equal(LNY[2026], '02-17'); assert.equal(LNY[2027], '02-06'); assert.equal(LNY[2028], '01-26'); assert.equal(LNY[2029], '02-13'); assert.equal(LNY[2030], '02-03');
  // "the day following the Chinese Mid-Autumn Festival" 2026-09-26, 2027-09-16
  assert.equal(MID_AUTUMN[2026], '09-25'); assert.equal(MID_AUTUMN[2027], '09-15');
  assert.equal(seasonFor(at('2027-02-06T10:00:00+08:00')), 'lunarNewYear');
  assert.equal(seasonFor(at('2027-01-30T10:00:00+08:00')), 'lunarNewYear'); // 7 days before
  assert.equal(seasonFor(at('2027-01-29T10:00:00+08:00')), null);
  assert.equal(seasonFor(at('2027-02-20T10:00:00+08:00')), 'lunarNewYear'); // Lantern Festival (day 15)
  assert.equal(seasonFor(at('2027-02-21T10:00:00+08:00')), null);
  assert.equal(seasonFor(at('2028-01-20T10:00:00+08:00')), 'lunarNewYear');
  assert.equal(seasonFor(at('2026-09-25T20:00:00+08:00')), 'midAutumn');
  assert.equal(seasonFor(at('2026-09-20T20:00:00+08:00')), 'midAutumn');
  assert.equal(seasonFor(at('2026-09-27T00:00:00+08:00')), null);
  assert.equal(seasonFor(at('2028-10-03T20:00:00+08:00')), 'midAutumn');
  for (let y = 2026; y <= 2036; y++) {
    const w = seasonWindows(y);
    assert.equal(w.length, 4, `4 windows in ${y}`);
    // no overlaps
    const ord = (d) => Date.parse(d + 'T00:00:00Z');
    for (const a of w) for (const b of w) if (a !== b) assert.ok(ord(a.end) < ord(b.start) || ord(b.end) < ord(a.start), `${y} ${a.id}/${b.id} overlap`);
  }
});

test('seasons: table agrees with the ICU chinese calendar except the two known near-midnight years', () => {
  let f;
  try { f = new Intl.DateTimeFormat('en-u-ca-chinese', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric' }); } catch { return; }
  const known = new Set(['2027-02-06', '2030-02-03']);
  const md = (y, mmdd) => { const p = Object.fromEntries(f.formatToParts(new Date(`${y}-${mmdd}T12:00:00+08:00`)).map((x) => [x.type, x.value])); return `${p.month}/${p.day}`; };
  if (md(2026, '02-17') !== '1/1') return; // runtime without a Chinese calendar
  for (const [y, d] of Object.entries(LNY)) if (!known.has(`${y}-${d}`)) assert.equal(md(y, d), '1/1', `LNY ${y}`);
  for (const [y, d] of Object.entries(MID_AUTUMN)) assert.equal(md(y, d), '8/15', `Mid-Autumn ${y}`);
});

test('seasons: ?theme= override, off switch, greetings', () => {
  assert.equal(parseOverride('?theme=halloween'), 'halloween');
  assert.equal(parseOverride('?a=1&theme=lunar-new-year'), 'lunarNewYear');
  assert.equal(parseOverride('?theme=mid-autumn'), 'midAutumn');
  assert.equal(parseOverride('?theme=xmas'), 'christmas');
  assert.equal(parseOverride('?theme=none'), '');
  assert.equal(parseOverride('?theme=bogus'), undefined);
  assert.equal(parseOverride(''), undefined);
  const july = at('2026-07-01T12:00:00+08:00'); const oct = at('2026-10-22T12:00:00+08:00');
  assert.equal(resolveSeason({ now: july, override: 'christmas' }), 'christmas');
  assert.equal(resolveSeason({ now: oct, override: '' }), null);
  assert.equal(resolveSeason({ now: oct, enabled: false }), null);
  assert.equal(resolveSeason({ now: oct, enabled: false, override: 'halloween' }), 'halloween');
  assert.equal(resolveSeason({ now: oct }), 'halloween');
  assert.equal(seasonText('halloween', 'zh-Hant'), '萬聖節快樂');
  assert.equal(seasonText('christmas', 'zh-Hans'), '圣诞快乐');
  assert.equal(seasonText('lunarNewYear', 'ja'), 'Happy Lunar New Year');
});

test('seasons: decor is a lazy chunk, assets small, motion respects reduced motion', () => {
  const srcFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(`${dir}/${e.name}`) : /\.(jsx?|mjs)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
  for (const f of srcFiles('src')) {
    if (f.endsWith('season-hook.js') || f.includes('components/season/')) continue;
    assert.ok(!/from ['"][^'"]*SeasonDecor/.test(fs.readFileSync(f, 'utf8')), `${f} imports SeasonDecor statically`);
  }
  assert.match(fs.readFileSync('src/lib/season-hook.js', 'utf8'), /import\('\.\.\/components\/season\/SeasonDecor\.jsx'\)/);
  for (const f of fs.readdirSync('public/season')) assert.ok(fs.statSync(`public/season/${f}`).size < 30000, `${f} too big`);
  const css = fs.readFileSync('src/components/season/season.css', 'utf8');
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation: none/);
  for (const [, body] of css.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*\}/g)) {
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const p of props) assert.ok(['transform', 'opacity'].includes(p), `season keyframe animates ${p}`);
  }
  assert.match(fs.readFileSync('src/pages/app/Settings.jsx', 'utf8'), /SeasonRow/);
});

test('micro-animations: Run 22 keyframes are transform/opacity only; routeIn has no blur', () => {
  const css = fs.readFileSync('src/styles.css', 'utf8');
  const r22 = css.slice(css.indexOf('Run 22 — micro-animations'));
  assert.ok(r22.length > 500);
  for (const [, body] of r22.matchAll(/@keyframes [\w-]+ \{([\s\S]*?)\}\s*\}/g)) {
    for (const [, p] of body.matchAll(/([a-z-]+)\s*:/g)) assert.ok(['transform', 'opacity'].includes(p), `Run 22 keyframe animates ${p}`);
  }
  const route = css.match(/@keyframes routeIn \{([\s\S]*?)\}\s*\}/)[1];
  assert.ok(!/filter/.test(route), 'routeIn must not animate filter');
  assert.match(r22, /prefers-reduced-motion: reduce[\s\S]*\.swipe-row[\s\S]*animation: none/);
});

test('gestures: axis lock, swipe commit / cancel, rubber band', () => {
  assert.equal(lockAxis(3, 4), null);
  assert.equal(lockAxis(-30, 5), 'x');
  assert.equal(lockAxis(12, 11), 'y'); // diagonal → scroll wins
  assert.equal(lockAxis(2, 40), 'y');
  assert.equal(swipeDecision({ dx: -150, dt: 600, width: 360 }), 'commit');
  assert.equal(swipeDecision({ dx: -100, dt: 600, width: 360 }), 'cancel');
  assert.equal(swipeDecision({ dx: -70, dt: 90, width: 360 }), 'commit'); // flick
  assert.equal(swipeDecision({ dx: -30, dt: 20, width: 360 }), 'cancel'); // too short even if fast
  assert.equal(swipeDecision({ dx: 200, dt: 300, width: 360 }), 'cancel'); // wrong direction
  assert.equal(swipeDecision({ dx: -170, dt: 900, width: 700 }), 'commit'); // tablet row: capped distance
  assert.equal(swipeDecision({ dx: -150, dt: 900, width: 700 }), 'cancel');
  assert.equal(swipeOffset(-100, 360), -100);
  assert.ok(swipeOffset(-400, 360) > -300 && swipeOffset(-400, 360) < -216);
  assert.ok(swipeOffset(80, 360) > 0 && swipeOffset(80, 360) <= 18);
  assert.equal(swipeOffset(0, 360), 0);
});

test('gestures: pull-to-refresh damping + swipe-back only in the iOS home-screen app', () => {
  assert.equal(pullDistance(-20), 0);
  assert.equal(Math.round(pullDistance(100)), 55);
  assert.ok(!pullReady(pullDistance(100)));
  assert.ok(pullReady(pullDistance(140)));
  assert.ok(pullDistance(1000) <= 130);
  assert.equal(PULL_TRIGGER, 70);
  assert.equal(swipeBackAllowed({ standalone: true, ios: true }), true);
  assert.equal(swipeBackAllowed({ standalone: false, ios: true }), false); // Safari has its own back swipe
  assert.equal(swipeBackAllowed({ standalone: true, ios: false }), false); // Android system back
  assert.ok(edgeStart(10)); assert.ok(!edgeStart(60));
  assert.equal(backDecision({ dx: 160, dy: 10, dt: 400, width: 390 }), 'commit');
  assert.equal(backDecision({ dx: 60, dy: 90, dt: 400, width: 390 }), 'cancel');
  assert.equal(backDecision({ dx: 50, dy: 4, dt: 400, width: 390 }), 'cancel');
  // never inside the landing's live demo (window listeners would act on the marketing page)
  const shell = fs.readFileSync('src/components/AppShell.jsx', 'utf8');
  assert.match(shell, /<PullToRefresh [^>]*enabled=\{!chatPage && !demo\}/);
  assert.match(shell, /<SwipeBack enabled=\{fromMore && iosApp && !demo\}/);
});

test('multi-send: queue, batch, restore, retry turn', () => {
  let q = [];
  let r = enqueue(q, { text: '  ', cid: 'c1' }); assert.equal(r.ok, false);
  r = enqueue(q, { text: 'first', cid: 'c1' }); q = r.queue;
  r = enqueue(q, { text: 'second', cid: 'c1' }); q = r.queue;
  r = enqueue(q, { text: 'other chat', cid: 'c2' }); q = r.queue;
  assert.equal(q.length, 3);
  const { batch, rest } = takeBatch(q, 'c1');
  assert.deepEqual(batch.map((x) => x.text), ['first', 'second']);
  assert.deepEqual(rest.map((x) => x.text), ['other chat']);
  assert.deepEqual(restore(rest, batch).map((x) => x.text), ['first', 'second', 'other chat']);
  assert.equal(restore(q, batch).length, 3, 'no duplicates');
  for (let i = 0; i < QUEUE_MAX + 2; i++) { const x = enqueue(q, { text: `m${i}`, cid: 'c3' }); if (x.ok) q = x.queue; else assert.equal(x.reason, 'full'); }
  assert.equal(q.filter((x) => x.cid === 'c3').length, QUEUE_MAX);
  assert.deepEqual(combineBatch(['only one']), { text: 'only one', n: 1 });
  const c = combineBatch(['What is 2+2?', '', 'and remind me to buy milk']);
  assert.equal(c.n, 2);
  assert.equal(c.text, '[1] What is 2+2?\n\n[2] and remind me to buy milk');
  const big = combineBatch(Array.from({ length: 8 }, () => 'x'.repeat(4000)));
  assert.ok(big.text.length <= BATCH_MAX + 100);
  const msgs = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'A' }, { role: 'user', content: 'b', batch: 'b1' }, { role: 'user', content: 'c', batch: 'b1' }];
  const lt = lastTurn(msgs);
  assert.equal(lt.first, 2); assert.deepEqual(lt.items.map((m) => m.content), ['b', 'c']);
  assert.equal(lastTurn([{ role: 'user', content: 'x' }, { role: 'user', content: 'y' }]).items.length, 1);
  assert.equal(lastTurn([]), null);
});

test('multi-send: system prompt rule only for a real batch, only in AI 助理 (chat mode)', () => {
  assert.equal(BATCH_RULE(1), ''); assert.equal(BATCH_RULE(undefined), ''); assert.equal(BATCH_RULE('3'), '');
  const sys = systemPrompt('chat', 'en', { batch: 3 });
  assert.match(sys, /Several messages at once: the user sent 3 messages/);
  assert.match(sys, /ONE merged reply/); assert.match(sys, /answer each one separately/);
  assert.ok(!systemPrompt('chat', 'en', {}).includes('Several messages at once'));
  assert.ok(!systemPrompt('tutor', 'en', { batch: 3 }).includes('Several messages at once'));
  // wiring: only the AI 助理 page uses the queue
  const agent = fs.readFileSync('src/pages/app/Agent.jsx', 'utf8');
  assert.match(agent, /chat-queue\.js/);
  assert.match(agent, /batch: batchN/);
  for (const f of ['src/pages/app/Tutor.jsx', 'src/pages/app/PluginStudio.jsx']) assert.ok(!fs.readFileSync(f, 'utf8').includes('chat-queue'), `${f} must not queue`);
});
