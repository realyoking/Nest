// SEO / GEO configuration for the prerendered public pages (seo/build.js, run by the `nest-seo` Vite plugin after `vite build`).
// Everything here is PUBLIC (it ends up in HTML). Never put secrets in this file.
export const SEO = {
  site: SITE, // canonical origin (src/site.js, VITE_SITE_URL)
  // Content date for <lastmod> of pages without their own date (changelog/home use the newest changelog entry).
  updated: '2026-10-19',
  contactEmail: CONTACT_EMAIL, // same address as the in-app Help link (src/components/AccountMenu.jsx)

  // ---- Search console verification -------------------------------------------------------------------------
  // Meta tags go into the <head> of the root page, every static page and the SPA shell. Leave '' to omit a tag.
  // Google Search Console tokens (one <meta> each): VITE_GOOGLE_SITE_VERIFICATION, comma-separated. Empty = no tag.
  googleSiteVerification: env('VITE_GOOGLE_SITE_VERIFICATION').split(',').map((s) => s.trim()).filter(Boolean),
  // Bing Webmaster Tools: left empty on purpose — Bing imports the site from Google Search Console after Google verifies.
  // If ever needed: paste the msvalidate.01 content value here.
  bingMsvalidate: '',
  // Optional HTML verification files written to dist/ at build time: { 'google1234abcd.html': 'google-site-verification: google1234abcd.html',
  // 'BingSiteAuth.xml': '<?xml version="1.0"?><users><user>XXXX</user></users>' }. Each is ONE generated file, nothing to upload.
  verificationFiles: {},

  // ---- IndexNow (Bing, Yandex, Seznam, Naver …) ------------------------------------------------------------
  // Public key (VITE_INDEXNOW_KEY, 32 hex chars; empty = no key file). The build writes dist/<key>.txt containing the key.
  // Ping after a deploy: node scripts/indexnow.mjs
  indexNowKey: env('VITE_INDEXNOW_KEY'),

  // Social card (1200×630, English). One image for every page type keeps the upload count down.
  ogImage: '/og-v2.png',
  ogImageAlt: `Nest — Your family's AI home. ${SITE_HOST}`,
};

// URL scheme: /<seg>/<page>. Root "/" = x-default; "/" and /<seg>/ are the SAME interactive landing (static text in #root for crawlers).
// Run 14: 12 languages from the one registry (src/lib/langs.js): en, zh-Hant (HK), zh-Hans, ja, ko, es, fr, de, pt-BR, id, vi, th.
import { SITE, SITE_HOST } from '../src/site.js';
import { env } from '../src/env.js';
import { CONTACT_EMAIL } from '../src/contact.js';
import { LANGS as REG } from '../src/lib/langs.js';
export const LANGS = REG.map(({ id, seg, hreflang, html, og, label, short, flag }) => ({ id, seg, hreflang, html, og, label, short, flag }));
// Blog POSTS exist only in the languages they were written in (store: en / zh-Hant / zh-Hans); every other page is in all LANGS.
export const POST_LANGS = ['en', 'zh-Hant', 'zh-Hans'];
// '' = the language home page (/en/). Keep in sync with the rewrites in vercel.json (`/:lang(en|zh-hant|…|th)/:page(...)`, scripts/gen-lang-routes.mjs).
export const PAGES = ['', 'features', 'pricing', 'faq', 'plugins', 'changelog', 'blog', 'blog/nest-vs-chatgpt'];
// Blog posts (newest first). The ChatGPT comparison moved here from /<lang>/compare/nest-vs-chatgpt-homework (301 in vercel.json).
export const POSTS = ['blog/nest-vs-chatgpt'];
// One site nav for the landing (React) and every static page. 'demo' → the demo on the language home page.
// Run 18: + 'status' (https://status.nesty.cyou). blog/changelog/status hrefs are absolute sub-site URLs (src/site.js).
export const NAV = ['demo', 'features', 'pricing', 'faq', 'plugins', 'changelog', 'blog', 'status'];
export const FOOT_NAV = ['features', 'pricing', 'faq', 'plugins', 'changelog', 'blog', 'status'];
