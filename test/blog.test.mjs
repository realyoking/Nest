import './_env.mjs';
// Run 12 — blog (網誌): sanitizer, iframe allowlist, slugs, schedule visibility, image checks, admin auth (401/403),
// and the whole store flow through api/ops.js against an in-memory Firestore REST + Identity Toolkit + JWKS mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHtml, renderMarkdown, embedSrc, iframeAllowed, slugProblem, slugClash, isLive, statusOf, livePosts, findLive, checkImageDataUrl, cleanMarkdown, cleanPostInput, badEmbeds,
} from '../src/lib/blog-core.js';

// ---------- pure ----------
test('sanitizer strips scripts, handlers, javascript: links, foreign images and non-allowlisted iframes', () => {
  const dirty = '<p onclick="x()">hi<script>alert(1)</script><style>p{}</style><img src="https://evil.example/x.png" onerror="alert(1)"><img src="/blog-media/abcdefgh12" alt="ok" onload="x"><a href="javascript:alert(1)">j</a><a href="https://ok.example/">ok</a><iframe src="https://evil.example/embed/x"></iframe><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1"></iframe><svg onload=alert(1)><circle/></svg><object data=x></object></p>';
  const out = sanitizeHtml(dirty);
  for (const bad of ['<script', 'alert(1)</', 'onclick', 'onerror', 'onload', 'javascript:', 'evil.example', '<svg', '<object', 'autoplay', '<style']) assert.ok(!out.includes(bad), `${bad} in ${out}`);
  assert.match(out, /<img src="\/blog-media\/abcdefgh12" alt="ok">/);
  assert.match(out, /<a href="https:\/\/ok\.example\/" rel="noopener nofollow">ok<\/a>/);
  assert.ok(!out.includes('<iframe'));
  // unbalanced / nested junk never leaves an open tag
  assert.equal(sanitizeHtml('<strong><em>x</strong>'), '<strong><em>x</em></strong>');
  assert.equal(sanitizeHtml('a < b > c'), 'a &lt; b &gt; c');
});
test('markdown renderer escapes raw HTML and produces only allowlisted markup', () => {
  const h = renderMarkdown('## T <img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1)) **b** `<i>`\n\n> q\n\n| a | b |\n|---|---|\n| 1 | 2 |');
  assert.ok(!/<script|<img src=x|<img[^>]*onerror|href="javascript/.test(h), h);
  assert.match(h, /<h2>T &lt;img src=x onerror=alert\(1\)&gt;<\/h2>/);
  assert.match(h, /<strong>b<\/strong> <code>&lt;i&gt;<\/code>/);
  assert.match(h, /<blockquote><p>q<\/p><\/blockquote>/);
  assert.match(h, /<table>/);
  assert.equal(cleanMarkdown('a<script>x</script>b<b>c</b>\u0000'), 'abc');
});
test('iframe allowlist: YouTube (nocookie) / Vimeo / Loom only, never autoplay', () => {
  assert.equal(embedSrc('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedSrc('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedSrc('https://youtube.com/shorts/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(embedSrc('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871?dnt=1');
  assert.equal(embedSrc('https://www.loom.com/share/0123456789abcdef0123456789abcdef'), 'https://www.loom.com/embed/0123456789abcdef0123456789abcdef');
  for (const bad of ['http://youtu.be/dQw4w9WgXcQ', 'https://evil.com/watch?v=dQw4w9WgXcQ', 'https://youtube.com.evil.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short', 'javascript:alert(1)', 'https://vimeo.com/abc'])
    assert.equal(embedSrc(bad), '', bad);
  assert.ok(iframeAllowed('https://player.vimeo.com/video/76979871?dnt=1'));
  assert.ok(!iframeAllowed('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1'));
  assert.ok(!iframeAllowed('https://www.youtube-nocookie.com/watch?v=dQw4w9WgXcQ'));
  assert.deepEqual(badEmbeds('@[video](https://evil.com/x)\n@[video](https://youtu.be/dQw4w9WgXcQ)'), ['https://evil.com/x']);
  assert.match(renderMarkdown('@[video](https://youtu.be/dQw4w9WgXcQ)'), /<div class="embed"><iframe src="https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ"/);
});
test('slug validation + unique per language', () => {
  assert.equal(slugProblem('nest-vs-chatgpt'), '');
  for (const [s, e] of [['', 'slug_empty'], ['ab', 'slug_short'], ['Nest', 'slug_chars'], ['a--b', 'slug_chars'], ['-ab', 'slug_chars'], ['中文標題', 'slug_chars'], ['admin', 'slug_reserved'], ['a'.repeat(81), 'slug_long']]) assert.equal(slugProblem(s), e, s);
  const posts = { a1: { id: 'a1', langs: { en: { slug: 'hello' }, 'zh-Hant': { slug: 'hello-zh' } } } };
  assert.deepEqual(slugClash(posts, 'b2', { en: { slug: 'hello' } }), { lang: 'en', slug: 'hello', id: 'a1' });
  assert.equal(slugClash(posts, 'b2', { 'zh-Hans': { slug: 'hello' } }), null); // same slug in another language is fine
  assert.equal(slugClash(posts, 'a1', { en: { slug: 'hello' } }), null); // own post
  assert.equal(cleanPostInput({ langs: { en: { title: 'T', slug: 'Bad Slug' } } }, { en: 'x' }).error, 'slug_chars');
  assert.equal(cleanPostInput({ langs: { en: { title: 'T', slug: 'ok-slug' } } }, { en: '@[video](https://evil.com/v)' }).error, 'bad_embed');
});
test('schedule visibility: drafts and future posts are never public', () => {
  const now = Date.parse('2026-10-19T12:00:00Z');
  const L = { en: { title: 'T', slug: 'post', has: true } };
  const draft = { id: 'd', status: 'draft', publishAt: now - 1e6, langs: L };
  const live = { id: 'l', status: 'published', publishAt: now - 1000, langs: { en: { title: 'T', slug: 'live', has: true } } };
  const later = { id: 's', status: 'published', publishAt: now + 3600e3, langs: { en: { title: 'T', slug: 'later', has: true } } };
  const noBody = { id: 'n', status: 'published', publishAt: now - 1000, langs: { en: { title: 'T', slug: 'nobody', has: false } } };
  assert.deepEqual([draft, live, later].map((p) => statusOf(p, now)), ['draft', 'published', 'scheduled']);
  assert.ok(!isLive(draft, now) && isLive(live, now) && !isLive(later, now));
  assert.ok(isLive(later, now + 3600e3 + 1)); // appears after its time
  const all = { d: draft, l: live, s: later, n: noBody };
  assert.deepEqual(livePosts(all, 'en', now).map((p) => p.id), ['l']);
  assert.equal(findLive(all, 'en', 'later', now), null); assert.equal(findLive(all, 'zh-Hant', 'live', now), null);
});
test('image checks: MIME allowlist, magic bytes, size cap', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(100)]);
  assert.equal(checkImageDataUrl(`data:image/png;base64,${png.toString('base64')}`).mime, 'image/png');
  assert.equal(checkImageDataUrl(`data:image/jpeg;base64,${jpg.toString('base64')}`).mime, 'image/jpeg');
  assert.equal(checkImageDataUrl(`data:image/webp;base64,${webp.toString('base64')}`).mime, 'image/webp');
  assert.equal(checkImageDataUrl(`data:image/png;base64,${jpg.toString('base64')}`).error, 'image_mismatch');
  assert.equal(checkImageDataUrl(`data:image/svg+xml;base64,${png.toString('base64')}`).error, 'bad_image_type');
  assert.equal(checkImageDataUrl(`data:image/gif;base64,${png.toString('base64')}`).error, 'bad_image_type');
  assert.equal(checkImageDataUrl(`data:image/png;base64,${Buffer.concat([png, Buffer.alloc(310 * 1024)]).toString('base64')}`).error, 'image_too_large');
});

// ---------- store flow through api/ops.js (mocked Google services) ----------
const { docs, commits, idToken } = await import('./fixtures/google-mock.mjs');
const ops = (await import('../api/ops.js')).default;
const call = async (path, { method = 'GET', token, body } = {}) => {
  const r = await ops(new Request(`https://heynest.vercel.app${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, text: t, json: j, headers: r.headers };
};
const ADMIN = await idToken('nest@official.heynest.invalid', 'officialUid0000000000000001', false);
const MEMBER = await idToken('nest-test-member@nest-test.invalid', 'memberUid123', true);
const UNVERIFIED_OWNER = await idToken('admin@nest.example', 'ownerUid1234', false);

test('admin auth: 401 without token, 403 for non-admins (incl. unverified allowlisted email), 200 for the official admin', async () => {
  assert.equal((await call('/api/ops?op=app-blog-admin')).status, 401);
  assert.equal((await call('/api/ops?op=app-blog-admin', { method: 'POST', body: { op: 'save' } })).status, 401);
  for (const t of [MEMBER, UNVERIFIED_OWNER, 'garbage.token.x']) {
    const r = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: t, body: { op: 'save', post: { langs: { en: { title: 'x', slug: 'xyz' } } }, bodies: { en: 'x' } } });
    assert.equal(r.status, t === 'garbage.token.x' ? 401 : 403, t.slice(0, 12));
  }
  const ok = await call('/api/ops?op=app-blog-admin', { token: ADMIN });
  assert.equal(ok.status, 200);
});

test('store: migration seed, draft → preview → publish → public page/schema/sitemap → unpublish → delete; schedule; media', async () => {
  // seeded on first read (once), served in 3 languages
  const list = await call('/api/ops?op=app-blog-admin', { token: ADMIN });
  const seed = list.json.posts.find((p) => p.id === 'nestvschatgpt');
  assert.ok(seed && seed.status === 'published' && Object.keys(seed.langs).length === 3);
  for (const seg of ['en', 'zh-hant', 'zh-hans']) {
    const r = await call(`/api/ops?op=blog-post&lang=${seg}&slug=nest-vs-chatgpt`);
    assert.equal(r.status, 200, seg); assert.match(r.text, /"@type":"BlogPosting"/); assert.match(r.text, /<link rel="canonical" href="https:\/\/blog\.nesty\.cyou\/[a-z-]+\/nest-vs-chatgpt" \/>/);
    assert.match(r.text, /hreflang="zh-Hant-HK"/); assert.match(r.text, /<table>/); assert.match(r.headers.get('cache-control'), /s-maxage=60/);
  }
  assert.match((await call('/api/ops?op=blog-post&lang=en&slug=nest-vs-chatgpt')).text, /not affiliated with OpenAI/);
  // Run 13: HEAD answers like GET without a body (was 404 JSON)
  for (const q of ['op=blog-post&lang=en&slug=nest-vs-chatgpt', 'op=blog-index&lang=zh-hant', 'op=blog-sitemap', 'op=blog-llms']) {
    const h = await call(`/api/ops?${q}`, { method: 'HEAD' });
    assert.equal(h.status, 200, q); assert.equal(h.text, '', q);
  }
  assert.equal((await call('/api/ops?op=blog-post&lang=en&slug=no-such-post', { method: 'HEAD' })).status, 404);
  const nSeedCommits = commits.length; await call('/api/ops?op=app-blog-admin', { token: ADMIN }); assert.equal(commits.length, nSeedCommits); // no re-seed

  // image upload (cover)
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(2000, 7)]);
  const up = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'upload', kind: 'cover', image: `data:image/webp;base64,${webp.toString('base64')}`, w: 1200, h: 630 } });
  assert.equal(up.status, 200, up.text); const cover = up.json.id;
  const bad = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'upload', image: `data:image/png;base64,${webp.toString('base64')}`, w: 10, h: 10 } });
  assert.equal(bad.json.error, 'image_mismatch');
  const media = await call(`/api/ops?op=blog-media&id=${cover}`);
  assert.equal(media.status, 200); assert.equal(media.headers.get('content-type'), 'image/webp'); assert.match(media.headers.get('cache-control'), /immutable/);

  // draft
  const post = { cover, langs: { en: { title: 'TEST post', slug: 'test-post', excerpt: 'Hello', coverAlt: 'A cover' }, 'zh-Hant': { title: '測試文章', slug: 'test-post' } } };
  const bodies = { en: '## Hi\n\nBody <script>alert(1)</script> text.\n\n@[video](https://youtu.be/dQw4w9WgXcQ)', 'zh-Hant': '內容' };
  const clash = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'save', post: { langs: { en: { title: 'x', slug: 'nest-vs-chatgpt' } } }, bodies: { en: 'x' } } });
  assert.equal(clash.status, 409); assert.equal(clash.json.error, 'slug_taken');
  const saved = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'save', post, bodies } });
  assert.equal(saved.status, 200, saved.text); const id = saved.json.id; assert.equal(saved.json.post.status, 'draft');
  const got = await call(`/api/ops?op=app-blog-admin&id=${id}`, { token: ADMIN });
  assert.ok(!got.json.bodies.en.includes('<script'), 'raw HTML stripped server-side on save');
  assert.equal((await call('/api/ops?op=blog-post&lang=en&slug=test-post')).status, 404); // draft not public
  const prev = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'preview', lang: 'en', post, bodies } });
  assert.match(prev.json.html, /noindex, nofollow/); assert.match(prev.json.html, /PREVIEW/); assert.ok(!prev.json.html.includes('<script>alert'));

  // publish → public, schema, OG image = cover, sitemap + llms
  assert.equal((await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'publish', id } })).status, 200);
  const pub = await call('/api/ops?op=blog-post&lang=en&slug=test-post');
  assert.equal(pub.status, 200); assert.match(pub.text, /"@type":"BlogPosting"/);
  assert.match(pub.text, new RegExp(`<meta property="og:image" content="https://nesty.cyou/blog-media/${cover}" />`));
  assert.match(pub.text, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/); assert.ok(!pub.text.includes('alert(1)'));
  assert.match(pub.text, /hreflang="zh-Hant-HK" href="https:\/\/blog\.nesty\.cyou\/zh-hant\/test-post"/);
  assert.ok(!pub.text.includes('<link rel="alternate" hreflang="zh-Hans"')); // no zh-Hans version → no alternate
  assert.match((await call('/api/ops?op=blog-index&lang=en')).text, /TEST post/);
  assert.match((await call('/api/ops?op=blog-sitemap')).text, /https:\/\/blog\.nesty\.cyou\/en\/test-post/);
  assert.match((await call('/api/ops?op=blog-llms')).text, /TEST post/);
  assert.equal((await call('/api/ops?op=blog-post&lang=zh-hans&slug=test-post')).status, 404);

  // unpublish → gone; schedule in the future → still not public
  await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'unpublish', id } });
  assert.equal((await call('/api/ops?op=blog-post&lang=en&slug=test-post')).status, 404);
  assert.ok(!(await call('/api/ops?op=blog-sitemap')).text.includes('test-post'));
  const sch = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'schedule', id, at: Date.now() + 3600e3 } });
  assert.equal(sch.json.post.status, 'scheduled');
  assert.equal((await call('/api/ops?op=blog-post&lang=en&slug=test-post')).status, 404);
  assert.equal((await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'schedule', id, at: Date.now() - 1000 } })).json.error, 'bad_time');

  // non-admin can't touch it; delete → gone; media still referenced? cover no longer used after delete
  assert.equal((await call('/api/ops?op=app-blog-admin', { method: 'POST', token: MEMBER, body: { op: 'delete', id } })).status, 403);
  // Run 13: a fresh unused upload (another editor in progress) survives the orphan purge; the deleted post's cover doesn't
  const fresh = (await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'upload', kind: 'inline', image: `data:image/webp;base64,${webp.toString('base64')}`, w: 10, h: 10 } })).json.id;
  const del = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'delete', id } });
  assert.equal(del.json.deleted, true); assert.equal(del.json.mediaRemoved, 1);
  assert.ok(!(await call('/api/ops?op=app-blog-admin', { token: ADMIN })).json.posts.some((p) => p.id === id));
  assert.equal((await call(`/api/ops?op=blog-media&id=${cover}`)).status, 404, 'own cover purged on delete');
  assert.equal((await call(`/api/ops?op=blog-media&id=${fresh}`)).status, 200, 'fresh orphan kept (grace)');
  assert.equal((await call(`/api/ops?op=blog-media&id=${fresh}`, { method: 'HEAD' })).status, 200);
  assert.equal((await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'delete-media', id: fresh } })).status, 200);
  assert.equal((await call(`/api/ops?op=blog-media&id=${fresh}`)).status, 404);

  // audit log entries for every write
  const ledgerDoc = [...docs.entries()].find(([k]) => k.endsWith('uid_nestledger'))?.[1]?.fields || {};
  const acts = (ledgerDoc.log || []).map((e) => e.action);
  for (const a of ['blog-migrate', 'blog-upload', 'blog-create', 'blog-publish', 'blog-unpublish', 'blog-schedule', 'blog-delete', 'blog-media-delete']) assert.ok(acts.includes(a), a);
  assert.ok(!('promos' in ledgerDoc), 'beta ledger promos untouched');
});

test('store: blobs spill to a new shard when one is full (no single 1 MiB doc limit)', async () => {
  const { SHARD_CAP } = await import('../api/_blog.js');
  const big = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(290 * 1024, 1)]).toString('base64');
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const r = await call('/api/ops?op=app-blog-admin', { method: 'POST', token: ADMIN, body: { op: 'upload', image: `data:image/webp;base64,${big}`, w: 100, h: 100 } });
    assert.equal(r.status, 200, r.text); ids.push(r.json.id);
  }
  const st = (await call('/api/ops?op=app-blog-admin', { token: ADMIN })).json.store;
  assert.ok(st.shards.length >= 2, JSON.stringify(st)); for (const s of st.shards) assert.ok(s.bytes <= SHARD_CAP);
  for (const id of ids) assert.equal((await call(`/api/ops?op=blog-media&id=${id}`)).status, 200);
});
test('store unreachable → the migrated post still renders from the bundled copy', async () => {
  const saved = new Map(docs); docs.clear();
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (u, i) => (String(u).includes('firestore') ? new Response('{}', { status: 503 }) : prevFetch(u, i));
  try {
    const r = await call('/api/ops?op=blog-post&lang=zh-hant&slug=nest-vs-chatgpt');
    assert.equal(r.status, 200); assert.match(r.text, /BlogPosting/);
  } finally { globalThis.fetch = prevFetch; for (const [k, v] of saved) docs.set(k, v); }
});
