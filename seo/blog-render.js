// Run 12 — blog pages rendered from the STORE (api/_blog.js → api/ops.js, Edge, crawler-readable HTML, no JS except the
// tiny auth-CTA head script). Same look as the static pages (seo/render.js css/header/footer). Also: the migration seed
// (the Nest-vs-ChatGPT post from seo/content.js → markdown) used to create the first store post and as the fallback
// when the store cannot be read.
import { SEO, LANGS, POSTS } from './config.js';
import { COPY } from './content.js';
import { esc, copyFor, pagePath, pageUrl, header, footer, css, socialTags, ldTag, verificationMeta, fmtDate, LMAP, ctaPair, absolutize } from './render.js';
import { BLOG_ORIGIN } from '../src/site.js';
import { AUTH_HEAD_SCRIPT } from '../src/lib/auth-hint.js';
import { renderMarkdown, LANG_SEG, BLOG_LANGS, liveLangs, mediaUrl } from '../src/lib/blog-core.js';
import { toHans } from '../src/lib/hans.js';

const S = SEO.site;
// Run 18: posts live on https://blog.nesty.cyou/<seg>/<slug> (absolute; served by the vercel.json blog-host rewrites).
export const postPath = (lang, slug) => `${BLOG_ORIGIN}/${LANG_SEG[lang]}/${slug}`;
export const postUrl = (lang, slug) => postPath(lang, slug);
const isoDay = (ms) => new Date(Number(ms) + 8 * 3600e3).toISOString().slice(0, 10); // HKT calendar day
const isoTime = (ms) => new Date(Number(ms)).toISOString();

// Extra CSS for store posts (figures, embeds, quotes, code, cover).
const BLOG_CSS = `.post-body{max-width:760px}.post-body h2{margin-top:36px}.post-body h3{margin-top:26px}.post-body p,.post-body li{color:var(--ink2)}.post-body img{border-radius:14px;border:1px solid var(--line);display:block}
.post-body figure{margin:22px 0}.post-body figcaption{font-size:14px;color:var(--muted);margin-top:8px;text-align:center}.post-body blockquote{margin:18px 0;padding:4px 0 4px 16px;border-left:3px solid var(--ink)}.post-body blockquote p{color:var(--ink)}
.post-body pre{background:var(--soft);border-radius:12px;padding:14px;overflow-x:auto;font-size:14px}.post-body code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em;background:var(--soft);border-radius:6px;padding:1px 5px}.post-body pre code{background:none;padding:0}
.post-body .embed{position:relative;aspect-ratio:16/9;margin:22px 0;border-radius:14px;overflow:hidden;background:#000}.post-body .embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.post-body hr{border:0;border-top:1px solid var(--line);margin:28px 0}
.post-body .tbl{margin:16px 0}.cover{margin:18px 0 6px;max-width:960px}.cover img{width:100%;aspect-ratio:1200/630;object-fit:cover;border-radius:20px;border:1px solid var(--line)}.posts .card .thumb{display:block;margin:-18px -18px 12px;border-radius:20px 20px 0 0;overflow:hidden}.posts .card .thumb img{width:100%;aspect-ratio:1200/630;object-fit:cover;margin:0;border-radius:0}
.draft-bar{position:sticky;top:0;z-index:70;background:#ffd84d;color:#000;font-weight:800;text-align:center;padding:6px 10px;font-size:14px}`;

