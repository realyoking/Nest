// Run 20: the landing hero scene (day meadow / moonlit night). Plain strings + data so the React landing (Landing.jsx)
// and the pre-rendered static home (seo/render.js) draw the SAME decorative layers. All art is original (generated for
// Nest). Night images are lazy (only fetched in dark mode).
export const LP_THEME_KEY = 'nest.lpTheme';
// Run 21: REAL raster art (original generate_image renders, cut in work/run21/art/process.py) replaces the CSS/SVG sky,
// sun, moon and butterflies. Full scene photo per theme (sky + clouds/stars + hills; tall crop for phones), separate
// transparent sun / moon / butterflies / foreground grass. AVIF first, WebP fallback. Night set is lazy.
const V = '/hero/v2/';
export const SCENE_SIZES = '(max-width: 640px) 220vw, 145vw';
export const GRASS_SIZES = '(max-width: 640px) 900px, min(1400px, 158vw)';
const sceneSet = (n, ext) => ({
  tall: `${V}scene-${n}-tall-768.${ext} 768w, ${V}scene-${n}-tall-1152.${ext} 1152w`,
  wide: `${V}scene-${n}-1376.${ext} 1376w, ${V}scene-${n}-2200.${ext} 2200w`,
});
const grassSet = (n, ext) => `${V}grass-${n}-900.${ext} 900w, ${V}grass-${n}-1376.${ext} 1376w`;
// One <picture> description per layer: sources (avif/webp, phone crop first) + the <img> fallback.
export function heroPicture(layer, n) {
  if (layer === 'scene') {
    const a = sceneSet(n, 'avif'), w = sceneSet(n, 'webp');
    return { sizes: SCENE_SIZES, src: `${V}scene-${n}-1376.webp`, srcset: w.wide, sources: [
      { media: '(max-width: 640px)', type: 'image/avif', srcset: a.tall }, { media: '(max-width: 640px)', type: 'image/webp', srcset: w.tall },
      { type: 'image/avif', srcset: a.wide }] };
  }
  return { sizes: GRASS_SIZES, src: `${V}grass-${n}-1376.webp`, srcset: grassSet(n, 'webp'), sources: [{ type: 'image/avif', srcset: grassSet(n, 'avif') }] };
}
export const HERO_IMG = {
  scene: { day: heroPicture('scene', 'day'), night: heroPicture('scene', 'night') },
  grass: { day: heroPicture('grass', 'day'), night: heroPicture('grass', 'night') },
  sun: `${V}sun-480.webp`, moon: `${V}moon-300.webp`, butterflies: `${V}butterflies-256.webp`,
};
// Static markup of one picture; lazy = night (data-srcset / data-src, swapped in by the page script only in dark mode).
export function pictureHtml(p, cls, { lazy = false, high = false } = {}) {
  const d = lazy ? 'data-' : '';
  const src = p.sources.map((s) => `<source${s.media ? ` media="${s.media}"` : ''} type="${s.type}" ${d}srcset="${s.srcset}" sizes="${p.sizes}">`).join('');
  return `<picture class="${cls}">${src}<img ${d}src="${p.src}" ${d}srcset="${p.srcset}" sizes="${p.sizes}" alt="" decoding="async"${high ? ' fetchpriority="high"' : ''}></picture>`;
}
// Real screenshots of the app (mock build, sample data): scripts/hero-shots.mjs. 'zh' covers 繁 + 简, 'en' everything else.
export const shotLang = (lang) => (lang === 'en' ? 'en' : 'zh');
export function appShot(lang, scheme) {
  const l = shotLang(lang);
  return {
    desk: `/hero/app-desk-${l}-${scheme}-860.webp 860w, /hero/app-desk-${l}-${scheme}-1280.webp 1280w`,
    deskSrc: `/hero/app-desk-${l}-${scheme}-860.webp`,
    mob: `/hero/app-mob-${l}-${scheme}-520.webp`,
  };
}
export const SHOT_SIZES = '(max-width: 640px) 240px, min(640px, 82vw)';

// Deterministic star field (no randomness between server and client).
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
export function starsSvg() {
  const r = rng(20261020);
  let c = '';
  for (let i = 0; i < 110; i++) {
    const x = (r() * 1000).toFixed(1), y = (Math.pow(r(), 1.35) * 560).toFixed(1);
    const big = r() > 0.9;
    const rad = big ? (1.3 + r() * 0.8).toFixed(2) : (0.45 + r() * 0.75).toFixed(2);
    const o = (0.45 + r() * 0.55).toFixed(2);
    c += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#fff" opacity="${o}"${big || i % 9 === 0 ? ` class="tw" style="animation-delay:${(r() * 4).toFixed(2)}s"` : ''}/>`;
  }
  return `<svg class="hz-stars" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMin slice" aria-hidden="true" focusable="false">${c}</svg>`;
}
// x / y in % of the hero, s = px, d = delay, v = sprite half (0 | 1), r = heading in deg.
export const BUTTERFLIES = [
  { x: 20, y: 32, s: 40, d: 0, v: 0, r: -18 }, { x: 26, y: 47, s: 30, d: 1.2, v: 1, r: 14 }, { x: 76, y: 41, s: 32, d: 0.6, v: 1, r: 20 }, { x: 87, y: 57, s: 26, d: 2.1, v: 0, r: -10 },
];
export const FIREFLIES = [
  [12, 70, 0], [22, 78, 1.4], [31, 66, 2.6], [40, 82, 0.8], [58, 74, 2.0], [66, 68, 3.1], [74, 80, 0.4], [83, 70, 1.8], [90, 76, 2.9], [8, 84, 3.6], [49, 70, 1.1], [95, 66, 0.2],
];

// Static (pre-rendered) markup of the decorative layers; React renders the same classes in Landing.jsx.
export function heroArtHtml() {
  const bfs = BUTTERFLIES.map((b, i) => `<span class="hz-bf hz-bf${i}" style="left:${b.x}%;top:${b.y}%;width:${b.s}px;height:${b.s}px;--r:${b.r}deg;animation-delay:${b.d}s"><i class="bfv${b.v}"></i></span>`).join('');
  const ffs = FIREFLIES.map(([x, y, d]) => `<i style="left:${x}%;top:${y}%;animation-delay:${d}s"></i>`).join('');
  return `<div class="hz-sky" aria-hidden="true">${pictureHtml(HERO_IMG.scene.day, 'hz-scene hz-d', { high: true })}${pictureHtml(HERO_IMG.scene.night, 'hz-scene hz-n', { lazy: true })}`
    + `<div class="hz-stars-w">${starsSvg()}</div><img class="hz-sun" src="${HERO_IMG.sun}" alt="" decoding="async"><img class="hz-moon" data-src="${HERO_IMG.moon}" alt="" decoding="async">`
    + `<div class="hz-bfs">${bfs}</div><div class="hz-ffs">${ffs}</div></div>`;
}
// Pre-paint: <html data-lpt="dark|light"> from the saved landing choice, else the system scheme.
export const LP_THEME_HEAD_SCRIPT = `<script>(function(){try{var t=null;try{t=localStorage.getItem('${LP_THEME_KEY}')}catch(e){}if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-lpt',t)}catch(e){}})()</script>`;
