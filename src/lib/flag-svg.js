// Run 14: flags as SVG markup strings (emoji flags do not render on Windows). Shared by the React <Flag> (ui.jsx) and the
// static pages' language menu (seo/render.js). Simplified but recognisable at 13–20 px; 3:2 boxes.
const starPts = (cx, cy, R, r, n = 5, rot = 0) => Array.from({ length: n * 2 }, (_, i) => {
  const a = ((rot + (i * 180) / n) - 90) * Math.PI / 180; const k = i % 2 ? r : R;
  return `${(cx + k * Math.cos(a)).toFixed(2)},${(cy + k * Math.sin(a)).toFixed(2)}`;
}).join(' ');
const towards = (x, y) => (Math.atan2(5 - y, 5 - x) * 180) / Math.PI + 90 + 180; // small CN stars point at the big star
const PETAL = 'M0 0C-1.6-2.2-1.4-5.6 0.9-7.6C1.5-5.4 3.4-4.4 3.1-2.2C2.9-0.9 1.4-0.1 0 0z';
const BOX = '0 0 30 20';
// Korean trigram (3 bars; `b` = which bars are broken, top→bottom) centred at (x, y), rotated `r` degrees.
const tri = (x, y, r, b) => `<g transform="translate(${x} ${y}) rotate(${r})">${[0, 1, 2].map((i) => (b[i]
  ? `<rect x="-2.5" y="${-2.1 + i * 1.6}" width="2.2" height="1" /><rect x="0.3" y="${-2.1 + i * 1.6}" width="2.2" height="1" />`
  : `<rect x="-2.5" y="${-2.1 + i * 1.6}" width="5" height="1" />`)).join('')}</g>`;

const F = {
  gb: ['0 0 60 40', '<clipPath id="ukc"><rect width="60" height="40"/></clipPath><g clip-path="url(#ukc)"><rect width="60" height="40" fill="#012169"/><path d="M0 0l60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0l60 40M60 0L0 40" stroke="#C8102E" stroke-width="3"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="7"/></g>'],
  hk: ['-15 -10 30 20', `<rect x="-15" y="-10" width="30" height="20" fill="#DE2910"/>${[0, 72, 144, 216, 288].map((r) => `<path d="${PETAL}" fill="#fff" transform="rotate(${r}) translate(0 -0.6)"/>`).join('')}`],
  cn: [BOX, `<rect width="30" height="20" fill="#EE1C25"/><polygon points="${starPts(5, 5, 3, 1.15)}" fill="#FFFF00"/>${[[10, 2], [12, 4], [12, 7], [10, 9]].map(([x, y]) => `<polygon points="${starPts(x, y, 1, 0.38, 5, towards(x, y))}" fill="#FFFF00"/>`).join('')}`],
  tw: [BOX, `<rect width="30" height="20" fill="#FE0000"/><rect width="15" height="10" fill="#000095"/><polygon points="${starPts(7.5, 5, 3.75, 2.0, 12)}" fill="#fff"/><circle cx="7.5" cy="5" r="1.95" fill="#000095"/><circle cx="7.5" cy="5" r="1.65" fill="#fff"/>`],
  jp: [BOX, '<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>'],
  kr: [BOX, `<rect width="30" height="20" fill="#fff"/><g transform="translate(15 10) rotate(33.7)"><path d="M-5 0a5 5 0 0 1 10 0z" fill="#CD2E3A"/><path d="M-5 0a5 5 0 0 0 10 0z" fill="#0047A0"/><circle cx="-2.5" cy="0" r="2.5" fill="#CD2E3A"/><circle cx="2.5" cy="0" r="2.5" fill="#0047A0"/></g><g fill="#000">${tri(6.2, 4.3, -56.3, [0, 0, 0])}${tri(23.8, 15.7, -56.3, [1, 1, 1])}${tri(23.8, 4.3, 56.3, [0, 1, 0])}${tri(6.2, 15.7, 56.3, [1, 0, 1])}</g>`],
  es: [BOX, '<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/><rect x="7" y="7.6" width="3.2" height="4.4" rx="0.6" fill="#AA151B" opacity=".85"/>'],
  fr: [BOX, '<rect width="30" height="20" fill="#fff"/><rect width="10" height="20" fill="#002395"/><rect x="20" width="10" height="20" fill="#ED2939"/>'],
  de: [BOX, '<rect width="30" height="20" fill="#FFCE00"/><rect width="30" height="6.67" fill="#000"/><rect y="6.67" width="30" height="6.67" fill="#DD0000"/>'],
  br: [BOX, '<rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.2 27.4,10 15,17.8 2.6,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6 9.1c3-.9 6.4-.5 8.9 1.2" stroke="#fff" stroke-width=".8" fill="none"/>'],
  id: [BOX, '<rect width="30" height="20" fill="#fff"/><rect width="30" height="10" fill="#E70011"/>'],
  vn: [BOX, `<rect width="30" height="20" fill="#DA251D"/><polygon points="${starPts(15, 10.4, 6, 2.3)}" fill="#FFFF00"/>`],
  th: [BOX, '<rect width="30" height="20" fill="#A51931"/><rect y="3.33" width="30" height="13.33" fill="#F4F5F8"/><rect y="6.67" width="30" height="6.67" fill="#2D2A4A"/>'],
};
export const FLAG_CODES = Object.keys(F);
// Inner markup + viewBox for a flag code (unknown → GB, the old default).
export const flagParts = (code) => { const [viewBox, inner] = F[code] || F.gb; return { viewBox, inner }; };
// Full <svg> string (static pages). `size` = height in px.
export function flagSvg(code, size = 14) {
  const { viewBox, inner } = flagParts(code);
  return `<svg class="flag" width="${+(size * 1.5).toFixed(1)}" height="${size}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${inner}</svg>`;
}
// Static pages: one hidden sprite of <symbol>s per page + <use> references (keeps the 24 menu flags small).
export const flagSprite = (codes) => `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${[...new Set(codes)].map((c) => { const { viewBox, inner } = flagParts(c); return `<symbol id="flag-${c}" viewBox="${viewBox}">${inner}</symbol>`; }).join('')}</defs></svg>`;
export const flagUse = (code, size = 14) => `<svg class="flag" width="${+(size * 1.5).toFixed(1)}" height="${size}" aria-hidden="true" focusable="false"><use href="#flag-${F[code] ? code : 'gb'}"/></svg>`;