function shell({ lang, title, description, url, alternates, ld, body, page, altPaths, social, robots = 'index, follow, max-image-preview:large, max-snippet:-1', banner = '', noScript = false }) {
  const L = LMAP[lang]; const c = copyFor(lang);
  return absolutize(`<!doctype html>
<html lang="${L.html}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
${noScript ? '' : AUTH_HEAD_SCRIPT}
<meta name="description" content="${esc(description)}" />
${url ? `<link rel="canonical" href="${url}" />` : ''}
${(alternates || []).map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n')}
<meta name="robots" content="${robots}" />
${verificationMeta()}
${social || ''}
<meta name="theme-color" content="#ffffff" />
<link rel="icon" href="/favicon.svg?v=4" type="image/svg+xml" />
<link rel="icon" href="/favicon-32.png?v=4" sizes="32x32" type="image/png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4" sizes="180x180" />
<style>${css(lang)}${BLOG_CSS}</style>
${ld ? ldTag(ld) : ''}
</head>
<body>
${banner}<a class="skip" href="#main">${esc(c.ui.skip)}</a>
${header(lang, page, c, altPaths)}
<main id="main" class="w">
${body}
</main>
${footer(lang, c)}
</body>
</html>
`);
}
const org = () => ({ '@type': 'Organization', '@id': `${S}/#org`, name: 'Nest', alternateName: 'Nest 巢', url: `${S}/`, logo: { '@type': 'ImageObject', url: `${S}/icon-512.png`, width: 512, height: 512 } });
const crumbsHtml = (lang, c, items) => `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map(([n, h], i) => (i === items.length - 1 ? `<li aria-current="page">${esc(n)}</li>` : `<li><a href="${h}">${esc(n)}</a></li>`)).join('')}</ol></nav>`;

