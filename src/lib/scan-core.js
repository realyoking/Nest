// Run 24: on-device document scanner + "remove handwriting". Pure JS on RGBA buffers ({ width, height, data }),
// so it runs in the browser (canvas ImageData) and in node tests alike. No OpenCV, no network, no AI cost.
//   detectQuad  → find the sheet of paper (largest bright, low-colour region) and its 4 corners
//   warp        → perspective-correct the quad into a flat rectangle (homography + bilinear sampling)
//   enhance     → shadow removal / white balance (divide by a blurred max-filter background) + levels; colour / grey / B&W
//   inkMask     → which pixels are handwriting: coloured ink (reliable), pencil (light-grey strokes, heuristic),
//                 black pen (stroke-shape heuristic, lower quality)
//   compose     → enhanced page with the mask painted white, print lines repaired where ink crossed them
import { handMask } from './scan-hand.js';
export const MAX_SIDE = 2000;
export const mkImg = (width, height, data = new Uint8ClampedArray(width * height * 4)) => ({ width, height, data });
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lumaAt = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];

// ---------- small helpers ----------
export function downscale(img, maxSide) {
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (s === 1) return { img, s };
  const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  const out = mkImg(w, h); const d = img.data, o = out.data;
  const fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * fx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy += 1 + ((y1 - y0) >> 2)) for (let xx = x0; xx < x1; xx += 1 + ((x1 - x0) >> 2)) { const i = (yy * img.width + xx) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      const j = (y * w + x) * 4; o[j] = r / n; o[j + 1] = g / n; o[j + 2] = b / n; o[j + 3] = 255;
    }
  }
  return { img: out, s: w / img.width };
}
function boxBlur(a, w, h, r) { // Float32 single channel, separable, in place-ish
  if (r < 1) return a;
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) { let acc = 0; const row = y * w; for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { t[row + x] = acc / (2 * r + 1); acc += a[row + clamp(x + r + 1, 0, w - 1)] - a[row + clamp(x - r, 0, w - 1)]; } }
  for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = acc / (2 * r + 1); acc += t[clamp(y + r + 1, 0, h - 1) * w + x] - t[clamp(y - r, 0, h - 1) * w + x]; } }
  return o;
}
function maxFilter(a, w, h, r) {
  const t = new Float32Array(a.length), o = new Float32Array(a.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (a[y * w + k] > m) m = a[y * w + k]; t[y * w + x] = m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (t[k * w + x] > m) m = t[k * w + x]; o[y * w + x] = m; }
  return o;
}
export function otsu(values) {
  const hist = new Float64Array(256); for (const v of values) hist[clamp(v | 0, 0, 255)]++;
  const total = values.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sumB += t * hist[t]; const mB = sumB / wB, mF = (sum - sumB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; thr = t; } }
  return thr;
}

