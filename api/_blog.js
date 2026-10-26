// Blog (網誌) — Run 12. Served by api/ops.js (NO new function; 12/12):
//   public  GET /:lang/blog            → op=blog-index&lang=     SSR HTML (published posts only)
//           GET /:lang/blog/:slug      → op=blog-post&lang=&slug= SSR HTML (BlogPosting JSON-LD, canonical + hreflang)
//           GET /sitemap.xml           → op=blog-sitemap          static pages + published posts
//           GET /llms.txt              → op=blog-llms
//           GET /blog-media/:id        → op=blog-media&id=        image bytes (immutable; cover = og:image)
//   admin   GET/POST /api/app/blog-admin → op=app-blog-admin     ONLY the server allowlist (isAdminClaims); 401 without a
//           token, 403 for every other signed-in user. Every write → audit log entry (ledger log, like other admin actions).
// STORAGE (no Firebase Storage exists; Firestore docs are capped at 1 MiB):
//   • index doc  = system account nest-blog@system.heynest.invalid → users/{uid}: { posts{id: meta}, media{id: {s,n,mime,w,h}},
//                  blobs{key: {s,n}}, seeded } — small (≈2–4 KB per post), so ~200 posts fit comfortably.
//   • blob shards = nest-blob-N@system.heynest.invalid → users/{uid}.x{key: string}; each shard ≤ SHARD_CAP bytes. Keys:
//                  'p_<postId>' = JSON {en, zh-Hant, zh-Hans} markdown bodies, 'i_<mediaId>' = image data URL (≤ 300 KB).
//                  New shards are created on demand (self-provisioning accounts), so total size is not capped by one doc.
//   Reads use field masks (one blob per request). Public responses are CDN-cached (s-maxage 60 s, images immutable).
import { json, fsGetMask, fsCommit, docName, pathsWrite, ledgerSession, ledgerPath, ledgerTx, fp } from './_ops-lib.js';
import { audit } from './_admin.js';
import {
  BLOG_LANGS, SEG_LANG, LIMITS, MEDIA_RE, POST_ID_RE, cleanPostInput, slugClash, statusOf, livePosts, findLive, liveLangs, checkImageDataUrl, mediaRefs, renderMarkdown,
} from '../src/lib/blog-core.js';
import { renderBlogPost, renderBlogIndex, renderBlog404, seedPost, SEED_ID, SEED_SLUG, postUrl } from '../seo/blog-render.js';
import { sitemapXml, llmsTxt } from '../seo/render.js';

export const SHARD_CAP = 900000; // bytes per shard doc (Firestore limit 1,048,576 incl. field names / overhead)
const PUBLIC_CACHE = { 'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' };
const rid = (n = 12) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join('');
const bytesOf = (s) => new TextEncoder().encode(String(s)).length;
const html = (status, body, headers = {}) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', ...headers } });
const text = (body, type, headers = {}) => new Response(body, { status: 200, headers: { 'content-type': `${type}; charset=utf-8`, ...headers } });

