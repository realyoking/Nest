// Nest plugins — manifest schema + validation. Pure JS: shared by the browser, the server (api/_plugins.js) and tests.
// A plugin bundle = { manifest, html, css, js }. JS only ever runs inside the sandboxed iframe (see sandbox.js);
// everything the main app does for a plugin (theme, tab, widget, reminders) goes through validated data.
import { sanitizeTheme } from './theme.js';
import { PERMS, PERM_IDS, NEVER, SOON, impliedFor, cleanDomains } from './permissions.js';

export const LIMITS = {
  code: 200 * 1024,       // manifest + html + css + js (UTF-8 bytes)
  icon: 48 * 1024,        // data URL length
  shot: 320 * 1024,       // one screenshot data URL
  shots: 6,
  settings: 12,
  storage: 64 * 1024,     // nest.storage per plugin (JSON chars)
  review: 600,
  bio: 160,
};
export const CATEGORIES = ['theme', 'productivity', 'study', 'family', 'fun', 'tools'];
export const CAPABILITIES = ['theme', 'font', 'background', 'tab', 'widget', 'automation'];
// Every permission (see permissions.js for labels / risk). Data permissions must be declared AND approved at install.
export const PERMISSIONS = PERM_IDS;
// Capabilities that change the app's look need no data permission, but are still listed in the install prompt.
export const TAB_ICONS = ['sparkle', 'calendar', 'bell', 'book', 'cards', 'star', 'gauge', 'lightbulb', 'image', 'cloud', 'check', 'users', 'home', 'globe', 'brain'];
export const SETTING_TYPES = ['toggle', 'text', 'number', 'select', 'color', 'time', 'date'];

const ID_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
const VER_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const byteLen = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(String(s || '')).length : Buffer.byteLength(String(s || '')));
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

// Icons: our own static plugin assets, or a small raster/SVG data URL (shown only through <img>, never inlined as markup).
export function cleanIcon(v) {
  const s = String(v || '');
  if (/^\/plugins\/[a-z0-9-]+\/[a-z0-9._-]+\.(svg|png|webp)$/.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= LIMITS.icon) return s;
  return '';
}
export function cleanShot(v) {
  const s = String(v || '');
  if (/^\/plugins\/[a-z0-9-]+\/[a-z0-9._-]+\.(png|webp|jpg)$/.test(s)) return s;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= LIMITS.shot) return s;
  return '';
}
export function cleanVideo(v) {
  const s = str(v, 300);
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:') return '';
    if (/^(www\.)?(youtube\.com|youtu\.be|vimeo\.com)$/.test(u.hostname)) return u.toString();
    if (/\.(mp4|webm)$/i.test(u.pathname)) return u.toString();
  } catch {}
  return '';
}

function cleanSetting(x, errors, i) {
  if (!x || typeof x !== 'object') { errors.push(`settings[${i}]: not an object`); return null; }
  const key = String(x.key || '');
  if (!KEY_RE.test(key)) { errors.push(`settings[${i}]: bad key`); return null; }
  const type = SETTING_TYPES.includes(x.type) ? x.type : null;
  if (!type) { errors.push(`settings.${key}: bad type`); return null; }
  const out = { key, type, label: str(x.label || key, 60), labelZh: str(x.labelZh, 60) || undefined };
  if (type === 'select') {
    const opts = (Array.isArray(x.options) ? x.options : []).slice(0, 12).map((o) => (typeof o === 'string' ? { value: str(o, 40), label: str(o, 40) } : { value: str(o?.value, 40), label: str(o?.label ?? o?.value, 40), labelZh: str(o?.labelZh, 40) || undefined })).filter((o) => o.value);
    if (!opts.length) { errors.push(`settings.${key}: select needs options`); return null; }
    out.options = opts;
  }
  if (type === 'number') { out.min = Number.isFinite(+x.min) ? +x.min : 0; out.max = Number.isFinite(+x.max) ? +x.max : 9999; }
  if (type === 'text') out.maxLength = Math.max(1, Math.min(200, Number(x.maxLength) || 80));
  const d = coerceSetting(out, x.default);
  out.default = d === undefined ? defaultFor(out) : d;
  return out;
}
const defaultFor = (s) => ({ toggle: false, text: '', number: s.min ?? 0, select: s.options?.[0]?.value, color: '#0a0a0a', time: '09:00', date: '' }[s.type]);
// Value for one setting, or undefined when invalid.
export function coerceSetting(s, v) {
  if (v === undefined || v === null) return undefined;
  switch (s.type) {
    case 'toggle': return typeof v === 'boolean' ? v : undefined;
    case 'text': return typeof v === 'string' ? str(v, s.maxLength || 80) : undefined;
    case 'number': { const n = Number(v); return Number.isFinite(n) ? Math.max(s.min ?? -1e9, Math.min(s.max ?? 1e9, n)) : undefined; }
    case 'select': return s.options?.some((o) => o.value === v) ? v : undefined;
    case 'color': return typeof v === 'string' && COLOR_RE.test(v) ? v.toLowerCase() : undefined;
    case 'time': return typeof v === 'string' && TIME_RE.test(v) ? v : undefined;
    case 'date': return typeof v === 'string' && (v === '' || DATE_RE.test(v)) ? v : undefined;
    default: return undefined;
  }
}
// Full settings object for a manifest: defaults overlaid with valid user values (unknown keys dropped).
export function settingsValues(manifest, values = {}) {
  const out = {};
  for (const s of manifest?.settings || []) {
    const v = coerceSetting(s, values?.[s.key]);
    out[s.key] = v === undefined ? s.default : v;
  }
  return out;
}

