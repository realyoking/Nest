import './_env.mjs';
import { AUTH_HEAD_SCRIPT } from '../src/lib/auth-hint.js';
// Run 9 SEO/GEO: prerendered pages, head tags, JSON-LD, robots/sitemap/llms, Vercel routing, zh-Hant 書面語.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSeo, copyFor, allUrls, jsonLd, robotsTxt, DISALLOW, langsFor, LANG_SAVE_SCRIPT, pageUrl } from '../seo/build.js';
import { SEO, LANGS, PAGES } from '../seo/config.js';
import { COPY, PLUGINS } from '../seo/content.js';
import { resolve, compileSource } from '../scripts/vercel-routes.mjs';

const COLLOQUIAL = /(尋日|琴日|聽日|嘅|咗|唔|喺|佢|冇|嚟|啲|嘢|咩|乜|噉|嗰|呢個|呢啲|呢度|而家|點樣|(?<![關联聯])係|嚔|囉|喎|睇|畀|攞|搵|諗|早晨！)/;
const TW_ONLY = /(網路|軟體|使用者|帳號|品質|列印|硬碟|行動裝置|簡訊|視訊|部落格|貼文|滑鼠|數位|計程車|捷運|公車|國中|補習班)/;
const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };

// Build into a temp dir from the source index.html (stands in for vite's dist/index.html).
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-seo-'));
fs.writeFileSync(path.join(OUT, 'index.html'), fs.readFileSync('index.html', 'utf8').replace('<script type="module" src="/src/main.jsx"></script>', '<script type="module" crossorigin src="/assets/index-TEST.js"></script>\n    <link rel="stylesheet" crossorigin href="/assets/index-TEST.css">'));
fs.mkdirSync(path.join(OUT, 'beta')); fs.writeFileSync(path.join(OUT, 'beta', 'index.html'), fs.readFileSync(path.join(OUT, 'index.html'), 'utf8'));
for (const f of ['sw.js', 'oauth-callback.html', 'icon-192.png', 'apple-touch-icon.png']) fs.writeFileSync(path.join(OUT, f), 'x');
buildSeo(OUT, { log: () => {}, staticBlog: true });
const read = (rel) => fs.readFileSync(path.join(OUT, rel), 'utf8');
const fileOf = (l, p) => `${LANGS.find((x) => x.id === l).seg}/${p === '' ? 'home' : p}.html`; // Run 18: <seg>/home.html (an <seg>/index.html would shadow the blog/changelog host rewrites)
const head = (h) => h.split('</head>')[0];
const lds = (h) => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const text = (h) => h.split('<body>')[1].replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('zh-Hant SEO copy is Hong Kong 書面語 (same rules as zh-hk.test)', () => {
  const bad = strings(COPY['zh-Hant']).concat(PLUGINS.flatMap((p) => [p.nameZh, p.zh])).filter((s) => COLLOQUIAL.test(s) || TW_ONLY.test(s));
  assert.deepEqual(bad, []);
});

