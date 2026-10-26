// Browser-only: screenshot / icon processing for the listing editor. Decodes the file into a canvas (so any markup or
// metadata in the upload is dropped — SVG uploads are not accepted at all), centre-crops to the standard ratio,
// resizes, and re-encodes as WebP (JPEG fallback) stepping quality down until it fits the size limit.
import { LISTING_LIMITS, SHOT_RATIOS, ICON_SIZE, cropRect, ratioFor } from './listing.js';

const RASTER = /^image\/(png|jpeg|webp|gif|heic|heif|avif)$/i;
function loadImage(file) {
  return new Promise((res, rej) => {
    if (!file || (file.type && !RASTER.test(file.type))) { rej(new Error('bad_type')); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
function encode(canvas, budget) {
  const types = ['image/webp', 'image/jpeg'];
  for (const type of types) {
    for (const q of [0.86, 0.78, 0.7, 0.6, 0.5, 0.42]) {
      const d = canvas.toDataURL(type, q);
      if (!d.startsWith(`data:${type}`)) break; // type not supported → next
      if (d.length <= budget) return d;
    }
  }
  return '';
}
// → { img (data URL), ratio: 'landscape'|'portrait', w, h }
export async function processShot(file, ratio) {
  const img = await loadImage(file);
  const r = ratio || ratioFor(img.naturalWidth, img.naturalHeight);
  const { sx, sy, sw, sh } = cropRect(img.naturalWidth, img.naturalHeight, r);
  let { w, h } = SHOT_RATIOS[r];
  if (sw < w) { const k = sw / w; w = Math.round(w * k); h = Math.round(h * k); } // never upscale
  for (const scale of [1, 0.8, 0.64]) {
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const d = encode(c, LISTING_LIMITS.shot);
    if (d) return { img: d, ratio: r, w: c.width, h: c.height };
  }
  throw new Error('too_large');
}
export async function processIcon(file) {
  const img = await loadImage(file);
  const s = Math.min(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas'); c.width = ICON_SIZE; c.height = ICON_SIZE;
  const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, ICON_SIZE, ICON_SIZE);
  let d = c.toDataURL('image/png');
  if (d.length > LISTING_LIMITS.icon) d = encode(c, LISTING_LIMITS.icon);
  if (!d) { c.width = 160; c.height = 160; c.getContext('2d').drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, 160, 160); d = encode(c, LISTING_LIMITS.icon); }
  if (!d) throw new Error('too_large');
  return d;
}
export const shotRatioOf = (dataUrl) => new Promise((res) => { const i = new Image(); i.onload = () => res(ratioFor(i.naturalWidth, i.naturalHeight)); i.onerror = () => res('portrait'); i.src = dataUrl; });
// Announcement image (admin, Run 8b): centre-crop to 16:9, ≤ 1200×675, WebP/JPEG ≤ 180 KB of data URL.
export async function processBanner(file, budget = 180000) {
  const img = await loadImage(file);
  const W = img.naturalWidth, H = img.naturalHeight; const want = 16 / 9;
  let sw = W, sh = Math.round(W / want); if (sh > H) { sh = H; sw = Math.round(H * want); }
  const sx = Math.round((W - sw) / 2), sy = Math.round((H - sh) / 2);
  for (const tw of [1200, 960, 720, 540]) {
    const w = Math.min(tw, sw); const h = Math.round(w / want);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
    const d = encode(c, budget);
    if (d) return d;
  }
  throw new Error('too_large');
}
