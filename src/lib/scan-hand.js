// Run 24 part 1b: handwriting-vs-print segmentation for dark (black / blue-black) pen and pencil — classical, on-device.
// Works on the enhanced page (paper ≈ white), downscaled so the long side ≤ 1400 px, then maps the mask back.
//   1. ink components (8-connected) with size / darkness / stroke-width features
//   2. typical printed glyph height Hp (count-weighted median — printed glyphs vastly outnumber handwritten ones)
//   3. printed text lines: chains of glyph-sized components with close spacing, steady heights and baselines
//   4. diagrams: components made mostly of long straight runs (8 directions) or hollow frames → kept
//   5. handwriting: big, curvy components; then small marks / short strokes right next to removed handwriting
//      (degree signs, dots, "=" and "1" strokes) go with it. Light-grey big marks = pencil.
// Honest limits: handwriting the same size as the print and written in tidy rows can look like print; handwriting that
// touches print removes the touched print too; hand-drawn straight lines are treated as diagram lines.
export const SEG_SIDE = 1400;
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 1], [2, -1], [1, 2], [1, -2]];

function lumaGray(img, s) {
  const w = Math.max(1, Math.round(img.width * s)), h = Math.max(1, Math.round(img.height * s));
  const L = new Uint8Array(w * h), C = new Uint8Array(w * h); const d = img.data, W = img.width;
  const f = 1 / s;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // min-pool (keeps thin strokes when shrinking)
    let best = 255, bc = 0; const x0 = Math.floor(x * f), y0 = Math.floor(y * f), x1 = Math.min(img.width, Math.max(x0 + 1, Math.floor((x + 1) * f))), y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor((y + 1) * f)));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * W + xx) * 4; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (l < best) { best = l; bc = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); } }
    L[y * w + x] = best; C[y * w + x] = bc;
  }
  return { L, C, w, h };
}

// straight-run length through every ink pixel, max over 8 directions (DP forward + backward per direction)
export function lineRuns(ink, w, h) {
  const n = w * h; const best = new Float32Array(n); const f = new Uint16Array(n), b = new Uint16Array(n);
  for (const [dx, dy] of DIRS) {
    const len = Math.hypot(dx, dy); const step = dy * w + dx;
    const yA = dy >= 0 ? 0 : h - 1, yB = dy >= 0 ? h : -1, ys = dy >= 0 ? 1 : -1;
    f.fill(0); b.fill(0);
    for (let y = yA; y !== yB; y += ys) for (let x = 0; x < w; x++) { const p = y * w + x; if (!ink[p]) continue; const px = x - dx, py = y - dy; f[p] = px >= 0 && px < w && py >= 0 && py < h && ink[p - step] ? f[p - step] + 1 : 1; }
    for (let y = yB - ys; y !== yA - ys; y -= ys) for (let x = w - 1; x >= 0; x--) { const p = y * w + x; if (!ink[p]) continue; const qx = x + dx, qy = y + dy; b[p] = qx >= 0 && qx < w && qy >= 0 && qy < h && ink[p + step] ? b[p + step] + 1 : 1; }
    for (let p = 0; p < n; p++) if (ink[p]) { const r = (f[p] + b[p] - 1) * len; if (r > best[p]) best[p] = r; }
  }
  return best;
}

