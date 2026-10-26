import './_env.mjs';
// Run 24: on-device document scanner + remove handwriting (src/lib/scan-core.js, scan-pdf.js, Scanner page wiring).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectQuad, homography, applyH, warp, enhance, inkMask, compose, applyFilter, brush, scan, removeOpts, mkImg, otsu, REMOVE_MODES, FILTERS } from '../src/lib/scan-core.js';
import { jpegPdf } from '../src/lib/scan-pdf.js';
import { removal } from '../src/lib/scan-core.js';
import { handMask, lineRuns } from '../src/lib/scan-hand.js';
import { runScan } from '../src/lib/scan-worker.js';
import { R24 } from '../src/lib/strings-run24.js';

// ---------- a synthetic "photo": flat page drawn first, then projected onto a dark table with a shadow ----------
const PW = 300, PH = 400;
function flatPage() {
  const img = mkImg(PW, PH); const d = img.data; d.fill(255);
  const set = (x, y, [r, g, b]) => { if (x < 0 || y < 0 || x >= PW || y >= PH) return; const i = (y * PW + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; };
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, c); };
  const K = [20, 20, 22], BLUE = [30, 60, 200], RED = [210, 40, 40], PENCIL = [150, 150, 150];
  for (let r = 0; r < 6; r++) {
    const y = 60 + r * 50;
    for (let g = 0; g < 4; g++) rect(30 + g * 14, y - 14, 9, 14, K); // printed "glyphs" (question text)
    rect(140, y + 2, 120, 3, K); // answer line
  }
  // blue answer crossing the line on row 0 (a downstroke through the line)
  for (let y = 40; y < 72; y++) rect(170 + ((y - 40) >> 3), y, 4, 1, BLUE);
  rect(200, 50, 30, 4, BLUE);
  // red tick
  for (let k = 0; k < 14; k++) rect(268 + (k >> 1), 100 + k, 3, 1, RED);
  // pencil answer, row 2 (big, light grey)
  for (let y = 140; y < 160; y++) rect(170 + ((y - 140) >> 2), y, 2, 1, PENCIL); rect(185, 146, 22, 2, PENCIL);
  // black pen answer written on row 3's line
  for (let y = 196; y < 210; y++) rect(175, y, 3, 1, K); rect(175, 196, 14, 3, K); rect(186, 196, 3, 14, K);
  return img;
}
const TRUE_QUAD = [[60, 50], [420, 70], [440, 560], [40, 530]];
function photo() {
  const W = 480, H = 600; const out = mkImg(W, H); const o = out.data; const page = flatPage();
  const Hm = homography(TRUE_QUAD, [[0, 0], [PW, 0], [PW, PH], [0, PH]]); // photo → page
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4; const [u, v] = applyH(Hm, x + 0.5, y + 0.5); const shade = 1 - 0.35 * Math.max(0, 1 - Math.hypot(x - 460, y - 40) / 420);
    if (u >= 0 && v >= 0 && u < PW && v < PH) { const j = ((v | 0) * PW + (u | 0)) * 4; o[i] = page.data[j] * shade * 0.97; o[i + 1] = page.data[j + 1] * shade * 0.95; o[i + 2] = page.data[j + 2] * shade * 0.9; }
    else { o[i] = 70 * shade; o[i + 1] = 58 * shade; o[i + 2] = 48 * shade; }
    o[i + 3] = 255;
  }
  return out;
}
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

test('scan: detects the page corners on a tilted, shadowed photo (within 3% of the frame)', () => {
  const q = detectQuad(photo());
  assert.equal(q.found, true);
  q.quad.forEach((p, i) => assert.ok(Math.hypot(p[0] - TRUE_QUAD[i][0], p[1] - TRUE_QUAD[i][1]) < 0.03 * 600, `corner ${i} ${p} vs ${TRUE_QUAD[i]}`));
  // nothing page-like → whole frame, found:false
  const dark = mkImg(100, 100); dark.data.fill(40); const r = detectQuad(dark);
  assert.equal(r.found, false); assert.deepEqual(r.quad, [[0, 0], [100, 0], [100, 100], [0, 100]]);
});

