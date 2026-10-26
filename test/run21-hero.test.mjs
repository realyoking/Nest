import './_env.mjs';
// Run 21: (1) regression — the nav menu sheet was hidden behind the hero on tablet / phone (backdrop-filter on the
// <header> made it the containing block of the position:fixed sheet); (2) the hero art is real raster layers.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { heroArtHtml, HERO_IMG, pictureHtml } from '../src/lib/hero-art.js';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const pub = (u) => new URL(`../public${u}`, import.meta.url);
const size = (u) => fs.statSync(pub(u)).size;

// Props that turn an element into the containing block of its position:fixed descendants.
const TRAPS = /(^|;)\s*(-webkit-)?(backdrop-filter|filter|transform|perspective|contain|will-change)\s*:/;
function headerRules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  const flat = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((m = re.exec(flat))) {
    for (const sel of m[1].split(',')) {
      const last = sel.trim().split(/\s+|>/).filter(Boolean).pop() || '';
      // the <header class="snav …"> itself: only .snav* classes and :not(...), no pseudo-element, no descendant
      if (/^(\.snav(-lp|-hero)?|:not\([^)]*\))+$/.test(last) && last.startsWith('.snav')) out.push([sel.trim(), m[2]]);
    }
  }
  return out;
}

test('menu over hero: the nav <header> never gets filter / backdrop-filter / transform (fixed sheet stays viewport-sized)', () => {
  const css = read('src/styles.css');
  const rules = headerRules(css);
  assert.ok(rules.length >= 5, 'found the header rules');
  for (const [sel, body] of rules) assert.ok(!TRAPS.test(body), `${sel} { ${body.trim().slice(0, 120)} }`);
  // the frosted bar moved to a pseudo-element
  assert.match(css, /\.snav-lp::before \{[^}]*backdrop-filter/);
  assert.match(css, /\.snav-lp:not\(\.snav-hero\)::before \{ opacity: 1; \}/);
  // the sheet is still fixed to the viewport and above the hero
  assert.match(css, /\.snav-panel \{ position: fixed; left: 0; right: 0; top: 68px; bottom: 0;[^}]*z-index: 60/);
  assert.match(css, /\.snav \{ position: sticky; top: 0; z-index: 50;/);
  const hz = css.match(/\.hz \{[^}]*\}/)[0];
  assert.ok(!/z-index:\s*[1-9]\d{2}/.test(hz), 'hero must not out-stack the nav');
  // static pages: same guarantee for the pre-rendered nav CSS
  const R = read('seo/render.js');
  const nav = R.match(/const NAV_CSS = `([\s\S]*?)`;/)[1];
  for (const [sel, body] of headerRules(nav)) assert.ok(!TRAPS.test(body), `static ${sel}`);
  // React: the sheet is rendered (inside the header) only when open
  const P = read('src/components/PublicLayout.jsx');
  assert.match(P, /\{open && \(\s*<div className="snav-panel open" data-testid="mobile-menu">/);
});

test('raster art: every layer exists as AVIF + WebP, transparent layers have alpha, weights stay reasonable', () => {
  const urls = [];
  for (const k of ['scene', 'grass']) for (const n of ['day', 'night']) {
    const p = HERO_IMG[k][n];
    urls.push(p.src, ...p.srcset.split(', ').map((x) => x.split(' ')[0]));
    for (const s of p.sources) urls.push(...s.srcset.split(', ').map((x) => x.split(' ')[0]));
  }
  urls.push(HERO_IMG.sun, HERO_IMG.moon, HERO_IMG.butterflies);
  for (const u of new Set(urls)) { assert.ok(/^\/hero\/v2\/.+\.(webp|avif)$/.test(u), u); assert.ok(size(u) > 3000, u); }
  // webp with alpha = VP8X chunk with the alpha flag
  for (const u of [HERO_IMG.sun, HERO_IMG.moon, HERO_IMG.butterflies, '/hero/v2/grass-day-1376.webp', '/hero/v2/grass-night-900.webp']) {
    const b = fs.readFileSync(pub(u));
    assert.equal(b.toString('ascii', 12, 16), 'VP8X', u); assert.ok(b[20] & 0x10, `${u} has alpha`);
  }
  const deskDay = size('/hero/v2/scene-day-2200.avif') + size('/hero/v2/grass-day-1376.avif') + size(HERO_IMG.sun) + size(HERO_IMG.butterflies) + size('/hero/app-desk-zh-light-1280.webp');
  const mobDay = size('/hero/v2/scene-day-tall-1152.avif') + size('/hero/v2/grass-day-900.avif') + size(HERO_IMG.sun) + size(HERO_IMG.butterflies) + size('/hero/app-mob-zh-light-520.webp');
  assert.ok(deskDay < 400 * 1024, `desktop day ${deskDay}`);
  assert.ok(mobDay < 300 * 1024, `mobile day ${mobDay}`);
});

test('hero markup: raster sun / moon / butterflies (no SVG art), day eager + high priority, night lazy', () => {
  const art = heroArtHtml();
  assert.match(art, /<picture class="hz-scene hz-d"><source media="\(max-width: 640px\)" type="image\/avif" srcset="\/hero\/v2\/scene-day-tall-768\.avif/);
  assert.match(art, /<img src="\/hero\/v2\/scene-day-1376\.webp"[^>]*fetchpriority="high"/);
  assert.match(art, /<picture class="hz-scene hz-n">(<source[^>]* data-srcset="[^"]+"[^>]*>)+<img data-src=/);
  assert.match(art, /<img class="hz-sun" src="\/hero\/v2\/sun-480\.webp"/);
  assert.match(art, /<img class="hz-moon" data-src="\/hero\/v2\/moon-300\.webp"/);
  assert.ok(!/<svg[^>]*>(?![\s\S]*hz-stars)/.test(art.replace(/<svg class="hz-stars"[\s\S]*?<\/svg>/, '')), 'only the twinkle overlay is SVG');
  assert.ok(!/\s(src|srcset)="[^"]*night/.test(art), 'no eager night image');
  assert.equal((art.match(/class="hz-bf /g) || []).length, 4);
  assert.match(pictureHtml(HERO_IMG.grass.night, 'hz-n', { lazy: true }), /^<picture class="hz-n"><source type="image\/avif" data-srcset=/);
  const L = read('src/pages/public/Landing.jsx');
  assert.ok(!/MOON_SVG|BUTTERFLY_SVG/.test(L));
  assert.match(L, /<HeroPic p=\{HERO_IMG\.scene\.day\} className="hz-scene hz-d" high \/>/);
  assert.match(L, /\{night && <HeroPic p=\{HERO_IMG\.scene\.night\}/);
  assert.match(L, /\{night \? <img className="hz-moon" src=\{HERO_IMG\.moon\}/);
  const css = read('src/styles.css');
  assert.match(css, /html\[data-lpt='dark'\]\.lpt-anim \.hz-sun \{ transition: transform/);
  // phones: the moon sits below the 68px nav bar, not on the logo
  const phone = css.slice(css.lastIndexOf('@media (max-width: 640px) {'));
  const top = +phone.match(/\.hz-moon \{[^}]*top: (\d+)px/)[1];
  assert.ok(top >= 76, `moon top ${top}`);
  assert.ok(read('scripts/serve-dist.mjs').includes("'.avif': 'image/avif'"));
});

test('reference images are not shipped (original renders only)', () => {
  const up = new URL('../../uploads/', import.meta.url);
  const refs = ['hero-target-look.png', 'hero-grass-chosen-day.png', 'hero-night-mood-ref.png'].map((f) => new URL(f, up)).filter((u) => fs.existsSync(u));
  const hashes = new Set(refs.map((u) => crypto.createHash('sha256').update(fs.readFileSync(u)).digest('hex')));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(new URL('../public', import.meta.url).pathname)) {
    assert.ok(!/target-look/.test(f), f);
    if (/\.(png|jpe?g|webp|avif)$/.test(f)) assert.ok(!hashes.has(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')), f);
  }
});