// Validate + normalise a manifest. Returns { ok, manifest, errors }.
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, errors: ['manifest must be an object'], manifest: null };
  const id = String(m.id || '');
  if (!ID_RE.test(id)) errors.push('id: 3–40 chars, a-z 0-9 and -');
  const name = str(m.name, 40);
  if (!name) errors.push('name is required');
  const version = VER_RE.test(String(m.version || '')) ? String(m.version) : (m.version ? (errors.push('version: use 1.0.0'), '') : '1.0.0');
  const category = CATEGORIES.includes(m.category) ? m.category : 'tools';
  const unknownCaps = (Array.isArray(m.capabilities) ? m.capabilities : []).filter((c) => !CAPABILITIES.includes(c));
  if (unknownCaps.length) errors.push(`unknown capabilities: ${unknownCaps.join(', ')}`);
  const capabilities = [...new Set((Array.isArray(m.capabilities) ? m.capabilities : []).filter((c) => CAPABILITIES.includes(c)))];
  const permsIn = Array.isArray(m.permissions) ? m.permissions.map(String) : [];
  const never = permsIn.filter((p) => NEVER.includes(p) || /^(chats?|secrets?|tokens?)(\.|$)/.test(p));
  if (never.length) errors.push(`never grantable: ${never.join(', ')} (private chats, secrets and tokens are never available to plugins)`);
  const unknownPerms = permsIn.filter((p) => !PERMISSIONS.includes(p) && !never.includes(p));
  if (unknownPerms.length) errors.push(`unknown permissions: ${unknownPerms.join(', ')}`);
  const soon = permsIn.filter((p) => SOON.includes(p));
  if (soon.length) errors.push(`not available yet: ${soon.join(', ')}`);
  const permissions = [...new Set([...permsIn.filter((p) => PERMISSIONS.includes(p) && !SOON.includes(p)), ...impliedFor(capabilities)])];
  if (!capabilities.length) errors.push('declare at least one capability');
  const settingsIn = Array.isArray(m.settings) ? m.settings : [];
  if (settingsIn.length > LIMITS.settings) errors.push(`at most ${LIMITS.settings} settings`);
  const settings = settingsIn.slice(0, LIMITS.settings).map((x, i) => cleanSetting(x, errors, i)).filter(Boolean);
  if (new Set(settings.map((s) => s.key)).size !== settings.length) errors.push('settings keys must be unique');
  const out = {
    id, name, nameZh: str(m.nameZh, 40) || undefined, version, category,
    description: str(m.description, 400), descriptionZh: str(m.descriptionZh, 400) || undefined,
    icon: cleanIcon(m.icon) || undefined, capabilities, permissions, settings,
    features: str(String(m.features ?? '').replace(/\r/g, ''), 1000).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20).join('\n') || undefined,
  };
  // Optional reason per requested permission (shown in the install prompt).
  if (m.permissionReasons && typeof m.permissionReasons === 'object') {
    const r = {};
    for (const p of permissions) { const v = str(m.permissionReasons[p], 140); if (v) r[p] = v; }
    if (Object.keys(r).length) out.permissionReasons = r;
  }
  if (permissions.includes('network')) {
    const domains = cleanDomains(m.network?.domains, errors);
    if (!domains.length) errors.push('network: list the websites (domains) the plugin connects to');
    out.network = { domains };
  }
  if (capabilities.includes('automation')) {
    const every = Number(m.schedule?.everyMinutes);
    if (Number.isFinite(every) && every > 0) out.schedule = { everyMinutes: Math.max(15, Math.min(1440, Math.round(every))) };
  }
  if (capabilities.includes('tab')) {
    const t = m.tab || {};
    out.tab = { title: str(t.title || name, 20), titleZh: str(t.titleZh, 12) || undefined, icon: TAB_ICONS.includes(t.icon) ? t.icon : 'sparkle' };
  }
  if (capabilities.includes('widget')) {
    const w = m.widget || {};
    out.widget = { title: str(w.title || name, 30), titleZh: str(w.titleZh, 20) || undefined, height: Math.max(60, Math.min(420, Number(w.height) || 140)) };
  }
  if (capabilities.includes('automation')) out.automation = { runOn: 'open' };
  if (m.theme && typeof m.theme === 'object') {
    if (!capabilities.some((c) => ['theme', 'font', 'background'].includes(c))) errors.push('theme needs the theme, font or background capability');
    const th = { };
    const base = sanitizeTheme(m.theme, capabilities);
    Object.assign(th, base);
    if (m.theme.setting && m.theme.variants && typeof m.theme.variants === 'object') {
      const s = settings.find((x) => x.key === m.theme.setting && x.type === 'select');
      if (!s) errors.push('theme.setting must name a select setting');
      else {
        th.setting = s.key;
        th.variants = Object.fromEntries(s.options.filter((o) => m.theme.variants[o.value]).map((o) => [o.value, sanitizeTheme(m.theme.variants[o.value], capabilities)]));
      }
    }
    out.theme = th;
  }
  if (capabilities.some((c) => ['tab', 'widget', 'automation'].includes(c)) === false && !out.theme) errors.push('a look-only plugin needs a theme block');
  return { ok: errors.length === 0, errors, manifest: out };
}

