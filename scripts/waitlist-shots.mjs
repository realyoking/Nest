// Screenshots for the heynest alias + waitlist: live landing demo bar, live pricing + waitlist modal
// (the /api/waitlist answer is stubbed for the success shot so no test rows are written), and the in-app Usage card (mock build).
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
const OUT = process.argv[2] || '../work/waitlist-shots';
const LIVE = 'https://heynest.vercel.app';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4193', '--strictPort'], { stdio: 'ignore' });
await wait(2500);
const b = await launch();
try {
  for (const lang of ['zh-Hant', 'en']) {
    const L = lang === 'en' ? 'en' : 'zh';
    const p = await newPage(b, { allow: ['heynest.vercel.app', 'googleapis.com', 'gstatic.com'] });
    await p.setViewport({ width: 1440, height: 900 });
    await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); localStorage.removeItem('nest.waitlist'); }, lang);
    await p.goto(LIVE + '/', { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await wait(2000);
    const bar = await p.$('.demo-bar');
    if (bar) { await bar.scrollIntoView(); await wait(1200); await p.screenshot({ path: `${OUT}/landing-demo-bar-${L}.png` }); console.log('bar text:', await p.$eval('.demo-url', (e) => e.textContent)); }
    await p.goto(LIVE + '/pricing', { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await wait(2200);
    await p.evaluate(() => window.scrollTo(0, 260)); await wait(900);
    await p.screenshot({ path: `${OUT}/pricing-${L}.png` });
    const btns = await p.$$('.plan .btn');
    await btns[1].click(); await wait(700);
    await p.type('.modal input[type=email]', 'parent@example.com');
    await p.type('.modal textarea', lang === 'en' ? 'Family of four' : '一家四口');
    await p.screenshot({ path: `${OUT}/waitlist-modal-${L}.png` });
    // Stub the API answer (no live write) to capture the success state.
    await p.setRequestInterception(true);
    p.removeAllListeners('request');
    p.on('request', (r) => r.url().includes('/api/waitlist') ? r.respond({ status: 200, contentType: 'application/json', body: '{"ok":true,"stored":"waitlist"}' }) : r.continue());
    await p.click('.modal button[type=submit]'); await wait(900);
    await p.screenshot({ path: `${OUT}/waitlist-success-${L}.png` });
    await p.keyboard.press('Escape'); await wait(500);
    await p.screenshot({ path: `${OUT}/pricing-after-${L}.png` });
    await p.close();
    const q = await newPage(b, {});
    await q.setViewport({ width: 1280, height: 860 });
    await q.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); localStorage.removeItem('nest.waitlist'); }, lang);
    await q.goto('http://localhost:4193/app/usage?mock=in', { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await wait(2000);
    await q.screenshot({ path: `${OUT}/app-usage-${L}.png` });
    await q.close();
  }
} finally { await b.close(); srv.kill(); }
