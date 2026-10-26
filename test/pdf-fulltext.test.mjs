import './_env.mjs';
// PDF full-text fix (23 Oct 2026): a long chat PDF must keep ALL its text — extraction (every page, CJK via cMaps),
// Files storage (full text, consistent word count) and the chat payload (as much as the budget allows, honest notice).
// node --test test/pdf-fulltext.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makePdf, englishPages, cjkPages, FACT, CJK_FACT } from './helpers/make-pdf.mjs';
import { processPdf } from '../src/lib/attach.js';
import { countWords, planDocs, buildContent, persistPlan, mergeAttChunks, historyDocs, docReadInfo, estTokens, DOC_TOKENS, DOC_PART_MAX, INLINE_TEXT_BYTES } from '../src/lib/attach-core.js';
import { collectFiles } from '../src/lib/files.js';
import { sanitizeMessages } from '../api/chat.js';

const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
const NM = path.resolve('node_modules/pdfjs-dist');
const assets = { cMapUrl: `${NM}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${NM}/standard_fonts/` };
const fileOf = (bytes) => ({ arrayBuffer: async () => bytes.slice().buffer });
const quiet = (f) => async (...a) => { const w = console.log; console.log = () => {}; try { return await f(...a); } finally { console.log = w; } };
const read = quiet((bytes, opts = {}) => processPdf(fileOf(bytes), { lib, assets, ...opts }));
const has = (text, s) => String(text).replace(/\s+/g, ' ').includes(s); // a fact may wrap across PDF lines
const textParts = (c) => (Array.isArray(c) ? c.filter((p) => p.type === 'text').map((p) => p.text) : [c]);

const EN = makePdf(englishPages(14, 760));
const ZH = makePdf(cjkPages(14, 900), { cjk: true });

test('countWords is CJK-aware and consistent', () => {
  assert.equal(countWords('Hello world, it’s a test.'), 5);
  assert.equal(countWords('家長日在11月14日'), 8); // 6 ideographs + "11" + "14"
  assert.equal(countWords('Nest 巢 app'), 3);
  assert.equal(countWords('你好世界'), 4);
  assert.equal(countWords('[p.1]\nabc def'), 2); // page markers are not words
  assert.ok(countWords('สวัสดีครับ ยินดีต้อนรับ') >= 2);
  assert.equal(countWords(''), 0);
});

test('extraction reads every page of a 14-page / 10k+ word PDF (all pages awaited, no preview)', async () => {
  const r = await read(EN);
  assert.equal(r.pages, 14);
  for (let i = 1; i <= 14; i++) { assert.ok(r.text.includes(`[p.${i}]`), `page ${i} marker`); assert.ok(has(r.text, FACT(i)), `page ${i} fact`); }
  assert.ok(r.words > 10_000, `words ${r.words}`);
  assert.equal(r.words, countWords(r.text));
});

test('CJK PDF (standard Adobe CJK font) reads with cMaps — empty without them (old bug)', async () => {
  const bare = await read(ZH, { assets: {} });
  assert.ok(countWords(bare.text) < 50, 'without cMaps the text is empty');
  const r = await read(ZH);
  assert.equal(r.pages, 14);
  for (const i of [1, 12, 13, 14]) assert.ok(has(r.text, CJK_FACT(i)), `page ${i}`);
  assert.ok(r.words > 12_000, `words ${r.words}`);
  // the build copies the cMaps + standard fonts next to the app
  const cfg = fs.readFileSync('vite.config.js', 'utf8');
  assert.match(cfg, /nest-pdfjs-assets/); assert.match(cfg, /'cmaps', 'standard_fonts'/);
  assert.match(fs.readFileSync('src/lib/attach.js', 'utf8'), /cMapUrl: '\/pdfjs\/cmaps\/'/);
  assert.match(fs.readFileSync('src/components/drive/PdfView.jsx', 'utf8'), /cMapUrl: '\/pdfjs\/cmaps\/'/);
});

