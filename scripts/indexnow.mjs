// IndexNow ping (Bing, Yandex, Seznam, Naver, … share submissions). Run AFTER a production deploy:
//   node scripts/indexnow.mjs            → checks the live key file, reads the live sitemap, submits every URL
//   node scripts/indexnow.mjs --dry-run  → prints what it would send
//   node scripts/indexnow.mjs https://nesty.cyou/en/faq …   → submit only these URLs
// Key: SEO.indexNowKey in seo/config.js; the build writes dist/<key>.txt (served at https://nesty.cyou/<key>.txt).
// Google does not use IndexNow — submit the sitemap in Search Console instead.
import { SEO } from '../seo/config.js';

const dry = process.argv.includes('--dry-run');
const explicit = process.argv.slice(2).filter((a) => /^https?:\/\//.test(a));
const host = new URL(SEO.site).host;
const keyLocation = `${SEO.site}/${SEO.indexNowKey}.txt`;

async function liveUrls() {
  const r = await fetch(`${SEO.site}/sitemap.xml`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`sitemap ${r.status}`);
  const urls = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) throw new Error('no <loc> entries (sitemap not deployed yet?)');
  return urls;
}

const k = await fetch(keyLocation, { cache: 'no-store' }).then(async (r) => ({ ok: r.ok, body: (await r.text()).trim() })).catch((e) => ({ ok: false, body: String(e) }));
if (!k.ok || k.body !== SEO.indexNowKey) {
  console.error(`Key file not live at ${keyLocation} (got: ${k.body.slice(0, 80)}). Deploy first.`);
  if (!dry) process.exit(1);
}
const urlList = explicit.length ? explicit : await liveUrls().catch(async (e) => {
  console.warn(`live sitemap unavailable (${e.message}) — using the local page list`);
  const { allUrls } = await import('../seo/build.js');
  return allUrls();
});
const body = { host, key: SEO.indexNowKey, keyLocation, urlList };
console.log(`IndexNow: ${urlList.length} URLs for ${host}`);
if (dry) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }
const res = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
// 200 = OK, 202 = accepted (key validation pending), 400 bad request, 403 key not valid, 422 URLs not for this host, 429 too many requests
console.log(`api.indexnow.org → HTTP ${res.status} ${res.statusText}`, (await res.text()).slice(0, 300));
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