// ---------- store ----------
async function readIndex(fields = null) {
  const s = await ledgerSession('blog');
  const d = fields ? await fsGetMask(ledgerPath(s), s.token, fields) : await fsGetMask(ledgerPath(s), s.token, ['posts', 'media', 'blobs', 'seeded']);
  return d?.data || {};
}
async function readBlob(index, key) {
  const loc = index.blobs?.[key]; if (!loc) return null;
  const s = await ledgerSession(`blob-${loc.s}`);
  const d = await fsGetMask(ledgerPath(s), s.token, [fp('x', key)]);
  return d?.data?.x?.[key] ?? null;
}
// Pick a shard with room (sizes come from the index), write the blob there. Returns {s, n}.
async function writeBlob(index, key, value) {
  const n = bytesOf(value);
  if (n > SHARD_CAP) throw Object.assign(new Error('blob_too_large'), { status: 413 });
  const use = {};
  for (const [k, b] of Object.entries(index.blobs || {})) if (k !== key) use[b.s] = (use[b.s] || 0) + Number(b.n || 0);
  const prev = index.blobs?.[key];
  const order = [...new Set([...(prev ? [prev.s] : []), ...Object.keys(use).map(Number).sort((a, b) => a - b)])];
  const next = Math.max(-1, ...Object.keys(use).map(Number), ...(prev ? [prev.s] : [])) + 1;
  for (const sh of [...order, next, next + 1]) {
    if ((use[sh] || 0) + n > SHARD_CAP) continue;
    const s = await ledgerSession(`blob-${sh}`);
    const r = await fsCommit([pathsWrite(docName(ledgerPath(s)), [[['x', key], value]])], s.token);
    if (r.ok) { if (prev && prev.s !== sh) await deleteBlob(prev.s, key).catch(() => {}); return { s: sh, n }; }
    if (!(r.code === 400 && /size|exceeds|too large|INVALID_ARGUMENT/i.test(r.text || r.status))) throw Object.assign(new Error(`blob_write ${r.code}`), { status: 502 });
  }
  throw Object.assign(new Error('store_full'), { status: 507 });
}
async function deleteBlob(shard, key) {
  const s = await ledgerSession(`blob-${shard}`);
  return fsCommit([pathsWrite(docName(ledgerPath(s)), [[['x', key], undefined]])], s.token);
}
const indexTx = (mutate) => ledgerTx(mutate, { which: 'blog' });

// First read anywhere seeds the store ONCE with the migrated Nest-vs-ChatGPT post (idempotent CAS; `seeded` stays true
// even if an admin later deletes the post, so it is never re-created).
let seedChecked = false;
export async function ensureSeed(index) {
  if (index.seeded || seedChecked) return index;
  const { post, bodies } = seedPost();
  const loc = await writeBlob(index, `p_${SEED_ID}`, JSON.stringify(bodies));
  const done = await indexTx((doc) => (doc.seeded ? { result: false } : { entries: [[['posts', SEED_ID], post], [['blobs', `p_${SEED_ID}`], loc], [['seeded'], true]], result: true }));
  seedChecked = true;
  if (done) await audit({ email: 'system' }, 'blog-migrate', SEED_ID, `Migrated "${post.langs.en.title}" (en/zh-Hant/zh-Hans) into the blog store`).catch(() => {});
  return readIndex();
}