test('Files stores the FULL text with the same word count as the chat chip', async () => {
  const r = await read(EN);
  const att = { id: 'a1', kind: 'file', ftype: 'pdf', status: 'ready', name: 'report.pdf', size: EN.length, ...r };
  const plan = planDocs('What is the code on page 13?', [att]);
  const { atts, chunks } = persistPlan([att], plan);
  assert.equal(chunks.length, 0); // ~84k chars fits on the message doc
  assert.equal(atts[0].text, r.text); assert.equal(atts[0].words, r.words);
  const files = collectFiles([{ id: 'c1', title: 'chat' }], { c1: mergeAttChunks([{ id: 'm1', role: 'user', content: 'q', atts, createdAt: 1 }]) });
  assert.equal(files.length, 1);
  assert.equal(files[0].text, r.text, 'Files keeps the whole text, not a 400-char preview');
  assert.equal(files[0].words, r.words, 'same word count as the chip');
  assert.ok(has(files[0].text, FACT(14)));
});

test('very long text spills into chunk docs and comes back whole (Firestore 1 MiB doc limit)', () => {
  const long = cjkPages(14, 900).join('').repeat(16); // ~200k CJK chars ≈ 600 KB UTF-8
  const att = { id: 'z', kind: 'file', status: 'ready', name: 'long.txt', text: long };
  const { atts, chunks } = persistPlan([att, { ...att, id: 'z2' }]);
  assert.ok(chunks.length >= 1);
  for (const c of chunks) assert.ok(Buffer.byteLength(c.text) < 900_000);
  assert.ok(Buffer.byteLength(JSON.stringify(atts)) < INLINE_TEXT_BYTES + 50_000);
  const msgs = mergeAttChunks([{ id: 'm', role: 'user', atts }, ...chunks.map((c, i) => ({ id: `x${i}`, role: 'attext', of: 'm', ...c }))]);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].atts[0].text, long); assert.equal(msgs[0].atts[1].text, long);
  // a missing chunk is flagged, never silently shown as complete
  const part = mergeAttChunks([{ id: 'm', role: 'user', atts }]);
  assert.ok(part[0].atts.some((a) => a.partial));
});

test('chat payload: the whole 14-page document reaches the model (page 12–14 answerable), server keeps it', async () => {
  const r = await read(EN);
  const att = { id: 'a1', kind: 'file', ftype: 'pdf', status: 'ready', name: 'report.pdf', ...r };
  const q = 'What is the secret code on page 13?';
  const plan = planDocs(q, [att]);
  assert.equal(plan.a1.truncated, false); assert.equal(plan.a1.usedWords, r.words);
  const content = buildContent(q, [att], 'en', plan);
  const doc = textParts(content).find((t) => t.startsWith('[Attached file'));
  for (const i of [1, 12, 13, 14]) assert.ok(has(doc, FACT(i)), `page ${i} sent`);
  assert.match(doc, /full text, about 10,\d{3} words/);
  assert.ok(countWords(doc) >= r.words, 'sent words ≥ document words');
  // server: document parts are no longer cut to 12,000 chars
  const [m] = sanitizeMessages([{ role: 'user', content }], 12000, { docs: true });
  const kept = textParts(m.content).find((t) => t.startsWith('[Attached file'));
  assert.equal(kept, doc);
  // plain text parts are still capped, and a fake doc header is capped by the request budget
  const [p] = sanitizeMessages([{ role: 'user', content: 'x'.repeat(20000) }], 12000, { docs: true });
  assert.equal(p.content.length, 12000);
  const [big] = sanitizeMessages([{ role: 'user', content: [{ type: 'text', text: `[Attached file: a]\n${'y'.repeat(DOC_PART_MAX + 10)}` }] }], 12000, { docs: true });
  assert.equal(big.content[0].text.length, DOC_PART_MAX);
  const [assist] = sanitizeMessages([{ role: 'user', content: [{ type: 'text', text: `[Attached file: a]\n${'y'.repeat(30000)}` }] }], 2000);
  assert.equal(assist.content[0].text.length, 2000);
  // persisted: nothing trimmed → no sentWords; the bubble says the AI read it all
  const { atts } = persistPlan([att], plan);
  assert.equal(atts[0].sentWords, undefined); assert.deepEqual(docReadInfo(atts[0]), { words: r.words, sent: r.words, trimmed: false });
});

