// Published-plugin listing (store page) metadata, editable by the creator WITHOUT a code rebuild:
// screenshots (≤6, each with alt text, standard ratio), icon, description (zh + en), 功能 text, category, links.
// Pure JS: shared by the browser (ListingEditor), the server (api/_plugins.js op=plug-listing) and tests.
// Review policy (server): normal plugins → applied to the live listing at once; plugins labelled Safe or Verified (or
// first-party) → stored as a pending listing change until an admin approves it (light re-review), live listing unchanged.
import { CATEGORIES } from './manifest.js';

export const LISTING_LIMITS = {
  shots: 6,
  shot: 300 * 1024,     // data URL length of one compressed screenshot (WebP/JPEG)
  icon: 48 * 1024,      // data URL length (PNG/WebP/JPEG only — no SVG uploads)
  alt: 140,
  desc: 600,
  features: 1000,
  links: 4,
  linkLabel: 40,
};
// Standard ratios: landscape 16:10 (1280×800) and portrait 9:16 (720×1280). Every upload is centre-cropped to the nearer one.
export const SHOT_RATIOS = { landscape: { w: 1280, h: 800, r: 16 / 10 }, portrait: { w: 720, h: 1280, r: 9 / 16 } };
export const ICON_SIZE = 256;
export const ratioFor = (w, h) => (w / h >= 1 ? 'landscape' : 'portrait');
// Centre crop of a w×h image to the target ratio → { sx, sy, sw, sh } (source rect).
export function cropRect(w, h, ratio) {
  const r = SHOT_RATIOS[ratio]?.r || ratio;
  if (w / h > r) { const sw = Math.round(h * r); return { sx: Math.round((w - sw) / 2), sy: 0, sw, sh: h }; }
  const sh = Math.round(w / r); return { sx: 0, sy: Math.round((h - sh) / 2), sw: w, sh };
}

const ctl = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
const line = (s, n) => ctl(s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, n);
const multi = (s, n) => ctl(s).replace(/\r/g, '').split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
export const SHOT_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const ICON_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const cleanListingShot = (v) => (typeof v === 'string' && SHOT_RE.test(v) && v.length <= LISTING_LIMITS.shot ? v : '');
export const cleanListingIcon = (v) => (typeof v === 'string' && ICON_RE.test(v) && v.length <= LISTING_LIMITS.icon ? v : '');
export function cleanLink(l) {
  const label = line(l?.label, LISTING_LIMITS.linkLabel);
  try {
    const u = new URL(String(l?.url || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.href.length > 300) return null;
    return { label: label || u.hostname, url: u.href };
  } catch { return null; }
}

// Client payload → { patch, errors }. `shots` is the FULL new ordered list: each item is { keep: <current index> } or
// { img: <data URL> }, plus { alt }. Fields that are absent are not changed. `current` = number of screenshots now.
// `currentIcon` = the icon the listing has now (may be a first-party SVG path): sending it back unchanged is not an edit.
export function cleanListingPatch(b = {}, { current = 0, currentIcon } = {}) {
  const patch = {}; const errors = [];
  if ('descZh' in b) patch.descZh = multi(b.descZh, LISTING_LIMITS.desc);
  if ('desc' in b) patch.desc = multi(b.desc, LISTING_LIMITS.desc);
  if ('features' in b) patch.features = multi(b.features, LISTING_LIMITS.features).split('\n').filter(Boolean).slice(0, 20).join('\n');
  if ('category' in b) { if (CATEGORIES.includes(b.category)) patch.category = b.category; else errors.push('bad_category'); }
  if ('links' in b) {
    const raw = Array.isArray(b.links) ? b.links.slice(0, LISTING_LIMITS.links + 2) : [];
    const ok = raw.map(cleanLink);
    if (ok.some((x) => !x)) errors.push('bad_link');
    patch.links = ok.filter(Boolean).slice(0, LISTING_LIMITS.links);
  }
  if ('icon' in b && !(currentIcon !== undefined && b.icon === currentIcon)) {
    if (!b.icon) patch.icon = '';
    else if (cleanListingIcon(b.icon)) patch.icon = b.icon;
    else errors.push('bad_icon');
  }
  if ('shots' in b) {
    if (!Array.isArray(b.shots) || b.shots.length > LISTING_LIMITS.shots) errors.push('too_many_shots');
    else {
      const seen = new Set();
      patch.shots = b.shots.map((s) => {
        const alt = line(s?.alt, LISTING_LIMITS.alt);
        if (s && Number.isInteger(s.keep)) {
          if (s.keep < 0 || s.keep >= current || seen.has(s.keep)) { errors.push('bad_shot_ref'); return null; }
          seen.add(s.keep); return { keep: s.keep, alt };
        }
        const img = cleanListingShot(s?.img);
        if (!img) { errors.push(String(s?.img || '').length > LISTING_LIMITS.shot ? 'shot_too_large' : 'bad_screenshot'); return null; }
        return { img, alt };
      });
      if (patch.shots.some((x) => !x)) delete patch.shots;
    }
  }
  return { patch, errors: [...new Set(errors)] };
}
// Which edits need the light admin re-review.
export const needsListingReview = (p, isSafeFn) => !!p && (!!p.verified || !!p.firstParty || (isSafeFn ? isSafeFn(p) : false));
