import './_env.mjs';
// Run 6: changelog data, what's-new AI block, environment header, deploy changelog check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHANGELOG, APP_VERSION, latestFor } from '../src/data/changelog.js';
import { whatsNewBlock, WHATSNEW_RE } from '../src/lib/whatsnew-ai.js';
import { cleanEnv, envLine, wantsEnv, detectOs, sizeClass, pageName } from '../src/lib/env.js';
import { classify } from '../src/lib/grounding.js';
const COLLOQUIAL = new RegExp(fs.readFileSync('test/zh-hk.test.mjs', 'utf8').match(/export const COLLOQUIAL = \/(.*)\/;/)[1]);

test('changelog: newest first, HKT dates, three languages, no internal details, 書面語', () => {
  assert.ok(CHANGELOG.length >= 8);
  assert.equal(APP_VERSION, CHANGELOG[0].version);
  for (let i = 0; i < CHANGELOG.length; i++) {
    const e = CHANGELOG[i];
    assert.match(e.date, /^2026-\d\d-\d\d$/);
    if (i) assert.ok(e.date <= CHANGELOG[i - 1].date, `${e.version} order`);
    for (const l of ['zh-Hant', 'zh-Hans', 'en']) { assert.ok(e[l]?.title, `${e.version} ${l}`); assert.equal(e[l].items.length, e['zh-Hant'].items.length, `${e.version} ${l} items`); }
    const all = JSON.stringify(e);
    assert.doesNotMatch(all, /agnes|vercel|firebase|firestore|quota|api\/|\.js|admin|deploy|dpl_|secret|token/i, e.version);
    for (const x of [e['zh-Hant'].title, ...e['zh-Hant'].items]) assert.doesNotMatch(x, COLLOQUIAL, x);
  }
  // tonight's fixes are back-filled
  const top = CHANGELOG.find((e) => e.version === '1.7.0')['zh-Hant'].items.join(' ');
  for (const w of ['重複', '提我', '重複建立', '書面語', '互動']) assert.ok(top.includes(w), w);
});

test("what's new: only the latest 3 entries + link; questions detected, not looked up on Wikipedia", () => {
  const b = whatsNewBlock('zh-Hant');
  assert.match(b, /\/app\/changelog/);
  assert.equal((b.match(/^- \d+\.\d+\.\d+/gm) || []).length, 3);
  assert.equal(latestFor('en', 3)[0].title, CHANGELOG[0].en.title);
  for (const q of ["What's new in Nest?", 'Nest 最近有咩更新？', '有甚麼新功能？', '最近更新了什麼？']) { assert.ok(WHATSNEW_RE.test(q), q); assert.equal(classify(q).lookup, '', q); }
  for (const q of ['what is new york', '提醒我明天交功課', 'Claude 最新模型係咩？']) assert.equal(WHATSNEW_RE.test(q), false, q);
});

test('environment header: device / size / page detection and one sanitized line', () => {
  assert.equal(detectOs('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'), 'iPadOS');
  assert.equal(detectOs('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit', '', 5), 'iPadOS');
  assert.equal(detectOs('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'iOS');
  assert.equal(detectOs('Mozilla/5.0 (Linux; Android 15; Pixel 9)'), 'Android');
  assert.equal(detectOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows');
  assert.deepEqual([390, 820, 1180, 1600].map(sizeClass), ['phone', 'tablet-narrow', 'tablet-wide', 'desktop']);
  assert.equal(pageName('/app/agent/abc'), 'AI 助理'); assert.equal(pageName('/app'), '今天'); assert.equal(pageName('/app/changelog', 'en'), "What's new");
  const e = cleanEnv({ v: '1.7.0', route: '/app/tutor', display: 'pwa', os: 'iPadOS', size: 'tablet-wide', w: 1180, h: 820, nav: 'sidebar', theme: 'dark', tz: 'Asia/Hong_Kong', evil: '<script>' , lang: 'x' });
  const line = envLine(e, { plan: 'pro (beta until 2026-11-18)' });
  for (const w of ['功課導師', 'installed app', 'iPad', '1180×820', 'sidebar', 'dark theme', 'pro (beta']) assert.ok(line.includes(w), w);
  assert.ok(!line.includes('Asia/Hong_Kong'), 'HK time zone is implied');
  assert.ok(envLine({ ...e, tz: 'Europe/London' }).includes('Europe/London (not Hong Kong)'));
  assert.doesNotMatch(line, /script/);
  assert.ok(line.length < 420, `${line.length}`);
  const short = envLine(e, { plan: 'pro' }, { full: false });
  assert.equal(short, 'App: Nest 1.7.0 · page 功課導師 · iPad home-screen app · left sidebar (mention only if asked about the app/device).');
  assert.ok(short.length < 120, `${short.length}`);
  assert.equal(cleanEnv({ os: 'Evil', display: 'x', route: '/app/"><img' }).os, 'unknown');
  assert.doesNotMatch(cleanEnv({ route: '/app/"><img src=x>' }).route, /[<>"]/);
  assert.equal(envLine(null), '');
});

test('server wiring: env + whats-new + nest-ui inserted before the closing language rule; no new api files', () => {
  const src = fs.readFileSync('api/chat.js', 'utf8');
  assert.match(src, /envLine\(cleanEnv\(body\.env\), \{ plan: planText\(rplan\) \}, \{ full: wantsEnv\(lastUser\) \}\)/);
  assert.match(src, /whatsNewBlock\(/);
  assert.match(src, /uiRule\(mode, lastUser(, prevVis)?\)/);
  const fns = fs.readdirSync('api', { recursive: true }).filter((f) => /\.js$/.test(f) && !/(^|\/)_/.test(f));
  assert.ok(fns.length <= 12, `functions: ${fns.length}`);
  assert.match(fs.readFileSync('src/lib/ai.js', 'utf8'), /env: detectEnv\(\)/);
});

test('deploy script checks the changelog date', () => {
  assert.match(fs.readFileSync('scripts/deploy.mjs', 'utf8'), /changelogCheck/);
});

test('env: full line only for page / device / app questions', () => {
  for (const q of ['我而家喺邊頁？', '我用緊咩裝置？', '我在哪一頁？', '我在用什么设备？', 'Where is the settings button?', 'how do I find reminders', '點樣改深色模式', '側欄去咗邊', 'Which version is this app?']) assert.ok(wantsEnv(q), q);
  for (const q of ['hi', 'Claude 最新模型係咩？', '3x+6=21 點解', '提我聽日下晝四點前交中文功課', 'Who is the CEO of Anthropic?', '我今日用咗幾多']) assert.ok(!wantsEnv(q), q);
});
