// Captures the landing page's feature screenshots from the mock build (real app screens, sample data).
//   npx vite build --mode mock --outDir dist-mock && node scripts/feature-shots.mjs
// Writes public/shots/<feature>-<zh|en>.png: the content area (sidebar cropped off) of a 1280×800 viewport at 1.5× DPR.
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const OUT = 'public/shots';
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const only = (process.argv[2] || '').split(',').filter(Boolean);
const SHOTS = [
  ['tutor', '/app/tutor?mock=in', async (p, lang) => {
    await p.type('textarea.textarea', lang === 'en' ? 'Solve 3x + 5 = 20' : '3x + 5 = 20，求 x。');
    await p.evaluate(() => [...document.querySelectorAll('.card .btn-lg')].pop()?.click());
    await new Promise((r) => setTimeout(r, 2500));
    await p.evaluate(() => document.querySelector('.tutor-tools .btn')?.click());
    await new Promise((r) => setTimeout(r, 2500));
  }],
  ['memory', '/app/memory?mock=in'],
  ['agent', '/app/agent/c1?mock=in', async (p) => { await p.evaluate(() => document.querySelector('.chat-scroll')?.scrollTo(0, 1e9)); }],
  ['connections', '/app/connections?mock=in'],
  ['parent', '/app/family?mock=in'],
  ['usage', '/app/usage?mock=in'],
].filter(([n]) => !only.length || only.includes(n));
const b = await launch();
try {
  for (const lang of ['zh-Hant', 'en']) {
    for (const [name, url, act] of SHOTS) {
      const p = await newPage(b);
      await p.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1.5 });
      await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); sessionStorage.clear(); sessionStorage.setItem('nest.gtoken', JSON.stringify({ token: 'mock', ids: ['gmail', 'googlecalendar'], exp: Date.now() + 3e6 })); }, lang);
      await p.goto('http://localhost:4180' + url, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await p.evaluate(() => document.fonts.ready);
      await new Promise((r) => setTimeout(r, 1600));
      if (act) await act(p, lang);
      await new Promise((r) => setTimeout(r, 900));
      await p.screenshot({ path: `${OUT}/${name}-${lang === 'en' ? 'en' : 'zh'}.png`, clip: { x: 257, y: 0, width: 1023, height: 720 } });
      await p.close();
    }
  }
} finally { await b.close(); srv.kill(); }
console.log('done');
