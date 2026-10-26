// ```nest-ui``` declarative blocks in AI replies (AI 助理 + 功課導師). Pure code (no DOM) so it is unit-tested.
// The model writes JSON; the app renders it with its own vetted components. Nothing the model writes is ever executed:
// no HTML, no SVG markup, no JS — only numbers, short strings and maths expressions (parsed by ./expr.js).
// splitBlocks(text) → [{kind:'md', text} | {kind:'ui', spec} | {kind:'ui-pending'} | {kind:'ui-bad', raw, text}]
// normalize(obj) → { ok:true, spec } | { ok:false, error } (clamps sizes, drops unknown keys, validates expressions)
import { compile } from './expr.js';
import { sanitizeSvg } from './svg.js';

export const TYPES = ['plot', 'diagram', 'chart', 'quiz', 'steps', 'flashcards', 'timeline', 'compare'];
const OPEN = /```(nest-ui|nest-svg)[^\S\n]*\n?/;
const MAX_BLOCK = 12000;
export const COLORS = ['accent', 'blue', 'red', 'green', 'orange', 'purple', 'teal', 'pink', 'muted', 'ink'];

export function splitBlocks(text, { final = false } = {}) {
  const src = String(text || '');
  const out = [];
  let rest = src;
  for (let guard = 0; guard < 20; guard++) {
    const m = OPEN.exec(rest);
    if (!m) break;
    const before = rest.slice(0, m.index);
    if (before.trim()) out.push({ kind: 'md', text: before });
    const after = rest.slice(m.index + m[0].length);
    const close = after.indexOf('```');
    if (m[1] !== 'nest-ui') { // ```nest-svg: model-written SVG, allowlist-sanitised (./svg.js)
      if (close < 0 && !final) { out.push({ kind: 'ui-pending' }); rest = ''; break; }
      let end = close >= 0 ? close : after.length;
      if (close < 0) { const e = after.search(/<\/svg\s*>/i); if (e >= 0) end = e + after.slice(e).indexOf('>') + 1; }
      out.push(svgBlock(after.slice(0, end).trim()));
      rest = after.slice(close >= 0 ? close + 3 : end).replace(close >= 0 ? /^/ : /^[^\S\n]*`{1,3}/, '');
      continue;
    }
    if (close < 0) {
      if (!final) { out.push({ kind: 'ui-pending' }); rest = ''; break; }
      // The reply ended without a closing fence (the model wrote one stray ` or none): take the balanced JSON object,
      // the rest is normal text again.
      let end = jsonEnd(after);
      if (end < 0 || blockOf(after.slice(0, end)).kind !== 'ui') {
        // unbalanced (e.g. a key that lost its colon flips the quote parity): try each "}" that ends a line, last first
        const cands = [...after.matchAll(/\}[^\S\n]*`{0,3}[^\S\n]*(?=\n|$)/g)].map((x) => x.index + 1).reverse().slice(0, 12);
        const ok = cands.find((i) => blockOf(after.slice(0, i)).kind === 'ui');
        if (ok) end = ok; else if (end < 0 && cands.length) end = cands[0];
      }
      const raw = (end > 0 ? after.slice(0, end) : after).trim().replace(/`+$/, '');
      out.push(blockOf(raw));
      rest = end > 0 ? after.slice(end).replace(/^[^\S\n]*`{1,3}/, '') : '';
      continue;
    }
    const raw = after.slice(0, close).trim().replace(/`+$/, '');
    out.push(blockOf(raw));
    rest = after.slice(close + 3);
  }
  if (rest.trim()) out.push({ kind: 'md', text: rest });
  return out;
}