test('follow-up turn: earlier document travels again, selected for the NEW question', async () => {
  const r = await read(EN);
  const att = { id: 'a1', kind: 'file', ftype: 'pdf', status: 'ready', name: 'report.pdf', ...r };
  const { atts } = persistPlan([att], planDocs('Summarise this', [att]));
  const msgs = [{ id: 'm1', role: 'user', content: 'Summarise this', atts }, { id: 'm2', role: 'assistant', content: 'Summary…' }];
  const hd = historyDocs(msgs, 'And what is the code on page 14?', 'en');
  const doc = hd.m1.map((p) => p.text).join('\n');
  assert.ok(has(doc, FACT(14)) && has(doc, FACT(12)));
  assert.equal(hd.m2, undefined);
});

test('a document bigger than the budget is trimmed HONESTLY and keeps the asked pages', async () => {
  const pages = cjkPages(70, 900);
  const r = await read(makePdf(pages, { cjk: true }));
  assert.equal(r.pages, 70); assert.ok(has(r.text, CJK_FACT(66)));
  assert.ok(estTokens(r.text) > DOC_TOKENS);
  const att = { id: 'b', kind: 'file', ftype: 'pdf', status: 'ready', name: '長文件.pdf', ...r };
  const q = '第66頁的暗號是甚麼？';
  const plan = planDocs(q, [att]);
  assert.equal(plan.b.truncated, true);
  assert.ok(plan.b.usedWords > 40_000 && plan.b.usedWords < r.words, `used ${plan.b.usedWords} of ${r.words}`);
  const doc = textParts(buildContent(q, [att], 'zh-Hant', plan)).find((t) => t.startsWith('[附件檔案'));
  assert.ok(has(doc, CJK_FACT(66)), 'the asked page is included');
  assert.ok(has(doc, CJK_FACT(1)), 'the start is included');
  assert.match(doc, new RegExp(`節選約 ${plan.b.usedWords.toLocaleString('en')}／${r.words.toLocaleString('en')} 字`));
  const { atts } = persistPlan([att], plan);
  assert.equal(atts[0].sentWords, plan.b.usedWords);
  assert.deepEqual(docReadInfo(atts[0]), { words: r.words, sent: plan.b.usedWords, trimmed: true });
  // Files still has every page
  const files = collectFiles([{ id: 'c' }], { c: [{ id: 'm', role: 'user', atts, createdAt: 1 }] });
  assert.equal(files[0].words, r.words); assert.equal(files[0].sentWords, plan.b.usedWords); assert.ok(has(files[0].text, CJK_FACT(70)));
});

test('UI strings: chip / bubble / Files notices exist in zh-Hant, en and th (香港書面語)', async () => {
  const { R24 } = await import('../src/lib/strings-run24.js');
  for (const l of ['zh-Hant', 'en', 'th']) for (const k of ['words', 'pages', 'fullText', 'aiRead', 'aiUsed', 'partial', 'pagesCut']) assert.ok(R24[l].chatdoc[k], `${l}.${k}`);
  assert.match(R24['zh-Hant'].chatdoc.aiUsed, /約 \{used\}／\{total\} 字/);
  assert.doesNotMatch(JSON.stringify(R24['zh-Hant'].chatdoc), /[嘅咗唔係喺]/);
  const src = fs.readFileSync('src/components/Attachments.jsx', 'utf8');
  for (const l of ["'zh-Hant'", 'en:', 'th:']) assert.ok(src.includes(l));
  assert.match(src, /readSome: '文件較長：AI 已使用約 \{used\}／\{total\} 字/);
});