// Whole bundle: manifest + code, with size limits.
export function validateBundle(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return { ok: false, errors: ['bundle must be an object'] };
  const v = validateManifest(b.manifest);
  errors.push(...v.errors);
  const html = String(b.html ?? ''); const css = String(b.css ?? ''); const js = String(b.js ?? '');
  const size = byteLen(JSON.stringify(v.manifest || {})) + byteLen(html) + byteLen(css) + byteLen(js);
  if (size > LIMITS.code) errors.push(`code is ${Math.round(size / 1024)} KB — limit ${LIMITS.code / 1024} KB`);
  const needsCode = (v.manifest?.capabilities || []).some((c) => ['tab', 'widget', 'automation'].includes(c));
  if (needsCode && !html.trim() && !js.trim()) errors.push('tab / widget / automation plugins need HTML or JS');
  return { ok: errors.length === 0, errors, bundle: { manifest: v.manifest, html, css, js }, size };
}

// The theme a manifest yields for these settings (variant overlay on the base).
export function themeFor(manifest, settings = {}) {
  const th = manifest?.theme;
  if (!th) return null;
  const vals = settingsValues(manifest, settings);
  const variant = th.setting ? th.variants?.[vals[th.setting]] : null;
  if (!variant) return { vars: { ...(th.vars || {}) }, font: th.font, headingFont: th.headingFont, background: th.background, scheme: th.scheme };
  return {
    vars: { ...(th.vars || {}), ...(variant.vars || {}) },
    font: variant.font || th.font, headingFont: variant.headingFont || th.headingFont,
    background: variant.background || th.background, scheme: variant.scheme || th.scheme,
  };
}

// Display helpers.
export const pName = (m, lang) => (lang !== 'en' && m?.nameZh) || m?.name || '';
export const pDesc = (m, lang) => (lang !== 'en' && m?.descriptionZh) || m?.description || '';
export const sLabel = (s, lang) => (lang !== 'en' && s?.labelZh) || s?.label || s?.key || '';
// Permissions newly requested by an update compared with what the user approved.
// Implied permissions (look / tab / widget / background / storage) are never "new"; revoked (denied) ones are not asked again.
export const newPermissions = (manifest, granted = [], denied = []) => (manifest?.permissions || []).filter((p) => !PERMS[p]?.implied && !granted.includes(p) && !denied.includes(p));