// Index just past the first balanced {...} (string-aware), or -1.
export function jsonEnd(s) {
  let depth = 0; let inStr = false; let esc = false; let started = false;
  for (let i = 0; i < s.length && i < MAX_BLOCK; i++) {
    const c = s[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') { depth++; started = true; }
    else if (c === '}' || c === ']') { depth--; if (started && depth === 0) return i + 1; }
  }
  return -1;
}

const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
function svgBlock(raw) {
  const r = sanitizeSvg(raw, { idPrefix: `s${hash(raw)}` });
  const title = (/<title>([^<]{1,80})<\/title>/i.exec(raw) || [])[1] || '';
  return r.ok ? { kind: 'svg', svg: r.svg, title } : { kind: 'ui-bad', raw: '', text: '' };
}
function blockOf(raw) {
  if (raw.length > MAX_BLOCK) return { kind: 'ui-bad', raw: '', text: '' };
  let obj;
  try { obj = JSON.parse(raw); } catch { try { obj = JSON.parse(repairJson(raw)); } catch { return { kind: 'ui-bad', raw, text: '' }; } }
  const n = normalize(obj);
  return n.ok ? { kind: 'ui', spec: n.spec } : { kind: 'ui-bad', raw, text: specText(obj) };
}

// Small, safe repairs for model JSON: smart quotes, trailing commas, // comments at line ends.
export function repairJson(s) {
  return String(s)
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/"([A-Za-z_]\w{0,20})\s+(?=[\[{"\d-])/g, '"$1":') // "values [ … → "values":[ (a key that lost its colon)
    .replace(/:(\s*-?\d+(?:\.\d+)?)"(?=\s*[,}\]])/g, ':$1') // "max": 30", → "max": 30,
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

// Readable text for a block that cannot be drawn (invalid spec → text, never a blank).
export function specText(o) {
  if (!o || typeof o !== 'object') return '';
  const lines = [];
  const push = (x) => { const v = str(x, 400); if (v) lines.push(v); };
  push(o.title);
  for (const q of arr(o.questions, 10)) { push(q?.q); arr(q?.options, 6).forEach((x, i) => push(`${'ABCDEF'[i]}. ${str(x, 200)}`)); }
  for (const s of arr(o.steps, 20)) push(typeof s === 'string' ? s : `${str(s?.title, 120)} ${str(s?.body, 400)}`);
  for (const c of arr(o.cards, 30)) push(`${str(c?.front, 200)} — ${str(c?.back, 300)}`);
  for (const e of arr(o.events, 30)) push(`${str(e?.date, 40)} ${str(e?.title, 160)}`);
  if (Array.isArray(o.columns)) for (const r of arr(o.rows, 30)) push(`${str(r?.label, 80)}: ${arr(r?.values, 6).map((v) => str(v, 160)).join(' / ')}`);
  return lines.join('\n');
}

const str = (v, n = 200) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, n) : '');
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
const num = (v, d = 0, lo = -1e6, hi = 1e6) => { const x = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
const SERIES = ['accent', 'orange', 'green', 'purple', 'red', 'teal'];
const color = (c, i = 0) => (COLORS.includes(c) ? c : SERIES[i % SERIES.length]);
const pt = (p, d = [0, 0]) => (Array.isArray(p) && p.length >= 2 ? [num(p[0], d[0], -1000, 1000), num(p[1], d[1], -1000, 1000)] : d);
const VAR_RE = /^[A-Za-z\u0370-\u03ff][A-Za-z0-9_\u0370-\u03ff]{0,11}$/;
const RESERVED = new Set(['x', 't', 'e', 'pi', 'π', 'deg', 'sin', 'cos', 'tan', 'sqrt', 'abs', 'exp', 'ln', 'log', 'min', 'max', 'pow']);

export function normalize(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'not an object' };
  let type = String(o.type || '').toLowerCase();
  // A bare diagram item at the top level (live flash wrote {"type":"refraction",…} without the diagram wrapper) → wrap it.
  if (!TYPES.includes(type) && ITEM_TYPES.includes(ALIAS[type] || type)) { const { title, caption, ...it } = o; o = { type: 'diagram', title, caption, items: [it] }; type = 'diagram'; }
  if (!TYPES.includes(type)) return { ok: false, error: `unknown type ${type}` };
  const base = { type, title: str(o.title, 120), caption: str(o.caption, 300) };
  try {
    const spec = N[type](o, base);
    return spec ? { ok: true, spec } : { ok: false, error: 'empty' };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

const N = {
  plot(o, b) {
    const sliders = arr(o.sliders, 4).map((s) => {
      const name = str(s?.name, 12);
      if (!VAR_RE.test(name) || RESERVED.has(name)) return null;
      let min = num(s.min, -10), max = num(s.max, 10);
      if (max <= min) max = min + 1;
      const step = num(s.step, (max - min) / 100, 1e-6, max - min);
      return { name, label: str(s.label, 40) || name, min, max, step, value: num(s.value, (min + max) / 2, min, max), unit: str(s.unit, 12) };
    }).filter(Boolean);
    const names = sliders.map((s) => s.name);
    const raw = Array.isArray(o.fn) ? o.fn : o.fn != null ? [o.fn] : arr(o.functions, 4);
    const fns = raw.slice(0, 4).map((f, i) => {
      const c = color(f?.color, i);
      if (typeof f === 'string' || typeof f?.expr === 'string' || typeof f?.y === 'string' && f?.x == null) {
        const src = typeof f === 'string' ? f : f.expr || f.y;
        const cmp = compile(src, ['x', ...names]);
        if (!cmp.ok) throw new Error(`fn: ${cmp.error}`);
        return { kind: 'y', expr: src, label: str(f?.label, 40) || (raw.length > 1 ? `y = ${src}` : ''), color: c };
      }
      if (f && typeof f.x === 'string' && typeof f.y === 'string') { // parametric (projectile motion): x(t), y(t)
        const cx = compile(f.x, ['t', ...names]); const cy = compile(f.y, ['t', ...names]);
        if (!cx.ok || !cy.ok) throw new Error(`fn: ${cx.error || cy.error}`);
        const t = Array.isArray(f.t) ? [num(f.t[0], 0), num(f.t[1], 10)] : [0, 10];
        return { kind: 'param', x: f.x, y: f.y, t: t[1] > t[0] ? t : [0, 10], tMax: typeof f.tMax === 'string' && compile(f.tMax, names).ok ? f.tMax : '', label: str(f.label, 40), color: c };
      }
      return null;
    }).filter(Boolean);
    if (!fns.length) throw new Error('no function');
    const dom = Array.isArray(o.domain) ? [num(o.domain[0], -10), num(o.domain[1], 10)] : [-10, 10];
    if (dom[1] <= dom[0]) dom[1] = dom[0] + 1;
    const range = Array.isArray(o.range) && num(o.range[1], 0) > num(o.range[0], 0) ? [num(o.range[0]), num(o.range[1])] : null;
    const points = arr(o.points, 12).map((p) => ({ at: [str(p?.x, 60) || String(num(p?.at?.[0])), str(p?.y, 60) || String(num(p?.at?.[1]))], label: str(p?.label, 30) }))
      .filter((p) => compile(p.at[0], names).ok && compile(p.at[1], names).ok);
    return { ...b, fns, sliders, domain: dom, domainGiven: Array.isArray(o.domain), range, points, xLabel: str(o.xLabel, 30), yLabel: str(o.yLabel, 30), equal: !!o.equal };
  },
  diagram(o, b) {
    const items = arr(o.items || o.elements, 60).flatMap((x) => { const r = item(x); return Array.isArray(r) ? r : [r]; }).filter(Boolean).slice(0, 140);
    if (!items.length) throw new Error('no items');
    const size = Array.isArray(o.size) ? [num(o.size[0], 10, 2, 100), num(o.size[1], 6, 2, 100)] : null;
    return { ...b, items, size, grid: !!o.grid, axes: !!o.axes };
  },
  chart(o, b) {
    const kind = ['bar', 'line', 'pie'].includes(o.kind) ? o.kind : 'bar';
    const labels = arr(o.labels, 24).map((x) => str(x, 24));
    let series = arr(o.series, 4).map((s, i) => ({ name: str(s?.name, 30), color: color(s?.color, i), data: arr(s?.data, 24).map((v) => num(v, 0)) })).filter((s) => s.data.length);
    if (!series.length && Array.isArray(o.data)) series = [{ name: '', color: color(o.color, 0), data: arr(o.data, 24).map((v) => num(v, 0)) }];
    if (!series.length) throw new Error('no data');
    const n = Math.max(...series.map((s) => s.data.length));
    while (labels.length < n) labels.push(String(labels.length + 1));
    return { ...b, kind, labels: labels.slice(0, n), series: kind === 'pie' ? series.slice(0, 1) : series, yLabel: str(o.yLabel, 30), xLabel: str(o.xLabel, 30), unit: str(o.unit, 10) };
  },
  quiz(o, b) {
    const qs = arr(o.questions, 10).map((q) => {
      const options = arr(q?.options, 6).map((x) => str(x, 200)).filter(Boolean);
      const a = typeof q?.answer === 'string' && /^[A-F]$/i.test(q.answer) ? q.answer.toUpperCase().charCodeAt(0) - 65 : num(q?.answer, -1);
      if (!str(q?.q, 400) || options.length < 2 || a < 0 || a >= options.length) return null;
      return { q: str(q.q, 400), options, answer: Math.round(a), explain: str(q.explain || q.explanation, 400) };
    }).filter(Boolean);
    if (!qs.length) throw new Error('no questions');
    return { ...b, questions: qs };
  },
  steps(o, b) {
    const steps = arr(o.steps, 20).map((s) => (typeof s === 'string' ? { title: '', body: str(s, 600) } : { title: str(s?.title, 120), body: str(s?.body || s?.text, 600) })).filter((s) => s.title || s.body);
    if (!steps.length) throw new Error('no steps');
    return { ...b, steps };
  },
  flashcards(o, b) {
    const cards = arr(o.cards, 30).map((c) => ({ front: str(c?.front, 200), back: str(c?.back, 400) })).filter((c) => c.front && c.back);
    if (!cards.length) throw new Error('no cards');
    return { ...b, cards };
  },
  timeline(o, b) {
    const events = arr(o.events, 30).map((e) => ({ date: str(e?.date, 40), title: str(e?.title, 160), body: str(e?.body, 400) })).filter((e) => e.title);
    if (!events.length) throw new Error('no events');
    return { ...b, events };
  },
  compare(o, b) {
    const columns = arr(o.columns, 4).map((x) => str(x, 40)).filter(Boolean);
    const rows = arr(o.rows, 30).map((r) => ({ label: str(r?.label, 60), values: arr(r?.values, columns.length).map((v) => str(v, 300)) })).filter((r) => r.label || r.values.some(Boolean));
    if (columns.length < 2 || !rows.length) throw new Error('need ≥2 columns and rows');
    return { ...b, columns, rows };
  },
};

// Diagram primitives (coordinates in diagram units, y up). Physics helpers: incline (block on a slope with forces),
// force (vector from a point at an angle), circuit parts, rays + lens/mirror, geometry.
// Optics (Run 8): boundary (two media + labels / refractive indices), normal (dashed), ray (arrow mid-way), and the
// macros refraction / reflection that expand into those primitives (θ₂ from Snell's law when n1, n2 and θ₁ are given).
const ITEM_TYPES = ['line', 'arrow', 'force', 'rect', 'circle', 'polygon', 'polyline', 'angle', 'point', 'text', 'label', 'incline',
  'resistor', 'battery', 'bulb', 'switch', 'ammeter', 'voltmeter', 'wire', 'ray', 'lens', 'mirror', 'arc', 'boundary', 'normal', 'axes',
  'refraction', 'reflection'];
const ALIAS = { medium: 'boundary', interface: 'boundary', surface: 'boundary', 'normal-line': 'normal', snell: 'refraction', 'light-refraction': 'refraction', 'plane-mirror': 'reflection', curve: 'polyline', path: 'polyline', 'curved-mirror': 'mirror' };
function item(it) {
  if (!it || typeof it !== 'object') return null;
  let type = String(it.type || '').toLowerCase();
  type = ALIAS[type] || type;
  if (!ITEM_TYPES.includes(type)) return null;
  if (type === 'refraction') return refraction(it);
  if (type === 'reflection') return reflection(it);
  if (type === 'label') type = 'text';
  const defColor = type === 'force' || type === 'arrow' ? 'red' : type === 'ray' ? 'orange' : type === 'normal' || type === 'axes' ? 'muted' : 'ink';
  const o = { type, label: str(it.label, 40), color: COLORS.includes(it.color) ? it.color : defColor, dashed: type === 'normal' ? it.dashed !== false : !!it.dashed };
  switch (type) {
    case 'mirror':
      if (it.from == null && it.at != null) { // curved mirror: vertical, centred at "at", height h; concave opens to the left (-x)
        o.at = pt(it.at); o.h = num(it.h, 4, 0.2, 50); o.kind = it.kind === 'convex' ? 'convex' : 'concave'; o.f = num(it.f, 0, -100, 100);
        o.from = [o.at[0], o.at[1] - o.h / 2]; o.to = [o.at[0], o.at[1] + o.h / 2]; o.curved = true; return o;
      }
    // falls through
    case 'line': case 'arrow': case 'wire': case 'ray':
    case 'resistor': case 'battery': case 'bulb': case 'switch': case 'ammeter': case 'voltmeter':
      if (it.from == null) return null;
      o.from = pt(it.from);
      o.to = it.to != null ? pt(it.to) : [o.from[0] + num(it.length, 3) * Math.cos(num(it.angle, 0) * Math.PI / 180), o.from[1] + num(it.length, 3) * Math.sin(num(it.angle, 0) * Math.PI / 180)];
      if (type === 'switch') o.open = it.open !== false;
      if (type === 'ray') o.head = it.arrow === 'end' || it.head === 'end' ? 'end' : it.arrow === 'none' ? 'none' : 'mid';
      return o;
    case 'boundary': { // a surface between two media; the second medium (right of from→to, i.e. below a left→right line) is shaded
      const y = num(it.y, 0, -1000, 1000);
      o.from = it.from != null && Array.isArray(it.from) ? pt(it.from) : [num(it.x?.[0] ?? it.from, -5), y];
      o.to = it.to != null && Array.isArray(it.to) ? pt(it.to) : [num(it.x?.[1] ?? it.to, 5), y];
      if (o.from[0] === o.to[0] && o.from[1] === o.to[1]) o.to = [o.from[0] + 10, o.from[1]];
      o.depth = num(it.depth, 3, 0.2, 100);
      const med = Array.isArray(it.media) ? it.media : [];
      const name = (m) => (m && typeof m === 'object' ? str(m.name || m.label, 30) : str(m, 30));
      const nOf = (m, k) => (m && typeof m === 'object' && m.n != null ? m.n : it[k]);
      o.top = str(it.top, 30) || name(med[0]); o.bottom = str(it.bottom, 30) || name(med[1]);
      const n1 = nOf(med[0], 'n1'), n2 = nOf(med[1], 'n2');
      o.n1 = n1 != null && Number.isFinite(+n1) ? num(n1, 1, 0.1, 10) : null; o.n2 = n2 != null && Number.isFinite(+n2) ? num(n2, 1, 0.1, 10) : null;
      o.color = COLORS.includes(it.color) ? it.color : 'ink'; o.fillColor = COLORS.includes(it.fill) ? it.fill : 'blue'; o.dashed = false;
      return o;
    }
    case 'normal': { // dashed line through "at" (default vertical), total length "length"
      o.at = pt(it.at); const a = num(it.angle, 90); const L = num(it.length, 6, 0.2, 100) / 2;
      o.from = [o.at[0] - L * Math.cos(a * Math.PI / 180), o.at[1] - L * Math.sin(a * Math.PI / 180)];
      o.to = [o.at[0] + L * Math.cos(a * Math.PI / 180), o.at[1] + L * Math.sin(a * Math.PI / 180)];
      return o;
    }
    case 'axes': {
      const xr = Array.isArray(it.x) ? [num(it.x[0], -5), num(it.x[1], 5)] : [-5, 5];
      const yr = Array.isArray(it.y) ? [num(it.y[0], -3), num(it.y[1], 3)] : [-3, 3];
      o.x = xr[1] > xr[0] ? xr : [-5, 5]; o.y = yr[1] > yr[0] ? yr : [-3, 3];
      o.at = pt(it.origin || it.at, [0, 0]);
      const lb = Array.isArray(it.labels) ? it.labels : [it.xLabel, it.yLabel];
      o.xLabel = str(lb[0], 20); o.yLabel = str(lb[1], 20);
      return o;
    }
    case 'force':
      o.at = pt(it.at || it.from); o.angle = num(it.angle, -90); o.length = num(it.length, 2, 0.1, 50); return o;
    case 'rect':
      o.at = pt(it.at); o.w = num(it.w, 1, 0.05, 100); o.h = num(it.h, 1, 0.05, 100); o.rotate = num(it.rotate, 0, -360, 360); return o;
    case 'circle':
      o.at = pt(it.at); o.r = num(it.r, 1, 0.02, 100); o.fill = !!it.fill; return o;
    case 'polygon': {
      o.points = arr(it.points, 24).map((p) => pt(p)); o.fill = it.fill !== false;
      return o.points.length >= 2 ? o : null;
    }
    case 'polyline': {
      o.points = arr(it.points, 80).map((p) => pt(p)); o.arrow = !!it.arrow;
      return o.points.length >= 2 ? o : null;
    }
    case 'angle': case 'arc':
      o.at = pt(it.at); o.from = num(it.from, 0, -720, 720); o.to = num(it.to, 30, -720, 720); o.r = num(it.r, 0.8, 0.05, 50); return o;
    case 'point':
      o.at = pt(it.at); return o;
    case 'text':
      o.at = pt(it.at); o.text = str(it.text || it.label, 80); o.label = '';
      o.anchor = ['start', 'middle', 'end'].includes(it.anchor) ? it.anchor : 'middle'; o.size = num(it.size, 15, 10, 22);
      return o.text ? o : null;
    case 'lens':
      o.at = pt(it.at); o.h = num(it.h, 3, 0.2, 50); o.kind = it.kind === 'concave' ? 'concave' : 'convex'; o.f = num(it.f, 0, -100, 100); return o;
    case 'incline': {
      o.at = pt(it.at); o.angle = num(it.angle, 30, 5, 75); o.length = num(it.length, 8, 2, 60);
      o.block = it.block !== false; o.pos = num(it.pos, 0.55, 0.1, 0.9); o.size = num(it.size, 1.2, 0.2, 10);
      o.forces = arr(it.forces, 6).map((f, i) => {
        const fo = typeof f === 'string' ? { dir: f } : f || {};
        const dir = ['weight', 'normal', 'friction', 'up-slope', 'down-slope', 'applied', 'tension'].includes(fo.dir || fo.kind) ? (fo.dir || fo.kind) : null;
        const ang = fo.angle != null ? num(fo.angle, 0) : null;
        if (!dir && ang == null) return null;
        return { dir: dir || 'angle', angle: ang, label: str(fo.label, 30), length: num(fo.length, 2, 0.2, 20), color: color(fo.color, i + 1) };
      }).filter(Boolean);
      o.showAngle = it.showAngle !== false;
      return o;
    }
    default: return null;
  }
}

// ---------- optics macros ----------
const D2R = Math.PI / 180;
const r1 = (v) => Math.round(v * 10) / 10;
// Snell's law n1 sin θ1 = n2 sin θ2. Returns θ2 in degrees, or null for total internal reflection.
export function snell(n1, n2, t1) {
  const s = (n1 * Math.sin(t1 * D2R)) / n2;
  return Math.abs(s) > 1 ? null : Math.asin(s) / D2R;
}
const fmtN = (n) => (Math.abs(Math.round(n * 100) - n * 100) < 1e-9 ? n.toFixed(2) : String(+n.toFixed(3)));
const labelsOf = (it) => (it.labels && typeof it.labels === 'object' && !Array.isArray(it.labels) ? it.labels : {});
// {"type":"refraction","at":[0,0],"n1":1,"n2":1.5,"angle":40,"media":["空氣","玻璃"],"reflected":true,"labels":{…}}
// Light goes from the top medium (n1) into the bottom one (n2), entering at "at" from the upper left.
function refraction(it) {
  const at = pt(it.at); const L = num(it.length, 4, 1, 40);
  const t1 = num(it.angle ?? it.theta1 ?? it.i ?? it.incidence, 40, 0, 89);
  const med = Array.isArray(it.media) ? it.media : [];
  const nm = (m) => (m && typeof m === 'object' ? m : { name: m });
  const m1 = nm(med[0]), m2 = nm(med[1]);
  const n1v = it.n1 ?? m1.n, n2v = it.n2 ?? m2.n;
  const n1 = n1v != null && Number.isFinite(+n1v) ? num(n1v, 1, 0.1, 10) : null;
  const n2 = n2v != null && Number.isFinite(+n2v) ? num(n2v, 1.5, 0.1, 10) : null;
  const given2 = it.angle2 ?? it.theta2 ?? it.r;
  let t2 = given2 != null && Number.isFinite(+given2) ? num(given2, 25, 0, 89) : n1 && n2 ? snell(n1, n2, t1) : n1 == null && n2 == null ? snell(1, 1.5, t1) : null;
  const tir = t2 == null; // total internal reflection
  const lb = labelsOf(it);
  const items = [];
  items.push({ type: 'boundary', label: '', color: 'ink', dashed: false, from: [at[0] - L - 1, at[1]], to: [at[0] + L + 1, at[1]], depth: L, top: str(lb.top || m1.name || m1.label || it.top, 30), bottom: str(lb.bottom || m2.name || m2.label || it.bottom, 30), n1, n2, fillColor: COLORS.includes(it.fill) ? it.fill : 'blue' });
  items.push({ type: 'normal', label: str(lb.normal, 20), color: 'muted', dashed: true, at, from: [at[0], at[1] - L * 0.95], to: [at[0], at[1] + L * 0.95] });
  const s1 = Math.sin(t1 * D2R), c1 = Math.cos(t1 * D2R);
  const inc = { type: 'ray', label: str(lb.incident, 24), color: COLORS.includes(it.color) ? it.color : 'orange', dashed: false, head: 'mid', from: [at[0] - L * s1, at[1] + L * c1], to: at };
  items.push(inc);
  const sym1 = str(lb.i || lb.theta1, 20) || 'θ₁'; const sym2 = str(lb.r || lb.theta2, 20) || 'θ₂';
  // Arcs carry only the symbols (they sit in the narrow gap between the normal and the ray); the values go in a legend
  // in the lower-left corner, which the rays never cross (the refracted ray always leaves to the right).
  items.push({ type: 'angle', label: sym1, color: 'ink', dashed: false, at, from: 90, to: 90 + t1, r: Math.min(1.3, L * 0.32) });
  const lx = at[0] - L - 0.75; const legend = [`${sym1} = ${r1(t1)}°`];
  if (!tir) {
    const s2 = Math.sin(t2 * D2R), c2 = Math.cos(t2 * D2R);
    items.push({ type: 'ray', label: str(lb.refracted, 24), color: COLORS.includes(it.color2) ? it.color2 : 'orange', dashed: false, head: 'mid', from: at, to: [at[0] + L * s2, at[1] - L * c2] });
    items.push({ type: 'angle', label: sym2, color: 'ink', dashed: false, at, from: -90, to: -90 + t2, r: Math.min(1.6, L * 0.4) });
    legend.push(`${sym2} ${given2 != null ? '=' : '≈'} ${r1(t2)}°`);
  }
  if (it.reflected === true || tir) {
    items.push({ type: 'ray', label: str(lb.reflected, 24), color: tir ? 'orange' : 'muted', dashed: !tir, head: 'mid', from: at, to: [at[0] + L * s1, at[1] + L * c1] });
    if (tir) items.push({ type: 'angle', label: sym1, color: 'ink', dashed: false, at, from: 90 - t1, to: 90, r: Math.min(1.3, L * 0.32) });
  }
  if (n1 && n2 && !tir && given2 == null) legend.push('n₁ sin θ₁ = n₂ sin θ₂');
  legend.forEach((t, k) => items.push({ type: 'text', label: '', color: 'ink', dashed: false, at: [lx, at[1] - L * 0.42 - k * 0.62], text: t, anchor: 'start', size: 13 }));
  if (tir) items.push({ type: 'text', label: '', color: 'red', dashed: false, at: [lx, at[1] - L * 0.42 - legend.length * 0.62], text: str(lb.tir, 30), tKey: 'tir', anchor: 'start', size: 13 });
  items.tir = tir; items.theta2 = t2;
  return items;
}
// {"type":"reflection","at":[0,0],"angle":35,"labels":{"incident":"入射光線","reflected":"反射光線","i":"i","r":"r"}} on a plane mirror
function reflection(it) {
  const at = pt(it.at); const L = num(it.length, 4, 1, 40); const t = num(it.angle ?? it.i, 35, 0, 89); const lb = labelsOf(it);
  const s = Math.sin(t * D2R), c = Math.cos(t * D2R);
  return [
    { type: 'mirror', label: str(lb.mirror, 20), color: 'ink', dashed: false, from: [at[0] - L - 0.5, at[1]], to: [at[0] + L + 0.5, at[1]], hatch: true },
    { type: 'normal', label: str(lb.normal, 20), color: 'muted', dashed: true, at, from: [at[0], at[1]], to: [at[0], at[1] + L * 0.95] },
    { type: 'ray', label: str(lb.incident, 24), color: 'orange', dashed: false, head: 'mid', from: [at[0] - L * s, at[1] + L * c], to: at },
    { type: 'ray', label: str(lb.reflected, 24), color: 'orange', dashed: false, head: 'mid', from: at, to: [at[0] + L * s, at[1] + L * c] },
    { type: 'angle', label: str(lb.i, 12) || 'i', color: 'ink', dashed: false, at, from: 90, to: 90 + t, r: Math.min(1.3, L * 0.32) },
    { type: 'angle', label: str(lb.r, 12) || 'r', color: 'ink', dashed: false, at, from: 90 - t, to: 90, r: Math.min(1.3, L * 0.32) },
    { type: 'text', label: '', color: 'ink', dashed: false, at: [at[0] - L - 0.4, at[1] - 0.75], text: `${str(lb.i, 12) || 'i'} = ${str(lb.r, 12) || 'r'} = ${r1(t)}°`, anchor: 'start', size: 13 },
  ];
}
export const mediumLabel = (name, n) => [name, n != null ? `n = ${fmtN(n)}` : ''].filter(Boolean).join('  ');

// Short label maths for SVG text (KaTeX cannot render inside SVG text): $\theta$ → θ, x^2 → x², F_N → F_N (subscript kept by the renderer).
const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', Delta: 'Δ', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', omega: 'ω', Omega: 'Ω', phi: 'φ', sigma: 'σ', rho: 'ρ', tau: 'τ', epsilon: 'ε', eta: 'η' };
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', '+': '⁺', n: 'ⁿ' };
const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', x: 'ₓ', y: 'ᵧ', n: 'ₙ' };
const wrapT = (x) => (/^[\w.\u0370-\u03ff]+$/.test(x) ? x : `(${x})`);
export function texLabel(s) {
  let t = String(s || '').replace(/\$/g, '');
  t = t.replace(/\^\{?\\circ\}?/g, '°').replace(/\\(degree|circ)/g, '°');
  t = t.replace(/\\(alpha|beta|gamma|Delta|delta|theta|lambda|mu|pi|Omega|omega|phi|sigma|rho|tau|epsilon|eta)(?![a-zA-Z])/g, (m, g) => GREEK[g]);
  t = t.replace(/\\(sin|cos|tan|log|ln)(?![a-zA-Z])/g, ' $1 ');
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b2) => `${wrapT(a)}/${wrapT(b2)}`).replace(/\\sqrt\{([^{}]*)\}/g, '√($1)').replace(/\\(cdot|times)/g, (m, k) => (k === 'cdot' ? '·' : '×'))
    .replace(/\\vec\{([^{}]*)\}/g, '$1').replace(/\\(text|mathrm|mathbf)\{([^{}]*)\}/g, '$2');
  t = t.replace(/\^\{([0-9n+-]+)\}|\^([0-9n])/g, (m, a, b2) => [...(a || b2)].map((c) => SUP[c] || c).join(''));
  t = t.replace(/_\{([0-9xyn]+)\}|_([0-9xyn])(?![A-Za-z])/g, (m, a, b2) => [...(a || b2)].map((c) => SUB[c] || c).join(''));
  // other subscripts (F_N, F_{net}) stay as "_" segments; the SVG renderer draws them as subscripts (labelParts)
  return t.replace(/\\[a-zA-Z]+/g, '').replace(/_\{([^{}]*)\}/g, '_$1').replace(/[{}]/g, '').replace(/\s{2,}/g, ' ').trim().slice(0, 60);
}
// "F_N" → [{t:'F'},{t:'N',sub:true}]; "F_net" → F + sub "net"
export function labelParts(s) {
  const out = [];
  String(s || '').split(/(_[A-Za-z0-9\u0370-\u03ff]+)/).forEach((p) => { if (!p) return; if (p[0] === '_' && p.length > 1) out.push({ t: p.slice(1), sub: true }); else out.push({ t: p }); });
  return out;
}
