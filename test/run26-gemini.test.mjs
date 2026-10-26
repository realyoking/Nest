import './_env.mjs';
// Run 26: Google AI Studio (Gemini / Gemma, free tier) — routing, request shape, 429 fallback, Pacific-midnight reset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AGNES, MODELS, MODEL_CHOICES, GEMINI_BASE, MISTRAL_BASE, ROUTES, GROUPS, createThrottle, routeKind, modelChain, modelParams, createBusyTracker, nextPacificMidnight, isDailyQuota, createThinkStripper } from '../src/lib/ai-models.js';
import { runChain } from '../api/_orca.js';
import { modelInfo } from '../src/lib/ai-models.js';
const iconKey = (id) => (id === 'auto' ? 'auto' : modelInfo(id)?.icon || 'auto');

const L35 = 'gemini-3.5-flash-lite', L31 = 'gemini-3.1-flash-lite', F36 = 'gemini-3.6-flash', F38 = 'gemini-3.8-flash', GEMMA = 'gemma-4-26b-a4b-it';
const V41 = 'deepseek/deepseek-v4.1-flash-free';
const M3 = 'ministral-3b-2512', M8 = 'ministral-8b-2512', M14 = 'ministral-14b-2512', COD = 'codestral-2508';

test('verified free Gemini/Gemma models are offered; no paid / pro models', () => {
  const g = MODELS.filter((m) => m.provider === 'gemini').map((m) => m.id);
  assert.deepEqual(g.sort(), [L35, L31, F36, F38, GEMMA].sort());
  for (const id of g) { assert.ok(MODEL_CHOICES.includes(id)); assert.doesNotMatch(id, /pro|image|tts/); }
  assert.equal(GEMINI_BASE, 'https://generativelanguage.googleapis.com/v1beta/openai');
});

test('auto router: everyday → Flash-Lite, trivial → Gemma, hard → 3.6/3.8 Flash, Agnes last', () => {
  assert.equal(routeKind({ text: '你好' }), 'light');
  assert.equal(routeKind({ text: 'thanks!' }), 'light');
  assert.deepEqual(modelChain('auto', { text: '你好' }).chain.slice(0, 3), [M3, GEMMA, L31]);
  assert.deepEqual(modelChain('auto', { text: '今個星期六有咩室內活動可以同小朋友玩？' }).chain.slice(0, 3), [L35, M14, L31]);
  assert.deepEqual(modelChain('auto', { text: '解方程 2x²−5x−3=0' }).chain.slice(0, 3), [F36, M14, V41]);
  assert.deepEqual(modelChain('auto', { text: '這是甚麼？', images: 1 }).chain.slice(0, 3), [F36, M14, L35]);
  assert.ok(!modelChain('auto', { text: 'x', images: 1 }).chain.includes(GEMMA), 'Gemma is text-only here');
  assert.deepEqual(modelChain('auto', { text: '總結', docTokens: 20000, promptTokens: 30000 }).chain.slice(0, 3), [F36, L35, M14]);
  // the 20-a-day models never appear for trivial or everyday messages
  for (const t of ['你好', 'ok', '幫我寫一段生日祝福']) { const c = modelChain('auto', { text: t }).chain; assert.ok(!c.includes(F38) && !c.includes(F36), t); }
  assert.ok(!ROUTES.chat.includes(F38) && !ROUTES.light.includes(F38));
  for (const k of ['reason', 'image', 'doc']) { const c = ROUTES[k]; assert.ok(c.indexOf(F38) >= 3, `3.8 Flash only as a late fallback (${k})`); }
  for (const k of ['light', 'chat', 'code', 'reason', 'image', 'doc']) assert.equal(modelChain('auto', { text: k === 'reason' ? 'solve x=1' : k === 'light' ? 'hi' : 'a b c d e f g', images: k === 'image' ? 1 : 0, docTokens: k === 'doc' ? 9000 : 0 }).chain.at(-1), AGNES);
  // Gemma's small free-tier prompt budget; no key → Gemini skipped
  assert.ok(!modelChain('auto', { text: 'hi', promptTokens: 20000 }).chain.includes(GEMMA));
  assert.ok(!modelChain('auto', { text: 'hi', off: { gemini: true } }).chain.some((id) => /gem/.test(id)));
  assert.ok(!modelChain('auto', { text: 'hi', off: { mistral: true } }).chain.some((id) => /stral/.test(id)));
  assert.deepEqual(modelChain(F38, { text: 'hi' }).chain.slice(0, 2), [F38, M3], 'manual pick first');
});

