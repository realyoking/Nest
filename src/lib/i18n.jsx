import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { STRINGS } from './strings.js';
import { zhDateStyle } from './zhdate.js';
export { zhDateStyle };
import HANS from 'virtual:nest-zh-hans';

const I18n = createContext(null);
const KEY = 'nest.lang';

// Run 14: data-driven language registry (src/lib/langs.js) — every selector reads LANGS. flag = id in src/lib/flag-svg.js.
import { LANGS as REG, LANG_IDS as REG_IDS, isIntl, detectLang as detectReg, pathLang as pathReg, LBY } from './langs.js';
export const LANGS = REG.map((l) => ({ ...l, html: l.id === 'zh-Hant' ? 'zh-Hant' : l.html }));
export const LANG_IDS = REG_IDS;
export const langInfo = (id) => LANGS.find((l) => l.id === id) || LANGS.find((l) => l.id === 'zh-Hant');
// Browser default: zh-CN / zh-SG / zh-Hans → 简体; other zh → 繁體; a supported language (ja, ko, es, fr, de, pt, id, vi, th, en)
// → that language; otherwise 繁體 (Hong Kong app).
export const detectLang = (list) => detectReg(list);
// A localized URL (/en/, /zh-hant/, /ja/, /pt-br/ …) always shows that language (not saved until the user picks one).
export const pathLang = (p) => pathReg(p);
export const readLang = () => {
  const pl = pathLang(); if (pl) return pl;
  try { const v = localStorage.getItem(KEY); if (LANG_IDS.includes(v)) return v; } catch {}
  return detectLang();
};
// Run 14: the added languages ship their own partial dictionary (src/locales/<id>.js), loaded on demand. Any key it
// lacks falls back to English (never Chinese, never blank). main.jsx preloads the start language before the first render.
const LOCALES = import.meta.glob(['../locales/*.js', '!../locales/index.js']);
const loaded = {};
export function loadLocale(id) {
  if (!isIntl(id)) return Promise.resolve(null);
  if (loaded[id]) return Promise.resolve(loaded[id]);
  const imp = LOCALES[`../locales/${id}.js`];
  if (!imp) return Promise.resolve(null);
  return imp().then((m) => { loaded[id] = m.default || {}; return loaded[id]; }).catch(() => null);
}
export const localeLoaded = (id) => !isIntl(id) || !!loaded[id];
const dig = (o, path) => path.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
STRINGS['zh-Hans'] = HANS;

// `lang` keeps the legacy two-way meaning for content code ('en' | 'zh-Hant'); `uiLang` is the selected language
// ('zh-Hant' | 'zh-Hans' | 'en'). In 简体 mode t() reads the generated zh-Hans dictionary and any remaining inline
// zh-Hant text is converted by the DOM safety net (hans-dom.js, lazy).
export function I18nProvider({ children }) {
  const [uiLang, setLangState] = useState(readLang);
  const [, setTick] = useState(0);
  useEffect(() => { if (!localeLoaded(uiLang)) loadLocale(uiLang).then(() => setTick((n) => n + 1)); }, [uiLang]);
  // Legacy two-way `lang` for content code: Chinese UIs → 'zh-Hant', English and every added language → 'en'.
  const lang = uiLang === 'zh-Hant' || uiLang === 'zh-Hans' ? 'zh-Hant' : 'en';
  // Leaving 简体: text nodes the safety net rewrote are not re-rendered by React, so remount the tree once.
  const prev = useRef(uiLang); const gen = useRef(0);
  if (prev.current !== uiLang) { if (prev.current === 'zh-Hans') gen.current += 1; prev.current = uiLang; }
  useEffect(() => {
    document.documentElement.lang = langInfo(uiLang).html;
    document.documentElement.dataset.lang = uiLang;
    let off = null; let live = true;
    if (uiLang === 'zh-Hans') import('./hans-dom.js').then((m) => { if (live) off = m.startHansDom(); }).catch(() => {});
    return () => { live = false; off?.(); };
  }, [uiLang]);
  const value = useMemo(() => {
    const intl = isIntl(uiLang);
    const dict = intl ? loaded[uiLang] || {} : STRINGS[uiLang] || STRINGS['zh-Hant'];
    const t = (path, vars) => {
      let v = dig(dict, path);
      if (v == null && intl) v = dig(STRINGS.en, path);
      if (v == null) v = dig(STRINGS['zh-Hant'], path);
      if (typeof v === 'string' && vars) v = v.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
      return v ?? path;
    };
    const setLang = (l, { silent } = {}) => {
      const id = LANG_IDS.includes(l) ? l : 'zh-Hant';
      try { localStorage.setItem(KEY, id); } catch {}
      if (!localeLoaded(id)) loadLocale(id).then(() => setLangState(id)); else setLangState(id);
      if (!silent) window.dispatchEvent(new CustomEvent('nest:lang', { detail: id }));
    };
    // zh: 2026年10月18日（週日） — the weekday goes in full-width brackets (HK written style).
    const fmtDate = (d, opts = { month: 'short', day: 'numeric' }) =>
      d ? zhDateStyle(new Intl.DateTimeFormat(uiLang === 'en' ? 'en-HK' : uiLang === 'zh-Hans' ? 'zh-CN' : uiLang === 'zh-Hant' ? 'zh-HK' : LBY[uiLang]?.html || 'en-HK', { timeZone: 'Asia/Hong_Kong', ...opts }).format(d)) : '';
    return { lang, uiLang, setLang, t, fmtDate };
  }, [uiLang, intlReady(uiLang)]);
  return <I18n.Provider value={value}><Fragment key={gen.current}>{children}</Fragment></I18n.Provider>;
}
const intlReady = (id) => !!loaded[id];
export const useI18n = () => useContext(I18n);
// Language to send to the AI / server (no hook needed).
export const aiLang = () => readLang();