test('every page × language exists, with unique title + description, canonical, hreflang, OG/Twitter, verification', () => {
  const titles = new Set(); const descs = new Set();
  for (const p of PAGES) for (const l of langsFor(p)) {
    const h = read(fileOf(l.id, p)); const hd = head(h);
    const url = pageUrl(l.id, p); // Run 18: blog/changelog → their hosts
    const title = hd.match(/<title>([^<]+)<\/title>/)[1]; const desc = hd.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(!titles.has(title), `duplicate title ${title}`); titles.add(title);
    assert.ok(!descs.has(desc), `duplicate description ${desc}`); descs.add(desc);
    assert.ok(desc.length >= (l.id === 'en' ? 50 : 30) && desc.length <= 230, `${url} description length ${desc.length}`);
    assert.ok(p === '' ? new RegExp('^<!doctype html>\\s*<html lang="' + l.html + '"', 'i').test(h) : h.startsWith('<!doctype html>\n<html lang="' + l.html + '">'), `${url} html lang`);
    assert.ok(hd.includes(`<link rel="canonical" href="${url}" />`), url);
    for (const x of langsFor(p)) assert.ok(hd.includes(`hreflang="${x.hreflang}" href="${pageUrl(x.id, p)}"`), `${url} → ${x.hreflang}`);
    assert.ok(hd.includes(`hreflang="x-default" href="${p === '' ? SEO.site + '/' : pageUrl('en', p)}"`));
    for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale']) assert.ok(hd.includes(`property="${k}"`), `${url} ${k}`);
    for (const k of ['twitter:card', 'twitter:title', 'twitter:image']) assert.ok(hd.includes(`name="${k}"`), `${url} ${k}`);
    assert.ok(hd.includes(`og:url" content="${url}"`));
    for (const g of [].concat(SEO.googleSiteVerification)) assert.ok(hd.includes(`<meta name="google-site-verification" content="${g}" />`), `${url} GSC ${g}`);
    assert.ok(hd.includes('<meta name="google-site-verification" content="testGscToken1" />'), `${url} nesty.cyou GSC token`);
    assert.ok(!hd.includes('msvalidate.01'), 'Bing tag stays off while bingMsvalidate is empty');
    if (p !== '') { assert.ok(!/<script(?![^>]*application\/ld\+json)/.test(h.replace(AUTH_HEAD_SCRIPT, '').replace(LANG_SAVE_SCRIPT, '')), `${url} has no JS (except the Run 12 auth-CTA head script + Run 14 language-save script)`); assert.ok(Buffer.byteLength(h) < (p === "changelog" ? 64000 : l.id === "th" ? 48000 : 40000), `${url} is small (${Buffer.byteLength(h)} B)`); /* Run 14: Thai is 3 bytes per character in UTF-8; the changelog grows with every release */ }
    else assert.ok(h.includes('<div id="root"><div id="seo">'), `${url} = the landing shell with static text`);
  }
});

test('home first sentence says what Nest is and who it is for (all languages, root too)', () => {
  assert.match(text(read('en/home.html')), /Nest is a free AI family app for students and parents: a homework tutor/);
  assert.match(text(read('zh-hant/home.html')), /Nest 是為學生及家長而設的免費 AI 家庭應用程式/);
  assert.match(text(read('zh-hans/home.html')), /Nest 是为学生及家长而设的免费 AI 家庭应用/);
  const root = text(read('index.html'));
  assert.match(root, /Nest is a free AI family app for students and parents: a homework tutor/);
  assert.match(root, /免費 AI 家庭應用程式/);
});

test('JSON-LD: Organization, WebSite, WebApplication (free offer), WebPage, BreadcrumbList, FAQPage', () => {
  const KNOWN = new Set(['Organization', 'WebSite', 'WebApplication', 'WebPage', 'FAQPage', 'BreadcrumbList', 'ListItem', 'Question', 'Answer', 'Offer', 'ImageObject', 'ContactPoint', 'Blog', 'BlogPosting', 'CollectionPage']);
  const walk = (o, f) => { if (Array.isArray(o)) o.forEach((x) => walk(x, f)); else if (o && typeof o === 'object') { f(o); Object.values(o).forEach((x) => walk(x, f)); } };
  for (const p of PAGES) for (const l of langsFor(p)) {
    const [ld] = lds(read(fileOf(l.id, p)));
    assert.equal(ld['@context'], 'https://schema.org');
    const g = ld['@graph']; const by = (t) => g.find((x) => [].concat(x['@type']).includes(t));
    walk(ld, (o) => { if (o['@type']) for (const t of [].concat(o['@type'])) assert.ok(KNOWN.has(t), `unknown type ${t}`); });
    assert.equal(by('Organization').url, SEO.site + '/'); assert.ok(by('Organization').logo.url.endsWith('/icon-512.png'));
    assert.equal(by('WebSite')['@id'], SEO.site + '/#website');
    const app = by('WebApplication'); assert.equal(app.offers.price, '0'); assert.equal(app.offers.priceCurrency, 'HKD'); assert.ok(app.applicationCategory && app.operatingSystem && app.name === 'Nest');
    const wp = by('WebPage'); assert.equal(wp.url, pageUrl(l.id, p)); assert.equal(wp.inLanguage, l.html);
    if (p) {
      const bc = by('BreadcrumbList'); assert.ok(bc, `${p} breadcrumb`);
      bc.itemListElement.forEach((it, i) => { assert.equal(it.position, i + 1); assert.ok(it.name); });
      assert.equal(bc.itemListElement.at(-1).item, wp.url);
      assert.equal(bc.itemListElement[0].item, `${SEO.site}/${l.seg}/`);
    }
    if (p === 'faq') {
      const faq = by('FAQPage'); const n = copyFor(l.id).pages.faq.sections[0].faq.length;
      assert.equal(faq.mainEntity.length, n); assert.ok(n >= 8);
      for (const q of faq.mainEntity) { assert.equal(q['@type'], 'Question'); assert.ok(q.name.length > 3); assert.equal(q.acceptedAnswer['@type'], 'Answer'); assert.ok(!/\]\(/.test(q.acceptedAnswer.text)); }
    } else assert.ok(!by('FAQPage'));
  }
  assert.ok(lds(read('index.html')).length === 1);
});