test('request shape: thinking off (minimal), 3.8 low, never shows thoughts', () => {
  assert.deepEqual(modelParams(L35, 'chat'), { extra_body: { google: { thinking_config: { thinking_level: 'minimal', include_thoughts: false } } }, max_tokens: 8192 });
  assert.equal(modelParams(F38, 'reason').extra_body.google.thinking_config.thinking_level, 'low');
  assert.equal(modelParams(GEMMA, 'light').extra_body.google.thinking_config.include_thoughts, false);
  const s = createThinkStripper();
  assert.equal(s('<thou') + s('ght>plan…</thought>\n答案') + s('是 3'), '答案是 3');
  const chat = fs.readFileSync(new URL('../api/chat.js', import.meta.url), 'utf8');
  assert.match(chat, /GEMINI_API_KEY/); assert.match(chat, /GEMINI_BASE : mi \? MISTRAL_BASE : ORCA_BASE/); assert.match(chat, /MISTRAL_API_KEY/); assert.match(chat, /throttle: misThrottle/);
  assert.ok(!fs.existsSync(new URL('../api/_gemprobe.js', import.meta.url)), 'temporary probe removed');
  const fns = fs.readdirSync(new URL('../api/', import.meta.url), { recursive: true }).filter((f) => f.endsWith('.js') && !f.split('/').pop().startsWith('_'));
  assert.equal(fns.length, 12, 'still 12 Vercel functions');
});

test('429 RESOURCE_EXHAUSTED → next model; daily quota busy until Pacific midnight', async () => {
  let t = Date.parse('2026-10-24T04:00:00Z'); // 21:00 PDT 23 Oct
  const busy = createBusyTracker(() => t);
  const day = '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"violations":[{"quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}}';
  const sse = (txt) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: txt } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { status: 200 });
  const calls = [];
  const orca = async (id) => { calls.push(id); return id === F36 ? new Response(day, { status: 429 }) : sse('ok'); };
  const out = await runChain({ chain: [F36, F38, AGNES], kind: 'reason', busy, orca, agnes: async () => sse('agnes') });
  assert.equal(out.answered.id, F38); assert.deepEqual(calls, [F36, F38]);
  assert.ok(busy.busy(F36));
  t = Date.parse('2026-10-24T06:59:00Z'); assert.ok(busy.busy(F36), 'still busy 23:59 PDT');
  t = Date.parse('2026-10-24T07:00:01Z'); assert.ok(!busy.busy(F36), 'free after 00:00 PDT');
  // per-minute 429 → short busy only
  const b2 = createBusyTracker(() => t); b2.mark(L35, null, '{"error":{"status":"RESOURCE_EXHAUSTED","message":"PerMinute"}}');
  assert.ok(b2.busy(L35)); t += 130e3; assert.ok(!b2.busy(L35));
  assert.ok(isDailyQuota(day)); assert.ok(!isDailyQuota('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'));
});

test('Pacific reset is DST-aware', () => {
  assert.equal(new Date(nextPacificMidnight(Date.parse('2026-10-24T04:00:00Z'))).toISOString(), '2026-10-24T07:00:00.000Z'); // PDT
  assert.equal(new Date(nextPacificMidnight(Date.parse('2026-12-01T12:00:00Z'))).toISOString(), '2026-12-02T08:00:00.000Z'); // PST
  assert.equal(new Date(nextPacificMidnight(Date.parse('2026-11-01T05:00:00Z'))).toISOString(), '2026-11-01T07:00:00.000Z'); // 31 Oct PDT
  assert.equal(new Date(nextPacificMidnight(Date.parse('2026-11-01T12:00:00Z'))).toISOString(), '2026-11-02T08:00:00.000Z'); // DST ended 1 Nov
});

test('picker icons for every model', () => {
  assert.equal(iconKey('auto'), 'auto'); assert.equal(iconKey(L35), 'gemini'); assert.equal(iconKey(GEMMA), 'gemma'); assert.equal(iconKey(AGNES), 'agnes');
  const src = fs.readFileSync(new URL('../src/components/ModelIcon.jsx', import.meta.url), 'utf8');
  for (const k of ['gemini', 'gemma', 'auto', 'agnes', 'deepseek', 'hunyuan', 'glm']) assert.match(src, new RegExp(`\\b${k}: `));
  assert.doesNotMatch(src, /https?:\/\/(?!www\.w3)/, 'no hotlinked images');
  assert.equal(iconKey(V41), 'deepseek'); assert.equal(iconKey('tencent/hy4-preview-free'), 'hunyuan'); assert.equal(iconKey('z-ai/glm-5.3-flash-free'), 'glm');
});

