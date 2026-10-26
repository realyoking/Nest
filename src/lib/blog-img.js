// Browser-only image processing for the blog editor (Run 12). Every upload is decoded into a canvas and re-encoded
// (metadata / embedded markup dropped; SVG never accepted), then sent as a WebP (JPEG fallback) data URL that fits the
// server cap (300 KB decoded). Cover = 1200×630 (1.91:1, the OG image size) with zoom / position crop.
export const COVER_W = 1200; export const COVER_H = 630;
const BUDGET = 330000; // data-URL characters ≈ 247 KB decoded
const RASTER = /^image\/(png|jpeg|webp|gif|heic|heif|avif)$/i;
export function loadImage(file) {
  return new Promise((res, rej) => {
    if (!file || (file.type && !RASTER.test(file.type))) { rej(new Error('bad_type')); return; }
    if (file.size > 25 * 1024 * 1024) { rej(new Error('too_large')); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('decode')); };
    img.src = url;
  });
}
function encode(canvas, budget = BUDGET) {
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const q of [0.86, 0.78, 0.7, 0.6, 0.5, 0.42]) {
      const d = canvas.toDataURL(type, q);
      if (!d.startsWith(`data:${type}`)) break;
      if (d.length <= budget) return d;
    }
  }
  return '';
}
// Source rectangle for a 1.91:1 crop. zoom ≥ 1; x, y ∈ [0, 1] = position of the crop window inside the free space.
export function coverRect(W, H, { zoom = 1, x = 0.5, y = 0.5 } = {}) {
  const want = COVER_W / COVER_H;
  let sw = W; let sh = W / want; if (sh > H) { sh = H; sw = H * want; }
  sw /= Math.max(1, zoom); sh /= Math.max(1, zoom);
  return { sx: (W - sw) * Math.min(1, Math.max(0, x)), sy: (H - sh) * Math.min(1, Math.max(0, y)), sw, sh };
}
export async function cropCover(img, crop) {
  const r = coverRect(img.naturalWidth, img.naturalHeight, crop);
  for (const w of [COVER_W, 1000, 800]) {
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round(w * COVER_H / COVER_W);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);
    const d = encode(c); if (d) return { img: d, w: c.width, h: c.height };
  }
  throw new Error('too_large');
}
export async function processInline(file) {
  const img = await loadImage(file);
  for (const max of [1600, 1280, 1000, 800]) {
    const k = Math.min(1, max / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = encode(c); if (d) return { img: d, w: c.width, h: c.height };
  }
  throw new Error('too_large');
}