// ---------- public ----------
const seg = (x) => SEG_LANG[String(x || '').toLowerCase()] || null;
async function indexForPublic() {
  try { return { index: await ensureSeed(await readIndex()), fallback: false }; } catch { // store unreachable → the bundled migrated post keeps the old URL working
    const { post } = seedPost();
    return { index: { posts: { [SEED_ID]: post }, media: {}, blobs: {} }, fallback: true };
  }
}
export async function blogIndexOp(url) {
  const lang = seg(url.searchParams.get('lang')); if (!lang) return html(404, renderBlog404('en'));
  const { index } = await indexForPublic();
  // Run 14: languages without blog posts (ja, ko, es …) list the English posts, linked to their English URLs, with a note.
  const src = BLOG_LANGS.includes(lang) ? lang : 'en';
  return html(200, renderBlogIndex({ lang, src, posts: livePosts(index.posts, src) }), PUBLIC_CACHE);
}
export async function blogPostOp(url) {
  const lang = seg(url.searchParams.get('lang')); const slug = String(url.searchParams.get('slug') || '').toLowerCase();
  if (!lang) return html(404, renderBlog404('en'));
  const { index, fallback } = await indexForPublic();
  const post = findLive(index.posts, lang, slug);
  if (!post) return html(404, renderBlog404(lang), { 'cache-control': 'public, max-age=0, s-maxage=30', 'x-robots-tag': 'noindex' });
  let bodies = null;
  if (fallback) bodies = seedPost().bodies;
  else { try { bodies = JSON.parse((await readBlob(index, `p_${post.id}`)) || '{}'); } catch { bodies = post.id === SEED_ID ? seedPost().bodies : {}; } }
  return html(200, renderBlogPost({ post, lang, body: bodies[lang] || '', media: index.media || {} }), PUBLIC_CACHE);
}
const blogFeed = (index, now = Date.now()) => Object.values(index.posts || {}).filter((p) => liveLangs(p, now).length).sort((a, b) => b.publishAt - a.publishAt).map((p) => {
  const urls = Object.fromEntries(liveLangs(p, now).map((l) => [l, postUrl(l, p.langs[l].slug)]));
  const l0 = p.langs.en ? 'en' : liveLangs(p, now)[0];
  return { urls, lastmod: new Date(Math.max(Number(p.publishAt), Number(p.updatedAt) || 0) + 8 * 3600e3).toISOString().slice(0, 10), title: p.langs[l0].title, desc: p.langs[l0].excerpt || '', date: new Date(Number(p.publishAt) + 8 * 3600e3).toISOString().slice(0, 10) };
});
export async function blogSitemapOp() { const { index } = await indexForPublic(); return text(sitemapXml({ posts: blogFeed(index) }), 'application/xml', PUBLIC_CACHE); }
export async function blogLlmsOp() { const { index } = await indexForPublic(); return text(llmsTxt({ posts: blogFeed(index) }), 'text/plain', PUBLIC_CACHE); }
export async function blogMediaOp(id) {
  if (!MEDIA_RE.test(String(id || ''))) return json(404, { error: 'not_found' });
  const index = await readIndex([fp('media', id), fp('blobs', `i_${id}`)]).catch(() => ({}));
  const d = await readBlob(index, `i_${id}`).catch(() => null);
  const m = /^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || ''));
  if (!m) return json(404, { error: 'not_found' }, { 'cache-control': 'public, max-age=60' });
  const bin = Uint8Array.from(atob(m[2]), (ch) => ch.charCodeAt(0));
  return new Response(bin, { status: 200, headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable', 'vercel-cdn-cache-control': 'max-age=3600', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } });
}


// Run 13: deleting a post also removes images no remaining post uses (cover or media: refs in any language body).
// The deleted post's own images go at once; other unused uploads younger than ORPHAN_GRACE are kept, so an image uploaded into an unsaved editor isn't pulled from under it.
export const ORPHAN_GRACE = 6 * 3600e3;
export async function purgeOrphanMedia(now = Date.now(), own = []) {
  const mine = new Set(own);
  const index = await readIndex();
  const used = new Set();
  for (const p of Object.values(index.posts || {})) {
    if (p.cover) used.add(p.cover);
    // A body that can't be read aborts the purge (throws) rather than treating its images as unused.
    if (!index.blobs?.[`p_${p.id}`]) continue;
    const bodies = JSON.parse(await readBlob(index, `p_${p.id}`));
    for (const l of BLOG_LANGS) for (const m of mediaRefs(bodies[l] || '')) used.add(m);
  }
  const dead = Object.entries(index.media || {}).filter(([id, m]) => !used.has(id) && (mine.has(id) || now - Number(m?.at || 0) > ORPHAN_GRACE)).map(([id]) => id);
  if (!dead.length) return [];
  const locs = dead.map((id) => [id, index.blobs?.[`i_${id}`]]);
  await indexTx(() => ({ entries: dead.flatMap((id) => [[['media', id], undefined], [['blobs', `i_${id}`], undefined]]), result: true }));
  for (const [id, loc] of locs) if (loc) await deleteBlob(loc.s, `i_${id}`).catch(() => {});
  return dead;
}

// ---------- admin ----------
const summary = (p, now = Date.now()) => ({ id: p.id, status: statusOf(p, now), publishAt: p.publishAt || null, updatedAt: p.updatedAt, updatedBy: p.updatedBy, cover: p.cover || null,
  langs: Object.fromEntries(BLOG_LANGS.filter((l) => p.langs?.[l]).map((l) => [l, { title: p.langs[l].title, slug: p.langs[l].slug, has: !!p.langs[l].has }])) });
function storeStats(index) {
  const shards = {};
  for (const b of Object.values(index.blobs || {})) shards[b.s] = (shards[b.s] || 0) + Number(b.n || 0);
  return { shards: Object.entries(shards).map(([s, n]) => ({ s: Number(s), bytes: n, cap: SHARD_CAP })), posts: Object.keys(index.posts || {}).length, media: Object.keys(index.media || {}).length };
}
export async function blogAdminOp(c, req, url) {
  if (req.method === 'GET') {
    const index = await ensureSeed(await readIndex());
    const id = url.searchParams.get('id');
    if (id) {
      const p = index.posts?.[id]; if (!p) return json(404, { error: 'not_found' });
      const bodies = JSON.parse((await readBlob(index, `p_${id}`)) || '{}');
      return json(200, { post: p, bodies, status: statusOf(p), media: index.media || {} }, { 'cache-control': 'no-store' });
    }
    const posts = Object.values(index.posts || {}).map((p) => summary(p)).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return json(200, { posts, store: storeStats(index), limits: { ...LIMITS, imageBytes: 300 * 1024, shardCap: SHARD_CAP } }, { 'cache-control': 'no-store' });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = await req.json().catch(() => ({}));
  const op = String(body?.op || '');
  const now = Date.now();

  if (op === 'upload') {
    const img = checkImageDataUrl(body.image);
    if (img.error) return json(400, { error: img.error });
    const w = Math.round(Number(body.w) || 0); const h = Math.round(Number(body.h) || 0);
    if (!(w > 0 && w <= 4000 && h > 0 && h <= 4000)) return json(400, { error: 'bad_dimensions' });
    const kind = body.kind === 'cover' ? 'cover' : 'inline';
    const id = rid(12);
    const index = await readIndex();
    const loc = await writeBlob(index, `i_${id}`, String(body.image));
    await indexTx(() => ({ entries: [[['media', id], { s: loc.s, n: loc.n, mime: img.mime, w, h, kind, at: now, by: c.email }], [['blobs', `i_${id}`], loc]], result: true }));
    await audit(c, 'blog-upload', id, `${kind} image ${img.mime} ${w}×${h} ${Math.round(img.bytes / 1024)} KB`);
    return json(200, { ok: true, id, url: `/blog-media/${id}`, w, h, mime: img.mime, bytes: img.bytes });
  }
  if (op === 'preview') {
    const lang = BLOG_LANGS.includes(body.lang) ? body.lang : 'en';
    const r = cleanPostInput(body.post || {}, body.bodies || {});
    if (r.error) return json(400, r);
    if (!r.post.langs[lang]) return json(400, { error: 'lang_missing', lang });
    const index = await readIndex([fp('media')]).catch(() => ({}));
    const p = { id: 'preview', status: String(body.status || 'draft'), publishAt: Number(body.publishAt) || now, updatedAt: now, ...r.post };
    return json(200, { html: renderBlogPost({ post: p, lang, body: r.bodies[lang], media: index.media || {}, preview: true }) }, { 'cache-control': 'no-store' });
  }
  if (op === 'save') {
    const r = cleanPostInput(body.post || {}, body.bodies || {});
    if (r.error) return json(400, r);
    let id = String(body.id || '');
    const isNew = !id; if (isNew) id = rid(12);
    if (!POST_ID_RE.test(id)) return json(400, { error: 'bad_id' });
    const index = await readIndex();
    if (isNew && Object.keys(index.posts || {}).length >= LIMITS.posts) return json(409, { error: 'too_many' });
    const refs = BLOG_LANGS.flatMap((l) => mediaRefs(r.bodies[l]));
    const missing = [...refs, ...(r.post.cover ? [r.post.cover] : [])].filter((m) => !index.media?.[m]);
    if (missing.length) return json(400, { error: 'media_missing', detail: missing[0] });
    const clash = slugClash(index.posts, id, r.post.langs); if (clash) return json(409, { error: 'slug_taken', ...clash });
    const loc = await writeBlob(index, `p_${id}`, JSON.stringify(r.bodies));
    const res = await indexTx((doc) => {
      const old = doc.posts?.[id];
      if (!isNew && !old) return { result: { missing: true } };
      const c2 = slugClash(doc.posts, id, r.post.langs); if (c2) return { result: { clash: c2 } };
      const p = { id, status: old?.status || 'draft', publishAt: old?.publishAt || null, firstPublishedAt: old?.firstPublishedAt || null, createdAt: old?.createdAt || now, updatedAt: now, updatedBy: c.email, ...r.post };
      return { entries: [[['posts', id], p], [['blobs', `p_${id}`], loc]], result: { post: p } };
    });
    if (res?.missing) return json(404, { error: 'not_found' });
    if (res?.clash) return json(409, { error: 'slug_taken', ...res.clash });
    await audit(c, isNew ? 'blog-create' : 'blog-edit', id, `${Object.keys(r.post.langs).join('/')} · "${(r.post.langs['zh-Hant'] || r.post.langs.en || Object.values(r.post.langs)[0]).title.slice(0, 60)}"`);
    return json(200, { ok: true, id, post: summary(res.post) });
  }
  if (['publish', 'schedule', 'unpublish', 'delete'].includes(op)) {
    const id = String(body.id || ''); if (!POST_ID_RE.test(id)) return json(400, { error: 'bad_id' });
    let at = null;
    if (op === 'schedule') { at = Number(body.at); if (!(at > now + 30e3 && at < now + 366 * 864e5)) return json(400, { error: 'bad_time' }); }
    const bodyLoc = op === 'delete' ? (await readIndex([fp('blobs', `p_${id}`)]).catch(() => ({}))).blobs?.[`p_${id}`] : null;
    let ownMedia = [];
    if (op === 'delete') { try { const ix = await readIndex(); const p0 = ix.posts?.[id]; const b0 = JSON.parse((await readBlob(ix, `p_${id}`)) || '{}') || {}; ownMedia = [...(p0?.cover ? [p0.cover] : []), ...BLOG_LANGS.flatMap((l) => mediaRefs(b0[l] || ''))]; } catch {} }
    const res = await indexTx((doc) => {
      const p = doc.posts?.[id]; if (!p) return { result: null };
      if (op === 'delete') return { entries: [[['posts', id], undefined], [['blobs', `p_${id}`], undefined]], result: { post: p } };
      if ((op === 'publish' || op === 'schedule') && !BLOG_LANGS.some((l) => p.langs?.[l]?.title && p.langs?.[l]?.slug && p.langs?.[l]?.has)) return { result: { incomplete: true } };
      const n = { ...p, updatedAt: now, updatedBy: c.email };
      if (op === 'publish') { n.status = 'published'; n.publishAt = now; n.firstPublishedAt = p.firstPublishedAt || now; }
      if (op === 'schedule') { n.status = 'published'; n.publishAt = at; }
      if (op === 'unpublish') { n.status = 'draft'; }
      return { entries: [[['posts', id], n]], result: { post: n } };
    });
    if (!res) return json(404, { error: 'not_found' });
    if (res.incomplete) return json(400, { error: 'incomplete' });
    if (op === 'delete' && bodyLoc) await deleteBlob(bodyLoc.s, `p_${id}`).catch(() => {});
    let purged = [];
    if (op === 'delete') purged = await purgeOrphanMedia(Date.now(), ownMedia).catch(() => []);
    const title = (res.post.langs?.['zh-Hant'] || res.post.langs?.en || Object.values(res.post.langs || {})[0] || {}).title || id;
    await audit(c, `blog-${op}`, id, `"${String(title).slice(0, 60)}"${op === 'schedule' ? ` at ${new Date(at).toISOString()}` : ''}${purged.length ? ` · ${purged.length} unused image(s) removed` : ''}`);
    return json(200, { ok: true, id, ...(op === 'delete' ? { deleted: true, mediaRemoved: purged.length } : { post: summary(res.post) }) });
  }
  if (op === 'delete-media') {
    const id = String(body.id || ''); if (!MEDIA_RE.test(id)) return json(400, { error: 'bad_id' });
    const index = await readIndex();
    const used = Object.values(index.posts || {}).some((p) => p.cover === id);
    if (used) return json(409, { error: 'media_in_use' });
    const loc = index.blobs?.[`i_${id}`];
    await indexTx(() => ({ entries: [[['media', id], undefined], [['blobs', `i_${id}`], undefined]], result: true }));
    if (loc) await deleteBlob(loc.s, `i_${id}`).catch(() => {});
    await audit(c, 'blog-media-delete', id, 'image removed');
    return json(200, { ok: true });
  }
  return json(400, { error: 'bad_op' });
}
export { renderMarkdown, SEED_ID, SEED_SLUG };
