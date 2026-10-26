// Preview: the new icon on light + dark iOS-style home screens, plus every rendered size and the favicon in both colour schemes.
import fs from 'node:fs';
import { launch, newPage } from './browser.mjs';
const out = process.argv[2] || '../work/icon-shots';
const img = (f) => `data:image/png;base64,${fs.readFileSync(`public/${f}`).toString('base64')}`;
const fav = `data:image/svg+xml;base64,${fs.readFileSync('public/favicon.svg').toString('base64')}`;
const b = await launch();
async function home(dark, path) {
  const p = await newPage(b);
  await p.setViewport({ width: 430, height: 560, deviceScaleFactor: 2 });
  await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }]);
  const tileBg = dark ? '#1c1c1e' : '#fff';
  const other = (c, t) => `<div class="app"><div class="ic" style="background:${dark ? '#1c1c1e' : '#fff'}"><div style="width:52%;height:52%;border-radius:30%;background:${c}"></div></div><span>${t}</span></div>`;
  await p.setContent(`<html><body style="margin:0;font-family:-apple-system,'Helvetica Neue',sans-serif;background:${dark ? 'linear-gradient(#20242c,#0b0c10)' : 'linear-gradient(#cfd9e8,#eef1f6)'};height:560px">
  <style>.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:26px 0;padding:56px 18px}.app{display:flex;flex-direction:column;align-items:center;gap:7px}
  .ic{width:68px;height:68px;border-radius:16px;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.18)}.ic img{width:100%;height:100%}
  span{font-size:12px;font-weight:600;color:${dark ? '#fff' : '#111'};text-shadow:${dark ? '0 1px 2px rgba(0,0,0,.5)' : 'none'}}
  .t{position:absolute;top:14px;left:30px;font-weight:700;font-size:16px;color:${dark ? '#fff' : '#111'}}</style>
  <div class="t">11:06 · iOS ${dark ? 'dark' : 'light'} mode</div>
  <div class="grid">${other('#4f8cff', 'Safari')}${other('#34c759', 'Phone')}${other('#ff9f0a', 'Notes')}${other('#af52de', 'Podcasts')}
  ${other('#ff3b30', 'Music')}${other('#5ac8fa', 'Weather')}${other('#ffd60a', 'Photos')}${other('#8e8e93', 'Settings')}
  <div class="app"><div class="ic"><img src="${img('apple-touch-icon.png')}"></div><span>Nest</span></div></div>
  <div style="display:flex;gap:18px;align-items:center;justify-content:center;margin-top:10px">
    <div class="ic" style="width:120px;height:120px;border-radius:27px"><img src="${img('apple-touch-icon.png')}"></div>
  </div></body></html>`);
  await p.screenshot({ path }); await p.close();
}
await home(false, `${out}/home-light-v2.png`);
await home(true, `${out}/home-dark-v2.png`);
const p = await newPage(b);
await p.setViewport({ width: 900, height: 300 });
await p.setContent(`<html><body style="margin:0;display:flex;gap:22px;align-items:center;padding:24px;background:repeating-conic-gradient(#ddd 0 25%,#f6f6f6 0 50%) 0 0/20px 20px;font:12px sans-serif">
  ${['icon-512.png', 'icon-192.png', 'icon-maskable-192.png', 'apple-touch-icon.png', 'favicon-32.png', 'badge-96.png'].map((f) => `<figure style="margin:0;text-align:center"><img src="${img(f)}" style="width:${f.includes('32') ? 32 : f.includes('badge') ? 96 : 120}px;${f.includes('badge') ? 'background:#333' : ''}"><figcaption>${f}</figcaption></figure>`).join('')}
  <figure style="margin:0;text-align:center"><div style="background:#fff;padding:8px"><img src="${fav}" width="40"></div><figcaption>favicon light</figcaption></figure>
  <figure style="margin:0;text-align:center"><div style="background:#202124;padding:8px"><iframe style="border:0;width:40px;height:40px;color-scheme:dark" srcdoc="<html style='color-scheme:dark;background:#202124'><body style='margin:0'><img src='${fav}' width=40></body></html>"></iframe></div><figcaption>favicon dark*</figcaption></figure>
</body></html>`);
await p.screenshot({ path: `${out}/icon-sizes-v2.png` }); await p.close();
// favicon in dark scheme
const q = await newPage(b);
await q.setViewport({ width: 160, height: 80 });
await q.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
await q.setContent(`<html><body style="margin:0;display:flex;gap:16px;padding:12px;background:#202124"><img src="${fav}" width="56"><div style="background:#fff;padding:0"><img src="${fav}" width="56" style="opacity:1"></div></body></html>`);
await q.screenshot({ path: `${out}/favicon-dark-v2.png` }); await q.close();
await b.close();
