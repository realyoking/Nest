// Run 11: the ONE public site nav, shared by the React landing (PublicNav) and the static pages (seo/build.js keeps the
// same keys in seo/config.js NAV). Language homes: /en/ · /zh-hant/ · /zh-hans/ ('/' = x-default, language from the
// saved choice / browser). Sub-pages are the static, pre-rendered pages under each language.
export const SITE_NAV = ['demo', 'features', 'pricing', 'faq', 'plugins', 'changelog', 'blog', 'status'];
export const FOOT_NAV = ['features', 'pricing', 'faq', 'plugins', 'changelog', 'blog', 'status'];
// Run 14: segments come from the language registry (12 languages: /en/ /zh-hant/ /zh-hans/ /ja/ /ko/ /es/ /fr/ /de/ /pt-br/ /id/ /vi/ /th/).
import { SEG, SEG_LANG, SEG_RE_SRC } from './langs.js';
import { subsiteUrl } from '../site.js';
export { SEG, SEG_LANG };
const LOCAL_RE = new RegExp(`^/(${SEG_RE_SRC})(/.*)?$`, 'i');
export const isLocalHome = (p) => p === '/' || new RegExp(`^/(${SEG_RE_SRC})/?$`, 'i').test(String(p || ''));
export const homePath = (lang) => `/${SEG[lang] || 'zh-hant'}/`;
// Run 18: blog / changelog / status → their own hosts (absolute URLs).
export const navHref = (lang, k) => (k === 'demo' ? `${homePath(lang)}#demo` : subsiteUrl(SEG[lang] || 'zh-hant', k) || `/${SEG[lang] || 'zh-hant'}/${k}`);
// Language-switch target for the current path: localized home for '/' and language homes, the same static page otherwise.
export function switchHref(pathname, lang) {
  const m = String(pathname || '/').match(LOCAL_RE);
  const rest = m ? (m[2] || '/').replace(/^\//, '') : '';
  if (m && /^blog\/./.test(rest)) return subsiteUrl(SEG[lang], 'blog'); // posts exist only in their own languages
  if (m && rest) return `/${SEG[lang]}/${rest}`;
  if (pathname === '/pricing') return `/${SEG[lang]}/pricing`;
  return homePath(lang);
}
