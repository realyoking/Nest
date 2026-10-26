// Headless Chromium whose external requests are fetched by Node (the sandbox's Chromium has no direct network).
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const cache = new Map();
export async function launch() {
  return puppeteer.launch({ executablePath: process.env.CHROME || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : '/tmp/chrome/chrome-headless-shell/linux_arm-155.0.8059.84/chrome-headless-shell-linux-arm64/chrome-headless-shell'), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
}
export async function newPage(browser, { block = [], allow = [] } = {}) {
  const p = await browser.newPage();
  await p.setRequestInterception(true);
  p.on('request', async (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1') || url.startsWith('about:')) return req.continue();
    if (block.some((b) => url.includes(b))) return req.abort();
    if (!/fonts\.(googleapis|gstatic)\.com/.test(url) && !allow.some((h) => url.includes(h))) return req.abort();
    try {
      let hit = cache.get(url);
      if (!hit) {
        const r = await fetch(url, { method: req.method(), body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData(), headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' } });
        hit = { status: r.status, type: r.headers.get('content-type') || '', body: Buffer.from(await r.arrayBuffer()) };
        cache.set(url, hit);
      }
      req.respond({ status: hit.status, contentType: hit.type, body: hit.body, headers: { 'access-control-allow-origin': '*' } });
    } catch { req.abort(); }
  });
  return p;
}