test('Run 26b Mistral: verified free ids only, code → Codestral, chat load spread, throttle ≤ 1 req/s', async () => {
  const m = MODELS.filter((x) => x.provider === 'mistral').map((x) => x.id);
  assert.deepEqual(m.sort(), [M3, M8, M14, COD].sort(), 'Small/Medium (0 req/min on this tier) and Large (not listed) are not offered');
  assert.equal(MISTRAL_BASE, 'https://api.mistral.ai/v1');
  assert.equal(routeKind({ text: '幫我寫一個 Python script 讀 CSV' }), 'code');
  assert.equal(routeKind({ text: 'fix this GitHub action bug' }), 'code');
  assert.equal(modelChain('auto', { text: '用 JavaScript 寫一個函數把陣列去重' }).chain[0], COD);
  assert.equal(modelChain('auto', { text: '今個星期六有咩室內活動可以同小朋友玩？', spread: 0 }).chain[0], L35);
  assert.equal(modelChain('auto', { text: '今個星期六有咩室內活動可以同小朋友玩？', spread: 1 }).chain[0], M14);
  assert.deepEqual(modelParams(M14, 'chat'), { max_tokens: 8192 });
  let t = 0; const waits = []; const th = createThrottle(1000, () => t, async (ms) => { waits.push(ms); t += ms; });
  await th(); await th(); t += 300; await th();
  assert.deepEqual(waits, [1000, 700]);
  assert.deepEqual(GROUPS.map((g) => g.key), ['google', 'mistral', 'orca', 'nest']);
  assert.equal(GROUPS.reduce((n, g) => n + g.ids.length, 0), MODELS.length);
  // throttled + 429 falls through
  const sse = (txt) => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: txt } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { status: 200 });
  let thr = 0;
  const out = await runChain({ chain: [M14, L35, AGNES], throttle: async () => { thr++; }, busy: createBusyTracker(), orca: async (id) => (id === M14 ? new Response('{"message":"Rate limit exceeded"}', { status: 429 }) : sse('ok')), agnes: async () => sse('a') });
  assert.equal(out.answered.id, L35); assert.equal(thr, 1);
  const src = fs.readFileSync(new URL('../src/components/ModelIcon.jsx', import.meta.url), 'utf8'); assert.match(src, /mistral: Mistral/);
});

test('Run 26c thinking: auto on for hard requests only, params, thought splitting, never persisted', async () => {
  const { wantThink, canThink, normThink, createThoughtSplitter, thinkText } = await import('../src/lib/ai-models.js');
  assert.equal(wantThink('auto', 'chat', '今日放學做咩好'), false);
  assert.equal(wantThink('auto', 'light', '你好'), false);
  assert.equal(wantThink('auto', 'reason', '解方程'), true);
  assert.equal(wantThink('auto', 'doc', '總結'), true);
  assert.equal(wantThink('auto', 'chat', '幫我計劃三日兩夜台北行程'), true);
  assert.equal(wantThink('on', 'chat', 'hi'), true); assert.equal(wantThink('off', 'reason', '解'), false);
  assert.equal(normThink('x'), 'auto');
  assert.ok(canThink('auto') && canThink(F36) && canThink(V41)); assert.ok(!canThink(GEMMA) && !canThink(M14) && !canThink(AGNES));
  assert.deepEqual(modelParams(F36, 'reason', true).extra_body.google.thinking_config, { thinking_level: 'medium', include_thoughts: true });
  assert.deepEqual(modelParams(L35, 'chat', true).extra_body.google.thinking_config, { thinking_level: 'low', include_thoughts: true });
  assert.equal(modelParams(L35, 'chat', false).extra_body.google.thinking_config.include_thoughts, false);
  assert.deepEqual(modelParams(GEMMA, 'chat', true).extra_body.google.thinking_config.include_thoughts, false, 'Gemma stays non-thinking');
  assert.deepEqual(modelParams(V41, 'chat', true), { reasoning_effort: 'low', max_tokens: 8192 });
  let sp = createThoughtSplitter();
  assert.deepEqual(sp({ reasoning_content: 'plan' }), { text: '', thought: 'plan' });
  assert.deepEqual(sp({ content: 'x', extra_content: { google: { thought: true } } }), { text: '', thought: 'x' });
  sp = createThoughtSplitter(); const a = [sp({ content: '<thou' }), sp({ content: 'ght>Factor it' }), sp({ content: '.</thought>Answer: 3' }), sp({ content: ' ok' })];
  assert.equal(a.map((x) => x.thought).join(''), 'Factor it.'); assert.equal(a.map((x) => x.text).join(''), 'Answer: 3 ok');
  for (const l of ['zh-Hant', 'zh-Hans', 'en', 'th']) { const T = thinkText(l); for (const k of ['auto', 'on', 'off', 'thinking', 'thought']) assert.ok(T[k]); }
  const ag = fs.readFileSync(new URL('../src/pages/app/Agent.jsx', import.meta.url), 'utf8');
  assert.match(ag, /thinkSec/); assert.doesNotMatch(ag, /addMessage\([^)]*think26\.text/, 'thought text is never saved');
  const chat = fs.readFileSync(new URL('../api/chat.js', import.meta.url), 'utf8'); assert.match(chat, /nest: 'think'/);
});