function lineFit(cs) {
  const xs = cs.map((c) => (c.x0 + c.x1) / 2), ys = cs.map((c) => c.y1); const n = xs.length; if (!n) return { a: 0, b: 0, n: 0 };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n; const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const b = n >= 2 && sxx > 0 ? xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / sxx : 0; return { a: my - b * mx, b, n };
}
export function handMask(enh, { pencil = true, onStage = () => {} } = {}) {
  const s = Math.min(1, SEG_SIDE / Math.max(enh.width, enh.height));
  const { L, C, w, h } = lumaGray(enh, s); const n = w * h;
  onStage('components');
  const ink = new Uint8Array(n); for (let p = 0; p < n; p++) ink[p] = L[p] < 205 && C[p] < 70 ? 1 : 0;
  // 8-connected components
  const lab = new Int32Array(n); const stack = new Int32Array(n); const comps = [null]; let cur = 0;
  for (let p0 = 0; p0 < n; p0++) {
    if (!ink[p0] || lab[p0]) continue; cur++; let sp = 0; stack[sp++] = p0; lab[p0] = cur;
    const c = { id: cur, n: 0, minL: 255, sumL: 0, x0: w, y0: h, x1: 0, y1: 0, edge: 0 };
    while (sp) {
      const p = stack[--sp]; c.n++; const x = p % w, y = (p / w) | 0; const l = L[p]; c.sumL += l; if (l < c.minL) c.minL = l;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) { if (!(dx && dy)) c.edge++; continue; }
        const q = yy * w + xx; if (ink[q]) { if (!lab[q]) { lab[q] = cur; stack[sp++] = q; } } else if (!(dx && dy)) c.edge++;
      }
    }
    c.w = c.x1 - c.x0 + 1; c.h = c.y1 - c.y0 + 1; c.sw = (2 * c.n) / Math.max(1, c.edge); comps.push(c);
  }
  const real = comps.slice(1).filter((c) => c.n >= 6 && c.h >= 4);
  if (!real.length) return { mask: new Uint8Array(enh.width * enh.height), stats: { hand: 0, pencil: 0, hp: 0, lines: 0 } };
  const med = (arr) => { if (!arr.length) return 0; const s2 = [...arr].sort((x, y) => x - y); return s2[s2.length >> 1]; };
  const hs = real.map((c) => c.h).sort((a, b) => a - b); const Hp = Math.max(6, hs[Math.floor(hs.length * 0.5)]);
  // ---- printed text lines ----
  onStage('lines');
  // glyphs or whole printed words (serif letters often touch after the photo blur); print is dark, pencil is not
  // (+ printed dashes: "−", the bars of "=", so "45 − 18 =" stays one row)
  for (const c of real) c.dash = c.h < Hp * 0.45 && c.w >= Hp * 0.4 && c.w <= Hp * 2.5 && c.w >= c.h * 2;
  const cand = real.filter((c) => ((c.h >= Hp * 0.45 && c.h <= Hp * 2.6) || c.dash) && c.w <= Hp * 16 && c.minL < 165).sort((a, b) => a.x0 - b.x0);
  const printSW = med(cand.map((c) => c.sw)) || 2;
  // printed glyphs are thin, so the photo leaves their cores mid-dark; pen strokes are wider → much darker cores
  const printDark = med(cand.map((c) => c.minL)) || 90;
  const parent = new Map(cand.map((c) => [c.id, c.id])); const root = (i) => { while (parent.get(i) !== i) { parent.set(i, parent.get(parent.get(i))); i = parent.get(i); } return i; };
  for (let i = 0; i < cand.length; i++) {
    const a = cand[i]; let bestJ = -1, bestGap = Infinity;
    for (let j = i + 1; j < cand.length; j++) {
      const b = cand[j]; const gap = b.x0 - a.x1; if (gap > Hp * 1.3) break;
      if (a.dash || b.dash) { if (a.dash && b.dash) { if (Math.abs(a.y0 - b.y0) > Hp * 0.6) continue; } else { const g = a.dash ? b : a, dd = a.dash ? a : b; const cy = (dd.y0 + dd.y1) / 2; if (cy < g.y0 + g.h * 0.2 || cy > g.y1 - g.h * 0.1) continue; } }
      else { const ov = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (ov < 0.45 * Math.min(a.h, b.h)) continue;
        if (Math.max(a.h, b.h) / Math.min(a.h, b.h) > 2.2) continue; }
      if (gap < bestGap) { bestGap = gap; bestJ = j; }
    }
    if (bestJ >= 0) parent.set(root(cand[bestJ].id), root(a.id));
  }
  const chains = new Map(); for (const c of cand) { const r = root(c.id); if (!chains.has(r)) chains.set(r, []); chains.get(r).push(c); }
  // page skew: median baseline slope of the long chains (most of them are printed lines)
  const slopes = []; for (const ch of chains.values()) { if (ch.length < 8) continue; const mh0 = med(ch.map((c) => c.h)); const f = lineFit(ch.filter((c) => c.h >= mh0 * 0.8)); if (f.n >= 6) slopes.push(f.b); }
  const skew = slopes.length >= 3 ? med(slopes) : 0;
  // how dark the page's long printed lines are (a photo leaves thin print mid-grey; a clean scan leaves it black)
  const longDark = []; for (const ch of chains.values()) { const g = ch.filter((c) => !c.dash); if (g.length >= 8) longDark.push(med(g.map((c) => c.minL))); }
  const lineDark = longDark.length >= 2 ? med(longDark) : printDark;
  const isPrint = new Uint8Array(cur + 1); const bands = []; const pencilChain = new Uint8Array(cur + 1);
  for (const chAll of chains.values()) {
    const ch = chAll.filter((c) => !c.dash); if (ch.length < 2 || chAll.length < 3) continue;
    const mh = med(ch.map((c) => c.h)); const bots = ch.map((c) => c.y1); const mb = med(bots);
    const mad = med(bots.map((v) => Math.abs(v - mb)));
    const dark = med(ch.map((c) => c.minL)); const sw = med(ch.map((c) => c.sw));
    // baseline: least-squares line through the bottoms of the full-height glyphs. A photo can leave the page a little
    // tilted, so print lines are judged by how STRAIGHT their baseline is (residuals), and only by the tilt relative to
    // the page's own skew (median over long chains, computed below in a first pass).
    const tall = ch.filter((c) => c.h >= mh * 0.8); const fit = lineFit(tall);
    const res = tall.length >= 3 ? med(tall.map((c) => Math.abs(c.y1 - (fit.a + fit.b * (c.x0 + c.x1) / 2)))) : mad;
    const slope = tall.length >= 5 ? Math.abs(fit.b - skew) : 0;
    const hsd = Math.sqrt(ch.reduce((a, c) => a + (c.h - mh) ** 2, 0) / ch.length) / Math.max(1, mh);
    // weighted evidence for handwriting; a chain is print when the evidence stays low
    const score = (mh > Hp * 1.6 ? 1 : 0) + (sw > printSW * 1.3 ? 1.5 : sw > printSW * 1.15 ? 0.5 : 0) + (lineDark > 40 && dark < lineDark * 0.3 ? 1 : dark < lineDark * 0.45 ? 0.5 : 0) + (res > Hp * 0.18 ? 1 : 0) + (hsd > 0.3 ? 0.5 : 0) + (slope > 0.02 ? 1 : 0);
    const typeset = ch.length >= 4 && res <= Math.max(1, Hp * 0.1, mh * 0.06) && slope < 0.01 && hsd < 0.25 && (mh <= Hp * 1.6 || ch.length >= 10); // bold / underlined / big titles too
    // pen look: thicker AND much darker than the page's print (a photo leaves thin print mid-grey). Level "font-like"
    // handwriting is caught by this; a bold printed row is protected by being a long, perfectly level line
    const penLook = lineDark > 40 && sw > printSW * 1.15 && dark < lineDark * 0.45;
    const regular = mh <= Hp * 2.2 && (score < 2 || typeset) && !(penLook && !(typeset && ch.length >= 10) && !(typeset && sw <= printSW * 1.15));
    const pencilLike = dark >= Math.max(printDark + 18, 115) && mh >= Hp * 0.95 && !typeset;
    if (pencilLike && pencil) { ch.forEach((c) => { pencilChain[c.id] = 1; }); continue; }
    if (regular) {
      chAll.forEach((c) => { isPrint[c.id] = 1; });
      bands.push({ x0: Math.min(...chAll.map((c) => c.x0)), x1: Math.max(...chAll.map((c) => c.x1)), y0: Math.min(...ch.map((c) => c.y0)), y1: Math.max(...ch.map((c) => c.y1)), ch: chAll, soft: !typeset && ch.length < 8, short: ch.length < 8, score, typeset, base: fit.a + fit.b * ((Math.min(...ch.map((c) => c.x0)) + Math.max(...ch.map((c) => c.x1))) / 2), mh });
    }
  }
  // ---- diagrams: straight runs / frames ----
  onStage('shapes');
  const runs = lineRuns(ink, w, h); const Lmin = Hp * 2.2;
  const lineFrac = new Float32Array(cur + 1); const cnt = new Int32Array(cur + 1);
  // a run only counts as a drawn line when it is long for the stroke's own thickness (thick pen strokes make long runs too)
  const need = new Float32Array(cur + 1); for (let i = 1; i <= cur; i++) need[i] = Math.max(Lmin, 8 * comps[i].sw);
  const maxRun = new Float32Array(cur + 1);
  for (let p = 0; p < n; p++) { const id = lab[p]; if (!id) continue; cnt[id]++; if (runs[p] >= need[id]) lineFrac[id]++; if (runs[p] > maxRun[id]) maxRun[id] = runs[p]; }
  for (let i = 1; i <= cur; i++) lineFrac[i] = cnt[i] ? lineFrac[i] / cnt[i] : 0;
  const frame = (c) => {
    if (c.w < Hp * 1.8 || c.h < Hp * 1.8) return false; let near = 0; const band = Math.max(3, c.sw * 2.5);
    for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) { const p = y * w + x; if (lab[p] === c.id && (x - c.x0 < band || c.x1 - x < band || y - c.y0 < band || c.y1 - y < band)) near++; }
    return near / c.n > 0.85;
  };
  // ---- classify ----
  onStage('classify');
  const HAND = 1, KEEP = 2, PENC = 3; const RULE = new Uint16Array(cur + 1); const cls = new Uint8Array(cur + 1); let lines = 0; // RULE: which rule decided a component (later passes revisit some)
  for (const c of real) {
    if (isPrint[c.id] || bands.some((b) => c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - 2 && c.y1 <= b.y1 + 2)) { cls[c.id] = KEEP; RULE[c.id] = 137; continue; }
    const big = c.h > Hp * 1.35 || c.w > Hp * 1.6; const long = Math.max(c.w, c.h);
    if (!big) { if (pencilChain[c.id]) cls[c.id] = PENC; RULE[c.id] = 139; continue; } // small marks: decided by proximity below
    // thick, very dark strokes look like pen: they only count as a drawn line / box when almost perfectly straight
    // a light-grey stroke that is not perfectly straight: a pencil working line (printed grey rules are dead straight)
    if (pencil && c.minL >= Math.max(printDark + 30, 115) && maxRun[c.id] < Math.max(c.w, c.h) * 0.85 && (c.h >= Hp * 1.1 || c.w >= Hp * 2.5)) { cls[c.id] = PENC; RULE[c.id] = 9007; continue; }
    // underlined printed heading: letters joined by one underline → wide, low, with a nearly full-width ink row at the bottom
    if (c.w >= Hp * 6 && c.h <= Hp * 2.4) { let best = 0; for (let y = c.y1 - Math.ceil(c.h * 0.3); y <= c.y1; y++) { let k = 0; for (let x = c.x0; x <= c.x1; x++) if (lab[y * w + x] === c.id) k++; if (k > best) best = k; } if (best >= c.w * 0.75) { cls[c.id] = KEEP; RULE[c.id] = 9006; continue; } }
    const inky = c.sw >= printSW * 1.6 && c.minL < printDark * 0.6 && maxRun[c.id] < c.w * 0.8; const lf = lineFrac[c.id]; // (an underline / rule spanning it → typeset heading)
    if ((lf >= (inky ? 0.9 : 0.45) && frame(c)) || (lf >= (inky ? 0.9 : 0.6) && long >= Hp * 3.5)) { cls[c.id] = KEEP; RULE[c.id] = 142; lines++; continue; }
    if (maxRun[c.id] >= c.w * 0.8 && c.w >= Hp * 4 && c.minL < printDark * 1.2) { cls[c.id] = KEEP; RULE[c.id] = 143; lines++; continue; } // ruled / underlined block
    if (inky && lf < 0.9) { cls[c.id] = HAND; RULE[c.id] = 144; continue; }
    if (pencilChain[c.id]) { cls[c.id] = PENC; RULE[c.id] = 145; continue; }
    const light = c.minL >= Math.max(printDark + 30, 115);
    if (light && pencil && (c.h >= Hp * 1.1 || c.w >= Hp * 2.5) && c.n >= 8) { cls[c.id] = PENC; RULE[c.id] = 147; continue; } // big light-grey strokes: pencil
    // a lone printed word (no neighbours to chain with): print-sized, print-dark, print-thin
    if (c.h <= Hp * 1.25 && c.w <= Hp * 9 && ((c.minL >= printDark * 0.6 && c.sw <= printSW * 1.6) || c.sw <= printSW * 1.12)) { cls[c.id] = KEEP; RULE[c.id] = 149; continue; }
    if (lineFrac[c.id] < 0.42) { cls[c.id] = HAND; RULE[c.id] = 150; continue; }
    if (long >= Hp * 3.5) { cls[c.id] = KEEP; RULE[c.id] = 151; lines++; continue; } // mostly straight + long: a diagram part
    cls[c.id] = HAND; RULE[c.id] = 152; // short + partly straight: a written stroke
  }
  // a short, not perfectly typeset "line" that continues a row of handwriting is handwriting too (small tidy hand
  // letters chain like print): a HAND component on the same row within 2.5 glyph heights flips it (2 rounds)
  for (let round = 0; round < 2; round++) {
    for (let bi = bands.length - 1; bi >= 0; bi--) {
      const b = bands[bi]; const g = Hp * 2.5;
      // a short typeset-looking row with no printed row right above or below it is soft as well (lone tidy handwriting)
      const lone = b.short && !bands.some((o) => o !== b && o.x0 <= b.x1 && o.x1 >= b.x0 && Math.abs((o.y0 + o.y1) - (b.y0 + b.y1)) / 2 <= b.mh * 3);
      if (!b.soft && !lone) continue;
      const hit = real.filter((o) => cls[o.id] === HAND && o.h >= Hp * 0.6 && o.h <= Hp * 3.5 && o.w <= Hp * 6 && Math.min(o.y1, b.y1) - Math.max(o.y0, b.y0) >= 0.5 * Math.min(o.h, b.y1 - b.y0 + 1) && o.x0 <= b.x1 + g && o.x1 >= b.x0 - g && (o.x1 < b.x0 + 2 || o.x0 > b.x1 - 2) && !(o.h >= (b.y1 - b.y0 + 1) * 2.2 && o.w >= Hp * 2.5)).length; // beside the row, not a loop / strike over it
      // …unless it continues a firm printed row (same baseline and letter height on the same line)
      const colinear = bands.some((o) => o !== b && !o.soft && !o.short && Math.abs(o.base - b.base) <= Math.max(3, b.mh * 0.25) && Math.abs(o.mh - b.mh) <= b.mh * 0.25 && o.x0 <= b.x1 + Hp * 15 && o.x1 >= b.x0 - Hp * 15);
      if (colinear || hit < 1) continue;
      bands.splice(bi, 1);
      for (const c of real) if (cls[c.id] === KEEP && (b.ch.includes(c) || (RULE[c.id] === 137 && c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - 2 && c.y1 <= b.y1 + 2))) { cls[c.id] = HAND; isPrint[c.id] = 0; RULE[c.id] = 9003; }
    }
  }
  // a short thin dash ("=", a fraction bar, "-") passes as a lone printed mark; inside a cluster of handwriting it is part of it
  const keepNear = (c, g) => real.some((o) => o !== c && cls[o.id] === KEEP && RULE[o.id] !== 149 && c.x0 <= o.x1 + g && c.x1 >= o.x0 - g && c.y0 <= o.y1 + g && c.y1 >= o.y0 - g);
  const handNear = (c, g) => real.filter((o) => cls[o.id] === HAND && c.x0 <= o.x1 + g && c.x1 >= o.x0 - g && c.y0 <= o.y1 + g && c.y1 >= o.y0 - g).length;
  for (const c of real) if (RULE[c.id] === 149 && !isPrint[c.id] && handNear(c, (c.dash || c.w >= c.h * 1.4 || c.h <= Hp * 0.8) ? Hp * 1.6 : Hp * 0.9) >= 1 && !keepNear(c, Hp * 1.2)) { cls[c.id] = HAND; RULE[c.id] = 9002; }
  // labels on a printed row: "B.", "(a)", a lone digit just left / right of a printed line, on its baseline → print
  const onRow = (c) => bands.some((b) => { const ov = Math.min(c.y1, b.y1) - Math.max(c.y0, b.y0); return ov >= 0.6 * c.h && c.h <= (b.y1 - b.y0 + 1) * 1.3 && c.x1 >= b.x0 - Hp * 4 && c.x0 <= b.x1 + Hp * 4; });
  for (const c of real) {
    const smallHand = cls[c.id] === HAND && (RULE[c.id] === 150 || RULE[c.id] === 152) && c.h <= Hp * 1.6 && c.w <= Hp * 3;
    if ((!cls[c.id] || smallHand) && onRow(c)) { cls[c.id] = KEEP; RULE[c.id] = 9001; }
    // big glyphs (CJK in a bold title) sitting exactly on a typeset line's baseline and no taller than its letters
    else if (cls[c.id] === HAND && RULE[c.id] === 150 && bands.some((b) => b.typeset && Math.abs(c.y1 - b.base) <= Math.max(2, b.mh * 0.12) && c.h <= b.mh * 1.45 && c.h >= b.mh * 0.6 && c.x1 >= b.x0 - b.mh * 3 && c.x0 <= b.x1 + b.mh * 3)) { cls[c.id] = KEEP; RULE[c.id] = 9005; }
  }
  // faint grey marks that are not part of a printed row: pencil (print is never this light after the enhance step)
  if (pencil) for (const c of real) if (!cls[c.id] && c.minL >= Math.max(printDark + 40, 130) && !onRow(c) && !bands.some((b) => c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - Hp * 0.3 && c.y1 <= b.y1 + Hp * 0.3)) { cls[c.id] = PENC; RULE[c.id] = 9004; }
  // proximity: unclassified small marks and short strokes hugging removed handwriting go with it (2 rounds)
  const boxes = () => real.filter((c) => cls[c.id] === HAND || cls[c.id] === PENC);
  for (let round = 0; round < 3; round++) {
    const hb = boxes(); const gap = Hp * 0.7;
    for (const c of real) {
      if (cls[c.id]) continue;
      if (bands.some((b) => c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - Hp * 0.3 && c.y1 <= b.y1 + Hp * 0.3)) continue; // inside a printed line
      const tiny = c.n <= Hp * Hp * 0.3;
      const gp = (c.dash || (c.w >= c.h * 1.4 && c.h <= Hp * 0.9)) ? Hp * 2.2 : gap; // signs between written terms
      const near = hb.find((o) => c.x0 <= o.x1 + gp && c.x1 >= o.x0 - gp && c.y0 <= o.y1 + gap && c.y1 >= o.y0 - gap);
      if (near && (tiny || c.dash || (c.n <= Hp * Hp * 0.9 && c.h <= Hp * 1.1) || c.h >= Hp * 1.1 || c.sw >= near.sw * 0.85)) { cls[c.id] = near.minL >= 120 ? PENC : HAND; RULE[c.id] = 164; }
    }
  }
  // specks too small to be components (the bars of a pen "=", dots) beside removed handwriting go with it
  { const hb = boxes(); const g = Hp * 1.2;
    for (let i = 1; i <= cur; i++) { const c = comps[i]; if (cls[i] || c.n < 2 || c.n >= 6 && c.h >= 4) continue;
      if (bands.some((b) => c.x0 >= b.x0 - 2 && c.x1 <= b.x1 + 2 && c.y0 >= b.y0 - Hp * 0.3 && c.y1 <= b.y1 + Hp * 0.3)) continue;
      const near = hb.find((o) => c.x0 <= o.x1 + g && c.x1 >= o.x0 - g && c.y0 <= o.y1 + g * 0.6 && c.y1 >= o.y0 - g * 0.6); if (near) cls[i] = cls[near.id]; } }
  // ---- back to full resolution ----
  onStage('mask');
  const W = enh.width, Hh = enh.height; const out = new Uint8Array(W * Hh); const d = enh.data; let handPx = 0, pencPx = 0;
  // a ring drawn round a printed option ("(A)") is often joined to the letter: erase the ring, keep what is inside it
  const ring = new Uint8Array(cur + 1); const rIn = new Int32Array(cur + 1), rMid = new Int32Array(cur + 1); const sect = new Map();
  const rr = (c, p) => { const x = p % w, y = (p / w) | 0; const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2; return Math.hypot((x - cx) / Math.max(1, c.w / 2), (y - cy) / Math.max(1, c.h / 2)); };
  const ringCand = (c) => c && cls[c.id] === HAND && c.w >= Hp * 1.6 && c.h >= Hp * 1.6 && c.w <= Hp * 6 && c.h <= Hp * 5 && c.w / c.h < 2.5 && c.h / c.w < 2.5;
  for (let p = 0; p < n; p++) {
    const id = lab[p]; if (!id || !ringCand(comps[id])) continue; const c = comps[id]; const r = rr(c, p);
    if (r < 0.55) { rIn[id]++; continue; }
    if (r < 0.72) { rMid[id]++; continue; }
    if (r >= 0.75) { const x = p % w, y = (p / w) | 0; const a = Math.atan2(y - (c.y0 + c.y1) / 2, x - (c.x0 + c.x1) / 2); const k = Math.min(15, Math.floor(((a + Math.PI) / (2 * Math.PI)) * 16)); sect.set(id, (sect.get(id) || 0) | (1 << k)); }
  }
  const bits = (v) => { let k = 0; while (v) { k += v & 1; v >>>= 1; } return k; };
  // a ring: its outer band goes (almost) all the way round, and something glyph-sized sits inside
  // ring 1: a clean gap between the ring and the glyph inside (not a Q or an 8) → keep the inside
  // ring 2: a loop round an option that runs through a printed row → keep what lies on that row inside the loop
  const rowOf = (c) => bands.filter((b) => Math.min(b.y1, c.y1) - Math.max(b.y0, c.y0) >= (b.y1 - b.y0 + 1) * 0.5 && b.x0 <= c.x1 + Hp * 4 && b.x1 >= c.x0);
  for (const c of real) if (ringCand(c) && bits(sect.get(c.id) || 0) >= 13) { if (rIn[c.id] >= Hp * Hp * 0.15 && rMid[c.id] < rIn[c.id] * 0.5) ring[c.id] = 1; else if (rowOf(c).length) ring[c.id] = 2; }
  const keepIn = (id, p) => { const c = comps[id]; const r = rr(c, p); if (ring[id] === 1) return r < 0.6; const y = (p / w) | 0; return r < 0.97 && rowOf(c).some((b) => y >= b.y0 && y <= b.y1); };
  const lowMark = new Uint8Array(n); for (let p = 0; p < n; p++) { const id = lab[p]; const c = cls[id]; if ((c === HAND || c === PENC) && !(ring[id] && keepIn(id, p))) lowMark[p] = c; }
  for (let y = 0; y < Hh; y++) {
    const ly = Math.min(h - 1, Math.floor(y * s));
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; if (l > 236) continue;
      const lx = Math.min(w - 1, Math.floor(x * s)); let m = lowMark[ly * w + lx];
      const here = lab[ly * w + lx];
      if (!m && cls[here] !== KEEP && !ring[here]) for (let dy = -1; dy <= 1 && !m; dy++) for (let dx = -1; dx <= 1 && !m; dx++) { const yy = ly + dy, xx = lx + dx; if (yy >= 0 && xx >= 0 && yy < h && xx < w) m = lowMark[yy * w + xx]; }
      if (m) { out[y * W + x] = 1; if (m === HAND) handPx++; else pencPx++; }
    }
  }
  return { mask: out, stats: { hand: handPx, pencil: pencPx, hp: Hp / s, lines, printLines: bands.length } };
}