test('root page: SPA shell + static content, x-default, hide script, watchdog; spa.html noindex; beta verified', () => {
  const r = read('index.html');
  assert.ok(r.includes('<div id="root"><div id="seo">'));
  assert.ok(r.includes('/assets/index-TEST.js'), 'still loads the SPA bundle');
  assert.ok(r.includes(`<link rel="canonical" href="${SEO.site}/" />`));
  assert.ok(r.includes(`hreflang="x-default" href="${SEO.site}/"`) && r.includes(`hreflang="en" href="${SEO.site}/en/"`));
  assert.ok(r.includes("location.pathname!=='/'") && r.includes('.seo-off #seo{display:none}'));
  assert.ok(r.includes("if (c.id !== 'seo') return;"), 'boot watchdog ignores the static block');
  assert.equal((r.match(/google-site-verification/g) || []).length, [].concat(SEO.googleSiteVerification).length);
  assert.ok(r.includes('content="testGscToken1"'), 'root carries the nesty.cyou GSC token');
  const s = read('spa.html');
  assert.ok(s.includes('<meta name="robots" content="noindex" />') && !s.includes('rel="canonical"') && !s.includes('<div id="seo">'));
  assert.ok(s.includes('google-site-verification'));
  assert.ok(read('beta/index.html').includes('google-site-verification'));
});

test('robots.txt: named AI/search bots allowed, private paths blocked, sitemap line', () => {
  const r = read('robots.txt');
  for (const b of ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'Applebot']) assert.match(r, new RegExp(`User-agent: ${b}\\nAllow: /\\n`));
  for (const d of ['/app/', '/admin', '/api/', '/__/']) assert.ok(r.includes(`Disallow: ${d}\n`));
  assert.ok(r.includes(`Sitemap: ${SEO.site}/sitemap.xml`));
  // simple prefix matcher ($ = end) — public pages + icons must stay crawlable
  const blocked = (p) => DISALLOW.some((d) => (d.endsWith('$') ? p === d.slice(0, -1) : p.startsWith(d)));
  for (const p of ['/', '/en/', '/zh-hant/faq', '/apple-touch-icon.png', '/beta', '/llms.txt', '/shots/tutor-en.png']) assert.ok(!blocked(p), p);
  for (const p of ['/app', '/app/agent', '/admin', '/api/chat', '/__/auth/handler', '/auth']) assert.ok(blocked(p), p);
  assert.equal(robotsTxt(), r);
});

