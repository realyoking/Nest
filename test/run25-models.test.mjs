import './_env.mjs';
// Run 25: OrcaRouter models — instant auto routing, fallback chain, busy tracking, picker persistence, request shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AGNES, MODELS, MODEL_CHOICES, routeKind, routeAuto, modelChain, modelParams, normModel, modelLabel, modelName, modelDesc, pickerText, createBusyTracker, shouldFallback, createThinkStripper, requestTokens } from '../src/lib/ai-models.js';
import { runChain, peekStream } from '../api/_orca.js';
import { normPref, DEFAULT_PREFS, PREF_KEYS } from '../src/lib/prefs.js';

const V41 = 'deepseek/deepseek-v4.1-flash-free';
const HY4 = 'tencent/hy4-preview-free';
const HY3 = 'tencent/hy3-free';
const GLM = 'z-ai/glm-5.3-flash-free';
const V4 = 'deepseek/deepseek-v4-flash-free';
const NG = { gemini: true, mistral: true }; // Run 26: no Gemini key → the Run 25 chains

test('only the five chosen free models + Agnes', () => {
  assert.deepEqual(MODELS.filter((m) => m.provider !== 'gemini' && m.provider !== 'mistral').map((m) => m.id).sort(), [V41, V4, HY3, HY4, GLM, AGNES].sort()); // Run 26 adds Gemini/Gemma (own test)
  for (const m of MODELS) if (m.provider === 'orca') assert.match(m.id, /-free$/);
  assert.ok(!MODEL_CHOICES.includes('orca/orcaverify-text1.0-free'));
  assert.equal(MODEL_CHOICES[0], 'auto');
});

test('auto routing rules (instant, no model call)', () => {
  assert.equal(routeKind({ text: '你好！今天放學後做甚麼好？' }), 'chat');
  assert.equal(routeKind({ text: 'hello there' }), 'chat');
  assert.equal(routeKind({ text: '解方程 2x² − 5x − 3 = 0' }), 'reason');
  assert.equal(routeKind({ text: '幫我做這份數學功課' }), 'reason');
  assert.equal(routeKind({ text: 'Solve 3x + 4 = 19 step by step' }), 'reason');
  assert.equal(routeKind({ text: 'what is 17*23?' }), 'reason');
  assert.equal(routeKind({ text: 'ช่วยทำการบ้านคณิตหน่อย' }), 'reason');
  assert.equal(routeKind({ text: '這是甚麼？', images: 1 }), 'image');
  assert.equal(routeKind({ text: '總結這份文件', docTokens: 20000 }), 'doc');
  assert.equal(routeKind({ text: '解方程', images: 2 }), 'image', 'photos win over maths (needs vision)');
  assert.equal(routeAuto({ text: 'hi' }).model, 'ministral-3b-2512', 'Run 26b: trivial → Ministral 3B');
  assert.equal(routeAuto({ text: '計算 12×13' }).model, 'gemini-3.6-flash');
});

test('chains: vision only for photos, prompt caps respected, Agnes always last', () => {
  const img = modelChain('auto', { text: 'x', images: 1, off: NG });
  assert.equal(img.kind, 'image');
  assert.deepEqual(img.chain, [V41, GLM, AGNES]);
  const chat = modelChain('auto', { text: '今日放學做咩好', off: NG });
  assert.deepEqual(chat.chain, [V41, HY4, HY3, AGNES]);
  assert.equal(chat.auto, true);
  // A manual pick goes first; the kind's chain follows (minus duplicates).
  const man = modelChain(HY3, { text: '今日放學做咩好', off: NG });
  assert.deepEqual(man.chain, [HY3, V41, HY4, AGNES]);
  assert.equal(man.auto, false);
  // Manual text-only model + a photo → skipped (cannot see images).
  assert.deepEqual(modelChain(HY3, { text: 'x', images: 1, off: NG }).chain, [V41, GLM, AGNES]);
  // Over the free-tier prompt cap → only Agnes (512K).
  assert.deepEqual(modelChain('auto', { text: 'x', docTokens: 150000, promptTokens: 160000, off: NG }).chain, [AGNES]);
  // Agnes chosen → Agnes first.
  assert.equal(modelChain(AGNES, { text: 'hi' }).chain[0], AGNES);
  // Unknown choice → auto.
  assert.equal(modelChain('evil/paid-model', { text: 'hi' }).auto, true);
  for (const k of ['chat', 'reason', 'image', 'doc']) assert.equal(modelChain('auto', { text: k === 'reason' ? 'solve x' : 'a', images: k === 'image' ? 1 : 0, docTokens: k === 'doc' ? 9000 : 0 }).chain.at(-1), AGNES);
});