// ---------- 1. find the page ----------
// Returns { quad: [tl, tr, br, bl] in source pixels, found, area (0–1 of frame) }.
export function detectQuad(img, dbg = null) {
  const { img: sm, s } = downscale(img, 360);
  const w = sm.width, h = sm.height, d = sm.data, n = w * h;
  let L = new Float32Array(n); const C = new Float32Array(n);
  for (let p = 0; p < n; p++) { const i = p * 4; L[p] = lumaAt(d, i); C[p] = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); }
  L = boxBlur(L, w, h, 1);
  const thr = otsu(L);
  // seeds: bright pixels in the central 40% of the frame; grow while neighbours change smoothly (shadows are smooth,
  // the paper edge is a step) and stay low-colour. Text strokes inside are simply walked around.
  const lab = new Int32Array(n); const stack = new Int32Array(n); let sp = 0, best = 0; const bestLab = 1;
  for (let y = Math.floor(h * 0.3); y < h * 0.7; y++) for (let x = Math.floor(w * 0.3); x < w * 0.7; x++) { const p = y * w + x; if (L[p] > thr && C[p] < 70) { lab[p] = 1; stack[sp++] = p; } }
  while (sp) {
    const p = stack[--sp]; best++; const x = p % w;
    const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
    for (const q of nb) if (q >= 0 && q < n && !lab[q] && C[q] < 70 && Math.abs(L[q] - L[p]) < STEP && L[q] > thr * 0.72) { lab[q] = 1; stack[sp++] = q; }
  }
  const full = [[0, 0], [img.width, 0], [img.width, img.height], [0, img.height]];
  if (dbg) Object.assign(dbg, { lab, w, h, thr });
  if (best < n * 0.12) return { quad: full, found: false, area: best / n };
  let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
  for (let p = 0; p < n; p++) {
    if (lab[p] !== bestLab) continue; const x = p % w, y = (p / w) | 0;
    if (x + y < tl[2]) tl = [x, y, x + y]; if (x + y > br[2]) br = [x + 1, y + 1, x + y];
    if (x - y > tr[2]) tr = [x + 1, y, x - y]; if (x - y < bl[2]) bl = [x, y + 1, x - y];
  }
  const back = (pt) => [clamp(pt[0] / s, 0, img.width), clamp(pt[1] / s, 0, img.height)];
  // inset 0.6% toward the centre so no sliver of table is left on the edges
  const raw = [tl, tr, br, bl].map(back);
  // Run 24 1b: photo already cropped to the page (paper reaches every frame corner) → keep the whole frame.
  // Insetting + re-warping such a page shifted the ink classification and erased printed header text.
  const tol = 0.02 * Math.max(img.width, img.height);
  if (raw.every((pt, i) => Math.hypot(pt[0] - full[i][0], pt[1] - full[i][1]) <= tol)) return { quad: full, found: true, area: 1, fills: true };
  const cx = raw.reduce((a, p) => a + p[0], 0) / 4, cy = raw.reduce((a, p) => a + p[1], 0) / 4;
  const quad = raw.map(([x, y]) => [x + (cx - x) * 0.012, y + (cy - y) * 0.012]);
  const area = polyArea(quad) / (img.width * img.height);
  if (area < 0.12) return { quad: full, found: false, area };
  return { quad, found: true, area };
}
const STEP = 7;
export const polyArea = (q) => Math.abs(q.reduce((a, p, i) => { const r = q[(i + 1) % q.length]; return a + p[0] * r[1] - r[0] * p[1]; }, 0)) / 2;

