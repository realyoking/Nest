// Run 16 — static, crawlable Privacy Policy + Terms (no JS needed) for Google OAuth verification and search engines.
// Written by buildSeo(): /privacy.html + /terms.html (English, canonical https://nesty.cyou/privacy|terms) and
// /<seg>/privacy.html + /<seg>/terms.html for all 12 languages. Body text exists in en, zh-Hant and zh-Hans (generated);
// the other 9 languages get their own nav/footer with the English text and a canonical to the English page.
import { SEO } from './config.js';
import { esc, LMAP, copyFor, css, header, footer, verificationMeta, socialTags, fmtDate } from './render.js';
import { AUTH_HEAD_SCRIPT } from '../src/lib/auth-hint.js';
import { hansDict } from '../src/lib/hans.js';
import { PRIVACY, TERMS, LEGAL_UPDATED } from '../src/data/legal.js';

export const LEGAL_KINDS = ['privacy', 'terms'];
export const LEGAL_LANGS = ['en', 'zh-Hant', 'zh-Hans']; // languages with their own legal text
const S = SEO.site;
const DOCS = { privacy: PRIVACY, terms: TERMS };

export function legalDoc(kind, lang) {
  const d = DOCS[kind];
  if (lang === 'zh-Hans') return hansDict(d['zh-Hant']);
  return d[lang] || d.en;
}
// Canonical URL of a legal page: English lives at the short URL (/privacy), zh at /<seg>/privacy, other langs → English.
export const legalUrl = (kind, lang) => (lang === 'zh-Hant' || lang === 'zh-Hans' ? `${S}/${LMAP[lang].seg}/${kind}` : `${S}/${kind}`);
// **bold** and [label](href) inside escaped text.
export function legalInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      const h = href.replace(/&amp;/g, '&');
      const ext = /^https?:/.test(h) && !h.startsWith(S);
      return `<a href="${esc(h)}"${ext ? ' rel="noopener" target="_blank"' : ''}>${label}</a>`;
    });
}
const LEGAL_CSS = `.legal-doc{max-width:760px}.legal-doc h1{font-size:clamp(32px,5vw,48px);margin-top:28px}.legal-doc .upd{color:var(--muted);font-weight:700;font-size:14px;margin:10px 0 0}.legal-doc .lead{margin:18px 0 0;max-width:none}
.legal-doc section{border-top:1px solid var(--line);margin-top:26px;padding-top:22px}.legal-doc h2{font-size:22px;margin:0 0 8px}.legal-doc p{margin:8px 0;color:var(--ink2)}.legal-doc a{text-decoration:underline;text-underline-offset:3px}.legal-doc .en-note{font-size:14px;color:var(--muted);border-left:3px solid var(--line);padding-left:12px;margin-top:18px}.legal-other{display:flex;gap:14px;flex-wrap:wrap;margin-top:28px;font-size:14px;font-weight:700}`;
const UPDATED = { en: 'Last updated', 'zh-Hant': '最後更新', 'zh-Hans': '最后更新' };

export function renderLegal(lang, kind) {
  const c = copyFor(lang);
  const L = LMAP[lang];
  const own = LEGAL_LANGS.includes(lang);
  const textLang = own ? lang : 'en';
  const D = legalDoc(kind, textLang);
  const url = legalUrl(kind, lang);
  // language menu: every language → its own /<seg>/<kind>; English → the short URL
  const altPaths = Object.fromEntries(Object.keys(LMAP).map((id) => [id, id === 'en' ? `/${kind}` : `/${LMAP[id].seg}/${kind}`]));
  const hreflang = [
    ...LEGAL_LANGS.map((id) => `<link rel="alternate" hreflang="${LMAP[id].hreflang}" href="${legalUrl(kind, id)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${S}/${kind}" />`,
  ].join('\n');
  const other = kind === 'privacy' ? 'terms' : 'privacy';
  const otherHref = textLang === 'en' ? `/${other}` : `/${L.seg}/${other}`;
  const desc = D.lead;
  const body = D.sections.map(([h, ps]) => `<section><h2>${esc(h)}</h2>${(Array.isArray(ps) ? ps : [ps]).map((p) => `<p>${legalInline(p)}</p>`).join('')}</section>`).join('\n');
  return `<!doctype html>
<html lang="${own ? L.html : 'en'}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(D.title)} — Nest</title>
${AUTH_HEAD_SCRIPT}
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
${hreflang}
<meta name="robots" content="index, follow" />
${verificationMeta()}
${socialTags({ url, title: `${D.title} — Nest`, description: desc, lang: textLang })}
<meta name="theme-color" content="#ffffff" />
<link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png?v=4" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4" sizes="180x180" />
<style>${css(lang)}${LEGAL_CSS}</style>
</head>
<body>
<a class="skip" href="#main">${esc(c.ui.skip)}</a>
${header(lang, null, c, altPaths)}
<main id="main" class="w"><article class="legal-doc"${own ? '' : ' lang="en"'}>
<h1>${esc(D.title)}</h1>
<p class="upd">${esc(UPDATED[textLang])}: <time datetime="${LEGAL_UPDATED}">${esc(fmtDate(LEGAL_UPDATED, textLang))}</time></p>
${own ? '' : '<p class="en-note">This document is available in English, Traditional Chinese and Simplified Chinese. The English version is shown.</p>'}
<p class="lead">${legalInline(D.lead)}</p>
${body}
<nav class="legal-other" aria-label="Legal"><a href="${otherHref}">${esc(legalDoc(other, textLang).title)}</a>${LEGAL_LANGS.filter((x) => x !== textLang).map((x) => `<a href="${x === 'en' ? `/${kind}` : `/${LMAP[x].seg}/${kind}`}" lang="${LMAP[x].html}">${esc(legalDoc(kind, x).title)} (${esc(LMAP[x].label)})</a>`).join('')}</nav>
</article></main>
${footer(lang, c)}
</body>
</html>
`;
}