test('scan: homography maps the rectangle onto the quad exactly; otsu splits two populations', () => {
  const H = homography([[0, 0], [10, 0], [10, 20], [0, 20]], TRUE_QUAD);
  [[0, 0], [10, 0], [10, 20], [0, 20]].forEach((p, i) => { const [x, y] = applyH(H, ...p); assert.ok(Math.abs(x - TRUE_QUAD[i][0]) < 1e-6 && Math.abs(y - TRUE_QUAD[i][1]) < 1e-6); });
  const t = otsu([...Array(100).fill(40), ...Array(100).fill(200)]); assert.ok(t >= 40 && t < 200);
});

test('scan: perspective crop + shadow removal give a flat white page with dark print', () => {
  const flat = warp(photo(), TRUE_QUAD, { w: PW, h: PH }); const enh = enhance(flat);
  // paper region far from marks: bright and even despite the shadow
  const vals = []; for (let y = 330; y < 390; y += 3) for (let x = 20; x < 280; x += 7) vals.push(lum(enh.data, (y * PW + x) * 4));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length; assert.ok(mean > 245, `paper mean ${mean}`);
  assert.ok(Math.max(...vals) - Math.min(...vals) < 20, 'shadow flattened');
  assert.ok(lum(enh.data, ((60 - 7) * PW + 34) * 4) < 90, 'printed glyph stays dark');
  const g = applyFilter(enh, 'gray'); assert.equal(g.data[0], g.data[1]); const bw = applyFilter(enh, 'bw'); assert.ok([0, 255].includes(bw.data[(53 * PW + 34) * 4]));
  assert.deepEqual(FILTERS, ['color', 'gray', 'bw']);
});

test('scan: colour-ink mode removes blue + red handwriting and keeps black print, repairing the crossed line', () => {
  const page = flatPage(); const r = inkMask(page, removeOpts('color')); const out = compose(page, r.mask);
  const d = page.data, o = out.data; let ink = 0, inkLeft = 0, print = 0, printKept = 0;
  for (let p = 0; p < PW * PH; p++) {
    const i = p * 4; const ch = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const onLine = (p % PW) >= 140 && (p % PW) < 260 && [0, 1, 2, 3, 4, 5].some((r) => { const y = (p / PW) | 0; return y >= 62 + r * 50 && y <= 64 + r * 50; });
    if (ch > 100 && !onLine) { ink++; const oc = Math.max(o[i], o[i + 1], o[i + 2]) - Math.min(o[i], o[i + 1], o[i + 2]); if (oc > 30 || lum(o, i) < 200) inkLeft++; }
    if (ch < 10 && lum(d, i) < 40) { print++; if (lum(o, i) < 60) printKept++; }
  }
  assert.ok(ink > 200 && inkLeft === 0, `ink ${ink} left ${inkLeft}`);
  assert.ok(printKept / print > 0.99, `print kept ${printKept}/${print}`);
  // the answer line under the blue downstroke (row 0: y 62–64, x ≈ 173) is dark again
  for (let x = 172; x < 178; x++) assert.ok(lum(o, (63 * PW + x) * 4) < 60, `line repaired at x=${x}`);
  // pencil + black pen untouched in this mode
  assert.ok(lum(o, (150 * PW + 172) * 4) < 200 && lum(o, (200 * PW + 176) * 4) < 60);
});