test('sitemap.xml lists every public URL with alternates + lastmod; llms.txt / llms-full.txt; IndexNow key file', () => {
  const x = read('sitemap.xml');
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs.sort(), allUrls().sort());
  assert.equal(locs.length, 1 + PAGES.reduce((n, p) => n + langsFor(p).length, 0));
  assert.equal((x.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length, locs.length);
  assert.equal((x.match(/<xhtml:link /g) || []).length, (LANGS.length + 1) + PAGES.reduce((n, p) => n + langsFor(p).length * (langsFor(p).length + 1), 0));
  const l = read('llms.txt');
  assert.match(l, /^# Nest\n\n> Nest is a free AI family app/);
  for (const u of LANGS.map((x) => `${SEO.site}/${x.seg}/`)) assert.ok(l.includes(u));
  assert.ok(l.includes(SEO.contactEmail));
  const f = read('llms-full.txt');
  assert.ok(f.length > 8000 && f.includes('## Frequently asked questions') && f.includes('HK$38/month'));
  assert.equal(read(`${SEO.indexNowKey}.txt`), SEO.indexNowKey);
  assert.match(SEO.indexNowKey, /^[a-f0-9]{32}$/);
});

test('vercel.json: static pages win over the SPA fallback; /app, /admin, api, auth, oauth, sw unchanged', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const R = (p) => resolve(p, { dist: OUT, config });
  const rel = (p) => { const r = R(p); return r.proxy || (r.file && path.relative(OUT, r.file)); };
  assert.equal(rel('/'), 'index.html');
  for (const p of PAGES) for (const l of langsFor(p)) {
    if (p.startsWith('blog')) continue; // Run 12: dynamic (api/ops.js), checked below
    if (p === 'changelog') { assert.equal(path.relative(OUT, resolve(`/${l.seg}/`, { dist: OUT, config, host: 'changelog.nesty.cyou' }).file), fileOf(l.id, p)); continue; } // Run 18
    assert.equal(rel(`/${l.seg}/${p}`), fileOf(l.id, p), `/${l.seg}/${p}`);
  }
  // Run 12: blog index / posts / media / sitemap / llms.txt → api/ops.js (dynamic, from the blog store)
  const RB = (p) => resolve(p, { dist: OUT, config, host: 'blog.nesty.cyou' }); // Run 18: blog lives on blog.nesty.cyou
  assert.equal(RB('/zh-hant/').dest, '/api/ops?op=blog-index&lang=zh-hant'); assert.equal(RB('/zh-hant').dest, '/api/ops?op=blog-index&lang=zh-hant');
  assert.equal(RB('/en/nest-vs-chatgpt').dest, '/api/ops?op=blog-post&lang=en&slug=nest-vs-chatgpt');
  assert.equal(RB('/zh-hans/my-post-2').dest, '/api/ops?op=blog-post&lang=zh-hans&slug=my-post-2');
  assert.equal(RB('/blog-media/abcdefgh1234').dest, '/api/ops?op=blog-media&id=abcdefgh1234');
  assert.equal(R('/blog-media/abcdefgh1234').dest, '/api/ops?op=blog-media&id=abcdefgh1234');
  assert.equal(rel('/en'), 'en/home.html'); assert.equal(rel('/en/'), 'en/home.html');
  for (const p of ['/app', '/app/agent', '/app/u/someone', '/admin', '/pricing', '/join/abc', '/auth', '/onboarding']) assert.equal(rel(p), 'spa.html', p);
  assert.equal(rel('/beta'), 'beta/index.html');
  // Run 16: static legal pages, Firebase email action handler, status page
  assert.equal(rel('/terms'), 'terms.html'); assert.equal(rel('/privacy'), 'privacy.html');
  assert.equal(rel('/zh-hant/privacy'), 'zh-hant/privacy.html'); assert.equal(rel('/ja/terms'), 'ja/terms.html');
  assert.equal(R('/auth/action').dest, '/auth/action.html'); assert.equal(R('/status').dest, '/status.html');
  assert.equal(rel('/sw.js'), 'sw.js'); assert.equal(rel('/oauth-callback.html'), 'oauth-callback.html');
  assert.equal(rel('/robots.txt'), 'robots.txt');
  { const cfg2 = { ...config }; const R2 = (p) => resolve(p, { dist: path.join(OUT, '__none__'), config: cfg2 }); assert.equal(R2('/sitemap.xml').dest, '/api/ops?op=blog-sitemap'); assert.equal(R2('/llms.txt').dest, '/api/ops?op=blog-llms'); }
  assert.match(rel('/__/auth/handler'), /^https:\/\/[a-z0-9-]+\.firebaseapp\.com\/__\/auth\/handler$/);
  // API rewrites keep their order and targets
  assert.equal(R('/api/promo/claim').dest, '/api/ops?op=promo-claim');
  assert.equal(R('/api/plugins/listing').dest, '/api/ops?op=plug-listing');
  const last = config.rewrites.at(-1); assert.equal(last.destination, '/spa.html');
  assert.ok(compileSource(last.source).test('/app/agent') && !compileSource(last.source).test('/api/chat'));
  // no new serverless functions (Hobby cap 12)
  const fns = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (!f.startsWith('_') && f.endsWith('.js')) fns.push(p); } })('api');
  assert.equal(fns.length, 12);
});

