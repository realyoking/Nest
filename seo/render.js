// Renderers for the public pages + crawler files (NO node:fs — also bundled into the Edge function api/ops.js for the
// dynamic blog / sitemap / llms.txt, Run 12). seo/build.js re-exports everything and adds buildSeo(). Called by the `nest-seo` Vite plugin (vite.config.js) after `vite build`,
// so Vercel's remote build generates everything — no generated file is uploaded (deploy upload cap).
// Output (dist/):
//   index.html            root "/" = x-default: SPA shell + static zh-Hant/English landing inside #root (React replaces it)
//   spa.html              the plain SPA shell (vercel.json catch-all → /spa.html), noindex
//   <seg>/index.html, <seg>/<page>.html, <seg>/compare/<slug>.html   static pages, no JS
//   robots.txt, sitemap.xml, llms.txt, llms-full.txt, <indexNowKey>.txt, verification files
import { SEO, LANGS, PAGES, POSTS, NAV, FOOT_NAV, POST_LANGS } from './config.js';
import { isZh, isIntl } from '../src/lib/langs.js';
import { flagUse, flagSprite } from '../src/lib/flag-svg.js';
import APP_LOCALES from '../src/locales/index.js';
import { COPY, PLUGINS } from './content.js';
import { PLANS, PLAN_ORDER } from '../src/lib/plans.js';
import { CHANGELOG } from '../src/data/changelog.js';
import { STRINGS } from '../src/lib/strings.js';
import { hansDict, toHans } from '../src/lib/hans.js';
import { AUTH_HEAD_SCRIPT, AUTH_CTA_CSS } from '../src/lib/auth-hint.js';
import { subsiteUrl, STATUS_ORIGIN } from '../src/site.js';
import { heroArtHtml, appShot, HERO_IMG, pictureHtml, SHOT_SIZES, LP_THEME_HEAD_SCRIPT } from '../src/lib/hero-art.js';

const S = SEO.site;
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const LMAP = Object.fromEntries(LANGS.map((l) => [l.id, l]));

// ---------- copy per language (zh-Hans generated) ----------
export function copyFor(lang) {
  if (lang === 'zh-Hans') return hansDict(COPY['zh-Hant']);
  return COPY[lang];
}
const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
const deep = (a, b) => { if (!isObj(b)) return b === undefined ? a : b; const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = isObj(v) && isObj(a?.[k]) ? deep(a[k], v) : v; return o; };
const appCache = {};
// Run 14: added languages = English app strings + that language's partial dictionary (src/locales/<id>.js).
export const appStrings = (lang) => (lang === 'zh-Hans' ? hansDict(STRINGS['zh-Hant']) : isIntl(lang) ? (appCache[lang] ||= deep(STRINGS.en, APP_LOCALES[lang] || {})) : STRINGS[lang]);
// Pages that exist in a language: blog posts only in their written languages (POST_LANGS), everything else in all 12.
export const langsFor = (page) => (POSTS.includes(page) ? LANGS.filter((l) => POST_LANGS.includes(l.id)) : LANGS);

// ---------- URLs ----------
// Run 18: blog + changelog live on their own hosts → pagePath returns an ABSOLUTE url for them (src/site.js subsiteUrl).
export const pagePath = (lang, page) => subsiteUrl(LMAP[lang].seg, page) || `/${LMAP[lang].seg}/${page}`; // page '' → /en/
export const pageUrl = (lang, page) => { const p = pagePath(lang, page); return /^https?:/.test(p) ? p : S + p; };
// Run 18: pages served on a sub-site host (blog./changelog.) must not use host-relative links to main-site pages.
export const absolutize = (html) => String(html).replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${S}/`);
export function alternates(page) {
  const out = langsFor(page).map((l) => ({ hreflang: l.hreflang, href: pageUrl(l.id, page) }));
  out.push({ hreflang: 'x-default', href: page === '' ? `${S}/` : pageUrl('en', page) });
  return out;
}
export function allUrls() {
  const urls = [`${S}/`];
  for (const l of LANGS) for (const p of PAGES) if (langsFor(p).includes(l)) urls.push(pageUrl(l.id, p));
  return urls;
}
export const latestDate = () => [CHANGELOG[0]?.date || SEO.updated, SEO.updated].sort().pop();
const lastmodOf = (page) => (page === '' || page === 'changelog' ? latestDate() : COPY.en.pages[page]?.date || SEO.updated);

// ---------- inline text ----------
export function inline(s, lang) {
  let out = esc(s);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    let h = href.replace(/&amp;/g, '&');
    if (h.startsWith('@')) h = pagePath(lang, h.slice(1));
    const ext = /^https?:/.test(h) && !h.startsWith(S) && !/^https:\/\/(blog|changelog|status)\.nesty\.cyou/.test(h);
    return `<a href="${esc(h)}"${ext ? ' rel="noopener"' : ''}>${label}</a>`;
  });
  // bare URLs (notes / facts) that are not already inside an <a>
  out = out.replace(/(^|[\s（(，,])(https:\/\/[^\s<）),，]+)/g, (_, pre, u) => `${pre}<a href="${u}"${u.startsWith(S) ? '' : ' rel="noopener"'}>${u.replace(/^https:\/\//, '')}</a>`);
  return out;
}
export const fmtDate = (iso, lang) => {
  const [y, m, d] = iso.split('-').map(Number);
  if (isIntl(lang)) { try { return new Intl.DateTimeFormat(LMAP[lang].html, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, d)); } catch { /* fall through to English */ } }
  if (lang === 'en' || isIntl(lang)) return `${d} ${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1]} ${y}`;
  return `${y}年${m}月${d}日`;
};