test('scan: strong mode also removes the big pencil answer and black pen on an answer line; printed glyphs survive', () => {
  const page = flatPage(); const r = inkMask(page, removeOpts('strong')); const out = compose(page, r.mask); const o = out.data;
  assert.ok(lum(o, (150 * PW + 172) * 4) > 240, 'pencil gone'); assert.ok(lum(o, (200 * PW + 176) * 4) > 240, 'black pen on the line gone');
  assert.ok(r.stats.pencilPx > 0 && r.stats.penPx > 0);
  for (let row = 0; row < 6; row++) { const y = 60 + row * 50 - 7; assert.ok(lum(o, (y * PW + 34) * 4) < 60, `glyph row ${row} kept`); assert.ok(lum(o, ((60 + row * 50 + 3) * PW + 250) * 4) < 60, `line row ${row} kept`); }
  assert.deepEqual(REMOVE_MODES, ['off', 'auto', 'color', 'dark']); assert.equal(removeOpts('off'), null);
});

test('scan: manual erase / restore beat the automatic mask; whole pipeline runs end to end', () => {
  const page = flatPage(); const r = inkMask(page, removeOpts('color'));
  const manual = new Uint8Array(PW * PH); brush(manual, PW, PH, 34, 53, 4, 1); // erase a printed glyph by hand
  brush(manual, PW, PH, 215, 52, 3, 2); // restore part of the blue stroke
  const o = compose(page, r.mask, manual).data;
  assert.ok(lum(o, (53 * PW + 34) * 4) > 250, 'hand-erased'); const i = (52 * PW + 215) * 4; assert.ok(o[i + 2] > 150 && o[i] < 80, 'hand-restored blue');
  const res = scan(photo(), { remove: 'color', filter: 'gray' });
  assert.ok(res.out.width > 200 && res.out.height > 250 && res.mask);
});

test('scan: PDF writer produces a valid single-page A4 PDF with a correct xref', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegPdf([{ jpeg, width: 1240, height: 1754 }, { jpeg, width: 1754, height: 1240 }], { title: '掃描 Scan(1)' });
  const txt = Buffer.from(pdf).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4')); assert.ok(txt.trimEnd().endsWith('%%EOF'));
  assert.match(txt, /\/Count 2/); assert.match(txt, /\/MediaBox \[0 0 595\.28 841\.89\]/); assert.match(txt, /\/MediaBox \[0 0 841\.89 595\.28\]/); assert.match(txt, /\/Filter \/DCTDecode/);
  const xref = Number(txt.match(/startxref\n(\d+)/)[1]); assert.ok(txt.slice(xref).startsWith('xref'));
  const offs = [...txt.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
  offs.forEach((o, k) => assert.ok(txt.slice(o).startsWith(`${k + 1} 0 obj`), `obj ${k + 1}`));
  assert.match(txt, /\/Title \(Scan1\)/);
});

