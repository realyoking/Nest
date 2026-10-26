// ```nest-svg``` blocks: simple model-written illustrations. Pure code (no DOM) so it is unit-tested.
// Strict ALLOWLIST rebuild — the model's markup is never inserted as-is: it is tokenised, every element / attribute /
// value is checked against the lists below, and a NEW string is serialised from what survived (values re-escaped).
// Dropped entirely (with their whole subtree): script, style, foreignObject, image, use, a, animate*, set, iframe,
// anything not listed. Dropped attributes: on*, href / xlink:href, style, class, any url() except a local #marker ref.
// sanitizeSvg(src, { idPrefix }) → { ok:true, svg, stats } | { ok:false, error }

export const SVG_TAGS = new Set(['svg', 'g', 'path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'text', 'tspan', 'defs', 'marker']);
const DROP_SUBTREE = true; // non-allowlisted elements lose their children too (a <script> body must never become text)
const MAX_SRC = 24000, MAX_EL = 600, MAX_DEPTH = 16, MAX_TEXT = 200;

const NUM = /^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?(px|%)?$/i;
const NUMS = /^[-+\d.eE,\s]*$/;
const COLOR_NAMES = /^[a-z]{3,20}$/i;
const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\)$/i;
const ID = /^[A-Za-z][\w-]{0,40}$/;
const TRANSFORM = /^(\s*(translate|rotate|scale|matrix|skewX|skewY)\s*\(\s*[-+\d.eE,\s]*\)\s*,?)*\s*$/;
const PATH_D = /^[MmLlHhVvCcSsQqTtAaZz\d\s,.eE+-]*$/;
const enumOf = (...v) => (x) => (v.includes(x) ? x : null);

// Dark-mode friendly colours: near-black → the theme's ink, white → the theme's background, basic hues → Nest palette.
const MAP = {
  black: 'currentColor', '#000': 'currentColor', '#000000': 'currentColor', '#111': 'currentColor', '#111111': 'currentColor', '#222': 'currentColor', '#222222': 'currentColor', '#333': 'currentColor', '#333333': 'currentColor',
  white: 'var(--nui-bg)', '#fff': 'var(--nui-bg)', '#ffffff': 'var(--nui-bg)',
  red: 'var(--nui-red)', blue: 'var(--nui-blue)', green: 'var(--nui-green)', orange: 'var(--nui-orange)', purple: 'var(--nui-purple)', gray: 'var(--nui-muted)', grey: 'var(--nui-muted)',
};
function paint(v, ids) {
  const x = v.trim();
  const low = x.toLowerCase();
  if (low === 'none' || low === 'currentcolor') return low === 'none' ? 'none' : 'currentColor';
  if (MAP[low]) return MAP[low];
  if (HEX.test(x) || RGB.test(x)) return x;
  const u = /^url\(\s*#([A-Za-z][\w-]{0,40})\s*\)$/.exec(x); // no gradients/patterns are allowed, so no paint url()
  if (u) return null;
  if (COLOR_NAMES.test(x) && !/^(inherit|initial|unset|revert|expression|javascript)$/i.test(x)) return low;
  return null;
}
const num = (v) => (NUM.test(v.trim()) ? v.trim() : null);
const nums = (max) => (v) => (NUMS.test(v) && v.length <= max ? v.trim().replace(/\s+/g, ' ') : null);

// attribute → validator (value string → clean string | null). Names are SVG presentation names (hyphenated).
const ATTRS = {
  x: num, y: num, x1: num, y1: num, x2: num, y2: num, cx: num, cy: num, r: num, rx: num, ry: num, dx: num, dy: num,
  width: num, height: num, 'stroke-width': num, 'font-size': num, opacity: num, 'fill-opacity': num, 'stroke-opacity': num,
  refX: num, refY: num, markerWidth: num, markerHeight: num, 'stroke-miterlimit': num,
  d: (v) => (PATH_D.test(v) && v.length <= 8000 ? v.trim() : null),
  points: nums(6000),
  viewBox: (v) => (/^\s*-?[\d.]+([\s,]+-?[\d.]+){3}\s*$/.test(v) ? v.trim().replace(/[\s,]+/g, ' ') : null),
  transform: (v) => (TRANSFORM.test(v) && v.length <= 300 ? v.trim() : null),
  fill: null, stroke: null, // → paint()
  'stroke-dasharray': (v) => (/^[\d.\s,]+$/.test(v) || v === 'none' ? v.trim() : null),
  'stroke-linecap': enumOf('butt', 'round', 'square'),
  'stroke-linejoin': enumOf('miter', 'round', 'bevel'),
  'fill-rule': enumOf('nonzero', 'evenodd'),
  'text-anchor': enumOf('start', 'middle', 'end'),
  'dominant-baseline': enumOf('auto', 'middle', 'central', 'hanging', 'alphabetic', 'mathematical'),
  'font-weight': (v) => (/^(normal|bold|bolder|lighter|[1-9]00)$/.test(v.trim()) ? v.trim() : null),
  'font-style': enumOf('normal', 'italic'),
  orient: (v) => (/^(auto|auto-start-reverse|-?[\d.]+)$/.test(v.trim()) ? v.trim() : null),
  markerUnits: enumOf('strokeWidth', 'userSpaceOnUse'),
  preserveAspectRatio: (v) => (/^(none|x(Min|Mid|Max)Y(Min|Mid|Max)( meet| slice)?)$/.test(v.trim()) ? v.trim() : null),
  id: null, 'marker-start': null, 'marker-mid': null, 'marker-end': null, // → ids
};
const ALLOWED_ATTR = new Set(Object.keys(ATTRS));

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 0 && c < 0x110000 && !(c >= 0xd800 && c < 0xe000) ? String.fromCodePoint(c) : ''; }
    return ENT[e.toLowerCase()] ?? '';
  });
}
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Tokeniser: comments / CDATA / doctype / processing instructions are removed; tags + text remain.
const TOKEN = /<!--[\s\S]*?(?:-->|$)|<!\[CDATA\[[\s\S]*?(?:\]\]>|$)|<![^>]*>|<\?[\s\S]*?(?:\?>|$)|<\s*(\/?)\s*([A-Za-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)|(<)/g;
const ATTR = /([^\s=\/"'<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

export function parseSvg(src) {
  const text = String(src || '');
  if (text.length > MAX_SRC) return { ok: false, error: 'too_large' };
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root]; const drop = []; // names of the dropped elements we are inside
  const VOID = /^(img|br|hr|input|meta|link|source|area|base|col|embed|param|track|wbr)$/i;
  let dropDepth = 0; let count = 0; let stripped = 0;
  TOKEN.lastIndex = 0; let m;
  while ((m = TOKEN.exec(text))) {
    if (m[2]) {
      const closing = !!m[1]; const raw = m[2]; const tag = raw.toLowerCase() === 'foreignobject' ? 'foreignobject' : raw;
      const selfClose = /\/\s*$/.test(m[3] || '');
      const ok = SVG_TAGS.has(tag) && !(raw.includes(':'));
      if (closing) {
        if (drop.length) { const i = drop.lastIndexOf(raw.toLowerCase()); if (i >= 0) drop.length = i; dropDepth = drop.length; continue; }
        // close the nearest matching open element (tolerates mis-nesting)
        for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
        continue;
      }
      if (dropDepth > 0 || !ok || stack.length > MAX_DEPTH) { stripped++; if (!selfClose && !VOID.test(raw) && DROP_SUBTREE) { drop.push(raw.toLowerCase()); dropDepth = drop.length; } continue; }
      if (++count > MAX_EL) return { ok: false, error: 'too_many_elements' };
      const attrs = {};
      ATTR.lastIndex = 0; let a; const body = (m[3] || '').replace(/\/\s*$/, '');
      while ((a = ATTR.exec(body))) attrs[a[1]] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? '');
      const node = { tag, attrs, children: [] };
      stack[stack.length - 1].children.push(node);
      if (!selfClose) stack.push(node);
    } else if (m[4] != null) {
      if (dropDepth > 0) continue;
      const cur = stack[stack.length - 1];
      if (cur.tag === 'text' || cur.tag === 'tspan') { const t = decodeEntities(m[4]).replace(/[\u0000-\u0008\u000b-\u001f]/g, ''); if (t.trim()) cur.children.push({ text: t.slice(0, MAX_TEXT) }); }
    }
  }
  const svg = root.children.find((n) => n.tag === 'svg');
  if (!svg) return { ok: false, error: 'no_svg' };
  return { ok: true, tree: svg, stripped };
}

// Rebuilds a clean string. ids are prefixed (several blocks on one page never clash) and marker refs must point at a
// marker id defined in the same block.
export function serialize(tree, { idPrefix = 'ns' } = {}) {
  const ids = new Set();
  (function walk(n) { if (n.attrs?.id && ID.test(n.attrs.id)) ids.add(n.attrs.id); (n.children || []).forEach(walk); })(tree);
  let dropped = 0;
  const pre = String(idPrefix).replace(/[^\w-]/g, '').slice(0, 24) || 'ns';
  const out = (n, depth) => {
    if (n.text != null) return escText(n.text);
    const parts = [];
    let vb = null; let w = null; let h = null;
    for (const [k0, v] of Object.entries(n.attrs)) {
      const k = k0 === 'viewbox' ? 'viewBox' : k0;
      if (!ALLOWED_ATTR.has(k) || /^on/i.test(k)) { dropped++; continue; }
      if (/url\s*\(|expression\s*\(|javascript:|data:/i.test(v) && !/^marker-/.test(k)) { dropped++; continue; }
      let clean = null;
      if (k === 'fill' || k === 'stroke') clean = paint(v, ids);
      else if (k === 'id') clean = ID.test(v) ? `${pre}-${v}` : null;
      else if (/^marker-/.test(k)) { const u = /^\s*url\(\s*#([A-Za-z][\w-]{0,40})\s*\)\s*$/.exec(v); clean = u && ids.has(u[1]) ? `url(#${pre}-${u[1]})` : null; }
      else clean = ATTRS[k](v);
      if (clean == null) { dropped++; continue; }
      if (n.tag === 'svg' && k === 'viewBox') { vb = clean; continue; }
      if (n.tag === 'svg' && (k === 'width' || k === 'height')) { if (k === 'width') w = clean; else h = clean; continue; }
      parts.push(`${k}="${escAttr(clean)}"`);
    }
    if (n.tag === 'svg') {
      if (depth === 0) {
        // root: always responsive — width 100%, height from the viewBox; no fixed pixel size that could overflow.
        const pw = parseFloat(w), ph = parseFloat(h);
        if (!vb) vb = pw > 0 && ph > 0 && !/%/.test(`${w}${h}`) ? `0 0 ${pw} ${ph}` : '0 0 400 300';
        parts.unshift(`xmlns="http://www.w3.org/2000/svg" viewBox="${escAttr(vb)}" width="100%" role="img" class="nui-svg nui-usvg"`);
      } else if (vb) parts.push(`viewBox="${escAttr(vb)}"`);
    }
    const kids = (n.children || []).map((c) => out(c, depth + 1)).join('');
    return `<${n.tag}${parts.length ? ' ' + parts.join(' ') : ''}>${kids}</${n.tag}>`;
  };
  return { svg: out(tree, 0), dropped };
}

export function sanitizeSvg(src, opts = {}) {
  const p = parseSvg(src);
  if (!p.ok) return p;
  const s = serialize(p.tree, opts);
  if (!/<(path|line|polyline|polygon|rect|circle|ellipse|text)\b/.test(s.svg)) return { ok: false, error: 'empty' };
  return { ok: true, svg: s.svg, stats: { strippedElements: p.stripped, droppedAttrs: s.dropped } };
}
