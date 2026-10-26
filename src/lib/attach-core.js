// AI 助理 attachments — pure helpers shared by the browser (src/lib/attach.js), /api/chat and tests.
// Nothing here touches the DOM.
import { unzipSync, strFromU8 } from 'fflate';

// Per-plan limits (family's effective plan). `daily` = attachments per user per Hong Kong day (server-counted).
export const ATTACH_LIMITS = {
  free: { perMsg: 3, daily: 10, fileMB: 10, videoSec: 30 },
  starter: { perMsg: 5, daily: 40, fileMB: 20, videoSec: 60 },
  pro: { perMsg: 8, daily: 120, fileMB: 25, videoSec: 60 },
};
export const attachLimits = (plan) => ATTACH_LIMITS[plan] || ATTACH_LIMITS.free;

// Request budget: Vercel caps a function request body at ~4.5 MB; keep the whole JSON under ~3.6 MB.
export const REQUEST_BUDGET = 3_400_000; // total data-URL characters for images in one message
export const MAX_IMAGE_SIDE = 2048;
export const FRAME_SIDE = 768;
export const THUMB_SIDE = 320;

export const FILE_TYPES = {
  pdf: { exts: ['pdf'], mimes: ['application/pdf'] },
  docx: { exts: ['docx'], mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  xlsx: { exts: ['xlsx'], mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  pptx: { exts: ['pptx'], mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'] },
  txt: { exts: ['txt', 'md', 'json', 'log'], mimes: ['text/plain', 'text/markdown', 'application/json'] },
  csv: { exts: ['csv', 'tsv'], mimes: ['text/csv', 'text/tab-separated-values'] },
};
export const FILE_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.tsv,.json,application/pdf,text/plain,text/csv';

// 'image' | 'video' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'csv' | 'heic' | null
export function kindOf(name = '', mime = '') {
  const ext = String(name).toLowerCase().split('.').pop();
  const m = String(mime).toLowerCase();
  if (/^image\/(heic|heif)/.test(m) || ['heic', 'heif'].includes(ext)) return 'heic';
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (m.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm'].includes(ext)) return 'video';
  for (const [k, v] of Object.entries(FILE_TYPES)) if (v.exts.includes(ext) || v.mimes.includes(m)) return k;
  if (['doc', 'xls', 'ppt'].includes(ext)) return 'legacy-office';
  return null;
}

// ---- Office Open XML text extraction (DOCX / PPTX / XLSX) ----
const unxml = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const tagText = (xml, tag) => [...String(xml).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => unxml(m[1]));
export function docxText(xml) {
  // paragraphs <w:p> → lines; runs <w:t>; tabs / breaks.
  return String(xml).split(/<\/w:p>/).map((p) => tagText(p.replace(/<w:tab\/>/g, '<w:t>\t</w:t>').replace(/<w:br\/>/g, '<w:t>\n</w:t>'), 'w:t').join('')).map((l) => l.trimEnd()).filter((l, i, a) => l || (a[i - 1] && a[i - 1] !== '')).join('\n').trim();
}
export function pptxText(slides) {
  return slides.map((xml, i) => `[Slide ${i + 1}]\n${String(xml).split(/<\/a:p>/).map((p) => tagText(p, 'a:t').join('')).filter(Boolean).join('\n')}`).join('\n\n').trim();
}
const colIndex = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return 0; let n = 0; for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64); return n - 1; };
export function xlsxText(shared, sheets, maxRows = 400) {
  const ss = String(shared || '').split(/<\/si>/).map((si) => tagText(si, 't').join('')).filter((_, i, a) => i < a.length - 1 || _);
  return sheets.map(({ name, xml }) => {
    const rows = [...String(xml).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].slice(0, maxRows).map((r) => {
      const out = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = c[1] || ''; const body = c[2] || '';
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1]; const t = /t="(\w+)"/.exec(attrs)?.[1];
        let v = tagText(body, 'v')[0] ?? '';
        if (t === 's') v = ss[+v] ?? ''; else if (t === 'inlineStr') v = tagText(body, 't').join('');
        out[colIndex(ref)] = String(v).replace(/[\r\n,]+/g, ' ');
      }
      return Array.from(out, (x) => x ?? '').join(',').replace(/,+$/, '');
    }).filter(Boolean);
    return `[Sheet ${name}]\n${rows.join('\n')}`;
  }).join('\n\n').trim();
}
// bytes (Uint8Array) of a .docx / .pptx / .xlsx → plain text.
export function officeText(kind, bytes) {
  const z = unzipSync(bytes, { filter: (f) => /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml|xl\/workbook\.xml|xl\/worksheets\/sheet\d+\.xml)$/.test(f.name) });
  const s = (n) => (z[n] ? strFromU8(z[n]) : '');
  if (kind === 'docx') return docxText(s('word/document.xml'));
  if (kind === 'pptx') {
    const names = Object.keys(z).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
    return pptxText(names.map(s));
  }
  if (kind === 'xlsx') {
    const wb = s('xl/workbook.xml');
    const sheetNames = [...wb.matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map((m) => unxml(m[1]));
    const names = Object.keys(z).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
    return xlsxText(s('xl/sharedStrings.xml'), names.map((n, i) => ({ name: sheetNames[i] || `Sheet${i + 1}`, xml: s(n) })));
  }
  return '';
}

