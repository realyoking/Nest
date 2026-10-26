import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
const OUT = '/workspace/projects/f8d03dec-c9f3-482e-b1db-3b6a4fac806a/work/shots';
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', '4180', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const list = (process.argv[2] || '').split(',').filter(Boolean);
const lang = process.argv[3] || 'zh-Hant';
const pages = [
  ['landing', '/?mock=out', true], ['pricing', '/pricing?mock=out', true], ['auth', '/auth?mock=out', false],
  ['onboarding', '/onboarding?mock=new', false], ['home', '/app?mock=in', true], ['agent', '/app/agent/c1?mock=in', false],
  ['tutor', '/app/tutor?mock=in', false], ['quiz', '/app/quiz?mock=in', true], ['memory', '/app/memory?mock=in', true],
  ['reminders', '/app/reminders?mock=in', true], ['family', '/app/family?mock=in', true], ['connections', '/app/connections?mock=in', true],
  ['usage', '/app/usage?mock=in', false], ['settings', '/app/settings?mock=in', true],
].filter(([n]) => !list.length || list.includes(n));
const b = await launch();
try {
  for (const [vw, vh, dpr, tag] of [[390, 844, 2, 'm'], [1440, 900, 1, 'd']]) {
    for (const [name, url, full] of pages) {
      const p = await newPage(b);
      await p.setViewport({ width: vw, height: vh, deviceScaleFactor: dpr, isMobile: tag === 'm', hasTouch: tag === 'm' });
      await p.evaluateOnNewDocument((l) => { localStorage.setItem('nest.lang', l); }, lang);
      await p.goto('http://localhost:4180' + url, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await p.evaluate(() => document.fonts.ready);
      if (full) {
        await p.evaluate(async () => { document.documentElement.style.scrollBehavior = 'auto'; for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); });
      }
      await new Promise((r) => setTimeout(r, 1800));
      await p.screenshot({ path: `${OUT}/${name}-${tag}${lang === 'en' ? '-en' : ''}.png`, fullPage: !!full });
      await p.close();
    }
  }
} finally { await b.close(); srv.kill(); }
console.log('done');
