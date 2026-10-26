// Theme sanitizer: the ONLY way plugin data reaches the main app's styles. Whitelisted CSS variables with strictly
// parsed values, fonts from a fixed list (loaded by Nest itself), and backgrounds Nest builds from validated parts.
// No raw CSS string from a plugin is ever written into the main document.

export const THEME_VARS = {
  '--ink': 'color', '--ink-2': 'color', '--muted': 'color', '--line': 'color', '--line-2': 'color',
  '--soft': 'color', '--soft-2': 'color', '--bg': 'color', '--surface': 'color', '--on-ink': 'color', '--red': 'color',
  '--radius': 'radius', '--radius-sm': 'radius',
};
// family → Google Fonts css2 query (Nest loads it; plugins cannot add stylesheets to the app).
export const FONTS = {
  'Nunito': null, // already loaded
  'Noto Sans TC': null,
  'Quicksand': 'Quicksand:wght@400;500;600;700',
  'M PLUS Rounded 1c': 'M+PLUS+Rounded+1c:wght@400;500;700;800;900',
  'Varela Round': 'Varela+Round',
  'Baloo 2': 'Baloo+2:wght@400;600;700;800',
  'Zen Maru Gothic': 'Zen+Maru+Gothic:wght@400;500;700;900',
  'Comfortaa': 'Comfortaa:wght@400;600;700',
  'Noto Serif TC': 'Noto+Serif+TC:wght@400;600;700;900',
};
const CJK_FALLBACK = "'Noto Sans TC', -apple-system, BlinkMacSystemFont, 'PingFang HK', 'Microsoft JhengHei', sans-serif";
export const fontStack = (f) => (FONTS[f] !== undefined ? `'${f}', ${CJK_FALLBACK}` : null);

const n255 = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)';
const pct = '(?:100|\\d{1,2}(?:\\.\\d+)?)%';
const alpha = '(?:0|1|0?\\.\\d{1,3})';
const RGB = new RegExp(`^rgba?\\(\\s*${n255}\\s*,\\s*${n255}\\s*,\\s*${n255}\\s*(?:,\\s*${alpha}\\s*)?\\)$`);
const HSL = new RegExp(`^hsla?\\(\\s*(?:360|3[0-5]\\d|[12]?\\d?\\d)\\s*,\\s*${pct}\\s*,\\s*${pct}\\s*(?:,\\s*${alpha}\\s*)?\\)$`);
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function cleanColor(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.length > 40) return null;
  if (HEX.test(s) || RGB.test(s) || HSL.test(s)) return s;
  return null;
}
export function cleanRadius(v) {
  const s = String(v ?? '').trim();
  const m = s.match(/^(\d{1,2})px$/);
  return m && +m[1] <= 40 ? `${+m[1]}px` : null;
}
export function cleanBgUrl(v) {
  const s = String(v || '');
  if (/^\/plugins\/[a-z0-9-]+\/[a-z0-9._-]+\.(svg|png|webp|jpg)$/.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= 160 * 1024) return s;
  return null;
}
function cleanBackground(b) {
  if (!b || typeof b !== 'object') return undefined;
  const colors = (Array.isArray(b.colors) ? b.colors : []).slice(0, 4).map(cleanColor).filter(Boolean);
  const angle = Number.isFinite(+b.angle) ? Math.round(Math.max(0, Math.min(360, +b.angle))) : 180;
  const image = cleanBgUrl(b.image);
  const out = {};
  if (b.type === 'color' && colors[0]) { out.type = 'color'; out.colors = [colors[0]]; }
  else if (colors.length >= 2) { out.type = 'gradient'; out.colors = colors; out.angle = angle; }
  else if (colors.length === 1) { out.type = 'color'; out.colors = colors; }
  if (image) { out.image = image; out.type = out.type || 'image'; out.size = b.size === 'contain' ? 'contain' : b.size === 'repeat' ? 'repeat' : 'cover'; }
  return out.type ? out : undefined;
}

// sanitizeTheme(input, capabilities?) → { vars, font, headingFont, background, scheme }. Unknown keys / bad values are dropped.
export function sanitizeTheme(t, caps = ['theme', 'font', 'background']) {
  const out = { vars: {} };
  if (!t || typeof t !== 'object') return out;
  const can = (c) => caps.includes(c) || caps.includes('theme');
  if (caps.includes('theme') && t.vars && typeof t.vars === 'object') {
    for (const [k, v] of Object.entries(t.vars).slice(0, 40)) {
      const kind = THEME_VARS[k];
      if (!kind) continue;
      const val = kind === 'color' ? cleanColor(v) : cleanRadius(v);
      if (val) out.vars[k] = val;
    }
  }
  if (can('font')) {
    if (typeof t.font === 'string' && FONTS[t.font] !== undefined) out.font = t.font;
    if (typeof t.headingFont === 'string' && FONTS[t.headingFont] !== undefined) out.headingFont = t.headingFont;
  }
  if (can('background')) { const bg = cleanBackground(t.background); if (bg) out.background = bg; }
  if (caps.includes('theme') && (t.scheme === 'dark' || t.scheme === 'light')) out.scheme = t.scheme;
  return out;
}

// CSS value for a sanitized background (built by Nest from validated parts only).
export function backgroundCss(bg) {
  if (!bg) return '';
  const layers = [];
  if (bg.image) layers.push(`url("${bg.image}") center / ${bg.size === 'repeat' ? 'auto' : bg.size || 'cover'} ${bg.size === 'repeat' ? 'repeat' : 'no-repeat'}`);
  if (bg.type === 'gradient') layers.push(`linear-gradient(${bg.angle ?? 180}deg, ${bg.colors.join(', ')})`);
  else if (bg.type === 'color') layers.push(bg.colors[0]);
  return layers.join(', ');
}

// Merge several sanitized themes (later ones win per variable).
export function mergeThemes(list) {
  const out = { vars: {} };
  for (const t of list) {
    if (!t) continue;
    Object.assign(out.vars, t.vars || {});
    if (t.font) out.font = t.font;
    if (t.headingFont) out.headingFont = t.headingFont;
    if (t.background) out.background = t.background;
    if (t.scheme) out.scheme = t.scheme;
  }
  return out;
}
