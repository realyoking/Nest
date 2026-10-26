// AI 助理 attachments — browser-side processing. Images are resized on the device (≤ 2048 px, JPEG; HEIC is decoded
// where the browser can — Safari / iOS — and re-encoded as JPEG), videos ≤ the plan's limit become keyframes + a
// thumbnail, documents become text (PDF via pdf.js loaded on demand; DOCX / PPTX / XLSX unzipped here; TXT / CSV read).
// Nothing is uploaded anywhere except inside the /api/chat request itself.
import { kindOf, officeText, countWords, MAX_IMAGE_SIDE, FRAME_SIDE, THUMB_SIDE, REQUEST_BUDGET, attachLimits } from './attach-core.js';

export class AttachError extends Error { constructor(code, info = {}) { super(code); this.code = code; Object.assign(this, info); } }
const uid = () => Math.random().toString(36).slice(2, 10);

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url;
    await img.decode();
    return img;
  } catch { return null; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function draw(src, maxSide) {
  const w0 = src.width || src.naturalWidth || src.videoWidth; const h0 = src.height || src.naturalHeight || src.videoHeight;
  const k = Math.min(1, maxSide / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
const jpeg = (canvas, q) => canvas.toDataURL('image/jpeg', q);
// Encode to fit `budget` data-URL chars: quality first, then size.
function fit(src, maxSide, budget) {
  for (const side of [maxSide, 1600, 1280, 1024, 800]) {
    if (side > maxSide) continue;
    const c = draw(src, side);
    for (const q of [0.85, 0.75, 0.62, 0.5]) { const d = jpeg(c, q); if (d.length <= budget) return { data: d, w: c.width, h: c.height }; }
  }
  const c = draw(src, 640); return { data: jpeg(c, 0.5), w: c.width, h: c.height };
}
// True when the canvas is one flat colour (nothing was drawn).
function blank(c) {
  const t = document.createElement('canvas'); t.width = 16; t.height = 16; const g = t.getContext('2d'); g.drawImage(c, 0, 0, 16, 16);
  const d = g.getImageData(0, 0, 16, 16).data;
  for (let i = 4; i < d.length; i += 4) if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 12) return false;
  return true;
}
const thumbOf = (src) => jpeg(draw(src, THUMB_SIDE), 0.62);

export async function processImage(file, { budget = 1_100_000 } = {}) {
  const bmp = await decode(file);
  if (!bmp) throw new AttachError(kindOf(file.name, file.type) === 'heic' ? 'heic_unsupported' : 'image_unreadable');
  const { data, w, h } = fit(bmp, MAX_IMAGE_SIDE, budget);
  const thumb = thumbOf(bmp);
  bmp.close?.();
  return { data, thumb, w, h };
}

export async function processVideo(file, { maxSec = 60, onProgress } = {}) {
  const url = URL.createObjectURL(file);
  const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  const once = (ev) => new Promise((res, rej) => { const ok = () => { cleanup(); res(); }; const bad = () => { cleanup(); rej(new AttachError('video_unreadable')); }; const cleanup = () => { v.removeEventListener(ev, ok); v.removeEventListener('error', bad); }; v.addEventListener(ev, ok); v.addEventListener('error', bad); });
  await Promise.race([once('loadedmetadata'), new Promise((_, rej) => setTimeout(() => rej(new AttachError('video_unreadable')), 15000))]);
  if (v.readyState < 2) await Promise.race([once('loadeddata'), new Promise((r) => setTimeout(r, 6000))]).catch(() => {});
  const dur = v.duration;
  if (!Number.isFinite(dur) || dur <= 0) throw new AttachError('video_unreadable');
  if (dur > maxSec + 0.5) { URL.revokeObjectURL(url); throw new AttachError('video_too_long', { max: maxSec }); }
  const n = Math.min(8, Math.max(3, Math.ceil(dur / 6)));
  const frames = []; let thumb = ''; let seen = false;
  for (let i = 0; i < n; i++) {
    v.currentTime = Math.min(dur - 0.05, (i + 0.5) * (dur / n));
    await Promise.race([once('seeked'), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
    // Wait until the seeked frame is actually presented (Safari draws a blank canvas otherwise).
    await new Promise((r) => { if (v.requestVideoFrameCallback) { const t = setTimeout(r, 400); v.requestVideoFrameCallback(() => { clearTimeout(t); r(); }); } else setTimeout(r, 120); });
    const c = draw(v, FRAME_SIDE);
    if (!blank(c)) seen = true;
    frames.push(jpeg(c, 0.68));
    if (!i) thumb = jpeg(draw(v, THUMB_SIDE), 0.62);
    onProgress?.((i + 1) / n);
  }
  // Some browsers (e.g. headless / no video→canvas) give blank frames: never send those to the model.
  if (!seen) { URL.revokeObjectURL(url); throw new AttachError('video_frames_unavailable'); }
  return { frames, thumb, dur, url, w: v.videoWidth, h: v.videoHeight };
}

let pdfjsP = null;
async function pdfjs() {
  pdfjsP ||= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    lib.GlobalWorkerOptions.workerSrc = worker;
    return lib;
  })();
  return pdfjsP;
}
// pdf.js needs its packed CMaps for CJK PDFs that use the standard Adobe CJK fonts (otherwise every Chinese page reads
// as empty) and the standard font data for non-embedded fonts. Both are copied to /pdfjs/ at build time (vite.config.js).
export const PDF_ASSETS = { cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' };
export const PDF_MAX_PAGES = 200;
// Every page is read (awaited in order) — the text of ALL pages is returned, never just the first page or a preview.
export async function processPdf(file, { onProgress, maxPages = PDF_MAX_PAGES, lib: libIn, assets = PDF_ASSETS } = {}) {
  const lib = libIn || await pdfjs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, disableFontFace: true, ...assets }).promise;
  const pages = doc.numPages; const out = [];
  for (let i = 1; i <= Math.min(pages, maxPages); i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    out.push(tc.items.map((x) => x.str + (x.hasEOL ? '\n' : '')).join('').replace(/[ \t]+\n/g, '\n'));
    onProgress?.(i / Math.min(pages, maxPages));
  }
  doc.destroy?.();
  const text = out.map((t, i) => `[p.${i + 1}]\n${t.trim()}`).join('\n\n').trim();
  const full = pages > maxPages ? `${text}\n\n[… ${pages - maxPages} more pages not read]` : text;
  return { text: full, pages, words: countWords(full), ...(pages > maxPages ? { pagesRead: maxPages } : {}) };
}

// One File → an attachment object (status 'ready' or throws AttachError).
export async function processFile(file, { plan = 'free', budget, onProgress } = {}) {
  const lim = attachLimits(plan);
  const kind = kindOf(file.name, file.type);
  const base = { id: uid(), name: file.name || 'file', size: file.size, mime: file.type || '' };
  if (!kind) throw new AttachError('type_unsupported');
  if (kind === 'legacy-office') throw new AttachError('legacy_office');
  if (file.size > lim.fileMB * 1048576 * (kind === 'video' ? 4 : 1)) throw new AttachError('file_too_big', { max: lim.fileMB * (kind === 'video' ? 4 : 1) });
  if (kind === 'image' || kind === 'heic') { const r = await processImage(file, { budget }); return { ...base, kind: 'image', mime: 'image/jpeg', ...r, status: 'ready' }; }
  if (kind === 'video') { const r = await processVideo(file, { maxSec: lim.videoSec, onProgress }); return { ...base, kind: 'video', ...r, status: 'ready' }; }
  if (kind === 'pdf') { const r = await processPdf(file, { onProgress }); return { ...base, kind: 'file', ftype: 'pdf', ...r, status: 'ready' }; }
  if (kind === 'docx' || kind === 'xlsx' || kind === 'pptx') {
    let text = '';
    try { text = officeText(kind, new Uint8Array(await file.arrayBuffer())); } catch { throw new AttachError('file_unreadable'); }
    return { ...base, kind: 'file', ftype: kind, text, words: countWords(text), status: 'ready' };
  }
  const text = (await file.text()).replace(/\r\n/g, '\n').slice(0, 400_000);
  return { ...base, kind: 'file', ftype: kind, text, words: countWords(text), status: 'ready' };
}
// Image budget per picture so the whole request stays under the server's body limit.
export const imageBudget = (nImages) => Math.max(160_000, Math.floor(REQUEST_BUDGET / Math.max(1, nImages)) - 20_000);
// Data-URL characters already used by ready attachments.
export const usedChars = (atts) => atts.reduce((n, a) => n + (a.data?.length || 0) + (a.frames || []).reduce((m, f) => m + f.length, 0), 0);