// ---------- one post ----------
// post = store meta; body = markdown of `lang`; media = media index (dims); opts.preview → noindex + banner.
export function renderBlogPost({ post, lang, body, media = {}, preview = false, now = Date.now() }) {
  const c = copyFor(lang); const x = post.langs[lang];
  const langs = preview ? BLOG_LANGS.filter((l) => post.langs?.[l]?.title && post.langs?.[l]?.slug) : liveLangs(post, now);
  const url = postUrl(lang, x.slug);
  const alternates = langs.map((l) => ({ hreflang: LMAP[l].hreflang, href: postUrl(l, post.langs[l].slug) }));
  const xd = langs.includes('en') ? 'en' : langs[0];
  if (xd) alternates.push({ hreflang: 'x-default', href: postUrl(xd, post.langs[xd].slug) });
  const altPaths = Object.fromEntries(LANGS.map((l) => [l.id, langs.includes(l.id) ? postPath(l.id, post.langs[l.id].slug) : pagePath(l.id, 'blog')]));
  const published = Number(post.publishAt) || Number(post.updatedAt) || now;
  const cover = post.cover ? S + mediaUrl(post.cover) : '';
  const coverMeta = post.cover ? media[post.cover] : null;
  const title = x.seoTitle || `${x.title} | Nest`;
  const description = x.seoDesc || x.excerpt || x.title;
  const html = renderMarkdown(body || '', { site: S, media });
  const blogUrl = pageUrl(lang, 'blog');
  const ld = { '@context': 'https://schema.org', '@graph': [org(),
    { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: LMAP[lang].html, isPartOf: { '@id': `${S}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` }, mainEntity: { '@id': `${url}#post` } },
    { '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`, itemListElement: [{ '@type': 'ListItem', position: 1, name: c.ui.home, item: pageUrl(lang, '') }, { '@type': 'ListItem', position: 2, name: c.ui.blog, item: blogUrl }, { '@type': 'ListItem', position: 3, name: x.title, item: url }] },
    { '@type': 'BlogPosting', '@id': `${url}#post`, headline: x.title.slice(0, 110), description, inLanguage: LMAP[lang].html, url, mainEntityOfPage: { '@id': `${url}#webpage` },
      datePublished: isoTime(published), dateModified: isoTime(Math.max(published, Number(post.updatedAt) || 0)), author: { '@id': `${S}/#org` }, publisher: { '@id': `${S}/#org` },
      image: cover ? { '@type': 'ImageObject', url: cover, width: coverMeta?.w || 1200, height: coverMeta?.h || 630 } : S + SEO.ogImage, isPartOf: { '@type': 'Blog', '@id': `${blogUrl}#blog`, url: blogUrl } }] };
  const body2 = `${crumbsHtml(lang, c, [[c.ui.home, pagePath(lang, '')], [c.ui.blog, pagePath(lang, 'blog')], [x.title]])}
<article>
<section class="hero sub"><h1>${esc(x.title)}</h1><p class="pub">${esc(c.ui.published)} <time datetime="${isoTime(published)}">${esc(fmtDate(isoDay(published), lang))}</time> · Nest</p>${x.excerpt ? `<p class="lead">${esc(x.excerpt)}</p>` : ''}
<div class="cta">${ctaPair('btn', c.ui)}</div></section>
${cover ? `<figure class="cover"><img src="${mediaUrl(post.cover)}" alt="${esc(x.coverAlt || '')}" width="1200" height="630" decoding="async" fetchpriority="high"></figure>` : ''}
<div class="post-body sec">${html}</div>
</article>`;
  return shell({ lang, title, description, url: preview ? '' : url, alternates: preview ? [] : alternates, ld: preview ? null : ld, body: body2, page: 'blog/', altPaths, robots: preview ? 'noindex, nofollow' : undefined, noScript: preview,
    social: socialTags({ url, title, description, lang, type: 'article', published: isoTime(published), ...(cover ? { image: cover, imageType: coverMeta?.mime || 'image/webp', imageAlt: x.coverAlt || x.title } : {}) }),
    banner: preview ? `<div class="draft-bar">PREVIEW · ${esc(post.status === 'published' ? (Number(post.publishAt) > now ? 'SCHEDULED' : 'PUBLISHED') : 'DRAFT')} — not public</div>` : '' });
}

// ---------- index ----------
export function renderBlogIndex({ lang, posts, src = lang, now = Date.now() }) {
  const c = copyFor(lang); const P = c.pages.blog; const url = pageUrl(lang, 'blog');
  const alternates = LANGS.map((l) => ({ hreflang: l.hreflang, href: pageUrl(l.id, 'blog') })).concat([{ hreflang: 'x-default', href: pageUrl('en', 'blog') }]);
  // src ≠ lang (Run 14): posts in another language (English) — cards carry lang/hreflang of the post and a note says so.
  const other = src !== lang; const la = other ? ` lang="${LMAP[src].html}"` : ''; const hl = other ? ` hreflang="${LMAP[src].hreflang}"` : '';
  const items = posts.map((p) => { const x = p.langs[src]; return { p, x, url: postUrl(src, x.slug), path: postPath(src, x.slug), day: isoDay(p.publishAt) }; });
  const ld = { '@context': 'https://schema.org', '@graph': [org(),
    { '@type': ['WebPage', 'CollectionPage'], '@id': `${url}#webpage`, url, name: P.title, description: P.description, inLanguage: LMAP[lang].html, mainEntity: { '@id': `${url}#blog` } },
    { '@type': 'Blog', '@id': `${url}#blog`, name: `Nest — ${P.h1}`, url, inLanguage: LMAP[lang].html, publisher: { '@id': `${S}/#org` },
      blogPost: items.map((i) => ({ '@type': 'BlogPosting', headline: i.x.title.slice(0, 110), url: i.url, datePublished: isoTime(i.p.publishAt), ...(i.p.cover ? { image: S + mediaUrl(i.p.cover) } : {}) })) }] };
  const cards = items.length ? `<div class="cards posts">${items.map((i) => `<article class="card">${i.p.cover ? `<a class="thumb" href="${i.path}" tabindex="-1" aria-hidden="true"><img src="${mediaUrl(i.p.cover)}" alt="" width="1200" height="630" loading="lazy" decoding="async"></a>` : ''}<p class="muted small"><time datetime="${i.day}">${esc(fmtDate(i.day, lang))}</time>${other ? ` · ${esc(LMAP[src].label)}` : ''}</p><h3${la}><a href="${i.path}"${hl}>${esc(i.x.title)}</a></h3>${i.x.excerpt ? `<p${la}>${esc(i.x.excerpt)}</p>` : ''}<p class="small"><a href="${i.path}"${hl}>${esc(c.ui.readMore)} →</a></p></article>`).join('')}</div>`
    : `<p class="muted">${esc(c.ui.noPosts || (lang === 'zh-Hans' ? '暂时未有文章。' : lang === 'zh-Hant' ? '暫時未有文章。' : 'No posts yet.'))}</p>`;
  const body = `${crumbsHtml(lang, c, [[c.ui.home, pagePath(lang, '')], [P.h1]])}
<section class="hero sub"><h1>${esc(P.h1)}</h1><p class="lead">${esc(P.lead)}</p><div class="cta">${ctaPair('btn', c.ui)}</div></section>
<section class="sec">${other && items.length && c.ui.blogNote ? `<p class="note">${esc(c.ui.blogNote)}</p>` : ''}${cards}</section>`;
  return shell({ lang, title: P.title, description: P.description, url, alternates, ld, body, page: 'blog', social: socialTags({ url, title: P.title, description: P.description, lang }) });
}

export function renderBlog404(lang) {
  const c = copyFor(lang);
  const t = c.ui.notFound || (lang === 'zh-Hans' || lang === 'zh-Hant' ? '找不到文章' : 'Post not found');
  return shell({ lang, title: `${t} | Nest`, description: t, url: '', alternates: [], ld: null, page: 'blog', robots: 'noindex',
    body: `<section class="hero sub"><h1>${esc(t)}</h1><p class="lead"><a href="${pagePath(lang, 'blog')}">${esc(c.ui.blog)} →</a></p></section>` });
}

// ---------- migration seed: the Nest-vs-ChatGPT post (seo/content.js) as a store post ----------
export const SEED_ID = 'nestvschatgpt';
export const SEED_SLUG = 'nest-vs-chatgpt';
function sectionsToMarkdown(lang, P) {
  const link = (s) => String(s).replace(/\]\(@([^)]*)\)/g, (_, p) => `](${pagePath(lang, p)})`);
  const out = [link(P.lead), ''];
  for (const s of P.sections) {
    if (s.h) out.push(`## ${s.h}`, '');
    for (const p of [].concat(s.p || [])) out.push(link(p), '');
    if (s.ul) out.push(...s.ul.map((x) => `- ${link(x)}`), '');
    if (s.cards) out.push(...s.cards.map(([t, d]) => `- **${t}**: ${link(d)}`), '');
    if (s.steps) out.push(...s.steps.map(([t, d], i) => `${i + 1}. **${t}**: ${link(d)}`), '');
    if (s.facts) out.push(...s.facts.map(([k, v]) => `- **${k}**: ${link(v)}`), '');
    if (s.table) out.push(`| ${s.table.head.join(' | ')} |`, `| ${s.table.head.map(() => '---').join(' | ')} |`, ...s.table.rows.map((r) => `| ${r.map((x) => link(x).replace(/\|/g, '/')).join(' | ')} |`), '');
    if (s.faq) for (const [q, a] of s.faq) out.push(`### ${q}`, '', link(a), '');
    if (s.note) out.push(`> ${link(s.note)}`, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export function seedPost() {
  const id = POSTS[0];
  const langs = {}; const bodies = {};
  for (const l of BLOG_LANGS) {
    const P = copyFor(l).pages[id];
    langs[l] = { title: P.h1, slug: SEED_SLUG, excerpt: P.description, seoTitle: P.title, seoDesc: P.description, coverAlt: '', has: true };
    bodies[l] = sectionsToMarkdown(l, P);
  }
  const date = COPY.en.pages[id].date;
  const at = Date.parse(`${date}T09:00:00+08:00`);
  return { post: { id: SEED_ID, status: 'published', publishAt: at, firstPublishedAt: at, createdAt: at, updatedAt: at, updatedBy: 'migration', cover: null, langs }, bodies };
}
export { toHans };
