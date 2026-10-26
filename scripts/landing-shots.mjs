// Viewport screenshots of the landing at key scroll positions (mock build).
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
const OUT = '/workspace/projects/f8d03dec-c9f3-482e-b1db-3b6a4fac806a/work/shots';
const base = process.argv[2] || 'http://localhost:4181';
const lang = process.argv[3] || 'zh-Hant';
const reduced = process.argv[4] === 'reduced';
let srv;
if (base.includes('localhost')) { srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4181', '--strictPort'], { stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 2500)); }
const b = await launch();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  for (const [vw, vh, dpr, tag] of [[390, 760, 2, 'm'], [1440, 900, 1, 'd']]) {
    const p = await newPage(b, { allow: base.includes('localhost') ? [] : [new URL(base).host, 'googleapis.com', 'gstatic.com'] });
    await p.setViewport({ width: vw, height: vh, deviceScaleFactor: dpr, isMobile: tag === 'm', hasTouch: tag === 'm' });
    if (reduced) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); }, lang);
    await p.goto(base + (base.includes('localhost') ? '/?mock=out' : '/'), { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    await wait(2200);
    const sfx = `${base.includes('localhost') ? '' : 'live-'}${tag}${lang === 'en' ? '-en' : ''}${reduced ? '-rm' : ''}`;
    await p.screenshot({ path: `${OUT}/lx-cover-${sfx}.png` });
    if (!reduced) {
      // Tap the egg a couple of times.
      await p.click('.lx-toy-btn').catch(() => {}); await wait(250); await p.click('.lx-toy-btn').catch(() => {}); await wait(450);
      await p.screenshot({ path: `${OUT}/lx-egg-${sfx}.png` });
      const day = await p.evaluate(() => { const el = document.getElementById('day'); const r = el.getBoundingClientRect(); return { top: r.top + scrollY, h: el.offsetHeight }; });
      const total = day.h - vh;
      for (const [k, f] of [['1', 0.06], ['2', 0.40], ['3', 0.66], ['4', 0.96]]) {
        await p.evaluate((y) => window.scrollTo(0, y), Math.round(day.top + total * f)); await wait(1100);
        await p.screenshot({ path: `${OUT}/lx-day${k}-${sfx}.png` });
      }
    }
    // Try it: open two hints and reveal.
    await p.evaluate(() => document.getElementById('try').scrollIntoView()); await wait(900);
    for (let i = 0; i < 2; i++) { await p.evaluate(() => [...document.querySelectorAll('.lx-demo-actions .btn')][0]?.click()); await wait(1400); }
    await p.screenshot({ path: `${OUT}/lx-try-${sfx}.png` });
    for (const id of ['features']) { await p.evaluate((i) => document.getElementById(i).scrollIntoView(), id); await wait(1100); await p.screenshot({ path: `${OUT}/lx-${id}-${sfx}.png` }); }
    await p.evaluate(() => document.querySelector('.lx-band').scrollIntoView()); await wait(1400); await p.screenshot({ path: `${OUT}/lx-band-${sfx}.png` });
    await p.evaluate(() => document.querySelector('.lx-final').scrollIntoView({ block: 'center' })); await wait(1800); await p.screenshot({ path: `${OUT}/lx-final-${sfx}.png` });
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(tag, 'horizontal overflow px:', overflow);
    await p.close();
  }
} finally { await b.close(); srv?.kill(); }
console.log('done');
