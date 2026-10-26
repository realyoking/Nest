import { launch, newPage } from './browser.mjs';
const C = {
  A: `<path d="M8 35H56C56 46.6 45.3 55 32 55S8 46.6 8 35z"/><path d="M32 9c-7.6 0-12.5 9.6-12.5 17.6 0 3.4 1 6.3 2.7 8.4h19.6c1.7-2.1 2.7-5 2.7-8.4C44.5 18.6 39.6 9 32 9z"/>`,
  B: `<path d="M32 8c-7.6 0-12.5 9.6-12.5 17.6C19.5 33 25 38 32 38s12.5-5 12.5-12.4C44.5 17.6 39.6 8 32 8z"/><path d="M7 34.5c0-1.4 1.1-2.5 2.5-2.5 2.6 0 4.3 2 6 4.6C18.6 41.3 24 44 32 44s13.4-2.7 16.5-7.4c1.7-2.6 3.4-4.6 6-4.6 1.4 0 2.5 1.1 2.5 2.5C57 47 46 56 32 56S7 47 7 34.5z"/>`,
  C: `<path d="M32 10c-7 0-11.5 8.8-11.5 16.2 0 3.6 1.1 6.6 3 8.8h17c1.9-2.2 3-5.2 3-8.8C43.5 18.8 39 10 32 10z"/><rect x="6" y="38" width="52" height="7" rx="3.5"/><path d="M12 48.5h40c-2.8 4.4-10.6 7.5-20 7.5s-17.2-3.1-20-7.5z"/>`,
};
const svg = (k, s, c = '#0a0a0a') => `<svg width="${s}" height="${s}" viewBox="0 0 64 64" fill="${c}">${C[k]}</svg>`;
const b = await launch(); const p = await newPage(b);
await p.setViewport({ width: 1100, height: 600 });
const row = (k) => `<div style="display:flex;gap:36px;align-items:center;padding:14px 30px"><b style="width:20px">${k}</b>${svg(k,16)}${svg(k,32)}${svg(k,64)}${svg(k,140)}<div style="background:#0a0a0a;padding:16px;border-radius:24px">${svg(k,90,'#fff')}</div><div style="display:flex;align-items:center;gap:8px">${svg(k,40)}<span style="font:900 42px Nunito;letter-spacing:-0.04em">Nest</span></div></div>`;
await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@900&display=block" rel="stylesheet"></head><body style="margin:0;background:#fff">${row('A')}${row('B')}${row('C')}</body></html>`, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 800));
await p.screenshot({ path: '/workspace/projects/f8d03dec-c9f3-482e-b1db-3b6a4fac806a/work/mark-lab.png' });
await b.close();
