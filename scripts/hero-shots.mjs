// Run 20: real static screenshots of the Nest app for the landing hero window (mock build = seeded sample data).
//   npx vite build --mode mock --outDir dist-mock && node scripts/hero-shots.mjs [outDir]
// Writes <out>/<desk|mob>-<en|zh>-<light|dark>.png (raw PNG; work/run20 converts them to webp at several widths).
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const OUT = process.argv[2] || '../work/run20/appshots';
const URL_PATH = process.env.HERO_PATH || '/app?mock=in';
fs.mkdirSync(OUT, { recursive: true });
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4181', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const b = await launch();
try {
  for (const lang of ['zh-Hant', 'en']) for (const scheme of ['light', 'dark']) for (const [kind, vp] of [['desk', { width: 1280, height: 800, deviceScaleFactor: 1.5 }], ['mob', { width: 390, height: 780, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
    const p = await newPage(b);
    await p.setViewport(vp);
    await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); sessionStorage.clear(); localStorage.setItem('nest.installDismissed', '1'); }, lang);
    await p.goto('http://localhost:4181' + URL_PATH, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 1800));
    const file = `${OUT}/${kind}-${lang === 'en' ? 'en' : 'zh'}-${scheme}.png`;
    await p.screenshot({ path: file });
    console.log(file);
    await p.close();
  }
} finally { await b.close(); srv.kill(); }