test('service worker never caches static SEO pages as the app shell', () => {
  const sw = fs.readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /nest-sw-v9/);
  assert.match(sw, /\(en\|zh-hant\|zh-hans\|ja\|ko\|es\|fr\|de\|pt-br\|id\|vi\|th\)/);
});

test('no secrets in the SEO config / output', () => {
  const all = fs.readFileSync('seo/config.js', 'utf8') + read('llms-full.txt') + read('index.html');
  assert.ok(!/AGNES|sk-[A-Za-z0-9]{20}|PRIVATE KEY|CLIENT_SECRET|TOKEN_ENC|NEST_LEDGER/.test(all));
});

test('ChatGPT comparison (now a blog post) stays factual: cites OpenAI as the source and states no affiliation', () => {
  for (const l of langsFor('blog/nest-vs-chatgpt')) {
    const h = read(fileOf(l.id, 'blog/nest-vs-chatgpt'));
    assert.ok(h.includes('https://openai.com/index/chatgpt-for-teens'));
    const g = lds(h)[0]['@graph']; const post = g.find((x) => x['@type'] === 'BlogPosting');
    assert.ok(post && post.datePublished === '2026-10-19' && post.headline && post.author && post.publisher, `${l.id} BlogPosting`);
    const blog = lds(read(fileOf(l.id, 'blog')))[0]['@graph'].find((x) => x['@type'] === 'Blog'); assert.ok(blog.blogPost.length >= 1);
  }
  assert.match(text(read('en/blog/nest-vs-chatgpt.html')), /not affiliated with OpenAI/);
});

test('Run 11: one nav everywhere (7 items incl. blog), one language switch, 301s for the old comparison URLs', () => {
  for (const p of PAGES) for (const l of langsFor(p)) {
    const h = read(fileOf(l.id, p));
    const nav = h.match(/<nav class="snav-links"[^>]*>([\s\S]*?)<\/nav>/); assert.ok(nav, `${l.id}/${p} nav`);
    assert.equal((nav[1].match(/<a /g) || []).length, 8, `${l.id}/${p} nav items`); // Run 18: + Status
    assert.ok(nav[1].includes(`https://blog.nesty.cyou/${l.seg}/`) && nav[1].includes(`https://changelog.nesty.cyou/${l.seg}/`) && nav[1].includes('https://status.nesty.cyou/') && nav[1].includes(`/${l.seg}/#demo`), `${l.id}/${p} nav hrefs`);
    assert.equal((h.match(/class="langseg"/g) || []).length, 0, `${l.id}/${p} old EN|繁|简 segment gone`);
    assert.equal((h.match(/<details class="lang" data-lang-menu>/g) || []).length, 1, `${l.id}/${p} one language dropdown`);
    const menu = h.match(/<div class="lang-menu" role="menu">([\s\S]*?)<\/div><\/details>/)[1];
    assert.equal((menu.match(/data-setlang=/g) || []).length, LANGS.length, `${l.id}/${p} dropdown lists all ${LANGS.length} languages`);
    assert.equal((menu.match(/aria-current="true"/g) || []).length, 1);
    assert.equal((h.match(/<div class="snav-langs"/g) || []).length, 1, `${l.id}/${p} languages inside the mobile menu`);
  }
  const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const r = vj.redirects.find((x) => x.source.includes('compare/nest-vs-chatgpt-homework') && x.source.includes(':lang'));
  assert.equal(r.statusCode, 301); assert.equal(r.destination, 'https://blog.nesty.cyou/:lang/nest-vs-chatgpt');
  assert.ok(vj.rewrites.some((x) => x.destination === '/api/ops?op=blog-post&lang=:lang&slug=:slug'));
  assert.ok(!vj.rewrites.some((x) => x.source.includes('compare')));
  const sm = read('sitemap.xml'); assert.ok(sm.includes('https://blog.nesty.cyou/en/nest-vs-chatgpt') && !sm.includes('compare/') && !sm.includes('/en/blog'));
  assert.match(read('llms.txt'), /blog\.nesty\.cyou\/en\/nest-vs-chatgpt/);
});

