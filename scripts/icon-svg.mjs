// Nest 巢 icon artwork (flat, restored 2026-10-17): the original simple mark — a rounded nest arc cradling an egg —
// in WHITE on a solid BLACK tile (reads in iOS light and dark mode). No gradients, glass or colour.
// Pure SVG strings so render-icons.mjs can rasterise them; geometry = MARK_PATHS in src/brand.jsx (64×64 space).
// (The Liquid Glass version is kept in work/icon-svg.glass.bak.mjs.)
export const EGG = 'M32 8c-7.6 0-12.5 9.6-12.5 17.6C19.5 33 25 38 32 38s12.5-5 12.5-12.4C44.5 17.6 39.6 8 32 8z';
export const NEST = 'M7 34.5c0-1.4 1.1-2.5 2.5-2.5 2.6 0 4.3 2 6 4.6C18.6 41.3 24 44 32 44s13.4-2.7 16.5-7.4c1.7-2.6 3.4-4.6 6-4.6 1.4 0 2.5 1.1 2.5 2.5C57 47 46 56 32 56S7 47 7 34.5z';

export function glyph(_id = 'g', { color = '#fff' } = {}) {
  return `<path d="${EGG}" fill="${color}"/><path d="${NEST}" fill="${color}"/>`;
}

// Black square (or rounded) tile with the white flat glyph. `scale` = glyph width relative to the tile.
export function tile(size, { rounded = false, scale = 0.6, bg = true } = {}) {
  const s = (size * scale) / 50;            // glyph spans ~50 units (x 7..57), y 8..56
  const tx = size / 2 - 32 * s;
  const ty = size / 2 - 32 * s;
  const r = rounded ? size * 0.225 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" rx="${r}" fill="#000"/>` : ''}
    <g transform="translate(${tx} ${ty}) scale(${s})">${glyph('m')}</g>
  </svg>`;
}
