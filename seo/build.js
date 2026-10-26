// Prerendered public pages + crawler files (Vite plugin `nest-seo`). The renderers live in seo/render.js (fs-free, shared
// with the Edge function); this file adds the build step that writes dist/.
import fs from 'node:fs';
import path from 'node:path';
import { SEO, LANGS, PAGES } from './config.js';
import { langsFor } from './render.js';
import { renderLegal, LEGAL_KINDS } from './legal.js';
import { absolutize, withVerification, spaShell, renderRoot, renderHome, renderPage, robotsTxt, sitemapXml, llmsTxt, llmsFullTxt } from './render.js';
export * from './render.js';

// ---------- main ----------
export function buildSeo(outDir, { log = console.log, staticBlog = false } = {}) {
  const idx = path.join(outDir, 'index.html');
  if (!fs.existsSync(idx)) return;
  let shell = fs.readFileSync(idx, 'utf8');
  if (shell.includes('<div id="seo">')) { log('nest-seo: index.html is already the root page — skipped'); return; }
  shell = withVerification(shell);
  const written = [];
  const put = (rel, text) => { const f = path.join(outDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); written.push(rel); };
  put('spa.html', spaShell(shell));
  const beta = path.join(outDir, 'beta', 'index.html');
  if (fs.existsSync(beta)) put('beta/index.html', withVerification(fs.readFileSync(beta, 'utf8')));
  put('index.html', renderRoot(shell));
  // Run 12: the blog (index + posts), sitemap.xml and llms.txt are DYNAMIC (api/ops.js reads the blog store), so they are NOT
  // written here — a file in dist/ would win over the vercel.json rewrite. `staticBlog: true` (tests) writes the old files.
  for (const l of LANGS) for (const p of PAGES) { if (!staticBlog && p.startsWith('blog')) continue; if (!langsFor(p).includes(l)) continue; put(`${l.seg}/${p === '' ? 'home' : p}.html`, p === '' ? renderHome(shell, l.id) : p === 'changelog' || p.startsWith('blog') ? absolutize(renderPage(l.id, p)) : renderPage(l.id, p)); } // Run 18: changelog/blog are served on sub-site hosts
  // Run 16: static legal pages (Google OAuth verification): /privacy + /terms (English) and /<seg>/privacy|terms.
  for (const k of LEGAL_KINDS) { put(`${k}.html`, renderLegal('en', k)); for (const l of LANGS) put(`${l.seg}/${k}.html`, renderLegal(l.id, k)); }
  put('robots.txt', robotsTxt());
  if (staticBlog) { put('sitemap.xml', sitemapXml()); put('llms.txt', llmsTxt()); }
  put('llms-full.txt', llmsFullTxt());
  if (SEO.indexNowKey) put(`${SEO.indexNowKey}.txt`, SEO.indexNowKey);
  for (const [name, text] of Object.entries(SEO.verificationFiles || {})) put(name, text);
  log(`nest-seo: wrote ${written.length} files (${LANGS.length} languages × ${PAGES.length} pages + root, spa shell, robots, sitemap, llms, IndexNow key)`);
  return written;
}
