// Blog (網誌) core — pure + isomorphic (Edge function api/_blog.js, the admin editor's live preview, tests).
// Posts are MARKDOWN. The renderer is safe by construction (every character of user text is escaped; only the tags
// below are generated) and its output goes through sanitizeHtml() again (allowlist) both on the server (SSR) and in
// the browser preview. Raw HTML in a post is never rendered: the server strips tags on save (cleanMarkdown).
export const BLOG_LANGS = ['en', 'zh-Hant', 'zh-Hans'];
// Run 14: segments for all 12 site languages (blog index chrome); posts themselves stay in BLOG_LANGS.
export { SEG as LANG_SEG, SEG_LANG } from './langs.js';
export const LIMITS = { title: 120, slug: 80, excerpt: 300, seoTitle: 70, seoDesc: 170, alt: 200, caption: 200, body: 40000, posts: 200 };
export const IMG_MAX_BYTES = 300 * 1024; // decoded bytes per image (client compresses to ≤ ~250 KB)
export const IMG_MIME = ['image/webp', 'image/jpeg', 'image/png'];
export const MEDIA_RE = /^[a-z0-9]{8,24}$/;
export const POST_ID_RE = /^[a-z0-9]{6,24}$/;

// ---------- slugs ----------
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(['index', 'feed', 'rss', 'page', 'new', 'edit', 'admin', 'api', 'draft', 'preview', 'tag', 'tags', 'category']);
export function slugProblem(slug) {
  const s = String(slug ?? '');
  if (!s) return 'slug_empty';
  if (s.length < 3) return 'slug_short';
  if (s.length > LIMITS.slug) return 'slug_long';
  if (!SLUG_RE.test(s)) return 'slug_chars';
  if (RESERVED.has(s)) return 'slug_reserved';
  return '';
}
export function slugify(t) {
  return String(t || '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, LIMITS.slug).replace(/-+$/, '');
}
// Slug unique per language: returns the first clash {lang, slug, id} or null.
export function slugClash(posts, id, langs) {
  for (const l of BLOG_LANGS) {
    const s = langs?.[l]?.slug; if (!s) continue;
    for (const p of Object.values(posts || {})) if (p && p.id !== id && p.langs?.[l]?.slug === s) return { lang: l, slug: s, id: p.id };
  }
  return null;
}

// ---------- visibility / status ----------
export const hasLang = (post, bodies, l) => !!(post?.langs?.[l]?.title && post?.langs?.[l]?.slug && (bodies ? String(bodies[l] || '').trim() : post?.langs?.[l]?.has));
export const isLive = (post, now = Date.now()) => !!post && post.status === 'published' && Number(post.publishAt) > 0 && Number(post.publishAt) <= now;
export function statusOf(post, now = Date.now()) {
  if (!post || post.status !== 'published') return 'draft';
  return Number(post.publishAt) > now ? 'scheduled' : 'published';
}
export const liveLangs = (post, now = Date.now()) => (isLive(post, now) ? BLOG_LANGS.filter((l) => post.langs?.[l]?.title && post.langs?.[l]?.slug && post.langs?.[l]?.has) : []);
export function livePosts(posts, lang, now = Date.now()) {
  return Object.values(posts || {}).filter((p) => isLive(p, now) && liveLangs(p, now).includes(lang)).sort((a, b) => Number(b.publishAt) - Number(a.publishAt));
}
export function findLive(posts, lang, slug, now = Date.now()) {
  return Object.values(posts || {}).find((p) => p?.langs?.[lang]?.slug === slug && liveLangs(p, now).includes(lang)) || null;
}

// ---------- embeds ----------
export const IFRAME_HOSTS = ['www.youtube-nocookie.com', 'www.youtube.com', 'youtube.com', 'youtube-nocookie.com', 'player.vimeo.com', 'www.loom.com', 'loom.com'];
// A user-supplied video URL → the canonical embed src (or '' when not allowed). No autoplay parameters are ever added.
export function embedSrc(url) {
  let u; try { u = new URL(String(url || '').trim()); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const h = u.hostname.toLowerCase().replace(/^m\./, 'www.');
  const yt = (id) => (/^[A-Za-z0-9_-]{11}$/.test(id || '') ? `https://www.youtube-nocookie.com/embed/${id}` : '');
  if (h === 'youtu.be') return yt(u.pathname.slice(1).split('/')[0]);
  if (['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com', 'music.youtube.com'].includes(h)) {
    if (u.pathname === '/watch') return yt(u.searchParams.get('v'));
    const m = /^\/(embed|shorts|live)\/([^/?#]+)/.exec(u.pathname); return m ? yt(m[2]) : '';
  }
  if (h === 'vimeo.com' || h === 'www.vimeo.com') { const m = /^\/(\d{4,12})(?:\/|$)/.exec(u.pathname); return m ? `https://player.vimeo.com/video/${m[1]}?dnt=1` : ''; }
  if (h === 'player.vimeo.com') { const m = /^\/video\/(\d{4,12})$/.exec(u.pathname); return m ? `https://player.vimeo.com/video/${m[1]}?dnt=1` : ''; }
  if (h === 'www.loom.com' || h === 'loom.com') { const m = /^\/(share|embed)\/([0-9a-f]{32})$/.exec(u.pathname); return m ? `https://www.loom.com/embed/${m[2]}` : ''; }
  return '';
}
// Is an iframe src (already canonical) on the allowlist? Used by the sanitizer.
export function iframeAllowed(src) {
  let u; try { u = new URL(String(src || '')); } catch { return false; }
  if (u.protocol !== 'https:' || !IFRAME_HOSTS.includes(u.hostname.toLowerCase())) return false;
  if (/autoplay=1/i.test(u.search)) return false;
  return /^\/(embed\/[A-Za-z0-9_-]{11}|video\/\d{4,12}|embed\/[0-9a-f]{32})$/.test(u.pathname);
}

// ---------- images ----------
// data URL → { mime, bytes, b64 } after checking MIME allowlist, decoded size and magic bytes; or { error }.
export function checkImageDataUrl(d, { maxBytes = IMG_MAX_BYTES } = {}) {
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(d || ''));
  if (!m) return { error: 'bad_image_type' };
  const b64 = m[2]; const bytes = Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  if (bytes > maxBytes) return { error: 'image_too_large' };
  if (bytes < 32) return { error: 'bad_image' };
  const head = (typeof atob === 'function' ? atob(b64.slice(0, 24)) : Buffer.from(b64.slice(0, 24), 'base64').toString('binary'));
  const at = (i) => head.charCodeAt(i);
  const ok = m[1] === 'image/png' ? (at(0) === 0x89 && head.slice(1, 4) === 'PNG')
    : m[1] === 'image/jpeg' ? (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff)
      : (head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP');
  if (!ok) return { error: 'image_mismatch' };
  return { mime: m[1], bytes, b64 };
}
export const mediaUrl = (id) => `/blog-media/${id}`;

// ---------- markdown input cleanup (server, on save) ----------
export function cleanMarkdown(md) {
  let s = String(md ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, ''); // any other raw HTML tag is dropped (text kept)
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  return s.slice(0, LIMITS.body);
}
// Media ids referenced by a body (![alt](media:ID) or (/blog-media/ID)).
export function mediaRefs(md) {
  const out = new Set();
  for (const m of String(md || '').matchAll(/\]\((?:media:|\/blog-media\/)([a-z0-9]{8,24})/g)) out.add(m[1]);
  return [...out];
}
// Embed lines that are NOT on the allowlist (reject on save with a clear error).
export function badEmbeds(md) {
  const bad = [];
  for (const line of String(md || '').split('\n')) {
    const m = /^\s*@\[video\]\(([^)\s]+)\)\s*$/.exec(line);
    if (m && !embedSrc(m[1])) bad.push(m[1]);
  }
  return bad;
}

// ---------- markdown → HTML (safe by construction) ----------
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
function safeHref(h) {
  const x = String(h || '').trim();
  if (/^https?:\/\/[^\s"'<>]+$/i.test(x) || /^mailto:[^\s"'<>]+$/i.test(x)) return x;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(x) || /^#[\w-]+$/.test(x)) return x;
  return '';
}
export function inlineMd(text, { site = '' } = {}) {
  // 1) pull out code spans so their content is not formatted
  const codes = [];
  let s = String(text ?? '').replace(/`([^`\n]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  // 2) links [label](href) — label formatted later, href checked
  const links = [];
  s = s.replace(/\[([^\]\n]{1,300})\]\(([^)\s]{1,600})\)/g, (all, label, href) => { const h = safeHref(href); if (!h) return label; links.push([label, h]); return `\u0001${links.length - 1}\u0001`; });
  s = esc(s);
  // bare https URLs → links
  s = s.replace(/(^|[\s(（])(https:\/\/[^\s<>"'）)]+[^\s<>"'）).,，。!?;:])/g, (_, pre, u) => `${pre}<a href="${u}" rel="noopener nofollow">${u.replace(/^https:\/\//, '')}</a>`);
  const fmt = (x) => x.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>').replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g, '$1<em>$2</em>');
  s = fmt(s);
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => {
    const [label, h] = links[Number(i)];
    const ext = /^https?:/i.test(h) && !(site && h.startsWith(site));
    return `<a href="${esc(h)}"${ext ? ' rel="noopener nofollow"' : ''}>${fmt(esc(label))}</a>`;
  });
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[Number(i)])}</code>`);
  return s;
}
const imgLine = /^!\[([^\]\n]{0,200})\]\((?:media:|\/blog-media\/)([a-z0-9]{8,24})(?:\s+"([^"\n]{0,200})")?\)\s*$/;
const videoLine = /^@\[video\]\(([^)\s]+)\)\s*$/;
const bareVideo = /^(https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com|loom\.com|www\.loom\.com)\/\S+)\s*$/;
export function renderMarkdown(md, { site = '', media = null } = {}) {
  const lines = String(md ?? '').replace(/\r\n?/g, '\n').split('\n');
  const out = []; let i = 0;
  const il = (t) => inlineMd(t, { site });
  const isBlockStart = (l) => /^(#{1,4})\s/.test(l) || /^\s*([-*+]|\d{1,3}[.)])\s+/.test(l) || /^>\s?/.test(l) || /^```/.test(l) || /^\s*(-{3,}|\*{3,})\s*$/.test(l) || imgLine.test(l) || videoLine.test(l) || bareVideo.test(l) || /^\|.*\|\s*$/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if (/^```/.test(line)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue; }
    if ((m = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line))) { const lv = Math.min(4, Math.max(2, m[1].length + (m[1].length === 1 ? 1 : 0))); out.push(`<h${lv}>${il(m[2])}</h${lv}>`); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if ((m = imgLine.exec(line.trim()))) {
      const [, alt, id, cap] = m; const meta = media?.[id];
      const dims = meta?.w && meta?.h ? ` width="${Number(meta.w)}" height="${Number(meta.h)}"` : '';
      out.push(`<figure><img src="${mediaUrl(id)}" alt="${esc(alt)}"${dims} loading="lazy" decoding="async">${cap ? `<figcaption>${il(cap)}</figcaption>` : ''}</figure>`); i++; continue;
    }
    if ((m = videoLine.exec(line.trim()) || bareVideo.exec(line.trim()))) {
      const src = embedSrc(m[1]);
      if (src) out.push(`<div class="embed"><iframe src="${esc(src)}" title="Video" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`);
      else out.push(`<p>${il(m[1])}</p>`);
      i++; continue;
    }
    if (/^>\s?/.test(line)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out.push(`<blockquote>${buf.join('\n').split(/\n{2,}/).map((p) => `<p>${il(p.replace(/\n/g, ' '))}</p>`).join('')}</blockquote>`); continue; }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="tbl"><table><thead><tr>${head.map((h) => `<th scope="col">${il(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${head.map((_, k) => (k === 0 ? `<th scope="row">${il(r[k] || '')}</th>` : `<td>${il(r[k] || '')}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if ((m = /^\s*([-*+]|\d{1,3}[.)])\s+/.exec(line))) {
      const ordered = /\d/.test(m[1]); const items = [];
      while (i < lines.length && (m = /^\s*([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(lines[i])) && /\d/.test(m[1]) === ordered) { items.push(m[2]); i++; while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d{1,3}[.)])\s+/.test(lines[i])) items[items.length - 1] += ' ' + lines[i++].trim(); }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${il(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    const buf = [line]; i++;
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${buf.map(il).join('<br>')}</p>`);
  }
  return sanitizeHtml(out.join('\n'), { site });
}

// ---------- HTML sanitizer (allowlist) ----------
const TAGS = { p: [], h2: [], h3: [], h4: [], ul: [], ol: [], li: [], blockquote: [], pre: [], code: [], strong: [], em: [], br: [], hr: [], table: [], thead: [], tbody: [], tr: [], th: ['scope'], td: [], figure: [], figcaption: [],
  a: ['href', 'rel'], img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'], div: ['class'],
  iframe: ['src', 'title', 'loading', 'allow', 'allowfullscreen', 'referrerpolicy'] };
const VOID = new Set(['br', 'hr', 'img']);
const decodeEnt = (v) => v.replace(/&(amp|quot|#39|lt|gt);/g, (_, e) => ({ amp: '&', quot: '"', '#39': "'", lt: '<', gt: '>' })[e]);
const DROP_WITH_CONTENT = /<(script|style|textarea|title|noscript|template|object|embed|svg|math|select)\b[\s\S]*?<\/\1\s*>/gi;
function attrOk(tag, name, value, site) {
  if (tag === 'a' && name === 'href') return !!safeHref(value);
  if (tag === 'a' && name === 'rel') return /^[a-z ]{1,40}$/.test(value);
  if (tag === 'img' && name === 'src') return /^\/blog-media\/[a-z0-9]{8,24}$/.test(value) || (!!site && new RegExp(`^${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/blog-media/[a-z0-9]{8,24}$`).test(value));
  if (tag === 'img' && (name === 'width' || name === 'height')) return /^\d{1,5}$/.test(value);
  if (tag === 'img' && name === 'loading') return value === 'lazy' || value === 'eager';
  if (tag === 'img' && name === 'decoding') return value === 'async';
  if (tag === 'div' && name === 'class') return value === 'embed' || value === 'tbl';
  if (tag === 'th' && name === 'scope') return value === 'col' || value === 'row';
  if (tag === 'iframe' && name === 'src') return iframeAllowed(value);
  if (tag === 'iframe' && name === 'allowfullscreen') return true;
  if (tag === 'iframe' && name === 'loading') return value === 'lazy';
  if (tag === 'iframe' && name === 'referrerpolicy') return value === 'strict-origin-when-cross-origin';
  if (tag === 'iframe' && name === 'allow') return /^[a-z-; ]{0,120}$/.test(value) && !/autoplay/.test(value);
  if (tag === 'iframe' && name === 'title') return value.length <= 120;
  if (name === 'alt') return value.length <= LIMITS.alt;
  return false;
}
export function sanitizeHtml(html, { site = '' } = {}) {
  let s = String(html ?? '').replace(DROP_WITH_CONTENT, '').replace(/<!--[\s\S]*?-->/g, '');
  const out = []; const stack = []; let last = 0;
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
  const text = (t) => t.replace(/<|>/g, (c) => (c === '<' ? '&lt;' : '&gt;')).replace(/&(?!(?:[a-zA-Z]{2,8}|#\d{1,6}|#x[0-9a-fA-F]{1,6});)/g, '&amp;');
  let m;
  while ((m = re.exec(s))) {
    out.push(text(s.slice(last, m.index))); last = re.lastIndex;
    const close = m[1] === '/'; const tag = m[2].toLowerCase();
    if (!TAGS[tag]) continue; // unknown tag: dropped (its text stays, escaped)
    if (close) {
      if (VOID.has(tag)) continue;
      const k = stack.lastIndexOf(tag); if (k < 0) continue;
      while (stack.length > k) out.push(`</${stack.pop()}>`);
      continue;
    }
    const attrs = []; let iframeSrc = false; let imgSrc = false;
    for (const a of m[3].matchAll(/([^\s=>/]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = a[1].toLowerCase(); const value = decodeEnt((a[3] ?? a[4] ?? a[5] ?? '').trim());
      if (/^on/.test(name) || !TAGS[tag].includes(name)) continue;
      if (!attrOk(tag, name, value, site)) continue;
      if (tag === 'iframe' && name === 'src') iframeSrc = true;
      if (tag === 'img' && name === 'src') imgSrc = true;
      attrs.push(name === 'allowfullscreen' ? ' allowfullscreen' : ` ${name}="${esc(value)}"`);
    }
    if (tag === 'iframe' && !iframeSrc) { const end = s.toLowerCase().indexOf('</iframe>', last); if (end >= 0) last = re.lastIndex = end + 9; continue; }
    if (tag === 'img' && !imgSrc) continue;
    if (tag === 'a' && attrs.some((x) => x.startsWith(' href="http')) && !attrs.some((x) => x.startsWith(' rel='))) attrs.push(' rel="noopener nofollow"');
    out.push(`<${tag}${attrs.join('')}>`);
    if (!VOID.has(tag)) stack.push(tag);
  }
  out.push(text(s.slice(last)));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

// ---------- post input validation (server) ----------
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
// Returns { post: {langs, cover, ...meta fields allowed from the editor}, bodies } or { error, lang? }.
export function cleanPostInput(input = {}, bodiesIn = {}) {
  const langs = {}; const bodies = {};
  for (const l of BLOG_LANGS) {
    const x = input.langs?.[l] || {};
    const body = cleanMarkdown(bodiesIn?.[l] || '');
    const v = { title: str(x.title, LIMITS.title), slug: str(x.slug, LIMITS.slug).toLowerCase(), excerpt: str(x.excerpt, LIMITS.excerpt), seoTitle: str(x.seoTitle, LIMITS.seoTitle), seoDesc: str(x.seoDesc, LIMITS.seoDesc), coverAlt: str(x.coverAlt, LIMITS.alt) };
    const any = v.title || v.slug || body.trim() || v.excerpt;
    if (!any) continue;
    if (!v.title) return { error: 'title_empty', lang: l };
    const sp = slugProblem(v.slug); if (sp) return { error: sp, lang: l };
    const bad = badEmbeds(body); if (bad.length) return { error: 'bad_embed', lang: l, detail: bad[0].slice(0, 120) };
    v.has = !!body.trim();
    langs[l] = v; bodies[l] = body;
  }
  if (!Object.keys(langs).length) return { error: 'empty' };
  const cover = input.cover && MEDIA_RE.test(String(input.cover)) ? String(input.cover) : null;
  return { post: { langs, cover }, bodies };
}
