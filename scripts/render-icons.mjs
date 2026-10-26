// Renders the PWA icon set from the Liquid Glass artwork in scripts/icon-svg.mjs:
//   icon-1024 (master), apple-touch-icon 180 (full-bleed; iOS rounds it), icon-192/512 (purpose any, rounded tile on transparent),
//   icon-maskable-192/512 (full-bleed, glyph inside the 80% safe zone), favicon-32, badge-96 (mono alpha), og.png.
// Dark tile + white glass glyph so the home-screen icon reads the same in iOS light AND dark mode.
// After changing the art: bump ICON_V in index.html / manifest / sw.js so installed PWAs refetch.
import { launch, newPage } from './browser.mjs';
import { tile, EGG, NEST } from './icon-svg.mjs';
const font = '<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@900&family=Noto+Sans+TC:wght@900&display=block" rel="stylesheet">';
const out = process.argv[2] || 'public';
const b = await launch();
async function shot(html, w, h, path, bg = 'transparent') {
  const p = await newPage(b);
  await p.setViewport({ width: w, height: h });
  await p.setContent(`<html><head>${font}<style>html,body{margin:0;background:${bg}}body{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;font-family:Nunito,'Noto Sans TC',sans-serif}svg{display:block}</style></head><body>${html}</body></html>`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  await p.screenshot({ path, omitBackground: bg === 'transparent' });
  await p.close();
}
await shot(tile(1024), 1024, 1024, `${out}/icon-1024.png`);
await shot(tile(180), 180, 180, `${out}/apple-touch-icon.png`);
await shot(tile(512, { rounded: true }), 512, 512, `${out}/icon-512.png`);
await shot(tile(192, { rounded: true }), 192, 192, `${out}/icon-192.png`);
await shot(tile(512, { scale: 0.5 }), 512, 512, `${out}/icon-maskable-512.png`);
await shot(tile(192, { scale: 0.5 }), 192, 192, `${out}/icon-maskable-192.png`);
await shot(tile(32, { rounded: true, scale: 0.78 }), 32, 32, `${out}/favicon-32.png`);
await shot(`<svg width="72" height="72" viewBox="0 0 64 64" fill="#fff"><path d="${EGG}"/><path d="${NEST}"/></svg>`, 96, 96, `${out}/badge-96.png`);
await shot(`<div style="display:flex;flex-direction:column;align-items:center;gap:30px">
  <div style="display:flex;align-items:center;gap:26px">${tile(140, { rounded: true })}<span style="font-size:124px;font-weight:900;letter-spacing:-0.045em;color:#0a0a0a">Nest</span><span style="font-size:100px;font-weight:900;color:#0a0a0a;margin-left:8px">巢</span></div>
  <div style="font-size:36px;font-weight:900;color:#767676">全家人的 AI 助理 · The AI helper for your family</div></div>`, 1200, 630, `${out}/og.png`, '#fff');
await b.close();
console.log('icons ->', out);
