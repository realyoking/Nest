// Run 14: the ONE language registry (pure — used by the app, the language pickers, seo/ prerender and api/ chat).
// Order = order in every language menu. `seg` = URL segment (/ja/, /pt-br/ …), `hreflang`/`html`/`og` for SEO,
// `flag` = id in src/lib/flag-svg.js, `label` = native name, `short` = compact chip text, `ai` = name used in the AI language rule.
// zh-Hant = Hong Kong standard written Chinese (書面語); zh-Hans is generated from zh-Hant. Every other language falls
// back to English for any string that has no translation (never to Chinese, never blank). RTL languages: not yet.
export const LANGS = [
  { id: 'en', seg: 'en', hreflang: 'en', html: 'en', og: 'en_US', flag: 'gb', label: 'English', short: 'EN', ai: 'English' },
  { id: 'zh-Hant', seg: 'zh-hant', hreflang: 'zh-Hant-HK', html: 'zh-Hant-HK', og: 'zh_HK', flag: 'hk', label: '繁體中文', short: '繁', ai: 'Traditional Chinese' },
  { id: 'zh-Hans', seg: 'zh-hans', hreflang: 'zh-Hans', html: 'zh-Hans', og: 'zh_CN', flag: 'cn', label: '简体中文', short: '简', ai: 'Simplified Chinese' },
  { id: 'ja', seg: 'ja', hreflang: 'ja', html: 'ja', og: 'ja_JP', flag: 'jp', label: '日本語', short: '日本語', ai: 'Japanese (日本語)' },
  { id: 'ko', seg: 'ko', hreflang: 'ko', html: 'ko', og: 'ko_KR', flag: 'kr', label: '한국어', short: '한국어', ai: 'Korean (한국어)' },
  { id: 'es', seg: 'es', hreflang: 'es', html: 'es', og: 'es_ES', flag: 'es', label: 'Español', short: 'ES', ai: 'Spanish (Español)' },
  { id: 'fr', seg: 'fr', hreflang: 'fr', html: 'fr', og: 'fr_FR', flag: 'fr', label: 'Français', short: 'FR', ai: 'French (Français)' },
  { id: 'de', seg: 'de', hreflang: 'de', html: 'de', og: 'de_DE', flag: 'de', label: 'Deutsch', short: 'DE', ai: 'German (Deutsch)' },
  { id: 'pt-BR', seg: 'pt-br', hreflang: 'pt-BR', html: 'pt-BR', og: 'pt_BR', flag: 'br', label: 'Português (Brasil)', short: 'PT', ai: 'Brazilian Portuguese (Português do Brasil)' },
  { id: 'id', seg: 'id', hreflang: 'id', html: 'id', og: 'id_ID', flag: 'id', label: 'Bahasa Indonesia', short: 'ID', ai: 'Indonesian (Bahasa Indonesia)' },
  { id: 'vi', seg: 'vi', hreflang: 'vi', html: 'vi', og: 'vi_VN', flag: 'vn', label: 'Tiếng Việt', short: 'VI', ai: 'Vietnamese (Tiếng Việt)' },
  { id: 'th', seg: 'th', hreflang: 'th', html: 'th', og: 'th_TH', flag: 'th', label: 'ไทย', short: 'ไทย', ai: 'Thai (ภาษาไทย)' },
];
export const LANG_IDS = LANGS.map((l) => l.id);
export const INTL = LANG_IDS.filter((l) => !['en', 'zh-Hant', 'zh-Hans'].includes(l)); // languages added in Run 14
export const isIntl = (l) => INTL.includes(l);
export const isZh = (l) => l === 'zh-Hant' || l === 'zh-Hans';
export const LBY = Object.fromEntries(LANGS.map((l) => [l.id, l]));
export const SEG = Object.fromEntries(LANGS.map((l) => [l.id, l.seg]));
export const SEG_LANG = Object.fromEntries(LANGS.map((l) => [l.seg, l.id]));
export const SEGS = LANGS.map((l) => l.seg);
export const SEG_RE_SRC = SEGS.map((s) => s.replace('-', '\\-')).join('|'); // for RegExp / vercel.json
// Browser languages → app language. zh-CN/SG/Hans → 简体; other zh → 繁體; pt-* → pt-BR; in → id (old code);
// any other supported prefix → that language; nothing matched → `fallback` (繁體: Hong Kong app).
export function detectLang(list = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [], fallback = 'zh-Hant') {
  for (const raw of list || []) {
    const l = String(raw || '').toLowerCase();
    if (!l) continue;
    if (/^zh-(hans|cn|sg|my)/.test(l)) return 'zh-Hans';
    if (/^zh/.test(l)) return 'zh-Hant';
    if (/^pt/.test(l)) return 'pt-BR';
    if (/^in(-|$)/.test(l)) return 'id';
    const p = l.split('-')[0];
    const hit = LANGS.find((x) => x.id.toLowerCase() === p);
    if (hit) return hit.id;
  }
  return fallback;
}
// Language from a URL path (/ja/…, /pt-br/…) or '' when the path is not localized.
const PATH_RE = new RegExp(`^/(${SEG_RE_SRC})(/|$)`, 'i');
export const pathLang = (p = typeof location !== 'undefined' ? location.pathname : '') => { const m = String(p).match(PATH_RE); return m ? SEG_LANG[m[1].toLowerCase()] : ''; };
// Accepts loose values ('ja-JP', 'pt', 'zh-CN', '简体') → a registry id, or undefined.
export function normLang(v) {
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  if (LANG_IDS.includes(s)) return s;
  if (/hans|zh-?(cn|sg)|简|簡體|simplified/i.test(s)) return 'zh-Hans';
  if (/^zh|中|繁|traditional/i.test(s)) return 'zh-Hant';
  const d = detectLang([s], '');
  return d || undefined;
}
