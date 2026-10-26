// Screenshots of the install guide + notification settings from the mock build, at iPhone 390×844 and iPad 820×1180.
//   npx vite build --mode mock --outDir dist-mock && node scripts/push-shots.mjs [outDir]
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const OUT = process.argv[2] || '../work/push-shots';
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4193', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const DEV = {
  iphone: { w: 390, h: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' },
  ipad: { w: 820, h: 1180, ua: 'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1' },
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await launch();
try {
  for (const [dev, d] of Object.entries(DEV)) {
    for (const lang of ['zh-Hant', 'en']) {
      const p = await newPage(b);
      await p.setUserAgent(d.ua);
      await p.setViewport({ width: d.w, height: d.h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); localStorage.removeItem('nest.installDismissed'); sessionStorage.clear(); }, lang);
      const L = lang === 'en' ? 'en' : 'zh';
      // Home with the install banner
      await p.goto('http://localhost:4193/app?mock=in', { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await p.evaluate(() => document.fonts.ready); await wait(1500);
      await p.screenshot({ path: `${OUT}/${dev}-${L}-home-banner.png` });
      // Settings → push card (turn the master switch on so the device list and types show as in use)
      await p.goto('http://localhost:4193/app/settings?mock=in', { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await p.evaluate(() => document.fonts.ready); await wait(1500);
      await p.evaluate(() => document.querySelector('.push-card .set-row:nth-of-type(2) .toggle, .push-card .toggle')?.click());
      await wait(900);
      await p.evaluate(() => { const c = document.querySelector('.push-card'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70); });
      await wait(900);
      await p.screenshot({ path: `${OUT}/${dev}-${L}-settings.png` });
      await p.addStyleTag({ content: '.mtop,.tabbar,.toast-wrap,.toasts{visibility:hidden!important}' });
      const ch = await p.evaluate(() => { const c = document.querySelector('.push-card').getBoundingClientRect(); return { x: c.left, y: c.top + window.scrollY, w: c.width, h: c.height }; });
      await p.screenshot({ path: `${OUT}/${dev}-${L}-settings-card.png`, clip: { x: ch.x - 8, y: ch.y - 8, width: ch.w + 16, height: ch.h + 16 }, captureBeyondViewport: true });
      await p.addStyleTag({ content: '.mtop,.tabbar{visibility:visible!important}' });
      // Install guide sheet
      await p.evaluate(() => [...document.querySelectorAll('.push-card .btn')].find((x) => x.querySelector('svg'))?.click());
      await wait(900);
      await p.screenshot({ path: `${OUT}/${dev}-${L}-install-guide.png` });
      await p.evaluate(() => document.querySelector('.modal')?.scrollTo(0, 1e5)); await wait(500);
      await p.screenshot({ path: `${OUT}/${dev}-${L}-install-guide-end.png` });
      await p.close();
    }
  }
} finally { await b.close(); srv.kill(); }
console.log('done');
