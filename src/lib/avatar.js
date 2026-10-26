// Profile pictures (2026-10-18). Firebase Storage is not required, so a picture is a small
// square data URL (256 px WebP, JPEG where WebP encoding is unsupported, kept under ~60 KB) stored in:
//   - families/{fid}/members/{uid}.photoURL  → what other family members see (self-update rule allows photoURL)
//   - users/{uid}.avatar                     → owner-only copy (works even if the member write is refused)
// Only data:image/* values count as a custom picture. Older member docs may hold a Google https photoURL from
// sign-up; it is ignored so the default stays the initial letter.
export const AVATAR_PX = 256;
export const AVATAR_MAX_BYTES = 60 * 1024;

export const avatarSrc = (v) => (typeof v === 'string' && /^data:image\/(webp|jpeg|png);base64,/.test(v) && v.length < 120000 ? v : '');
// Approximate decoded size of a base64 data URL.
export const dataUrlBytes = (u) => Math.floor(((u.length - u.indexOf(',') - 1) * 3) / 4);

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error('bad_image'), { code: 'bad_image' })); };
    img.src = url;
  });
}

// Crop geometry: the image is drawn "cover"-fitted into a square viewport, scaled by zoom (1…4) and moved by
// (x, y) in viewport-relative units (-0.5…0.5 of the viewport). Returns the source rectangle to sample.
export function cropRect(w, h, { zoom = 1, x = 0, y = 0 } = {}) {
  const side = Math.min(w, h) / zoom; // source pixels visible across the square
  const cx = w / 2 - x * side;
  const cy = h / 2 - y * side;
  const sx = Math.max(0, Math.min(w - side, cx - side / 2));
  const sy = Math.max(0, Math.min(h - side, cy - side / 2));
  return { sx, sy, side };
}
// Keep the offset inside the image so the square never shows empty space.
export function clampOffset(w, h, zoom, x, y) {
  const side = Math.min(w, h) / zoom;
  const mx = Math.max(0, (w - side) / 2 / side);
  const my = Math.max(0, (h - side) / 2 / side);
  return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
}

export function renderAvatar(img, crop, px = AVATAR_PX, maxBytes = AVATAR_MAX_BYTES) {
  const c = document.createElement('canvas');
  c.width = px; c.height = px;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff'; g.fillRect(0, 0, px, px); // transparent PNGs → white, not black, as JPEG
  const { sx, sy, side } = cropRect(img.naturalWidth || img.width, img.naturalHeight || img.height, crop);
  g.drawImage(img, sx, sy, side, side, 0, 0, px, px);
  let best = '';
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const q of [0.86, 0.76, 0.64, 0.5, 0.38]) {
      const u = c.toDataURL(type, q);
      if (!u.startsWith(`data:${type}`)) break; // encoder not supported (older Safari returns PNG)
      best = u;
      if (dataUrlBytes(u) <= maxBytes) return u;
    }
    if (best) break;
  }
  if (best && dataUrlBytes(best) <= maxBytes) return best;
  // Last resort: smaller canvas.
  if (px > 128) return renderAvatar(img, crop, 128, maxBytes);
  return best;
}

// ---------------- Profile banner (unified public profile, 2026-10-18) ----------------
// 3:1 banner: same cover-fit / zoom / offset model as the avatar, generalised to an aspect ratio.
// Rendered at 1200×400 (900×300 fallback) WebP/JPEG, ≤ 110 KB so the data URL fits the server cap (160 000 chars).
export const BANNER_ASPECT = 3;
export const BANNER_W = 1200;
export const BANNER_MAX_BYTES = 110 * 1024;
export function cropRectAspect(w, h, aspect, { zoom = 1, x = 0, y = 0 } = {}) {
  // Largest source rect of the target aspect that fits the image, shrunk by zoom.
  let sw = w; let sh = w / aspect;
  if (sh > h) { sh = h; sw = h * aspect; }
  sw /= zoom; sh /= zoom;
  const cx = w / 2 - x * sw;
  const cy = h / 2 - y * sh;
  const sx = Math.max(0, Math.min(w - sw, cx - sw / 2));
  const sy = Math.max(0, Math.min(h - sh, cy - sh / 2));
  return { sx, sy, sw, sh };
}
export function clampOffsetAspect(w, h, aspect, zoom, x, y) {
  let sw = w; let sh = w / aspect;
  if (sh > h) { sh = h; sw = h * aspect; }
  sw /= zoom; sh /= zoom;
  const mx = Math.max(0, (w - sw) / 2 / sw);
  const my = Math.max(0, (h - sh) / 2 / sh);
  return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
}
export function renderBanner(img, crop, pw = BANNER_W, maxBytes = BANNER_MAX_BYTES) {
  const ph = Math.round(pw / BANNER_ASPECT);
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.fillStyle = '#fff'; g.fillRect(0, 0, pw, ph);
  const { sx, sy, sw, sh } = cropRectAspect(img.naturalWidth || img.width, img.naturalHeight || img.height, BANNER_ASPECT, crop);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, pw, ph);
  let best = '';
  for (const type of ['image/webp', 'image/jpeg']) {
    for (const q of [0.82, 0.72, 0.62, 0.5, 0.4]) {
      const u = c.toDataURL(type, q);
      if (!u.startsWith(`data:${type}`)) break;
      best = u;
      if (dataUrlBytes(u) <= maxBytes) return u;
    }
    if (best) break;
  }
  if (pw > 900) return renderBanner(img, crop, 900, maxBytes);
  return best && dataUrlBytes(best) <= maxBytes ? best : '';
}