// ---- Word counts (CJK-aware, the same everywhere: composer chip, sent bubble, Files, AI notice) ----
// One CJK ideograph / kana / Hangul syllable = 1 word; a run of Latin letters, digits (and ' - . inside) = 1 word;
// Thai (no spaces) is segmented with Intl.Segmenter when available, else ~6 letters per word.
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u{20000}-\u{2fa1f}]/u;
const WORD_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u{20000}-\u{2fa1f}]|[\u0e00-\u0e7f]+|(?:(?![\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af\u{20000}-\u{2fa1f}])[\p{L}\p{N}\p{M}])+(?:['’.\-](?:(?![\u0e00-\u0e7f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af])[\p{L}\p{N}\p{M}])+)*/gu;
let thaiSeg = null;
const thaiWords = (run) => {
  try { thaiSeg ||= new Intl.Segmenter('th', { granularity: 'word' }); let n = 0; for (const x of thaiSeg.segment(run)) if (x.isWordLike) n += 1; return n; } catch { return Math.max(1, Math.round(run.length / 6)); }
};
export function countWords(text) {
  let n = 0;
  for (const m of String(text || '').replace(/\[p\.\d+\]/g, ' ').matchAll(WORD_RE)) n += /^[\u0e00-\u0e7f]/.test(m[0]) ? thaiWords(m[0]) : 1;
  return n;
}
export const isCjkHeavy = (text) => { const t = String(text || '').slice(0, 4000); let c = 0; for (const ch of t) if (CJK_RE.test(ch)) c += 1; return c > t.length * 0.25; };
// Rough model-token estimate (CJK ≈ 1 token per character, other text ≈ 4 characters per token).
export function estTokens(text) {
  let cjk = 0; const t = String(text || '');
  for (const ch of t) if (CJK_RE.test(ch)) cjk += 1;
  return Math.ceil(cjk + (t.length - cjk) / 4);
}
// Document text budget per request (agnes-3.0-flash has a 512K-token context; we stay far below it so replies start
// quickly and the request body stays well under Vercel's limit). Shared between the newest turn and earlier turns.
export const DOC_TOKENS = 60_000; // document text in the newest turn (all its files together)
export const DOC_TOKENS_WITH_IMAGES = 30_000; // when photos / video frames travel in the same request
export const HISTORY_DOC_TOKENS = 40_000; // document text re-sent from earlier turns (follow-up questions)
export const HISTORY_DOC_TOKENS_BUSY = 12_000; // …when the newest turn already carries documents
export const DOC_PART_MAX = 400_000; // server cap per document text part (chars)
export const DOC_REQUEST_MAX = 480_000; // server cap on all document parts in one request (chars)
export const INLINE_TEXT_BYTES = 600_000; // extracted text kept on the message doc itself (Firestore doc ≤ 1 MiB)
export const CHUNK_DOC_CHARS = 250_000; // overflow text per extra chunk doc (≤ 750 KB UTF-8 even when all CJK)
// Legacy names (kept for older imports).
export const TEXT_PER_FILE = 11_000;
export const TEXT_SAVED_PER_FILE = INLINE_TEXT_BYTES;
const DOC_HEAD_RE = /^\[(?:附件檔案|附件档案|Attached file|ไฟล์แนบ)[:：]/;
export const isDocPart = (t) => DOC_HEAD_RE.test(String(t || ''));

// ---- Large documents: keep the start + the chunks most related to the question (no extra AI call) ----
const terms = (q) => {
  const s = String(q || '').toLowerCase();
  const latin = s.match(/[a-z0-9]{3,}/g) || [];
  const cjk = (s.match(/[\u3400-\u9fff]+/g) || []).flatMap((w) => Array.from({ length: Math.max(0, w.length - 1) }, (_, i) => w.slice(i, i + 2)));
  return [...new Set([...latin, ...cjk])].slice(0, 60);
};
const STOP = new Set(['the', 'and', 'what', 'which', 'this', 'that', 'for', 'from', 'with', 'page', 'does', 'about', 'tell', 'please', 'document', 'file', 'pdf']);
// Pages: "page 13", "p.13", "pages 12-14", "第13頁", "第 12 至 14 頁".
export function pagesAsked(q) {
  const s = String(q || ''); const out = new Set();
  for (const m of s.matchAll(/(?:pages?|p\.|第)\s*(\d{1,3})(?:\s*(?:-|–|to|至|到|和|and|,|、)\s*(\d{1,3}))?\s*(?:頁|页)?/gi)) {
    const a = +m[1]; const b = m[2] ? +m[2] : a;
    for (let i = Math.min(a, b); i <= Math.min(Math.max(a, b), Math.min(a, b) + 40); i++) out.add(i);
  }
  return out;
}
// budget = characters (kept for callers/tests); tokens = token budget (preferred).
export function selectChunks(text, question, budget = TEXT_PER_FILE, size = 1500, { tokens } = {}) {
  const t = String(text || '');
  const total = t.length;
  const cap = tokens ? Math.floor(tokens * (total / Math.max(1, estTokens(t)))) : budget;
  if (total <= cap) return { text: t, total, kept: total, truncated: false };
  // chunk on page markers when present so a whole page stays together where possible
  const chunks = [];
  for (let i = 0; i < total; i += size) chunks.push({ i: chunks.length, s: t.slice(i, i + size), pages: new Set() });
  // a chunk belongs to every page from the last marker before it to the last marker inside it
  { let cur = 0; for (const c of chunks) { const inside = [...c.s.matchAll(/\[p\.(\d+)\]/g)].map((m) => +m[1]); c.pages = new Set([cur, ...inside].filter(Boolean)); if (inside.length) cur = inside[inside.length - 1]; } }
  const q = terms(question).filter((w) => !STOP.has(w));
  const wantPages = pagesAsked(question);
  const score = (c) => { const low = c.s.toLowerCase(); return q.reduce((n, w) => n + (low.includes(w) ? 1 : 0), 0) + ([...c.pages].some((p) => wantPages.has(p)) ? 50 : 0); };
  const keep = new Set([0]);
  let used = chunks[0].s.length;
  for (const c of [...chunks].slice(1).sort((a, b) => score(b) - score(a) || a.i - b.i)) {
    if (used + c.s.length > cap) continue;
    keep.add(c.i); used += c.s.length;
  }
  const parts = []; let last = -1;
  for (const c of chunks) if (keep.has(c.i)) { if (last >= 0 && c.i !== last + 1) parts.push('\n[…]\n'); parts.push(c.s); last = c.i; }
  return { text: parts.join(''), total, kept: used, truncated: true };
}

// Share a token budget between several documents: small ones are sent whole, the rest split what is left.
export function shareBudget(texts, tokens) {
  const need = texts.map((t) => estTokens(t));
  const out = need.map(() => 0); let left = tokens; let open = need.map((_, i) => i);
  while (open.length && left > 0) {
    const fair = Math.floor(left / open.length);
    const fits = open.filter((i) => need[i] - out[i] <= fair);
    if (!fits.length) { for (const i of open) out[i] += fair; break; }
    for (const i of fits) { left -= need[i] - out[i]; out[i] = need[i]; }
    open = open.filter((i) => !fits.includes(i));
  }
  return out;
}

const HEADS = {
  en: (n, pages, sel) => `[Attached file: ${n}${pages ? `, ${pages} pages` : ''}${sel.truncated ? ` — long document: you are given about ${sel.usedWords.toLocaleString('en')} of its ${sel.words.toLocaleString('en')} words (the start + the parts most related to the question; "[…]" marks skipped text). If the answer is not in this text, say which part is missing instead of guessing.` : ` — full text, about ${sel.words.toLocaleString('en')} words`}]`,
  zh: (n, pages, sel) => `[附件檔案：${n}${pages ? `，共 ${pages} 頁` : ''}${sel.truncated ? `——文件較長，以下只節選約 ${sel.usedWords.toLocaleString('en')}／${sel.words.toLocaleString('en')} 字（開頭及與問題最相關的部分，「[…]」代表略去的內容）。如果答案不在節選內容中，請說明欠缺哪一部分，不要猜測。` : `——全文，約 ${sel.words.toLocaleString('en')} 字`}]`,
};
// Text part the model gets for one file. opts.tokens = this file's token budget.
export function docSelection(att, question, { tokens = DOC_TOKENS } = {}) {
  const text = String(att.text || '');
  const sel = selectChunks(text, question, undefined, 1500, { tokens });
  const words = att.words || countWords(text);
  return { ...sel, words, usedWords: sel.truncated ? countWords(sel.text) : words };
}
export function filePart(att, question, lang = 'zh-Hant', opts = {}) {
  const sel = opts.sel || docSelection(att, question, opts);
  const head = (lang === 'en' ? HEADS.en : HEADS.zh)(att.name, att.pages, sel);
  return `${head}\n${sel.text || (lang === 'en' ? '(no readable text found)' : '（找不到可讀取的文字）')}`;
}

// What the model will get from each document of the newest turn: { [attId]: { words, usedWords, truncated } }.
export function planDocs(text, atts = []) {
  const ready = atts.filter((a) => a.status === 'ready');
  const docs = ready.filter((a) => a.kind !== 'image' && a.kind !== 'video');
  const imgs = ready.some((a) => a.kind === 'image' || a.kind === 'video');
  const shares = shareBudget(docs.map((a) => a.text || ''), imgs ? DOC_TOKENS_WITH_IMAGES : DOC_TOKENS);
  const out = {};
  docs.forEach((a, i) => { out[a.id] = docSelection(a, text, { tokens: Math.max(2000, shares[i]) }); });
  return out;
}

// Whole user turn for the model: text + file texts + images (video = keyframes).
export function buildContent(text, atts = [], lang = 'zh-Hant', plan = null) {
  const ready = atts.filter((a) => a.status === 'ready');
  if (!ready.length) return text;
  const docs = plan || planDocs(text, ready);
  const parts = [{ type: 'text', text: String(text || '').slice(0, 11000) || (lang === 'en' ? 'Please look at the attachment(s).' : '請看看附件。') }];
  for (const a of ready) {
    if (a.kind === 'image') parts.push({ type: 'image_url', image_url: { url: a.data } });
    else if (a.kind === 'video') {
      parts.push({ type: 'text', text: lang === 'en' ? `[Video ${a.name}, ${Math.round(a.dur || 0)} s — ${a.frames.length} keyframes in order]` : `[影片 ${a.name}，${Math.round(a.dur || 0)} 秒——依次 ${a.frames.length} 張關鍵畫面]` });
      for (const f of a.frames) parts.push({ type: 'image_url', image_url: { url: f } });
    } else parts.push({ type: 'text', text: filePart(a, text, lang, { sel: docs[a.id] }) });
  }
  return parts.slice(0, 16);
}
export const imagePartsOf = (content) => (Array.isArray(content) ? content.filter((p) => p?.type === 'image_url').length : 0);
// Attachments a message counts against the quota (video keyframes count as one attachment).
export const attachCountOf = (declared, content) => Math.max(Number(declared) || 0, Math.ceil(imagePartsOf(content) / 8));

const utf8Len = (s) => { let n = 0; for (const ch of String(s)) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
// What is stored on the message (owner-only Firestore doc, < 1 MiB): thumbnails + the FULL extracted text. When the texts
// of one message would not fit (very long documents), a file's text moves to extra chunk docs in the same messages
// collection ({ role: 'attext', of: <message id>, att, n, of_n, text }) — backend list/watch merges them back
// (mergeAttChunks). `plan` (from planDocs) records how much of each file the model got (sentWords).
export function persistPlan(atts = [], plan = {}) {
  const ready = atts.filter((a) => a.status === 'ready');
  let budget = INLINE_TEXT_BYTES - ready.reduce((n, a) => n + (a.thumb?.length || 0), 0);
  const chunks = [];
  const out = ready.map((a) => {
    const base = {
      id: a.id, kind: a.kind, name: String(a.name || '').slice(0, 120), size: a.size || 0, mime: a.mime || '',
      ...(a.ftype ? { ftype: a.ftype } : {}),
      ...(a.thumb ? { thumb: a.thumb } : {}), ...(a.dur ? { dur: Math.round(a.dur) } : {}), ...(a.pages ? { pages: a.pages } : {}), ...(a.pagesRead ? { pagesRead: a.pagesRead } : {}),
    };
    if (!a.text) return base;
    const text = String(a.text);
    const words = a.words || countWords(text);
    const p = plan[a.id];
    const meta = { chars: text.length, words, ...(p && p.truncated ? { sentWords: p.usedWords } : {}) };
    const bytes = utf8Len(text);
    if (bytes <= budget) { budget -= bytes; return { ...base, text, ...meta }; }
    const n = Math.ceil(text.length / CHUNK_DOC_CHARS);
    for (let i = 0; i < n; i++) chunks.push({ att: a.id, n: i, total: n, text: text.slice(i * CHUNK_DOC_CHARS, (i + 1) * CHUNK_DOC_CHARS) });
    const preview = text.slice(0, 2000);
    budget -= utf8Len(preview);
    return { ...base, text: preview, split: n, ...meta };
  });
  return { atts: out, chunks };
}
export const persistable = (atts = [], plan = {}) => persistPlan(atts, plan).atts;
export { mergeAttChunks } from './att-chunks.js';
// Earlier turns: attachments are re-described as text (images are not re-sent).
export function historyText(m, lang = 'zh-Hant') {
  const atts = Array.isArray(m.atts) ? m.atts : [];
  if (!atts.length) return m.content;
  const desc = atts.map((a) => (a.kind === 'image' ? (lang === 'en' ? `[image: ${a.name}]` : `[相片：${a.name}]`) : a.kind === 'video' ? (lang === 'en' ? `[video: ${a.name}]` : `[影片：${a.name}]`) : `[${a.name}]\n${String(a.text || '').slice(0, 2000)}`)).join('\n');
  return `${m.content || ''}\n${desc}`.trim();
}
// Earlier turns with documents, for a follow-up question: the newest documents get the budget first and travel as
// document parts selected against the NEW question (so "what does page 13 say?" works in turn 2, 3, …).
// Returns { [messageId]: content } for the messages that carry document text; others use historyText.
export function historyDocs(msgs = [], question = '', lang = 'zh-Hant', { tokens = HISTORY_DOC_TOKENS, note = (m, t) => t } = {}) {
  const out = {};
  const withDocs = msgs.filter((m) => m.role === 'user' && Array.isArray(m.atts) && m.atts.some((a) => a.kind !== 'image' && a.kind !== 'video' && a.text));
  let left = tokens;
  for (const m of [...withDocs].reverse()) {
    const docs = m.atts.filter((a) => a.kind !== 'image' && a.kind !== 'video' && a.text);
    const shares = shareBudget(docs.map((a) => a.text), Math.max(0, left));
    const others = m.atts.filter((a) => !docs.includes(a)).map((a) => (a.kind === 'image' ? (lang === 'en' ? `[image: ${a.name}]` : `[相片：${a.name}]`) : (lang === 'en' ? `[video: ${a.name}]` : `[影片：${a.name}]`)));
    const parts = [{ type: 'text', text: note(m, [m.content || '', ...others].filter(Boolean).join('\n') || (lang === 'en' ? '(attachment)' : '（附件）')) }];
    docs.forEach((a, i) => {
      if (shares[i] < 500) { parts.push({ type: 'text', text: `[${a.name}]\n${String(a.text).slice(0, 1500)}` }); return; }
      const sel = docSelection(a, question, { tokens: shares[i] });
      left -= estTokens(sel.text);
      parts.push({ type: 'text', text: filePart(a, question, lang, { sel }) });
    });
    out[m.id] = parts;
  }
  return out;
}
// Shown under a sent document: how much of it the AI read.
export const docReadInfo = (a) => (a && a.words ? { words: a.words, sent: a.sentWords && a.sentWords < a.words ? a.sentWords : a.words, trimmed: !!(a.sentWords && a.sentWords < a.words) } : null);
export const fmtSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
