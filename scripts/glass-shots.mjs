// Screenshots: pricing Monthly/Yearly, Usage card (yearly), Connections (multi-account), glass mark (light/dark).
// Default = mock build (dist-mock via vite preview). LIVE=https://heynest.vercel.app shoots /pricing from production.
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
const OUT = process.argv[2] || '../work/icon-shots';
const LIVE = process.env.LIVE;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = LIVE ? null : spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4194', '--strictPort'], { stdio: 'ignore' });
if (srv) await wait(2500);
const BASE = LIVE || 'http://localhost:4194';
const b = await launch();
async function page(lang, w = 1440, h = 900) {
  const p = await newPage(b, { allow: LIVE ? ['heynest.vercel.app', 'googleapis.com', 'gstatic.com'] : [] });
  await p.setViewport({ width: w, height: h });
  await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); }, lang);
  return p;
}
try {
  for (const lang of ['zh-Hant', 'en']) {
    const L = lang === 'en' ? 'en' : 'zh';
    const pre = LIVE ? 'live-' : '';
    const p = await page(lang);
    await p.goto(`${BASE}/pricing${LIVE ? '' : '?mock=out'}`, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await wait(2000); await p.evaluate(() => window.scrollTo(0, 220)); await wait(900);
    await p.screenshot({ path: `${OUT}/${pre}pricing-monthly-${L}.png` });
    const yr = await p.$$('.billing-toggle button'); await yr[1].click(); await wait(700);
    await p.screenshot({ path: `${OUT}/${pre}pricing-yearly-${L}.png` });
    console.log(L, 'prices:', await p.$$eval('.plan .price', (els) => els.map((e) => e.textContent).join(' | ')));
    if (!LIVE) {
      const btns = await p.$$('.plan .btn'); await btns[1].click(); await wait(700);
      await p.screenshot({ path: `${OUT}/waitlist-yearly-${L}.png` });
    }
    await p.close();
    if (LIVE) continue;
    const q = await page(lang, 1280, 900);
    await q.goto(`${BASE}/app/usage?mock=in`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(1800);
    const t = await q.$$('.billing-toggle button'); if (t[1]) { await t[1].click(); await wait(500); }
    await q.screenshot({ path: `${OUT}/app-usage-yearly-${L}.png` });
    await q.goto(`${BASE}/app/connections?mock=in`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(1500);
    for (let y = 0; y < 2400; y += 300) { await q.evaluate((v) => window.scrollTo(0, v), y); await wait(200); }
    await q.evaluate(() => window.scrollTo(0, 0)); await wait(800);
    await q.screenshot({ path: `${OUT}/connections-${L}.png`, fullPage: true });
    await q.close();
    const m = await page(lang, 390, 844);
    await m.goto(`${BASE}/app/connections?mock=in`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(2000);
    await m.screenshot({ path: `${OUT}/connections-mobile-${L}.png` });
    await m.close();
  }
  if (!LIVE) {
    const o = await page('zh-Hant', 1100, 760);
    await o.goto(`${BASE}/onboarding?mock=new`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(1800); await o.screenshot({ path: `${OUT}/mark-onboarding-light.png` }); await o.close();
    const d = await page('zh-Hant', 1100, 760);
    await d.goto(`${BASE}/app/agent?mock=in`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(1500);
    await d.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }); await wait(400);
    await d.screenshot({ path: `${OUT}/mark-app-dark.png` }); await d.close();
  }
} finally { await b.close(); srv?.kill(); }