// ---------- 2. perspective ----------
// Homography H mapping (u,v) in the destination rectangle to (x,y) in the source: solves the 8 unknowns.
export function homography(from, to) {
  const A = [], B = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = from[i], [x, y] = to[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); B.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); B.push(y);
  }
  const hv = solve(A, B); return [...hv, 1];
}
function solve(A, B) {
  const n = B.length; const M = A.map((r, i) => [...r, B[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]]; const p = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / p; if (!f) continue; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
export const applyH = (H, u, v) => { const z = H[6] * u + H[7] * v + H[8]; return [(H[0] * u + H[1] * v + H[2]) / z, (H[3] * u + H[4] * v + H[5]) / z]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function outSize(quad, maxSide = MAX_SIDE) {
  const [tl, tr, br, bl] = quad;
  let w = Math.max(dist(tl, tr), dist(bl, br)), h = Math.max(dist(tl, bl), dist(tr, br));
  const s = Math.min(1, maxSide / Math.max(w, h)); w = Math.max(8, Math.round(w * s)); h = Math.max(8, Math.round(h * s));
  return { w, h };
}
export function warp(img, quad, size = outSize(quad)) {
  const { w, h } = size; const H = homography([[0, 0], [w, 0], [w, h], [0, h]], quad);
  const out = mkImg(w, h); const o = out.data, d = img.data, W = img.width, Hh = img.height;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let [sx, sy] = applyH(H, x + 0.5, y + 0.5); sx -= 0.5; sy -= 0.5;
    const x0 = clamp(Math.floor(sx), 0, W - 1), y0 = clamp(Math.floor(sy), 0, Hh - 1), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(Hh - 1, y0 + 1);
    const fx = clamp(sx - x0, 0, 1), fy = clamp(sy - y0, 0, 1); const j = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) {
      const a = d[(y0 * W + x0) * 4 + c], b = d[(y0 * W + x1) * 4 + c], e = d[(y1 * W + x0) * 4 + c], f = d[(y1 * W + x1) * 4 + c];
      o[j + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy;
    }
    o[j + 3] = 255;
  }
  return out;
}

// ---------- 3. enhance (shadow removal) ----------
export const FILTERS = ['color', 'gray', 'bw'];
export function enhance(img, filter = 'color') {
  const { width: w, height: h, data: d } = img; const n = w * h;
  const f = Math.max(1, Math.round(Math.max(w, h) / 220)); // background map ≈ 220 px on the long side
  const sw = Math.ceil(w / f), sh = Math.ceil(h / f);
  const out = mkImg(w, h); const o = out.data;
  const bgs = [];
  for (let c = 0; c < 3; c++) {
    const a = new Float32Array(sw * sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) { let m = 0; for (let yy = y * f; yy < Math.min(h, y * f + f); yy++) for (let xx = x * f; xx < Math.min(w, x * f + f); xx++) { const v = d[(yy * w + xx) * 4 + c]; if (v > m) m = v; } a[y * sw + x] = m; }
    bgs.push(boxBlur(maxFilter(a, sw, sh, 3), sw, sh, 4));
  }
  for (let y = 0; y < h; y++) {
    const gy = clamp((y + 0.5) / f - 0.5, 0, sh - 1), y0 = Math.floor(gy), y1 = Math.min(sh - 1, y0 + 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = clamp((x + 0.5) / f - 0.5, 0, sw - 1), x0 = Math.floor(gx), x1 = Math.min(sw - 1, x0 + 1), fx = gx - x0; const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const b = bgs[c]; const bg = (b[y0 * sw + x0] * (1 - fx) + b[y0 * sw + x1] * fx) * (1 - fy) + (b[y1 * sw + x0] * (1 - fx) + b[y1 * sw + x1] * fx) * fy;
        let v = (d[i + c] * 255) / Math.max(24, bg); // flatten lighting
        v = ((v - 18) * 255) / (238 - 18); // levels: lift paper to white, deepen ink
        o[i + c] = clamp(v, 0, 255);
      }
      if (o[i] > 222 && o[i + 1] > 222 && o[i + 2] > 222) o[i] = o[i + 1] = o[i + 2] = 255; // clean paper
      o[i + 3] = 255;
    }
  }
  return filter === 'color' ? out : applyFilter(out, filter);
}
// grey / black-and-white look, applied after handwriting removal (colour is needed to find coloured ink)
export function applyFilter(img, filter = 'color') {
  if (filter === 'color') return img;
  const out = mkImg(img.width, img.height, new Uint8ClampedArray(img.data)); const o = out.data;
  for (let i = 0; i < o.length; i += 4) { let l = lumaAt(o, i); if (filter === 'bw') l = l < 150 ? 0 : 255; o[i] = o[i + 1] = o[i + 2] = l; }
  return out;
}

// ---------- 4. handwriting mask ----------
// opts: { color: true, pencil: false, pen: false }. Returns { mask: Uint8Array (1 = handwriting), stats }.
export const INK = { chroma: 30, sat: 0.3, paper: 226, pencilCore: 112, neutralSat: 0.22 };
export function inkMask(img, opts = {}) {
  const { color = true, pencil = false, pen = false } = opts;
  const { width: w, height: h, data: d } = img; const n = w * h;
  const mask = new Uint8Array(n); const L = new Uint8Array(n); const isColor = new Uint8Array(n); const neutral = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4; const r = d[i], g = d[i + 1], b = d[i + 2]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), ch = mx - mn; const l = lumaAt(d, i); L[p] = l;
    if (ch >= INK.chroma && ch / Math.max(1, mx) >= INK.sat && l < 245) isColor[p] = 1;
    else if (l < INK.paper) neutral[p] = 1; // grey / black (incl. slightly tinted dark pixels)
  }
  let colorPx = 0, pencilPx = 0, penPx = 0;
  if (color) {
    for (let p = 0; p < n; p++) if (isColor[p]) { mask[p] = 1; colorPx++; }
    // grow 2 px into the faint anti-aliased halo around coloured strokes (never into dark neutral print)
    for (let pass = 0; pass < 2; pass++) {
      const add = [];
      for (let p = 0; p < n; p++) { if (mask[p] || L[p] < 150) continue; const x = p % w; if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (p >= w && mask[p - w]) || (p + w < n && mask[p + w])) add.push(p); }
      for (const p of add) mask[p] = 1;
    }
    // then a little further into the tinted haze of the stroke (camera blur), never into neutral print
    for (let pass = 0; pass < 3; pass++) {
      const add = [];
      for (let p = 0; p < n; p++) { if (mask[p] || L[p] < 150) continue; const i = p * 4; if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 9) continue; const x = p % w; if ((x > 0 && mask[p - 1]) || (x < w - 1 && mask[p + 1]) || (p >= w && mask[p - w]) || (p + w < n && mask[p + w])) add.push(p); }
      for (const p of add) mask[p] = 1;
    }
  }
  if (pencil || pen) {
    // connected components of neutral (grey/black) marks
    const lab = new Int32Array(n); const stack = new Int32Array(n); const comps = []; let cur = 0;
    for (let p0 = 0; p0 < n; p0++) {
      if (!neutral[p0] || lab[p0] || mask[p0]) continue; cur++; let sp = 0; stack[sp++] = p0; lab[p0] = cur;
      const c = { id: cur, n: 0, minL: 255, x0: w, y0: h, x1: 0, y1: 0, edge: 0 };
      while (sp) {
        const p = stack[--sp]; c.n++; const x = p % w, y = (p / w) | 0; if (L[p] < c.minL) c.minL = L[p];
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        if (x > 0) { const q = p - 1; if (neutral[q] && !lab[q] && !mask[q]) { lab[q] = cur; stack[sp++] = q; } else if (!neutral[q]) c.edge++; }
        if (x < w - 1) { const q = p + 1; if (neutral[q] && !lab[q] && !mask[q]) { lab[q] = cur; stack[sp++] = q; } else if (!neutral[q]) c.edge++; }
        if (y > 0) { const q = p - w; if (neutral[q] && !lab[q] && !mask[q]) { lab[q] = cur; stack[sp++] = q; } else if (!neutral[q]) c.edge++; }
        if (y < h - 1) { const q = p + w; if (neutral[q] && !lab[q] && !mask[q]) { lab[q] = cur; stack[sp++] = q; } else if (!neutral[q]) c.edge++; }
      }
      comps.push(c);
    }
    const kill = new Uint8Array(cur + 1);
    // typical printed glyph height / stroke width (dark, glyph-sized components)
    const dark = comps.filter((c) => c.minL < INK.pencilCore && c.n >= 6);
    const hs = dark.map((c) => c.y1 - c.y0 + 1).sort((x, y) => x - y); const medH = hs[hs.length >> 1] || 12;
    const sws = dark.map((c) => (2 * c.n) / Math.max(1, c.edge)).sort((x, y) => x - y); const medSW = sws[sws.length >> 1] || 2;
    const isLine = (c) => (c.x1 - c.x0 + 1) >= medH * 3 && (c.y1 - c.y0 + 1) <= Math.max(5, medSW * 3.5);
    const lines = dark.filter(isLine);
    // "answer zone": sits on / just above a ruled line and inside its horizontal span (where answers are written)
    const onLine = (c) => lines.some((L) => c !== L && c.x0 >= L.x0 - medH * 0.3 && c.x1 <= L.x1 + medH * 0.5 && c.y1 <= L.y0 + medH * 0.4 && c.y1 >= L.y0 - medH * 1.4);
    if (pencil) for (const c of comps) {
      if (c.minL < INK.pencilCore || c.n < 4 || isLine(c)) continue;
      const bw = c.x1 - c.x0 + 1, bh = c.y1 - c.y0 + 1;
      // light grey marks that are big (answers, working lines) or written on an answer line; small grey print is kept
      if (bh >= medH * 1.15 || bw >= medH * 4 || onLine(c)) { kill[c.id] = 1; pencilPx += c.n; }
    }
    if (pen) for (const c of dark) {
      if (isLine(c) || !onLine(c)) continue;
      kill[c.id] = 1; penPx += c.n;
    }
    for (let p = 0; p < n; p++) if (lab[p] && kill[lab[p]]) mask[p] = 1;
    // anti-aliased halo of removed grey strokes: grow 2 px into light pixels (never into dark print)
    const killed = new Uint8Array(n); for (let p = 0; p < n; p++) if (lab[p] && kill[lab[p]]) killed[p] = 1;
    for (let pass = 0; pass < 5; pass++) {
      const add = [];
      for (let p = 0; p < n; p++) { if (killed[p] || L[p] < 70 || L[p] > 250) continue; const x = p % w; if ((x > 0 && killed[p - 1]) || (x < w - 1 && killed[p + 1]) || (p >= w && killed[p - w]) || (p + w < n && killed[p + w]) || (x > 0 && p >= w && killed[p - w - 1]) || (x < w - 1 && p + w < n && killed[p + w + 1])) add.push(p); }
      for (const p of add) { killed[p] = 1; mask[p] = 1; }
    }
    // specks: tiny marks touching a removed stroke go with it
    const size = new Int32Array(cur + 1); for (const c of comps) size[c.id] = c.n;
    const speck = new Uint8Array(cur + 1);
    for (let p = 0; p < n; p++) { const id = lab[p]; if (!id || kill[id] || size[id] > 14 || killed[p]) continue; const x = p % w; for (const q of [p - 1, p + 1, p - w, p + w, p - w - 1, p - w + 1, p + w - 1, p + w + 1]) if (q >= 0 && q < n && Math.abs((q % w) - x) <= 1 && killed[q]) { speck[id] = 1; break; } }
    for (let p = 0; p < n; p++) if (lab[p] && speck[lab[p]]) mask[p] = 1;
  }
  return { mask, stats: { colorPx, pencilPx, penPx, total: n } };
}