test('scan: strings exist in zh-Hant / en / th with the same keys; zh-Hant is written Chinese', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`])).sort();
  const zh = keys(R24['zh-Hant']); assert.deepEqual(keys(R24.en), zh); assert.deepEqual(keys(R24.th), zh);
  const zhText = JSON.stringify(R24['zh-Hant']);
  for (const w of ['嘅', '咗', '唔', '嚟', '啲', '喺', '冇', '嘢', '佢', '睇', '攞', '軟體', '網路', '螢幕', '列印', '相簿', '影像檔', '資料夾']) assert.ok(!zhText.includes(w), `zh-Hant has ${w}`);
  assert.ok(R24.th.scan.title && R24.en.scan.removeModes.dark === 'Dark pen');
});

test('scan: page is a lazy route, reached from Files, and never touches the network or AI', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/app\/Scanner\.jsx'\)\)/); assert.match(app, /path="files\/scan"/);
  assert.match(fs.readFileSync(new URL('../src/pages/app/Files.jsx', import.meta.url), 'utf8'), /to="\/app\/files\/scan"/);
  for (const f of ['../src/pages/app/Scanner.jsx', '../src/lib/scan-core.js', '../src/lib/scan-worker.js', '../src/lib/scan-pdf.js']) {
    const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bfetch\(|XMLHttpRequest|\/api\/|useBe|agnes/i.test(src), `${f} must stay on-device`);
  }
  const fns = fs.readdirSync(new URL('../api/', import.meta.url), { recursive: true }).filter((f) => /\.js$/.test(f) && !f.split('/').pop().startsWith('_'));
  assert.equal(fns.length, 12, 'no new Vercel function');
});

// ---------- part 1b: dark pen ----------
// a typeset page: rows of thin, print-sized glyphs on level baselines; a diagram (box + long diagonal); then big,
// thick, curvy dark-pen strokes written in the free space (and one crossing the diagram)
const QW = 600, QH = 800;
function printedPage({ hand = true, blue = false } = {}) {
  const img = mkImg(QW, QH); const d = img.data; d.fill(255);
  const dot = (x, y, r, c) => { for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (xx >= 0 && yy >= 0 && xx < QW && yy < QH && (xx - x) ** 2 + (yy - y) ** 2 <= r * r) { const i = (yy * QW + xx) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } };
  const rect = (x0, y0, w, h, c = [40, 40, 40]) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * QW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; } };
  for (let r = 0; r < 10; r++) { const y = 40 + r * 34; for (let g = 0; g < 30; g++) { const tall = (g * 7) % 5 === 0; const gx = 40 + g * 13 + Math.floor(g / 5) * 6; rect(gx, y + (tall ? 0 : 4), 2, tall ? 14 : 10); rect(gx + 2, y + 12, 5, 2); } }
  // diagram: box 300×160 at (240,440) and a long diagonal ray
  rect(240, 440, 300, 2); rect(240, 600, 300, 2); rect(240, 440, 2, 162); rect(538, 440, 2, 162);
  for (let k = 0; k < 140; k++) rect(80 + k, 620 - Math.floor(k * 0.9), 2, 2);
  if (hand) {
    const K = [15, 15, 15];
    for (let k = 0; k < 360; k += 2) { const a = (k * Math.PI) / 180; dot(110 + 28 * Math.cos(a), 470 + 34 * Math.sin(a), 2.6, K); } // a big "0"
    for (let x = 60; x < 220; x += 1) dot(x, 700 + 18 * Math.sin(x / 9), 2.6, K); // a wavy written word
    for (let x = 300; x < 470; x += 1) dot(x, 520 + 14 * Math.sin(x / 7), 2.6, K); // writing inside the diagram box
  }
  if (blue) for (let x = 60; x < 400; x++) dot(x, 760 + 10 * Math.sin(x / 8), 2.5, [30, 60, 200]);
  return img;
}
const darkAt = (o, x, y, r = 3) => { let m = 255; for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) m = Math.min(m, lum(o, (yy * QW + xx) * 4)); return m; };
test('1b: straight-run detector finds long lines, not curves', () => {
  const ink = new Uint8Array(100 * 100); for (let x = 10; x < 90; x++) ink[50 * 100 + x] = 1; for (let k = 0; k < 40; k++) ink[(10 + k) * 100 + 10 + k] = 1;
  const r = lineRuns(ink, 100, 100); assert.ok(r[50 * 100 + 50] >= 79); assert.ok(r[30 * 100 + 30] >= 55);
});
test('1b: dark-pen handwriting is removed; printed text lines and the diagram stay', () => {
  const page = printedPage(); const h = handMask(page); const o = compose(page, h.mask).data;
  assert.ok(h.stats.printLines >= 8, `print lines ${h.stats.printLines}`);
  assert.ok(h.stats.hand > 1500, `hand px ${h.stats.hand}`);
  // handwriting gone
  for (const [x, y] of [[110, 436], [138, 470], [100, 700], [380, 520]]) assert.ok(darkAt(o, x, y, 4) > 200, `hand left at ${x},${y}: ${darkAt(o, x, y, 4)}`);
  // every printed row kept (sample glyph pixels), box + diagonal kept
  let kept = 0, all = 0; for (let r = 0; r < 10; r++) for (let g = 0; g < 30; g += 3) { all++; if (lum(o, ((40 + r * 34 + 12) * QW + 40 + g * 13 + Math.floor(g / 5) * 6 + 1) * 4) < 100) kept++; }
  assert.ok(kept / all > 0.95, `print kept ${kept}/${all}`);
  for (const [x, y] of [[300, 441], [540, 500], [241, 560], [150, 557]]) assert.ok(darkAt(o, x, y, 2) < 100, `diagram lost at ${x},${y}`);
});
test('1b: auto picks colour ink when the answers are coloured, dark pen otherwise; never 0% on dark pen', () => {
  const blueOnly = printedPage({ hand: false, blue: true }); const a = removal(blueOnly, 'auto'); assert.equal(a.mode, 'color'); assert.ok(a.detected.includes('color'));
  const dark = printedPage(); const b = removal(dark, 'auto'); assert.equal(b.mode, 'dark'); assert.ok(b.stats.handPx / b.stats.total > 0.003, 'dark pen removed'); assert.ok(b.detected.includes('dark'));
  const off = removal(dark, 'off'); assert.equal(off.mask, null);
  const c = removal(dark, 'color'); assert.ok(c.stats.handPx === 0);
});
test('1b: worker pipeline (stateless) reports stages and returns transferable buffers', () => {
  const p = photo(); const stages = [];
  const r = runScan({ type: 'process', width: p.width, height: p.height, buffer: p.data.buffer, mode: 'auto' }, (s) => stages.push(s));
  assert.ok(r.out.byteLength === r.width * r.height * 4 && r.flat && r.enh);
  for (const s of ['detect', 'warp', 'enhance', 'color', 'compose']) assert.ok(stages.includes(s), s);
  assert.ok(['color', 'dark'].includes(r.mode));
});
test('1b: Scanner is multi-page: strip, add/retake/delete/reorder, apply to all, one combined PDF', () => {
  const src = fs.readFileSync(new URL('../src/pages/app/Scanner.jsx', import.meta.url), 'utf8');
  for (const k of ['scan-strip', 'scan-add', 'scan-del', 'scan-move-left', 'scan-move-right', 'scan-apply-all', 'savePdfAll', 'saveImgs', 'retakePage', 'multiple={!capture}', 'jpegPdf(out']) assert.ok(src.includes(k), k);
  assert.match(src, /MAX_IN = 2000/); assert.match(src, /new Worker\(new URL\('\.\.\/\.\.\/lib\/scan-worker\.js'/);
});

// ---------- 1b (final): real-looking fixtures (enhanced pages, test/fixtures/scan/*.png) ----------
// user-blackpen = the user's own physics worksheet answered in black pen (page crop of their screenshot);
// fresh-* = a worksheet NOT used while tuning (wobbly per-glyph handwriting, photo look): dark pen / colour + pencil / blank.
import zlib from 'node:zlib';
function readPng(file) { // minimal 8-bit RGB / RGBA PNG decoder (filters 0–4)
  const b = fs.readFileSync(new URL(`./fixtures/scan/${file}`, import.meta.url)); let p = 8, w = 0, h = 0, ct = 2; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p); const type = b.toString('latin1', p + 4, p + 8); const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; } else if (type === 'IDAT') idat.push(data); p += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const bpp = ct === 6 ? 4 : 3; const stride = w * bpp; const cur = new Uint8Array(stride), prev = new Uint8Array(stride);
  const out = mkImg(w, h); const o = out.data;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]; const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? cur[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1; else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = v & 255; }
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; o[i] = cur[x * bpp]; o[i + 1] = cur[x * bpp + 1]; o[i + 2] = cur[x * bpp + 2]; o[i + 3] = 255; }
    prev.set(cur);
  }
  return out;
}
const pct = (r) => (r.stats.colorPx + r.stats.handPx + r.stats.pencilPx) / r.stats.total * 100;
const keptIn = (enh, out, [x0, y0, x1, y1]) => { let a = 0, k = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * enh.width + x) * 4; if (lum(enh.data, i) < 120) { a++; if (lum(out.data, i) < 160) k++; } } return a ? k / a : 1; };
test('1b real: the user\'s black-pen worksheet — auto removes the answers (never ~0%), printed questions stay', () => {
  const enh = readPng('user-blackpen.png'); const r = removal(enh, 'auto'); const out = compose(enh, r.mask);
  assert.equal(r.mode, 'dark'); assert.ok(r.detected.includes('dark')); assert.ok(pct(r) > 1.5, `removed ${pct(r).toFixed(2)}%`);
  assert.ok(keptIn(enh, out, [18, 60, 300, 76]) > 0.9, 'title kept'); // "Common Question on Reflection"
  assert.ok(keptIn(enh, out, [45, 84, 690, 100]) > 0.9, 'Q1 line kept');
  assert.ok(keptIn(enh, out, [95, 560, 300, 580]) > 0.9, 'MC option A row kept');
  assert.ok(keptIn(enh, out, [90, 205, 330, 250]) < 0.15, 'black-pen working removed'); // "(a) 35°+12°=47°"
});
test('1b real: fresh dark-pen sheet — answers removed; bold underlined title, bold row, MC options, table kept', () => {
  const enh = readPng('fresh-dark.png'); const r = removal(enh, 'auto'); const out = compose(enh, r.mask);
  assert.equal(r.mode, 'dark'); assert.ok(pct(r) > 0.6, `removed ${pct(r).toFixed(2)}%`);
  assert.ok(keptIn(enh, out, [107, 73, 569, 107]) > 0.9, 'bold underlined title kept');
  assert.ok(keptIn(enh, out, [107, 136, 616, 160]) > 0.9, 'bold printed row kept');
  assert.ok(keptIn(enh, out, [126, 790, 300, 830]) > 0.9, 'MC A/B rows kept');
  assert.ok(keptIn(enh, out, [142, 225, 592, 278]) < 0.15, 'black-pen answer removed');
});
test('1b real: blank sheets lose (almost) nothing in auto or dark mode — print is never mistaken for pen', () => {
  for (const f of ['fresh-blank.png', 'maths-blank.png', 'physics-blank.png']) for (const m of ['auto', 'dark']) {
    const r = removal(readPng(f), m); assert.ok(pct(r) < 0.1, `${f} ${m}: ${pct(r).toFixed(3)}%`);
  }
});
test('1b real: colour ink + pencil sheet — auto removes both, keeps print', () => {
  const enh = readPng('fresh-mixed.png'); const r = removal(enh, 'auto'); const out = compose(enh, r.mask);
  assert.ok(r.detected.includes('color') && r.detected.includes('pencil'), r.detected.join());
  assert.ok(r.stats.pencilPx > 2000 && r.stats.colorPx > 2000);
  assert.ok(keptIn(enh, out, [107, 73, 569, 107]) > 0.9, 'title kept');
});
test('1b real: an already-cropped page keeps the whole frame (no inset), so the header "Physics" + "ACME" survive in-app', () => {
  const src = readPng('user-blackpen.png'); const q = detectQuad(src);
  assert.ok(q.fills && q.found, 'page fills frame'); assert.deepEqual(q.quad, [[0, 0], [src.width, 0], [src.width, src.height], [0, src.height]]);
  const r = runScan({ type: 'process', width: src.width, height: src.height, buffer: new Uint8ClampedArray(src.data).buffer, mode: 'auto' }, () => {});
  assert.equal(r.width, src.width); const out = { width: r.width, height: r.height, data: new Uint8ClampedArray(r.out) };
  const enh = { width: r.width, height: r.height, data: new Uint8ClampedArray(r.enh) };
  assert.ok(keptIn(enh, out, [18, 4, 112, 19]) > 0.85, 'I.S. – Physics kept');
  assert.ok(keptIn(enh, out, [610, 30, 738, 47]) > 0.85, 'ACME Learning Centre kept');
  assert.ok(keptIn(enh, out, [90, 205, 330, 250]) < 0.2, 'black-pen working still removed');
});