test('Run 11: public copy is global, not Hong Kong-only', () => {
  for (const f of ['en/home.html', 'zh-hant/home.html', 'zh-hans/home.html', 'index.html']) {
    const t = text(read(f));
    assert.ok(!/for Hong Kong (students|families)|為香港(學生|家庭)|为香港(学生|家庭)|Made for Hong Kong families/.test(t), f);
  }
  const llms = read('llms.txt'); assert.match(llms, /any country or region/); assert.match(llms, /Hong Kong only/);
});

// Run 15: canonical origin moved to https://nesty.cyou — no generated SEO file may point at the old *.vercel.app hosts.
test('Run 15: every generated SEO file uses https://nesty.cyou', () => {
  assert.equal(SEO.site, 'https://nesty.cyou');
  assert.match(read('robots.txt'), /\nSitemap: https:\/\/nesty\.cyou\/sitemap\.xml/);
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const files = walk(OUT).filter((f) => /\.(html|txt|xml|json)$/.test(f));
  assert.ok(files.length > 50);
  for (const f of files) { const t = fs.readFileSync(f, 'utf8'); assert.ok(!/heynest\.vercel\.app|kabo-family\.vercel\.app|nest(fam|hk|family)\.vercel\.app/.test(t), `${path.relative(OUT, f)} mentions an old host`); }
  for (const u of allUrls()) assert.ok(/^https:\/\/(blog\.|changelog\.)?nesty\.cyou\//.test(u), u); // Run 18: + blog/changelog hosts
});

// Run 15: old hosts 301 to nesty.cyou, but never /api/*, /__/*, /oauth-callback.html, nor preview/team-alias hosts.
test('Run 15: host-based 301s to https://nesty.cyou with OAuth/auth exclusions', () => {
  const cfg = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const hostReds = cfg.redirects.filter((r) => r.has && /\.vercel\.app$/.test(r.has[0].value));
  assert.deepEqual(hostReds.map((r) => r.has[0].value).sort(), ['heynest.vercel.app', 'kabo-family.vercel.app', 'nestfam.vercel.app', 'nestfamily.vercel.app', 'nesthk.vercel.app']);
  for (const r of hostReds) {
    assert.equal(r.has[0].type, 'host'); assert.equal(r.statusCode, 301); assert.equal(r.destination, 'https://nesty.cyou/:path');
    const re = compileSource(r.source);
    for (const p of ['/', '/en/faq', '/app', '/join/abc', '/zh-hant/blog/nest-vs-chatgpt', '/sitemap.xml', '/beta']) assert.ok(re.test(p), `${p} redirects`);
    for (const p of ['/api/github/callback', '/api/oauth/callback', '/api/chat', '/__/auth/handler', '/__/firebase/init.json', '/oauth-callback.html']) assert.ok(!re.test(p), `${p} must NOT redirect`);
  }
});

test('Run 16+18: status/blog/changelog subdomains — status / → /status; blog + changelog are served ON their hosts', () => {
  const cfg = JSON.parse(fs.readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const go = (host, p) => { for (const r of cfg.redirects) { if (r.has && r.has[0].value !== host) continue; const m = p.match(compileSource(r.source)); if (m) return [r.statusCode || (r.permanent === false ? 307 : 308), r.destination.replace(/:(\w+)\*?/g, (_, n) => m.groups?.[n] ?? '')]; } return null; };
  assert.deepEqual(go('status.nesty.cyou', '/'), [307, '/status']);
  assert.equal(go('status.nesty.cyou', '/api/promo/health'), null);
  assert.equal(go('status.nesty.cyou', '/status'), null);
  // blog host: /<seg>/ and /<seg>/<slug> are served (no redirect); bare slug → /en/<slug>; root → /en/; anything else → main site
  for (const p of ['/en/', '/en', '/zh-hant/', '/zh-hant/nest-vs-chatgpt', '/ja/my-post-2', '/blog-media/abcdefgh1234', '/robots.txt', '/sitemap.xml', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/assets/x.js']) assert.equal(go('blog.nesty.cyou', p), null, `blog ${p}`);
  assert.deepEqual(go('blog.nesty.cyou', '/'), [307, '/en/']);
  assert.deepEqual(go('blog.nesty.cyou', '/nest-vs-chatgpt'), [301, '/en/nest-vs-chatgpt']);
  assert.deepEqual(go('blog.nesty.cyou', '/app'), [301, '/en/app']);
  assert.deepEqual(go('blog.nesty.cyou', '/en/features.html'), [301, 'https://nesty.cyou/en/features.html']);
  assert.deepEqual(go('blog.nesty.cyou', '/auth/x'), [301, 'https://nesty.cyou/auth/x']);
  // changelog host: /<seg>/ served; root → /en/; anything else → /en/
  for (const p of ['/en/', '/zh-hant', '/th/', '/robots.txt', '/favicon.svg']) assert.equal(go('changelog.nesty.cyou', p), null, `changelog ${p}`);
  assert.deepEqual(go('changelog.nesty.cyou', '/'), [307, '/en/']);
  assert.deepEqual(go('changelog.nesty.cyou', '/x/y'), [301, '/en/']);
  // old main-site paths → the sub-sites (one hop)
  assert.deepEqual(go('nesty.cyou', '/zh-hant/blog'), [301, 'https://blog.nesty.cyou/zh-hant/']);
  assert.deepEqual(go('nesty.cyou', '/en/blog/nest-vs-chatgpt'), [301, 'https://blog.nesty.cyou/en/nest-vs-chatgpt']);
  assert.deepEqual(go('nesty.cyou', '/ja/changelog'), [301, 'https://changelog.nesty.cyou/ja/']);
  assert.deepEqual(go('nesty.cyou', '/blog'), [301, 'https://blog.nesty.cyou/en/']);
  assert.deepEqual(go('nesty.cyou', '/compare/nest-vs-chatgpt-homework'), [301, 'https://blog.nesty.cyou/en/nest-vs-chatgpt']);
  assert.equal(go('nesty.cyou', '/en/'), null); assert.equal(go('nesty.cyou', '/en/pricing'), null);
  // no <seg>/index.html in the output (it would shadow the host rewrites — Vercel checks the filesystem first)
  for (const l of LANGS) { assert.ok(!fs.existsSync(path.join(OUT, l.seg, 'index.html')), `${l.seg}/index.html must not exist`); assert.ok(fs.existsSync(path.join(OUT, l.seg, 'home.html'))); }
  // pages served on the sub-site hosts never use host-relative <a href="/…"> links
  for (const l of LANGS) { const h = read(fileOf(l.id, 'changelog')); assert.ok(!/<a\b[^>]*\shref="\/(?!\/)/.test(h), `${l.id} changelog relative link`); assert.match(h, new RegExp(`<link rel="canonical" href="https://changelog\\.nesty\\.cyou/${l.seg}/"`)); }
  const rw = cfg.rewrites.map((r) => r.source); const spa = rw.length - 1;
  for (const s of ['/status', '/auth/action', '/privacy', '/terms']) assert.ok(rw.indexOf(s) > -1 && rw.indexOf(s) < spa, s);
  const act = fs.readFileSync(new URL('../public/auth/action.html', import.meta.url), 'utf8');
  assert.match(act, /noindex/); for (const m of ['resetPassword', 'verifyEmail', 'recoverEmail', 'verifyAndChangeEmail', 'continueUrl']) assert.ok(act.includes(m), m);
  const st = fs.readFileSync(new URL('../public/status.html', import.meta.url), 'utf8');
  // Run 19: one CDN-shared call replaces the 4 per-tab function calls (test/status.test.mjs covers the endpoint).
  assert.ok(st.includes('/api/ops?op=status-all'));
  for (const u of ['/api/push/cron?health=1', '/api/promo/health', '/api/oauth/callback?health=1', '/api/ops?op=status-ai']) assert.ok(!st.includes(u), u);
  assert.ok(!/\/api\/chat/.test(st), 'status page never calls the chat endpoint');
});