// ---------- 5. compose ----------
// manual: optional Uint8Array (1 = erase by hand, 2 = restore by hand). Print lines that the ink crossed are rebridged:
// an erased pixel with dark neutral print within `gap` px on both sides (horizontally or vertically) becomes print again.
export function compose(enh, mask, manual = null) {
  const { width: w, height: h } = enh; const n = w * h; const out = mkImg(w, h, new Uint8ClampedArray(enh.data)); const o = out.data, d = enh.data;
  const er = new Uint8Array(n);
  for (let p = 0; p < n; p++) er[p] = (manual && manual[p] === 1) ? 2 : (mask && mask[p] === 1 && !(manual && manual[p] === 2)) ? 1 : 0;
  const print = new Uint8Array(n);
  for (let p = 0; p < n; p++) { if (er[p]) continue; const i = p * 4; print[p] = lumaAt(d, i) < 120 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 45 ? 1 : 0; }
  for (let p = 0; p < n; p++) if (er[p]) { const i = p * 4; o[i] = o[i + 1] = o[i + 2] = 255; }
  // repair ruled lines / box sides the ink crossed: a run of (print | auto-erased) pixels that starts and ends in print,
  // is long, and is mostly print, is a line → the erased gap gets the line's colour back. Hand-erased pixels are never refilled.
  const fix = (len, at) => {
    let s0 = -1, pr = 0, last = -1;
    for (let k = 0; k <= len; k++) {
      const p = k < len ? at(k) : -1; const on = p >= 0 && (print[p] || er[p] === 1);
      if (on) { if (s0 < 0) { s0 = k; pr = 0; } if (print[p]) { pr++; last = k; } continue; }
      if (s0 >= 0 && last >= 0) {
        const end = last, runLen = end - s0 + 1;
        if (runLen >= 30 && pr / runLen >= 0.5 && print[at(s0)]) {
          let ref = at(s0);
          for (let j = s0; j <= end; j++) { const q = at(j); if (print[q]) ref = q; else if (er[q] === 1) { const i = q * 4, r = ref * 4; o[i] = d[r]; o[i + 1] = d[r + 1]; o[i + 2] = d[r + 2]; } }
        }
      }
      s0 = -1; last = -1;
    }
  };
  for (let y = 0; y < h; y++) fix(w, (k) => y * w + k);
  for (let x = 0; x < w; x++) fix(h, (k) => k * w + x);
  return out;
}