test('request shape: reasoning off for speed, limited for maths, Agnes untouched', () => {
  assert.deepEqual(modelParams(V41, 'chat'), { thinking: { type: 'disabled' }, max_tokens: 8192 });
  assert.deepEqual(modelParams(V41, 'reason'), { reasoning_effort: 'low', max_tokens: 8192 });
  assert.deepEqual(modelParams(HY4, 'reason'), { reasoning_effort: 'none', max_tokens: 8192 });
  assert.deepEqual(modelParams(HY3, 'chat'), { thinking: { type: 'disabled' }, max_tokens: 8192 });
  assert.deepEqual(modelParams(GLM, 'chat'), { reasoning_effort: 'low', max_tokens: 8192 });
  assert.deepEqual(modelParams(AGNES, 'chat'), {});
  assert.ok(requestTokens([{ role: 'user', content: [{ type: 'text', text: '你好' }, { type: 'image_url', image_url: { url: 'data:x' } }] }], 'abcd') >= 1002);
});

test('picker persistence: aiModel is a valid per-user pref, default auto', () => {
  assert.equal(DEFAULT_PREFS.aiModel, 'auto');
  assert.ok(PREF_KEYS.includes('aiModel'));
  assert.equal(normPref('aiModel', V41), V41);
  assert.equal(normPref('aiModel', 'auto'), 'auto');
  assert.equal(normPref('aiModel', 'openai/gpt-paid'), undefined);
  assert.equal(normModel(undefined), 'auto');
  assert.equal(normModel(HY4), HY4);
});

test('labels + descriptions in zh-Hant / zh-Hans / en / th', () => {
  assert.equal(modelLabel({ id: V41, auto: true }, 'zh-Hant'), 'DeepSeek V4.1 Flash · 自動');
  assert.equal(modelLabel({ id: V41, auto: true }, 'en'), 'DeepSeek V4.1 Flash · Auto');
  assert.equal(modelLabel({ id: AGNES, fb: true }, 'zh-Hant'), 'Agnes 3.0 Flash · 後備');
  assert.equal(modelLabel({ id: HY4 }, 'th'), 'Hunyuan Hy4 Preview');
  assert.equal(modelLabel({ id: 'nope' }, 'en'), '');
  for (const l of ['zh-Hant', 'zh-Hans', 'en', 'th']) {
    assert.ok(pickerText(l).title && pickerText(l).auto);
    for (const id of MODEL_CHOICES) assert.ok(modelDesc(id, l).length > 3, `${id} ${l}`);
  }
  assert.equal(modelName('auto', 'zh-Hant'), '自動');
  assert.equal(pickerText('ja').auto, 'Auto', 'other app languages fall back to English');
  // 書面語: no Cantonese colloquial characters in the zh-Hant copy.
  const zh = JSON.stringify([pickerText('zh-Hant'), MODELS.map((m) => m.desc['zh-Hant'])]);
  assert.doesNotMatch(zh, /[嘅咗唔係喺佢冇嚟啲咁]/);
});

test('busy tracker: per-model short waits, whole bucket for day-long Retry-After', () => {
  let now = 1_000_000; const b = createBusyTracker(() => now);
  b.mark(V41, '5');
  assert.ok(b.busy(V41)); assert.ok(!b.busy(HY4));
  now += 21_000; assert.ok(!b.busy(V41), 'short Retry-After clears after ≥20 s');
  b.mark(HY3, '74012'); // day bucket (00:00 UTC) — shared by the default-tier free models
  assert.ok(b.busy(HY3) && b.busy(V41) && b.busy(GLM) && b.busy(V4));
  assert.ok(!b.busy(HY4), 'Hy4 has its own bucket');
  assert.ok(!b.busy(AGNES));
  now += 16 * 60e3; assert.ok(!b.busy(V41), 're-probe after 15 min');
});

test('fallback statuses', () => {
  for (const s of [429, 500, 502, 503, 400, 404, 422]) assert.ok(shouldFallback(s), String(s));
  assert.ok(!shouldFallback(200));
});

test('think stripper hides <think> blocks, passes normal text', () => {
  const s1 = createThinkStripper();
  assert.equal(['<thi', 'nk>secret plan', '</think>', '\n答案是 3'].map(s1).join(''), '答案是 3');
  const s2 = createThinkStripper();
  assert.equal(['Hello', ' world'].map(s2).join(''), 'Hello world');
  const s3 = createThinkStripper();
  assert.equal(['<b>x</b>'].map(s3).join(''), '<b>x</b>');
});

// --- runChain with fake upstreams ---
const enc = new TextEncoder();
const sse = (chunks, { status = 200, delay = 0, hang = false } = {}) => new Response(new ReadableStream({
  async start(c) {
    for (const x of chunks) { if (delay) await new Promise((r) => setTimeout(r, delay)); c.enqueue(enc.encode(typeof x === 'string' && x.startsWith(':') ? `${x}\n\n` : `data: ${typeof x === 'string' ? x : JSON.stringify(x)}\n\n`)); }
    if (!hang) c.close();
  },
}), { status, headers: { 'content-type': 'text/event-stream' } });
const d = (content, extra = {}) => ({ choices: [{ delta: { content, ...extra } }] });
const read = async (r) => { const t = await r.text(); return t.split('\n').filter((l) => l.startsWith('data:') && !l.includes('[DONE]')).map((l) => JSON.parse(l.slice(5)).choices[0].delta).map((x) => x.content || '').join(''); };

