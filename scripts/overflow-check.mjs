// Checks every app page for horizontal overflow at iPad-ish widths; screenshots the Family page with a long invite link.
import { launch, newPage } from './browser.mjs';
import { spawn } from 'node:child_process';
const OUT = '/workspace/projects/f8d03dec-c9f3-482e-b1db-3b6a4fac806a/work/shots/overflow';
const srv = spawn('npx', ['vite', 'preview', '--outDir', 'dist-mock', '--port', process.env.PORT || '4181', '--strictPort'], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const pages = [['home', '/app'], ['agent', '/app/agent/c1'], ['tutor', '/app/tutor'], ['quiz', '/app/quiz'], ['memory', '/app/memory'],
  ['reminders', '/app/reminders'], ['family', '/app/family'], ['connections', '/app/connections'], ['usage', '/app/usage'], ['settings', '/app/settings'], ['pricing', '/pricing']];
const sizes = [[768, 1024], [820, 1180], [1024, 768], [1180, 820], [1366, 1024]];
const LONG = 'https://nest.example.com/join/8tLa3sZfEoaH784pzXq2Lm9Rt6Wy4Kc1Vb7Nd3Hs';
const b = await launch(); const bad = [];
const onlyLang = process.argv[2]; const onlyW = Number(process.argv[3]) || 0;
try {
  for (const lang of ['zh-Hant', 'en'].filter((l) => !onlyLang || l === onlyLang)) for (const [w, h] of sizes.filter(([x]) => !onlyW || x === onlyW)) for (const [name, path] of pages) {
    const ctx = await b.createBrowserContext();
    const p = await newPage(ctx);
    p.on('dialog', (d) => d.accept());
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await p.evaluateOnNewDocument((l) => localStorage.setItem('nest.lang', l), lang);
    await p.goto(`http://localhost:${process.env.PORT || 4181}${path}?mock=${name === 'pricing' ? 'out' : 'in'}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await p.evaluate(() => document.fonts.ready); await new Promise((r) => setTimeout(r, 700));
    if (name === 'family') {
      // The demo family is full (3/3): remove one member first so an invite can be created.
      await p.evaluate(() => { const del = [...document.querySelectorAll('.list-row button')].filter((x) => /移除|Remove/i.test(x.getAttribute('aria-label') || x.title || '')); del[0]?.click(); });
      await new Promise((r) => setTimeout(r, 600));
      await p.evaluate(() => { const btn = [...document.querySelectorAll('button')].find((x) => /產生邀請|Create invite/i.test(x.textContent)); btn?.click(); });
      await new Promise((r) => setTimeout(r, 800));
      await p.evaluate((u) => { document.querySelectorAll('.invite-link code').forEach((c) => { c.textContent = u; }); }, LONG);
      await new Promise((r) => setTimeout(r, 300));
    }
    const m = await p.evaluate(() => {
      if (location.pathname.startsWith('/auth')) return { sw: -1, cw: 0, wide: ['REDIRECTED_TO_AUTH'] };
      const de = document.documentElement;
      const wide = [...document.querySelectorAll('.main *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1; }).slice(0, 3).map((el) => el.className || el.tagName);
      const box = document.querySelector('.invite-box'); const btn = document.querySelector('.invite-link .btn');
      return { sw: de.scrollWidth, cw: de.clientWidth, wide, inviteBox: !!box, copyVisible: btn ? btn.getBoundingClientRect().right <= window.innerWidth : null };
    });
    const ok = m.sw === m.cw && !m.wide.length && (name !== 'family' || m.copyVisible);
    if (!ok) bad.push({ lang, w, name, ...m });
    console.log(`${ok ? 'OK ' : 'BAD'} ${lang} ${w}x${h} ${name} scrollWidth=${m.sw} clientWidth=${m.cw}${name === 'family' ? ` invite=${m.inviteBox} copyVisible=${m.copyVisible}` : ''}${m.wide.length ? ' wide=' + m.wide.join('|') : ''}`);
    if (name === 'family' && lang === 'zh-Hant') await p.screenshot({ path: `${OUT}/family-${w}.png`, fullPage: true });
    await ctx.close();
  }
} finally { await b.close(); srv.kill(); }
console.log(bad.length ? `\n${bad.length} FAILURES` : '\nALL PASS');
