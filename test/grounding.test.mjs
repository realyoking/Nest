import './_env.mjs';
// AI 助理 grounding, Nest guide / own-state detection, fake-"done" guard, change-password rule.
// node --test test/grounding.test.mjs   (LIVE_WIKI=1 also hits Wikipedia)
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, lookupQuery, followUpLookup, wikiLookup, sourcesBlock, nestGuide, stateBlock, cleanSnapshot, claimsDone, unclaim, softenClaim, FACT_RULE } from '../src/lib/grounding.js';
import { pwProblem } from '../src/lib/profile.js';

test('factual / entity questions trigger a lookup (all three languages)', () => {
  for (const q of ['Claude 係咩？', 'Claude 是什么？', 'What is Claude?', 'Who is the CEO of Anthropic?', 'Anthropic 嘅 CEO 係邊個？', 'OpenAI 的创办人是谁？', 'Tell me about the Hong Kong Observatory']) {
    const c = classify(q);
    assert.ok(c.lookup, `${q} → lookup`);
    assert.equal(c.guide, false, q);
  }
  assert.match(lookupQuery('Who is the CEO of Anthropic?'), /CEO Anthropic/);
  assert.equal(lookupQuery('Claude 係咩？'), 'Claude');
});
test('homework, greetings and small talk do not trigger lookups', () => {
  for (const q of ['3x+5=20，x 係幾多？', 'Solve 2x - 4 = 10', '幫我改呢篇作文', 'What is 12 × 8?', 'hi', '早晨', '今晚食咩好', '光合作用是什麼？（生物功課）']) assert.equal(classify(q).lookup, '', q);
  assert.equal(classify('Claude 係咩？', 'tutor').lookup, '', 'only chat mode');
});
test('questions about Nest → guide; own account → state (+ guide); no lookup', () => {
  for (const q of ['點樣加家庭成員？', '插件商店係咩？', '怎么更改密码？', 'How do I change the app icon?', 'Nest 有咩功能？']) { const c = classify(q); assert.ok(c.guide, q); assert.equal(c.lookup, '', q); }
  for (const q of ['我今日用咗幾多？', '我係咩 plan？', '我是什么计划？', 'What plan am I on?', 'How much have I used today?', '我裝咗咩插件？']) { const c = classify(q); assert.ok(c.state, q); assert.ok(c.guide, q); assert.equal(c.lookup, '', q); }
  for (const q of ['Claude 係咩？', '3x+5=20']) { const c = classify(q); assert.equal(c.guide, false); assert.equal(c.state, false); }
});
test('wikiLookup: pre-retrieval with HK/CN variant, en fallback, latest paragraphs, truthful blocks, timeout', async () => {
  const calls = [];
  const page = (wl, title, extract, i = 1) => ({ index: i, title, fullurl: `https://${wl}.wikipedia.org/wiki/${title}`, extract, revisions: [{ timestamp: '2026-10-18T10:19:00Z' }] });
  const fake = (zhHits) => async (url, init) => {
    calls.push({ url, ua: init.headers['user-agent'] });
    const zh = url.includes('zh.wikipedia'); const wl = zh ? 'zh' : 'en';
    if (url.includes('generator=search')) return { ok: true, json: async () => ({ query: { pages: zh && !zhHits ? [] : [page(wl, 'Claude', 'Claude may refer to: many things', 1), page(wl, 'Claude (language model)', 'Claude is a family of large language models developed by Anthropic.', 2)] } }) };
    return { ok: true, json: async () => ({ query: { pages: [{ extract: 'Intro text about Claude models in general.\n2024年，Anthropic發布Claude 3。這是一段足夠長的段落用來測試。\n2026年2月5日，Anthropic發布Claude Opus 4.6。這是一段足夠長的段落用來測試。' }] } }) };
  };
  const r = await wikiLookup('Claude', 'zh-Hant', { fetchImpl: fake(true) });
  assert.equal(r.length, 1, 'disambiguation skipped'); assert.match(r[0].url, /zh\.wikipedia/); assert.match(r[0].extract, /Anthropic/);
  assert.ok(calls.some((c) => c.url.includes('variant=zh-hk'))); assert.ok(calls.every((c) => /Nest/.test(c.ua)));
  calls.length = 0;
  const r2 = await wikiLookup('Claude', 'zh-Hans', { fetchImpl: fake(false) });
  assert.match(r2[0].url, /en\.wikipedia/, 'falls back to en');
  calls.length = 0;
  const info = {};
  const r3 = await wikiLookup('Claude 最新模型', 'zh-Hans', { fetchImpl: fake(true), info });
  assert.ok(calls.some((c) => c.url.includes('variant=zh-cn')));
  assert.ok(info.queries.includes('zh:Claude 模型'), 'latest words stripped from the search'); assert.ok(info.queries.some((q) => q.startsWith('en:Claude')), 'latest → English too');
  assert.match(r3[0].latest, /Opus 4\.6/);
  const slow = (url, init) => new Promise((res, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
  const t0 = Date.now(); const i2 = {};
  assert.deepEqual(await wikiLookup('Claude', 'en', { fetchImpl: slow, timeoutMs: 200, info: i2 }), []);
  assert.ok(Date.now() - t0 < 1500); assert.ok(i2.error);
  const block = sourcesBlock(r3, 'zh-Hant', { query: 'Claude 最新模型', latest: true });
  assert.match(block, /WEB LOOKUP THIS TURN/); assert.match(block, /wikipedia\.org/); assert.match(block, /never say you cannot search/); assert.match(block, /last edited 2026-10-18/); assert.match(block, /may lag/);
  assert.match(sourcesBlock([], 'en', { query: 'x', error: 'timeout' }), /tried|did not answer in time/);
  assert.equal(sourcesBlock([], 'en'), '');
  assert.match(FACT_RULE, /not a company/); assert.match(FACT_RULE, /never say you cannot search/);
});
test('lookup detection: latest / who / what questions in zh + en, follow-ups reuse the topic', () => {
  for (const q of ['Claude 最新模型係咩？', 'Claude 最新模型是什么？', 'What is the latest Claude model?', 'Who is the CEO of Anthropic?', 'Anthropic 嘅 CEO 係邊個？', '香港天文台係咩？']) assert.ok(classify(q).lookup, q);
  assert.equal(classify('Claude 最新模型係咩？').lookup, 'Claude 最新模型');
  const fu = (a) => followUpLookup(a.map((x, i) => ({ role: i % 2 ? 'assistant' : 'user', text: x })), classify(a[a.length - 1]));
  assert.match(fu(['Claude 係咩？', 'x', '佢最新個模型係咩？']), /Claude/);
  assert.match(fu(['What is Anthropic?', 'x', 'And who is its CEO?']), /Anthropic/);
  assert.equal(fu(['Claude 係咩？', 'x', '你好']), '');
  assert.equal(fu(['3x+6=21', 'x', '佢係咩？']), '');
});
test('guide has deep links for every main page', () => {
  for (const lang of ['en', 'zh-Hant']) {
    const g = nestGuide(lang);
    for (const path of ['/app)', '/app/agent', '/app/tutor', '/app/quiz', '/app/memory', '/app/reminders', '/app/calendar', '/app/transport', '/app/subscriptions', '/app/family', '/app/connections', '/app/store', '/app/usage', '/app/settings', '/app/profile', '/app/studio']) assert.ok(g.includes(path), `${lang} ${path}`);
    assert.ok(g.length < 4200, 'guide stays compact');
  }
});
test('own state block: percentages, effective plan + beta expiry, labels only', () => {
  const b = stateBlock({ planId: 'pro', source: 'beta', until: Date.UTC(2026, 10, 18, 10, 47), base: 'free', day: 8, week: 10, daily: 800, weekly: 4000 }, { lang: 'zh-Hant', theme: 'dark', members: 'Mum (parent), Aden (student)', plugins: 'Sky', reminders: 3, overdue: 1, token: 'SECRET', email: 'x@y.z' });
  assert.match(b, /today 1%/); assert.match(b, /Beta promo/); assert.match(b, /2026-11-18/); assert.match(b, /Installed plugins: Sky/);
  assert.ok(!/SECRET|x@y\.z/.test(b));
  assert.deepEqual(Object.keys(cleanSnapshot({ token: 'x' })).includes('token'), false);
});
test('fake "done" detection and rewrite', () => {
  for (const t of ['好的，已幫你設好明天上午 8:30 出發的提醒。', '好的，已经帮你设好提醒。', "Done! I've set a reminder for 8:30.", 'Your reminder has been set.', '已新增提醒']) assert.ok(claimsDone(t), t);
  for (const t of ['需要我明天早上 8 點半提醒你出發嗎？', 'Want me to set a reminder?', '請按確認', 'x = 5', '```nest-actions\n[{"type":"reminder.create"}]\n```']) assert.ok(!claimsDone(t), t);
  assert.ok(!/已幫你設好/.test(unclaim('好的，已幫你設好提醒。', 'zh-Hant')));
  assert.match(unclaim('好的，已幫你設好提醒。', 'zh-Hant'), /尚未設定/);
  assert.match(unclaim("I've set it.", 'en'), /Not set yet/);
  const soft = softenClaim('好的，已幫你設好明天 8:30 的提醒。\n```nest-actions\n[{"type":"reminder.create","title":"出發","dueAt":"2026-10-19T08:30"}]\n```', 'zh-Hant');
  assert.match(soft, /已準備好/); assert.match(soft, /按確認即可設定/); assert.match(soft, /```nest-actions/);
  assert.match(softenClaim("Done — I've set your reminder.", 'en'), /Tap Confirm/);
  assert.equal(softenClaim('需要我設提醒嗎？', 'zh-Hant'), '需要我設提醒嗎？');
});
test('change password rule', () => {
  assert.equal(pwProblem('short1'), 'short');
  assert.equal(pwProblem('abcdefghijk'), 'mix');
  assert.equal(pwProblem('1234567890'), 'mix');
  assert.equal(pwProblem('abcde12345'), '');
});
test('live Wikipedia (LIVE_WIKI=1)', { skip: !process.env.LIVE_WIKI }, async () => {
  const zh = await wikiLookup('Claude 語言模型', 'zh-Hant');
  const en = await wikiLookup('CEO Anthropic', 'en');
  console.log('zh', zh.map((x) => `${x.title} ${x.url}`), 'en', en.map((x) => `${x.title} ${x.url}`));
  assert.ok(zh.length || en.length);
});