test('runChain: 429 → next model, label = the model that answered', async () => {
  const calls = []; const busy = createBusyTracker(); const tried = [];
  const out = await runChain({ chain: [V41, HY4, AGNES], kind: 'chat', auto: true, busy, tried,
    orca: async (id) => { calls.push(id); return id === V41 ? new Response('{"error":{"code":"free_rate_limited"}}', { status: 429, headers: { 'retry-after': '74012' } }) : sse([d('你好'), d('！'), '[DONE]']); },
    agnes: async () => { throw new Error('should not reach Agnes'); } });
  assert.deepEqual(calls, [V41, HY4]);
  assert.deepEqual(out.answered, { id: HY4, auto: true, fb: false });
  assert.equal(await read(out.r), '你好！');
  assert.ok(busy.busy(V41), 'rate-limited bucket remembered');
  assert.match(tried.join(','), /429.*hy4-preview-free:ok/);
  // Next request skips the busy model without calling it.
  const calls2 = [];
  await runChain({ chain: [V41, HY4, AGNES], busy, orca: async (id) => { calls2.push(id); return sse([d('x'), '[DONE]']); }, agnes: async () => new Response('') });
  assert.deepEqual(calls2, [HY4]);
});

test('runChain: everything fails → Agnes; manual pick marks fallback', async () => {
  const out = await runChain({ chain: [HY3, V41, AGNES], kind: 'chat', auto: false, choice: HY3, busy: createBusyTracker(),
    orca: async (id) => (id === HY3 ? new Response('x', { status: 503 }) : Promise.reject(new TypeError('fetch failed'))),
    agnes: async () => sse([d('Agnes 回答'), '[DONE]']) });
  assert.deepEqual(out.answered, { id: AGNES, auto: false, fb: true });
  assert.equal(await read(out.r), 'Agnes 回答');
});

test('runChain: stalled model (no first token) → next model within the cap', async () => {
  const t0 = Date.now();
  const out = await runChain({ chain: [V41, HY4, AGNES], kind: 'chat', busy: createBusyTracker(), caps: { chat: 300 },
    orca: async (id, sig) => (id === V41 ? sse([': nothing'], { hang: true }) : sse([d('快'), '[DONE]'])),
    agnes: async () => new Response('') });
  assert.equal(out.answered.id, HY4);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(await read(out.r), '快');
});

test('runChain: stream error chunk / empty stream → next; reasoning counts as alive', async () => {
  const out = await runChain({ chain: [V41, HY3, HY4, AGNES], kind: 'reason', busy: createBusyTracker(),
    orca: async (id) => (id === V41 ? sse([{ error: { message: 'upstream' } }]) : id === HY3 ? sse(['[DONE]']) : sse([d('', { reasoning_content: '想…' }), d('x = 3'), '[DONE]'])),
    agnes: async () => new Response('') });
  assert.equal(out.answered.id, HY4);
  assert.equal(await read(out.r), 'x = 3', 'reasoning is replayed but never becomes content');
});

test('runChain: non-stream (retries) returns the JSON response', async () => {
  const out = await runChain({ chain: [V41, AGNES], stream: false, busy: createBusyTracker(),
    orca: async () => new Response(JSON.stringify({ choices: [{ message: { content: '好', reasoning_content: 'hidden' } }] }), { status: 200 }),
    agnes: async () => new Response('') });
  assert.equal((await out.r.json()).choices[0].message.content, '好');
});

test('peekStream replays held bytes', async () => {
  const r = await peekStream(sse([': ping', d('A'), d('B'), '[DONE]']), 1000, new AbortController());
  assert.equal(await read(r), 'AB');
});

test('server wiring: chat.js uses OrcaRouter only for the AI 助理, keeps Agnes, emits the model event, no new function', () => {
  const src = fs.readFileSync(new URL('../api/chat.js', import.meta.url), 'utf8');
  assert.match(src, /process\.env\.ORCAROUTER_API_KEY/);
  assert.match(src, /orcaOn = mode === 'chat' && !isAssist/);
  assert.match(src, /nest: 'model'/);
  assert.match(src, /nest: 'status', key: 'reasoning'/);
  assert.doesNotMatch(src, /sk-orca-/);
  const fns = [];
  (function walk(dir) { for (const f of fs.readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${f.name}`; if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js') && !f.name.startsWith('_')) fns.push(p); } })(new URL('../api', import.meta.url).pathname);
  assert.equal(fns.length, 12, `Vercel functions: ${fns.length}`);
  const client = fs.readFileSync(new URL('../src/lib/ai.js', import.meta.url), 'utf8');
  assert.match(client, /j\.nest === 'model'/);
  assert.doesNotMatch(client, /ORCAROUTER/);
});