// manual brush: paint a disc into the manual mask (value 1 erase, 2 restore, 0 clear)
export function brush(manual, w, h, cx, cy, r, value) {
  const r2 = r * r;
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) manual[y * w + x] = value;
  return manual;
}
// Part 1b modes: auto (default) picks by ink type; colour = coloured ink only; dark = black / dark pen + pencil + colour.
export const REMOVE_MODES = ['off', 'auto', 'color', 'dark'];
export const removeOpts = (mode) => (mode === 'color' ? { color: true } : mode === 'strong' || mode === 'dark' ? { color: true, pencil: true, pen: true } : null); // (legacy single-mask options)
export const COLOR_SHARE = 0.0015; // ≥0.15% of the page in coloured ink → the answers were written in colour
// returns { mask, stats: { colorPx, handPx, pencilPx, total, ink }, mode (resolved), detected: [kinds] }
export function removal(enh, mode = 'auto', { onStage = () => {} } = {}) {
  const total = enh.width * enh.height;
  if (mode === 'off') return { mask: null, stats: { colorPx: 0, handPx: 0, pencilPx: 0, total }, mode, detected: [] };
  onStage('color');
  const c = inkMask(enh, { color: true });
  const colorShare = c.stats.colorPx / total;
  // auto always looks for every kind of writing (coloured ink + dark pen + pencil): a page answered in black pen with a
  // few coloured marks must never come out "0% removed". It reports the dominant kind it found.
  let mask = c.mask; let hand = 0, penc = 0; let h = null;
  if (mode === 'auto' || mode === 'dark') {
    h = handMask(enh, { pencil: true, onStage });
    mask = new Uint8Array(total); for (let p = 0; p < total; p++) mask[p] = c.mask[p] | h.mask[p];
    hand = h.stats.hand; penc = h.stats.pencil;
  }
  const detected = [colorShare >= 0.0002 ? 'color' : null, hand > total * 0.0005 ? 'dark' : null, penc > total * 0.0003 ? 'pencil' : null].filter(Boolean);
  const resolved = mode === 'auto' ? (hand + penc > c.stats.colorPx ? 'dark' : 'color') : mode;
  return { mask, stats: { colorPx: c.stats.colorPx, handPx: hand, pencilPx: penc, penPx: 0, total }, mode: resolved, detected };
}
// the whole pipeline (used by the page and the tests)
export function scan(img, { quad = null, filter = 'color', remove = 'off' } = {}) {
  const q = quad || detectQuad(img).quad; const flat = warp(img, q); const enh = enhance(flat, 'color');
  const m = removal(enh, remove);
  return { flat, enh, mask: m.mask, stats: m.stats, mode: m.mode, detected: m.detected, out: applyFilter(compose(enh, m.mask), filter), quad: q };
}