// ---------- section renderers ----------
function plansHtml(lang, ui) {
  const st = appStrings(lang).pricing;
  return `<div class="plans">${PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    const price = p.monthly ? `HK$${p.monthly}<small>${esc(ui.perMonth)}</small>` : `HK$0`;
    return `<article class="plan${id === 'free' ? ' plan-on' : ''}"><h3>${esc(st.names[id])}</h3><p class="muted">${esc(st.desc[id])}</p>
<p class="price">${price}</p>${p.monthly ? `<p class="muted small">${esc(ui.yearly.replace('{y}', p.yearly))}</p>` : '<p class="muted small">&nbsp;</p>'}
<ul><li>${esc(ui.aiDay.replace('{d}', p.daily.toLocaleString('en-US')).replace('{w}', p.weekly.toLocaleString('en-US')))}</li><li>${esc(ui.members.replace('{n}', p.members))}</li>${st.features[id].map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
<p class="tag">${esc(id === 'free' ? ui.available : ui.comingSoon)}</p></article>`;
  }).join('')}</div>`;
}
function pluginsHtml(lang, ui) {
  const zh = isZh(lang);
  const loc = (id) => copyFor(lang).plugins?.[id] || null; // Run 14: optional [name, description] per added language
  return `<div class="cards">${PLUGINS.map((p) => {
    const name = zh ? (lang === 'zh-Hans' ? toHans(p.nameZh) : p.nameZh) : loc(p.id)?.[0] || p.name;
    const d = zh ? (lang === 'zh-Hans' ? toHans(p.zh) : p.zh) : loc(p.id)?.[1] || p.en;
    return `<article class="card"><img src="/plugins/${p.id}/icon.svg" alt="" width="40" height="40" loading="lazy" decoding="async"><h3>${esc(name)}</h3><p class="muted small">${esc(ui.category[p.category] || p.category)}</p><p>${esc(d)}</p></article>`;
  }).join('')}</div>`;
}
function changelogHtml(lang, ui) {
  return (isIntl(lang) && ui.changelogNote ? `<p class="note">${esc(ui.changelogNote)}</p>\n` : '') + CHANGELOG.map((e) => {
    const c = e[lang] || (isIntl(lang) ? e.en : e['zh-Hant']);
    return `<section class="sec log" id="v${esc(e.version.replace(/\./g, '-'))}"><h2>${esc(c.title)}</h2><p class="muted small">${esc(ui.version)} ${esc(e.version)} · <time datetime="${e.date}">${esc(fmtDate(e.date, lang))}</time></p><ul>${c.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`;
  }).join('\n');
}
function postsHtml(lang, ui) {
  const c = copyFor(lang);
  return `<div class="cards posts">${POSTS.map((id) => { const P = c.pages[id]; return `<article class="card"><p class="muted small"><time datetime="${P.date}">${esc(fmtDate(P.date, lang))}</time></p><h3><a href="${pagePath(lang, id)}">${esc(P.h1)}</a></h3><p>${esc(P.description)}</p><p class="small"><a href="${pagePath(lang, id)}">${esc(ui.readMore)} →</a></p></article>`; }).join('')}</div>`;
}
function sectionHtml(sec, lang, ui) {
  if (sec.changelog) return changelogHtml(lang, ui);
  if (sec.posts) return `<section class="sec">${postsHtml(lang, ui)}</section>`;
  const parts = [];
  if (sec.h) parts.push(`<h2>${esc(sec.h)}</h2>`);
  if (sec.img) {
    const f = `/shots/${sec.img.name}-${isZh(lang) ? 'zh' : 'en'}.png`;
    parts.push(`<figure class="shot"><img src="${f}" alt="${esc(sec.img.alt)}" width="1023" height="720" loading="lazy" decoding="async"></figure>`);
  }
  for (const p of [].concat(sec.p || [])) parts.push(`<p>${inline(p, lang)}</p>`);
  if (sec.ul) parts.push(`<ul>${sec.ul.map((x) => `<li>${inline(x, lang)}</li>`).join('')}</ul>`);
  if (sec.cards) parts.push(`<div class="cards">${sec.cards.map(([t, d]) => `<article class="card"><h3>${esc(t)}</h3><p>${inline(d, lang)}</p></article>`).join('')}</div>`);
  if (sec.steps) parts.push(`<ol class="steps">${sec.steps.map(([t, d]) => `<li><h3>${esc(t)}</h3><p>${inline(d, lang)}</p></li>`).join('')}</ol>`);
  if (sec.facts) parts.push(`<dl class="facts">${sec.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${inline(v, lang)}</dd></div>`).join('')}</dl>`);
  if (sec.table) parts.push(`<div class="tbl"><table><thead><tr>${sec.table.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${sec.table.rows.map((r) => `<tr><th scope="row">${esc(r[0])}</th>${r.slice(1).map((c) => `<td>${inline(c, lang)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  if (sec.faq) parts.push(`<div class="faq">${sec.faq.map(([q, a]) => `<details open><summary><h3>${esc(q)}</h3></summary><p>${inline(a, lang)}</p></details>`).join('')}</div>`);
  if (sec.plans) parts.push(plansHtml(lang, ui));
  if (sec.plugins) parts.push(pluginsHtml(lang, ui));
  if (sec.note) parts.push(`<p class="note">${inline(sec.note, lang)}</p>`);
  return `<section class="sec">${parts.join('\n')}</section>`;
}

// ---------- JSON-LD ----------
export function jsonLd(lang, page, c) {
  const P = c.pages[page];
  const url = page === null ? `${S}/` : pageUrl(lang, page);
  const L = LMAP[lang];
  const org = { '@type': 'Organization', '@id': `${S}/#org`, name: 'Nest', alternateName: 'Nest 巢', url: `${S}/`, logo: { '@type': 'ImageObject', url: `${S}/icon-512.png`, width: 512, height: 512 },
    email: SEO.contactEmail, contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: SEO.contactEmail, availableLanguage: LANGS.map((l) => l.hreflang) }, areaServed: 'Worldwide' };
  const site = { '@type': 'WebSite', '@id': `${S}/#website`, url: `${S}/`, name: 'Nest', alternateName: 'Nest 巢', publisher: { '@id': `${S}/#org` }, inLanguage: LANGS.map((l) => l.hreflang) };
  const app = { '@type': 'WebApplication', '@id': `${S}/#app`, name: 'Nest', alternateName: 'Nest 巢', url: `${S}/`, applicationCategory: 'EducationalApplication', applicationSubCategory: 'Family organiser and homework tutor',
    operatingSystem: 'Web, iOS, iPadOS, Android, Windows, macOS', browserRequirements: 'Requires JavaScript and a modern browser', inLanguage: LANGS.map((l) => l.hreflang),
    description: COPY.en.pages[''].lead, image: S + SEO.ogImage, publisher: { '@id': `${S}/#org` },
    featureList: COPY.en.pages[''].sections[0].cards.map(([t]) => t),
    offers: { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'HKD', availability: 'https://schema.org/InStock', url: pageUrl('en', 'pricing') } };
  const webpage = { '@type': page === 'faq' ? ['WebPage', 'FAQPage'] : 'WebPage', '@id': `${url}#webpage`, url, name: P.title, description: P.description, inLanguage: L.html,
    isPartOf: { '@id': `${S}/#website` }, about: { '@id': `${S}/#app` }, primaryImageOfPage: { '@type': 'ImageObject', url: S + SEO.ogImage }, dateModified: lastmodOf(page || '') };
  const graph = [org, site, app, webpage];
  if (page) {
    const crumbs = [{ name: c.ui.home, item: pageUrl(lang, '') }];
    if (page.startsWith('blog/')) crumbs.push({ name: c.ui.blog, item: pageUrl(lang, 'blog') });
    crumbs.push({ name: P.h1, item: url });
    graph.push({ '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: crumbs.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, ...(x.item ? { item: x.item } : {}) })) });
    webpage.breadcrumb = { '@id': `${url}#breadcrumb` };
  }
  if (page && page.startsWith('blog/')) {
    webpage.mainEntity = { '@id': `${url}#post` };
    graph.push({ '@type': 'BlogPosting', '@id': `${url}#post`, headline: P.h1, description: P.description, inLanguage: L.html, url, mainEntityOfPage: { '@id': `${url}#webpage` },
      datePublished: P.date, dateModified: P.date, author: { '@id': `${S}/#org` }, publisher: { '@id': `${S}/#org` }, image: S + SEO.ogImage, isPartOf: { '@id': `${pageUrl(lang, 'blog')}#blog` } });
  }
  if (page === 'blog') {
    webpage['@type'] = ['WebPage', 'CollectionPage'];
    graph.push({ '@type': 'Blog', '@id': `${url}#blog`, name: `Nest — ${P.h1}`, url, inLanguage: L.html, publisher: { '@id': `${S}/#org` },
      blogPost: POSTS.map((id) => ({ '@type': 'BlogPosting', headline: c.pages[id].h1, url: pageUrl(lang, id), datePublished: c.pages[id].date })) });
  }
  if (page === 'faq') {
    const qa = P.sections.flatMap((s) => s.faq || []);
    webpage.mainEntity = qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') } }));
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
export const ldTag = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;

// ---------- head pieces ----------
export function verificationMeta() {
  const m = [];
  for (const g of [].concat(SEO.googleSiteVerification || []).filter(Boolean)) m.push(`<meta name="google-site-verification" content="${esc(g)}" />`);
  if (SEO.bingMsvalidate) m.push(`<meta name="msvalidate.01" content="${esc(SEO.bingMsvalidate)}" />`);
  return m.join('\n    ');
}
const hreflangTags = (page) => alternates(page).map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n');
export function socialTags({ url, title, description, lang, type = 'website', published = '', image = '', imageType = 'image/png', imageAlt = '' }) {
  const L = LMAP[lang];
  const img = image || S + SEO.ogImage;
  return [
    `<meta property="og:type" content="${type}" />`, ...(published ? [`<meta property="article:published_time" content="${published}" />`] : []), `<meta property="og:site_name" content="Nest" />`, `<meta property="og:locale" content="${L.og}" />`,
    ...LANGS.filter((x) => x.id !== lang).map((x) => `<meta property="og:locale:alternate" content="${x.og}" />`),
    `<meta property="og:url" content="${url}" />`, `<meta property="og:title" content="${esc(title)}" />`, `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:image" content="${img}" />`, `<meta property="og:image:secure_url" content="${img}" />`, `<meta property="og:image:type" content="${imageType}" />`,
    `<meta property="og:image:width" content="1200" />`, `<meta property="og:image:height" content="630" />`, `<meta property="og:image:alt" content="${esc(imageAlt || SEO.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`, `<meta name="twitter:title" content="${esc(title)}" />`, `<meta name="twitter:description" content="${esc(description)}" />`,
    `<meta name="twitter:image" content="${img}" />`, `<meta name="twitter:image:alt" content="${esc(imageAlt || SEO.ogImageAlt)}" />`,
  ].join('\n');
}

const MARK = '<svg width="26" height="26" viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><path d="M32 8c-7.6 0-12.5 9.6-12.5 17.6C19.5 33 25 38 32 38s12.5-5 12.5-12.4C44.5 17.6 39.6 8 32 8z"/><path d="M7 34.5c0-1.4 1.1-2.5 2.5-2.5 2.6 0 4.3 2 6 4.6C18.6 41.3 24 44 32 44s13.4-2.7 16.5-7.4c1.7-2.6 3.4-4.6 6-4.6 1.4 0 2.5 1.1 2.5 2.5C57 47 46 56 32 56S7 47 7 34.5z"/></svg>';

// Run 11 (one design): the static pages use the landing's look — white page, the same top nav (示範 · 功能 · 價格 · 常見問題 ·
// 插件 · 更新日誌 · 網誌), the same EN / 繁 / 简 language switch (links to the localized URL) and ONE call to action.
// Light only, like the landing. System fonts (Nunito first if installed), no web fonts, no JS (mobile menu = <details>).
const FONT = {
  en: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang HK","Noto Sans TC",sans-serif',
  'zh-Hant': '-apple-system,BlinkMacSystemFont,"PingFang HK","PingFang TC","Noto Sans TC","Microsoft JhengHei","Segoe UI",Roboto,Arial,sans-serif',
  'zh-Hans': '-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans SC","Microsoft YaHei","Segoe UI",Roboto,Arial,sans-serif',
  ja: '-apple-system,BlinkMacSystemFont,"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic UI",Meiryo,"Segoe UI",Roboto,Arial,sans-serif',
  ko: '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic","Segoe UI",Roboto,Arial,sans-serif',
  th: '-apple-system,BlinkMacSystemFont,"Thonburi","Noto Sans Thai","Leelawadee UI","Segoe UI",Roboto,Arial,sans-serif',
};
const fontFor = (lang) => FONT[lang] || FONT.en;
export const css = (lang) => `:root{--ink:#0a0a0a;--ink2:#3a3a3a;--muted:#767676;--line:#ebebeb;--soft:#f5f5f5;--bg:#fff;--on:#fff;color-scheme:light}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Nunito,${fontFor(lang)};-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit}img{max-width:100%;height:auto}.w{max-width:1180px;margin:0 auto;padding:0 24px}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:var(--bg);padding:8px 12px;z-index:9}
${NAV_CSS}
main{padding-bottom:40px}.crumbs{font-size:14px;color:var(--muted);padding-top:22px}.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.crumbs li+li:before{content:"›";margin-right:6px}
.hero{padding:72px 0 28px;text-align:center}.hero.sub{text-align:left;padding:32px 0 8px}.eyebrow{font-weight:800;font-size:14px;color:var(--muted)}
h1{font-size:clamp(36px,6vw,64px);line-height:1.08;letter-spacing:-.035em;margin:12px 0 0;font-weight:900}.hero.sub h1{font-size:clamp(32px,5vw,48px)}
.lead{font-size:clamp(17px,2vw,20px);color:var(--muted);max-width:720px;margin:20px auto 0;font-weight:600}.hero.sub .lead{margin-left:0}.cta{display:flex;gap:10px;justify-content:center;margin-top:28px;flex-wrap:wrap}.hero.sub .cta{justify-content:flex-start}
.btn{display:inline-flex;align-items:center;justify-content:center;height:48px;padding:0 24px;border-radius:999px;font-weight:800;text-decoration:none;background:var(--ink);color:var(--on);white-space:nowrap}.btn.o{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
h2{font-size:clamp(24px,3.2vw,32px);letter-spacing:-.025em;line-height:1.2;margin:0 0 14px}h3{font-size:18px;margin:0 0 6px;line-height:1.35}
.sec{padding:36px 0 8px;border-top:1px solid var(--line);margin-top:28px}.sec ul{padding-left:20px}.sec li{margin:6px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:14px}.card{border:1px solid var(--line);border-radius:20px;padding:18px;background:var(--bg)}.card p{margin:0}.card img{display:block;margin-bottom:10px;border-radius:10px}.posts .card h3 a{text-decoration:none}.posts .card p+p{margin-top:8px}
.steps{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px;counter-reset:s}.steps li{border:1px solid var(--line);border-radius:20px;padding:18px;counter-increment:s}.steps li:before{content:counter(s);display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--ink);color:var(--on);font-weight:800;margin-bottom:8px}.steps p{margin:0}
.facts{display:grid;gap:0;margin:0;border:1px solid var(--line);border-radius:20px;overflow:hidden}.facts div{display:grid;grid-template-columns:minmax(110px,30%) 1fr;gap:12px;padding:12px 16px}.facts div+div{border-top:1px solid var(--line)}.facts dt{font-weight:800}.facts dd{margin:0;color:var(--ink2)}
.shot{margin:4px 0 16px}.shot img{border-radius:16px;border:1px solid var(--line)}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:16px}table{border-collapse:collapse;width:100%;min-width:560px;font-size:15px}th,td{text-align:left;vertical-align:top;padding:12px 14px;border-bottom:1px solid var(--line)}thead th{background:var(--soft)}tbody tr:last-child>*{border-bottom:0}
.faq details{border-bottom:1px solid var(--line);padding:14px 0}.faq summary{cursor:pointer;list-style:none}.faq summary::-webkit-details-marker{display:none}.faq summary h3{display:inline;font-size:17px}.faq p{margin:8px 0 0;color:var(--ink2)}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:14px}.plan{border:1px solid var(--line);border-radius:20px;padding:22px}.plan-on{border:2px solid var(--ink)}.plan h3{font-size:20px}.price{font-size:34px;font-weight:900;margin:10px 0 0;letter-spacing:-.02em}.price small{font-size:15px;font-weight:600;color:var(--muted)}.plan ul{padding-left:18px;margin:14px 0}.tag{display:inline-block;font-size:13px;font-weight:800;background:var(--soft);border-radius:999px;padding:4px 10px;margin:0}
.muted{color:var(--muted)}.small{font-size:14px;margin:4px 0}.note{font-size:14px;color:var(--muted);border-left:3px solid var(--line);padding-left:12px}.log h2{font-size:22px;margin-bottom:2px}.pub{color:var(--muted);font-weight:700;font-size:14px;margin:14px 0 0}
${FOOT_CSS}`;
// Shared by the static pages and the landing's pre-rendered block (same class names as src/styles.css .snav-*).
const NAV_CSS_CORE = `.snav{position:sticky;top:0;z-index:50;background:var(--bg,#fff);border-bottom:1px solid var(--line)}.snav-in{height:68px;display:flex;align-items:center;gap:16px;max-width:1180px;margin:0 auto;padding:0 24px}
.snav-logo{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:22px;letter-spacing:-.03em;text-decoration:none;color:var(--ink)}.snav-logo em{font-style:normal;font-size:18px;margin-left:2px}
.snav-links{display:flex;gap:2px;margin-left:8px;min-width:0}.snav-links a{padding:8px 8px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14.5px;color:var(--ink2);white-space:nowrap}.snav-links a:hover,.snav-links a[aria-current]{background:var(--soft);color:var(--ink)}
.snav-right{margin-left:auto;display:flex;align-items:center;gap:8px;min-width:0}.lang{position:relative;flex:none}.lang>summary{list-style:none;cursor:pointer}.lang>summary::-webkit-details-marker{display:none}.lang-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 10px;border-radius:999px;background:var(--soft);font-weight:800;font-size:14px;color:var(--ink2);white-space:nowrap;line-height:1}.lang-btn .flag,.lang-menu .flag,.snav-langs-g .flag{flex:none;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,.08)}.lang-chev{font-size:10px;opacity:.7}.lang-short{display:none}
.lang-menu{position:absolute;right:0;top:calc(100% + 6px);background:var(--surface,var(--bg,#fff));color:var(--ink);color-scheme:inherit;border:1px solid var(--line);border-radius:16px;padding:6px;min-width:200px;max-width:calc(100vw - 24px);max-height:min(70vh,520px);overflow-y:auto;box-shadow:0 12px 32px rgba(0,0,0,.08);z-index:70}.lang-menu a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;color:var(--ink);white-space:nowrap}.lang-menu a:hover,.lang-menu a[aria-current]{background:var(--soft)}.lang-menu a span{flex:1}.lang-menu a[aria-current]:after{content:"✓";font-weight:900}
.snav-langs{margin-top:22px;padding-top:16px;border-top:1px solid var(--line)}.snav-langs-h{display:block;font-size:13px;font-weight:800;color:var(--muted);margin-bottom:8px}.snav-langs-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 10px}.snav-panel .snav-langs-g a{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;letter-spacing:0;padding:8px 8px;border-radius:10px;color:var(--ink2);min-width:0}.snav-panel .snav-langs-g a span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.snav-panel .snav-langs-g a[aria-current]{background:var(--soft);color:var(--ink)}
@media (max-width:640px){.lang-long{display:none}.lang-short{display:inline}.lang-btn{gap:6px;padding:0 9px}}
.snav-cta{display:inline-flex;align-items:center;height:38px;padding:0 18px;border-radius:999px;background:var(--ink);color:var(--on-ink,var(--on,#fff));font-weight:800;font-size:14px;text-decoration:none;white-space:nowrap}
.snav-mm{display:none;position:relative}.snav-mm summary{list-style:none;cursor:pointer;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:20px;font-weight:900}.snav-mm summary::-webkit-details-marker{display:none}
.snav-mm[open] .snav-panel,.snav-panel.open{display:flex}.snav-panel{display:none;position:fixed;left:0;right:0;top:68px;bottom:0;background:var(--bg,#fff);flex-direction:column;gap:2px;padding:20px 24px;overflow-y:auto;z-index:60}.snav-panel a{font-size:24px;font-weight:900;letter-spacing:-.02em;padding:10px 0;text-decoration:none;color:var(--ink)}.snav-panel .snav-cta,.snav-panel a.snav-cta{margin-top:16px;height:52px;font-size:17px;justify-content:center;color:var(--on-ink,var(--on,#fff))}
@media (max-width:1180px){.snav-links{display:none}.snav-mm{display:block}}@media (max-width:420px){.snav-right>.snav-cta{display:none}.snav-in{gap:8px;padding:0 16px}}`;
const NAV_CSS = `${AUTH_CTA_CSS}${NAV_CSS_CORE}`;
// Run 28: the landing's pre-rendered block puts its CSS in an inline <style> AFTER the app stylesheet, so any unscoped
// rule here beat the React UI's own rules of equal specificity (the hard-coded white .lang-menu showed up behind the
// night theme's near-white text). Prefix every selector with #seo so the static CSS can only style the static block.
export function scopeCss(cssText, scope) {
  let out = ''; let i = 0;
  while (i < cssText.length) {
    const open = cssText.indexOf('{', i);
    if (open < 0) { out += cssText.slice(i); break; }
    const head = cssText.slice(i, open).trim();
    if (head.startsWith('@')) {
      let depth = 1; let j = open + 1;
      while (j < cssText.length && depth) { if (cssText[j] === '{') depth++; else if (cssText[j] === '}') depth--; j++; }
      out += `${head}{${scopeCss(cssText.slice(open + 1, j - 1), scope)}}`; i = j; continue;
    }
    const close = cssText.indexOf('}', open);
    const sel = head.split(',').map((x) => x.trim()).filter(Boolean).map((x) => (/^(html|:root)\b/.test(x) ? x.replace(/^((?:html|:root)\S*)/, `$1 ${scope}`) : `${scope} ${x}`)).join(',');
    out += `${sel}{${cssText.slice(open + 1, close)}}`; i = close + 1;
  }
  return out;
}
const FOOT_CSS = `.sfoot{border-top:1px solid var(--line);margin-top:40px;padding:32px 0 44px;font-size:14px;color:var(--muted)}.sfoot-in{display:flex;flex-wrap:wrap;gap:12px 22px;align-items:center;max-width:1180px;margin:0 auto;padding:0 24px}.sfoot nav{display:flex;flex-wrap:wrap;gap:8px 18px;margin-left:auto}.sfoot a{text-decoration:none}.sfoot a:hover{color:var(--ink)}.sfoot-badge{display:inline-block;max-width:244px;line-height:0;border-radius:12px;opacity:.92;transition:opacity .15s}.sfoot-badge:hover{opacity:1}.sfoot-badge img{display:block;max-width:100%;height:auto}`;
// Run 12: auth-aware primary CTA — both variants in the HTML, <html data-auth> (AUTH_HEAD_SCRIPT) picks one with CSS.
export const ctaPair = (cls, u) => `<a class="${cls} cta-out" href="/auth?mode=up">${esc(u.start)}</a><a class="${cls} cta-in" href="/app">${esc(u.openApp)}</a>`;
export const navHref = (lang, k) => (k === 'demo' ? `${pagePath(lang, '')}#demo` : pagePath(lang, k));
// The one nav. `page` = current page key ('' home) for aria-current and the language switch target.
export function header(lang, page, c, altPaths = null) {
  const u = c.ui;
  const cur = (k) => (k === page || (k === 'blog' && String(page).startsWith('blog/')) ? ' aria-current="page"' : '');
  const links = NAV.map((k) => `<a href="${navHref(lang, k)}"${cur(k)}>${esc(u.nav[k])}</a>`).join('');
  const target = page == null ? '' : page;
  return `<header class="snav"><div class="snav-in"><a class="snav-logo" href="${pagePath(lang, '')}" aria-label="Nest">${MARK}<span>Nest${isZh(lang) ? '<em>巢</em>' : ''}</span></a>
<nav class="snav-links" aria-label="Main">${links}</nav>
<div class="snav-right">${langMenu(lang, target, altPaths, u)}
${ctaPair('snav-cta', u)}
<details class="snav-mm"><summary aria-label="${esc(u.menu)}">☰</summary><div class="snav-panel">${links}${ctaPair('snav-cta', u)}${langList(lang, target, altPaths, u)}</div></details></div></div></header>${LANG_SAVE_SCRIPT}`;
}
// Run 14: the ONE language dropdown on static pages (no framework): <details> with flag + native name; options are links
// to the same page in that language (blog posts → that language's blog index when not translated). LANG_SAVE_SCRIPT saves
// the pick (localStorage nest.lang, same key as the app) and closes the menu on outside click / Escape.
const langHref = (l, target, altPaths) => altPaths?.[l.id] || (langsFor(target).includes(l) ? pagePath(l.id, target) : pagePath(l.id, String(target).startsWith('blog') ? 'blog' : ''));
export function langMenu(lang, target, altPaths, u) {
  const L = LMAP[lang];
  return `${flagSprite(LANGS.map((l) => l.flag))}<details class="lang" data-lang-menu><summary class="lang-btn" aria-label="${esc(u.language)}: ${esc(L.label)}">${flagUse(L.flag, 13)}<span class="lang-long">${esc(L.label)}</span><span class="lang-short">${esc(L.short)}</span><span class="lang-chev" aria-hidden="true">▼</span></summary><div class="lang-menu" role="menu">${LANGS.map((l) => `<a role="menuitemradio" aria-checked="${l.id === lang}" href="${langHref(l, target, altPaths)}" hreflang="${l.hreflang}" lang="${l.html}" data-setlang="${l.id}"${l.id === lang ? ' aria-current="true"' : ''}>${flagUse(l.flag, 13)}<span>${esc(l.label)}</span></a>`).join('')}</div></details>`;
}
function langList(lang, target, altPaths, u) {
  return `<div class="snav-langs" role="group" aria-label="${esc(u.language)}"><span class="snav-langs-h">${esc(u.language)}</span><div class="snav-langs-g">${LANGS.map((l) => `<a href="${langHref(l, target, altPaths)}" hreflang="${l.hreflang}" lang="${l.html}" data-setlang="${l.id}"${l.id === lang ? ' aria-current="true"' : ''}>${flagUse(l.flag, 12)}<span>${esc(l.label)}</span></a>`).join('')}</div></div>`;
}
export const LANG_SAVE_SCRIPT = `<script>(function(){document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-setlang]');if(a){try{localStorage.setItem('nest.lang',a.getAttribute('data-setlang'))}catch(x){}}var d=document.querySelectorAll('details[data-lang-menu][open]');for(var i=0;i<d.length;i++)if(!d[i].contains(e.target))d[i].removeAttribute('open')});document.addEventListener('keydown',function(e){if(e.key==='Escape'){var d=document.querySelectorAll('details[data-lang-menu][open]');for(var i=0;i<d.length;i++)d[i].removeAttribute('open')}})})()</script>`;
// Nick Launches "featured" badge (public footers only, never inside /app). Fixed 244×56 box → no layout shift.
export const NL_BADGE = '<a class="sfoot-badge" href="https://nicklaunches.com/products/nest/" target="_blank" rel="noopener"><img src="https://nicklaunches.com/badges/featured.png" alt="Nest on Nick Launches" width="244" height="56" loading="lazy" decoding="async" /></a>';
export function footer(lang, c) {
  const u = c.ui;
  return `<footer class="sfoot"><div class="sfoot-in"><span>© 2026 Nest 巢 · ${esc(u.made)}</span>
<nav aria-label="Footer">${FOOT_NAV.map((k) => `<a href="${pagePath(lang, k)}">${esc(u.nav[k])}</a>`).join('')}${POST_LANGS.includes(lang) ? `<a href="${pagePath(lang, POSTS[0])}">${esc(u.vsChatgpt)}</a>` : ''}<a href="/terms">${esc(u.terms)}</a><a href="/privacy">${esc(u.privacy)}</a><a href="mailto:${SEO.contactEmail}">${esc(u.contact)}</a></nav>
<p style="margin:0;width:100%">${esc(u.footerAbout)}</p>${NL_BADGE}</div></footer>`;
}

// ---------- static page ----------
export function renderPage(lang, page) {
  const c = copyFor(lang);
  const P = c.pages[page];
  const L = LMAP[lang];
  const url = pageUrl(lang, page);
  const post = page.startsWith('blog/');
  const crumbs = `<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="${pagePath(lang, '')}">${esc(c.ui.home)}</a></li>${post ? `<li><a href="${pagePath(lang, 'blog')}">${esc(c.ui.blog)}</a></li>` : ''}<li aria-current="page">${esc(P.h1)}</li></ol></nav>`;
  const hero = `<section class="hero sub">${P.eyebrow ? `<p class="eyebrow">${esc(P.eyebrow)}</p>` : ''}<h1>${esc(P.h1)}</h1>${post ? `<p class="pub">${esc(c.ui.published)} <time datetime="${P.date}">${esc(fmtDate(P.date, lang))}</time> · Nest</p>` : ''}<p class="lead">${inline(P.lead, lang)}</p>
<div class="cta">${ctaPair('btn', c.ui)}</div></section>`;
  const body = P.sections.map((s) => sectionHtml(s, lang, c.ui)).join('\n');
  return `<!doctype html>
<html lang="${L.html}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(P.title)}</title>
${AUTH_HEAD_SCRIPT}
<meta name="description" content="${esc(P.description)}" />
<link rel="canonical" href="${url}" />
${hreflangTags(page)}
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
${verificationMeta()}
${socialTags({ url, title: P.title, description: P.description, lang, type: post ? 'article' : 'website', published: post ? P.date : '' })}
<meta name="theme-color" content="#ffffff" />
<link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png?v=4" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4" sizes="180x180" />
<style>${css(lang)}</style>
${ldTag(jsonLd(lang, page, c))}
</head>
<body>
<a class="skip" href="#main">${esc(c.ui.skip)}</a>
${header(lang, page, c)}
<main id="main" class="w">
${crumbs}
${post ? '<article>' : ''}${hero}
${body}${post ? '</article>' : ''}
</main>
${footer(lang, c)}
</body>
</html>
`;
}

// ---------- language home pages ("/" = x-default, /en/ · /zh-hant/ · /zh-hans/) ----------
// ONE landing: every home URL is the SPA shell (the React landing with the live, isolated demo) with that language's
// static text inside #root for crawlers / no-JS (React replaces it on mount). Same nav and layout; only the text differs.
// "/" picks the language from the saved choice or the browser (the head script hides the static zh-Hant block while
// another language is coming). /<seg>/ is always that language.
// Run 14: same detection as src/lib/langs.js detectLang (12 languages); the static block is zh-Hant, hidden for any other.
const ROOT_HEAD_SCRIPT = `<script>(function(){try{var d=document.documentElement,ids=${JSON.stringify(LANGS.map((l) => l.id))},l=null;try{l=localStorage.getItem('nest.lang')}catch(e){}if(ids.indexOf(l)<0){l='zh-Hant';var n=navigator.languages||[navigator.language];for(var i=0;i<n.length;i++){var x=String(n[i]||'').toLowerCase(),p=x.split('-')[0],h=null;if(!x)continue;if(/^zh-(hans|cn|sg|my)/.test(x))h='zh-Hans';else if(/^zh/.test(x))h='zh-Hant';else if(p==='pt')h='pt-BR';else if(p==='in')h='id';else for(var j=0;j<ids.length;j++)if(ids[j].toLowerCase()===p)h=ids[j];if(h){l=h;break}}}if(location.pathname!=='/'||l!=='zh-Hant')d.className+=' seo-off'}catch(e){}})()</script>`;
const HOME_CSS = () => `<style>.seo-off #seo{display:none}#seo{--ink:#0a0a0a;--ink2:#3a3a3a;--muted:#767676;--line:#ebebeb;--soft:#f5f5f5}html[data-lpt=dark] #seo{--ink:#f2f2f2;--ink2:#cfcfcf;--muted:#9b9b9b;--line:#262626;--soft:#1b1b1b;--bg:#0b0b0b;--surface:#111111;--on-ink:#0b0b0b}${AUTH_CTA_CSS}${scopeCss(NAV_CSS_CORE + FOOT_CSS, '#seo')}#seo>.snav{position:relative;z-index:50;background:transparent;border-color:transparent}#seo>.snav .snav-logo,#seo>.snav .snav-links a,#seo>.snav .snav-mm summary{color:#fff;--mark:#fff}#seo>.snav .lang-btn{background:rgba(255,255,255,.16);color:#fff}#seo>.snav .snav-cta{background:#fff;color:#0a0a0a}#seo .snav-panel{background:var(--bg,#fff)}#seo .seo-more{padding-top:24px;padding-bottom:64px}#seo .seo-more h2{font-size:clamp(24px,3vw,32px);margin:40px 0 14px}#seo .seo-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:14px}#seo .seo-cards article{border:1px solid #ebebeb;border-radius:20px;padding:18px}#seo .seo-cards h3{font-size:18px;margin:0 0 6px}#seo .seo-cards p,#seo .seo-more p{margin:0;color:#767676;font-weight:600;line-height:1.6}#seo .seo-faq h3{font-size:17px;margin:18px 0 4px}#seo .seo-langs{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}#seo .seo-langs a{text-decoration:underline}</style>`;
// Run 20: the meadow hero (same classes as Landing.jsx; styles.css draws it). Light screenshot + day art in the HTML;
// HERO_NIGHT_SCRIPT swaps in the night set only when <html data-lpt="dark"> (head script) is on.
function heroStageHtml(lang, lp) {
  const sl = lang === 'en' || isIntl(lang) ? 'en' : 'zh';
  const pic = (sch, cls) => { const a = appShot(sl, sch); const d = sch === 'dark'; return `<picture class="${cls}"><source media="(max-width: 640px)" ${d ? 'data-' : ''}srcset="${a.mob}"><img ${d ? 'data-' : ''}src="${a.deskSrc}" ${d ? 'data-' : ''}srcset="${a.desk}" sizes="${SHOT_SIZES}" alt="${d ? '' : esc(lp.heroShotAlt || 'Nest')}" width="1280" height="800" decoding="async"></picture>`; };
  return `<div class="hz-stage"><figure class="hz-win"><div class="hz-win-bar" aria-hidden="true"><i></i><i></i><i></i></div><div class="hz-win-body">${pic('light', 'hz-d')}${pic('dark', 'hz-n')}</div></figure>`
    + `<div class="hz-fg" aria-hidden="true">${pictureHtml(HERO_IMG.grass.day, 'hz-d')}${pictureHtml(HERO_IMG.grass.night, 'hz-n', { lazy: true })}</div></div>`;
}
const HERO_NIGHT_SCRIPT = `<script>(function(){if(document.documentElement.getAttribute('data-lpt')!=='dark')return;var e=document.querySelectorAll('.hz [data-srcset],.hz [data-src]');for(var i=0;i<e.length;i++){var x=e[i];if(x.dataset.src)x.src=x.dataset.src;if(x.dataset.srcset)x.srcset=x.dataset.srcset}})()</script>`;
export function renderHome(shell, lang, { root = false } = {}) {
  const c = copyFor(lang);
  const home = c.pages[''];
  const st = appStrings(lang);
  const lp = st.lp; const common = st.common;
  const L = LMAP[lang];
  const title = root ? 'Nest 巢 — free AI family app for students & parents · 全家人的 AI 助理' : home.title;
  const description = root ? `${COPY.en.pages[''].lead} ${COPY['zh-Hant'].pages[''].lead}` : home.description;
  const url = root ? `${S}/` : pageUrl(lang, '');
  const h1 = [].concat(lp.h1).map((l) => `<span class="bt-line">${esc(String(l).replace(/。$/, ''))}</span>`).join('');
  const faq = c.pages.faq.sections.flatMap((s) => s.faq || []).slice(0, 6);
  const cards = home.sections[0];
  const price = home.sections.find((s) => s.p && /pricing|價格|价格/.test(s.p)) || home.sections[3];
  const body = `<div id="seo">${header(lang, '', c)}
<main><div class="lp">
<section class="hz">${heroArtHtml()}<div class="hz-copy wrap"><span class="lp-eyebrow">${esc(lp.eyebrow)}</span><h1 class="lp-h1">${h1}</h1><p class="lp-sub">${esc(lp.sub)}</p>
<div class="lp-cta">${ctaPair('btn btn-primary btn-lg', { start: common.start, openApp: c.ui.openApp })}<a class="btn btn-outline btn-lg" href="/auth">${esc(common.signIn || c.ui.nav.demo)}</a></div></div>
${heroStageHtml(lang, lp)}<div class="hz-fade" aria-hidden="true"></div></section>${HERO_NIGHT_SCRIPT}
<section class="wrap seo-more">
${root ? `<p lang="en"><strong>${esc(COPY.en.pages[''].lead)}</strong></p>` : ''}
<h2>${esc(cards.h)}</h2>
<div class="seo-cards">${cards.cards.map(([t, d]) => `<article><h3>${esc(t)}</h3><p>${inline(d, lang)}</p></article>`).join('')}</div>
<h2>${esc(price.h)}</h2><p>${inline(price.p, lang)}</p>
<h2>${esc(c.pages.faq.h1)}</h2><div class="seo-faq">${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${inline(a, lang)}</p>`).join('')}</div>
<h2>${esc(c.ui.blog)}</h2><p>${POST_LANGS.includes(lang) ? `<a href="${pagePath(lang, POSTS[0])}">${esc(c.pages[POSTS[0]].h1)}</a>` : `<a href="${pagePath(lang, 'blog')}">${esc(c.pages.blog.h1)} →</a>`}</p>
<div class="seo-langs">${LANGS.map((l) => `<a href="${pagePath(l.id, '')}" hreflang="${l.hreflang}" lang="${l.html}" data-setlang="${l.id}">${esc(l.label)}</a>`).join('')}</div>
</section></div></main>
${footer(lang, c)}
</div>`;
  const ld = jsonLd(lang, root ? null : '', { ...c, pages: { ...c.pages, null: { title, description, h1: home.h1, sections: [] } } });
  if (root) ld['@graph'][3].inLanguage = 'zh-Hant-HK';
  let h = shell;
  h = h.replace(/<html lang="[^"]*"/, `<html lang="${root ? 'zh-Hant-HK' : L.html}"`)
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(description)}`)
    .replace(/(property="og:title" content=")[^"]*/, `$1${esc(title)}`).replace(/(name="twitter:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(property="og:description" content=")[^"]*/, `$1${esc(root ? COPY.en.pages[''].lead : description)}`).replace(/(name="twitter:description" content=")[^"]*/, `$1${esc(root ? COPY.en.pages[''].lead : description)}`)
    .replace(/(property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(property="og:locale" content=")[^"]*/, `$1${root ? 'zh_HK' : L.og}`)
    .replace(/(rel="canonical" href=")[^"]*/, `$1${url}`);
  h = h.replace('</head>', `    ${hreflangTags('').split('\n').join('\n    ')}\n    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />\n    ${root ? ROOT_HEAD_SCRIPT : ''}\n    ${LP_THEME_HEAD_SCRIPT}\n    ${AUTH_HEAD_SCRIPT}\n    ${HOME_CSS()}\n    ${ldTag(ld)}\n  </head>`);
  h = h.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return h;
}
export const renderRoot = (shell) => renderHome(shell, 'zh-Hant', { root: true });

// Shell helpers: verification meta into any SPA html; spa.html = shell + noindex, no canonical (SPA-only routes).
export function withVerification(html) {
  const v = verificationMeta();
  if (!v || html.includes('google-site-verification')) return html;
  return html.replace(/(<meta name="viewport"[^>]*>)/, `$1\n    ${v}`);
}
export function spaShell(shell) {
  return shell.replace(/\s*<link rel="canonical"[^>]*>/, '').replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');
}

// ---------- crawler files ----------
const BOTS = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'Claude-User', 'Claude-SearchBot', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended', 'DuckDuckBot'];
export const DISALLOW = ['/app/', '/app$', '/admin', '/api/', '/__/', '/auth', '/onboarding', '/join', '/oauth-callback.html', '/spa.html'];
export function robotsTxt() {
  const rules = ['Allow: /', ...DISALLOW.map((d) => `Disallow: ${d}`)].join('\n');
  const groups = BOTS.map((b) => `User-agent: ${b}\n${rules}`);
  return `# Nest — https://nesty.cyou\n# Public pages (/, /en/, /zh-hant/, /zh-hans/, /ja/, /ko/, /es/, /fr/, /de/, /pt-br/, /id/, /vi/, /th/, /beta, /llms.txt) are open to search engines and AI crawlers.\n# The signed-in app, admin, API and auth handlers are private.\n\n${groups.join('\n\n')}\n\nUser-agent: *\n${rules}\n\nSitemap: ${S}/sitemap.xml\n`;
}
// `blog` (Run 12, dynamic via api/ops.js): { index: true, posts: [{ urls: {lang: url}, lastmod: 'YYYY-MM-DD' }] } replaces the
// build-time blog post entries (POSTS from seo/content.js) with the PUBLISHED posts from the store.
export function sitemapXml(blog = null) {
  const entry = (loc, page) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmodOf(page)}</lastmod>\n${alternates(page).map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('\n')}\n  </url>`;
  const rows = [entry(`${S}/`, '')];
  const pages = blog ? PAGES.filter((p) => !POSTS.includes(p)) : PAGES;
  for (const p of pages) for (const l of langsFor(p)) rows.push(entry(pageUrl(l.id, p), p));
  if (blog) {
    for (const post of blog.posts || []) {
      const langs = LANGS.filter((l) => post.urls[l.id]);
      const alts = langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${post.urls[l.id]}"/>`);
      const xd = post.urls.en || post.urls[langs[0]?.id];
      if (xd) alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${xd}"/>`);
      for (const l of langs) rows.push(`  <url>\n    <loc>${post.urls[l.id]}</loc>\n    <lastmod>${post.lastmod}</lastmod>\n${alts.join('\n')}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

// Markdown version of a page (llms-full.txt).
export function pageMarkdown(lang, page) {
  const c = copyFor(lang);
  const P = c.pages[page];
  const md = (s) => String(s).replace(/\[([^\]]+)\]\(@([^)]*)\)/g, (_, l, p) => `[${l}](${pageUrl(lang, p)})`).replace(/\]\(\/(?!\/)/g, `](${S}/`);
  const out = [`## ${P.h1}`, `URL: ${pageUrl(lang, page)}`, '', md(P.lead), ''];
  for (const s of P.sections) {
    if (s.h) out.push(`### ${s.h}`);
    for (const p of [].concat(s.p || [])) out.push(md(p), '');
    if (s.ul) out.push(...s.ul.map((x) => `- ${md(x)}`), '');
    if (s.cards) out.push(...s.cards.map(([t, d]) => `- **${t}**: ${md(d)}`), '');
    if (s.steps) out.push(...s.steps.map(([t, d], i) => `${i + 1}. **${t}**: ${md(d)}`), '');
    if (s.facts) out.push(...s.facts.map(([k, v]) => `- ${k}: ${v}`), '');
    if (s.table) out.push(`| ${s.table.head.join(' | ')} |`, `| ${s.table.head.map(() => '---').join(' | ')} |`, ...s.table.rows.map((r) => `| ${r.join(' | ')} |`), '');
    if (s.faq) for (const [q, a] of s.faq) out.push(`**${q}**`, md(a), '');
    if (s.plans) {
      const st = appStrings(lang).pricing;
      for (const id of PLAN_ORDER) { const p = PLANS[id]; out.push(`- **${st.names[id]}** — ${p.monthly ? `HK$${p.monthly}/month or HK$${p.yearly}/year` : 'HK$0'}; ${p.daily}/day and ${p.weekly}/week AI messages per family; up to ${p.members} members; ${id === 'free' ? 'available now' : 'coming soon (waitlist)'}. ${st.features[id].join('; ')}.`); }
      out.push('');
    }
    if (s.plugins) out.push(...PLUGINS.map((p) => `- **${p.name}** (${p.category}): ${p.en}`), '');
    if (s.changelog) for (const e of CHANGELOG) { const x = e[lang] || e.en; out.push(`#### ${e.version} — ${x.title} (${e.date})`, ...x.items.map((i) => `- ${i}`), ''); }
    if (s.posts) out.push(...POSTS.map((id) => `- [${c.pages[id].h1}](${pageUrl(lang, id)}) (${c.pages[id].date}): ${c.pages[id].description}`), '');
    if (s.note) out.push(`> ${s.note}`, '');
  }
  return out.join('\n');
}
// `blog` (Run 12): { posts: [{ title, date, desc, urls: {lang: url} }] } = the published posts from the store.
export function llmsTxt(blog = null) {
  const en = COPY.en;
  const pg = (p) => en.pages[p];
  return `# Nest

> ${pg('').lead} Web app (installable on iPhone, iPad, Android and desktop). Website and AI replies in 12 languages: English, Traditional Chinese (Hong Kong written Chinese), Simplified Chinese, Japanese, Korean, Spanish, French, German, Portuguese (Brazil), Indonesian, Vietnamese and Thai (the app interface is complete in English and Chinese; main screens translated in the others, rest in English). For families in any country or region: users pick their country or region (all ISO 3166-1 codes); local packs (holidays, transport and weather links, emergency numbers, exam systems) cover Hong Kong, Macao, mainland China, Taiwan, Singapore, Japan, South Korea, the US, the UK, Australia, Canada, Germany, France, India and Malaysia; live weather warnings and MTR / bus arrival times are Hong Kong only. Made in Hong Kong.

Nest (Chinese name 巢) is for families: parents and students share one family space with roles (parent / student), invites by link or six-character code, a shared family memory, reminders, a calendar and a homework tutor that gives hints instead of answers. Free plan: 100 AI messages a day and 400 a week per family, up to 3 members. Starter (HK$38/month) and Pro (HK$78/month) are announced but not on sale yet (waitlist). The app lives at ${S}/app (sign-in required).

## Pages (English)
${(blog ? PAGES.filter((p) => !POSTS.includes(p)) : PAGES).map((p) => `- [${p ? pg(p).h1 : 'Home'}](${pageUrl('en', p)}): ${pg(p).description}`).join('\n')}

## 繁體中文 (香港)
${(blog ? PAGES.filter((p) => !POSTS.includes(p)) : PAGES).map((p) => `- [${p ? COPY['zh-Hant'].pages[p].h1 : '主頁'}](${pageUrl('zh-Hant', p)})`).join('\n')}

## 简体中文
- [Nest 简体中文主页](${pageUrl('zh-Hans', '')})
- [网志](${pageUrl('zh-Hans', 'blog')})

## Other languages (home · features · pricing · FAQ)
${LANGS.filter((l) => isIntl(l.id)).map((l) => `- ${l.label} (${l.hreflang}): [${COPY[l.id].ui.home}](${pageUrl(l.id, '')}) · [${COPY[l.id].ui.nav.features}](${pageUrl(l.id, 'features')}) · [${COPY[l.id].ui.nav.pricing}](${pageUrl(l.id, 'pricing')}) · [${COPY[l.id].ui.nav.faq}](${pageUrl(l.id, 'faq')})`).join('\n')}

## Blog
${blog ? (blog.posts || []).map((p) => `- [${p.title}](${p.urls.en || Object.values(p.urls)[0]}) — ${p.date}${p.desc ? `: ${p.desc}` : ''}${p.urls['zh-Hant'] ? `; [繁體中文](${p.urls['zh-Hant']})` : ''}${p.urls['zh-Hans'] ? `; [简体中文](${p.urls['zh-Hans']})` : ''}`).join('\n') || '- (no posts yet)'
    : POSTS.map((id) => `- [${pg(id).h1}](${pageUrl('en', id)}) — ${pg(id).date}; also in [繁體中文](${pageUrl('zh-Hant', id)}) and [简体中文](${pageUrl('zh-Hans', id)}). Moved from /en/compare/nest-vs-chatgpt-homework (301).`).join('\n')}
- [Blog index](${pageUrl('en', 'blog')}) · [網誌](${pageUrl('zh-Hant', 'blog')}) · [网志](${pageUrl('zh-Hans', 'blog')})

## Contact
- Email: ${SEO.contactEmail}
- Website: ${S}/
- Beta offer (first 10 families get Pro free for a month): ${S}/beta

## Optional
- [Full text of every page](${S}/llms-full.txt)
- [Sitemap](${S}/sitemap.xml)
`;
}
export function llmsFullTxt() {
  return `# Nest — full text\n\n> ${COPY.en.pages[''].lead}\n\nSource: ${S}/ · Updated ${latestDate()} · Contact ${SEO.contactEmail}\n\n# English\n\n${PAGES.map((p) => pageMarkdown('en', p)).join('\n\n')}\n\n# 繁體中文（香港）\n\n${['', 'faq'].map((p) => pageMarkdown('zh-Hant', p)).join('\n\n')}\n`;
}

