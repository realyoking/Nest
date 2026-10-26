import './_env.mjs';
// Run 20: landing meadow hero (day / night), landing light / dark toggle, static screenshot, lazy night set.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { starsSvg, heroArtHtml, appShot, HERO_IMG, LP_THEME_HEAD_SCRIPT, LP_THEME_KEY } from '../src/lib/hero-art.js';
import { STRINGS } from '../src/lib/strings.js';
import { toHans } from '../src/lib/hans.js';
import { buildSeo } from '../seo/build.js';

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const size = (u) => fs.statSync(new URL(`../public${u}`, import.meta.url)).size;

test('hero art: deterministic stars, every referenced image exists, weights stay small', () => {
  assert.equal(starsSvg(), starsSvg());
  assert.ok((starsSvg().match(/<circle/g) || []).length >= 80);
  for (const l of ['en', 'zh']) for (const s of ['light', 'dark']) {
    const a = appShot(l, s);
    for (const u of [a.deskSrc, a.mob, ...a.desk.split(', ').map((x) => x.split(' ')[0])]) { assert.ok(/\.webp$/.test(u)); assert.ok(size(u) > 5000 && size(u) < 90000, u); }
  }
  // Run 21: the art weights / files are checked in test/run21-hero.test.mjs.
  assert.equal(appShot('zh-Hans', 'light').mob, '/hero/app-mob-zh-light-520.webp');
  assert.equal(appShot('en', 'dark').mob, '/hero/app-mob-en-dark-520.webp');
});

test('reference mockups are not shipped (original art only)', () => {
  const up = new URL('../../uploads/', import.meta.url);
  const refs = ['hero-grass-chosen-day.png', 'hero-grass-chosen-mobile.png', 'hero-night-mood-ref.png'].map((f) => new URL(f, up)).filter((u) => fs.existsSync(u));
  const hashes = new Set(refs.map((u) => crypto.createHash('sha256').update(fs.readFileSync(u)).digest('hex')));
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(new URL('../public', import.meta.url).pathname)) {
    assert.ok(!/hero-grass-chosen|night-mood-ref/.test(f), f);
    if (/\.(png|jpe?g|webp)$/.test(f)) assert.ok(!hashes.has(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')), f);
  }
});

test('static hero: day art eager, night set only as data-srcset, headline is text, theme pre-paint script', () => {
  const art = heroArtHtml();
  assert.ok(!/\ssrc(set)?="[^"]*night/.test(art), 'night art must not load eagerly');
  assert.match(art, /data-srcset="\/hero\/v2\/scene-night-/);
  assert.match(LP_THEME_HEAD_SCRIPT, new RegExp(LP_THEME_KEY.replace('.', '\\.')));
  assert.match(LP_THEME_HEAD_SCRIPT, /prefers-color-scheme: dark/);

  const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-r20-'));
  fs.writeFileSync(path.join(OUT, 'index.html'), read('index.html'));
  fs.mkdirSync(path.join(OUT, 'beta')); fs.writeFileSync(path.join(OUT, 'beta', 'index.html'), read('index.html'));
  buildSeo(OUT);
  for (const [f, h1, shot] of [['index.html', '全家人的', 'zh'], ['en/home.html', 'The AI helper', 'en'], ['zh-hans/home.html', '全家人的', 'zh'], ['ja/home.html', null, 'en']]) {
    const h = fs.readFileSync(path.join(OUT, f), 'utf8');
    assert.match(h, /<section class="hz">/, f);
    assert.ok(h.includes(LP_THEME_HEAD_SCRIPT), `${f} theme head script`);
    assert.ok(h.indexOf(LP_THEME_HEAD_SCRIPT) < h.indexOf('<body'), `${f} script before body`);
    if (h1) assert.match(h, new RegExp(`<h1 class="lp-h1"><span class="bt-line">${h1}`), f);
    assert.match(h, new RegExp(`<img src="/hero/app-desk-${shot}-light-860\\.webp"`), `${f} light screenshot`);
    assert.match(h, new RegExp(`data-src="/hero/app-desk-${shot}-dark-860\\.webp"`), `${f} dark screenshot lazy`);
    assert.ok(!/<img[^>]+\ssrc="[^"]*(night|-dark-)/.test(h), `${f}: no eager night image`);
    assert.ok(!/DemoApp|demo-frame/.test(h.split('<section class="hz">')[1].split('</section>')[0]), `${f}: no demo in hero`);
  }
});

test('React landing: hero has the static screenshot (no live demo), demo loads lazily below, toggle next to language', () => {
  const L = read('src/pages/public/Landing.jsx');
  const hero = L.slice(L.indexOf('function Hero()'), L.indexOf('function Demo()'));
  assert.ok(!/DemoApp/.test(hero));
  assert.match(hero, /HeroShot/);
  assert.match(L, /IntersectionObserver/);
  assert.match(L, /<Hero \/>\s*<Features \/>\s*<Demo \/>/);
  assert.match(L, /useLpThemeScope\(\)/);
  assert.match(L, /useAuthCta\(s\.status\)/);
  const P = read('src/components/PublicLayout.jsx');
  assert.match(P, /<LangMenu \/>\s*\{hero && <ThemeToggle \/>\}/);
  assert.match(P, /aria-pressed=\{dark\}/);
});

test('copy: toggle + screenshot labels in zh-Hant (書面語), zh-Hans and English; other languages have their own', () => {
  const zh = STRINGS['zh-Hant'].lp, en = STRINGS.en.lp;
  for (const k of ['themeDark', 'themeLight', 'heroShotAlt']) { assert.ok(zh[k] && en[k], k); assert.ok(/[\u4e00-\u9fff]/.test(zh[k])); }
  assert.equal(toHans(zh.themeLight), '切换至浅色模式');
  assert.ok(!/(嘅|咗|唔|喺|睇|搵)/.test(zh.themeDark + zh.themeLight + zh.heroShotAlt));
  for (const l of ['ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'id', 'vi', 'th']) assert.match(read(`src/locales/${l}.js`), /themeDark: '[^']+', themeLight: '[^']+', heroShotAlt: '[^']+'/, l);
});

test('lp-theme: default follows system, toggle saves + animates, reduced motion swaps instantly', async () => {
  const attrs = {}; const cls = new Set(); const store = {};
  let reduce = false; let dark = true;
  globalThis.document = { documentElement: { getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; }, hasAttribute: (k) => k in attrs, classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) } } };
  globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduce : dark, addEventListener() {}, removeEventListener() {} });
  const m = await import('../src/lib/lp-theme.js');
  assert.equal(m.initialLpTheme(), 'dark');
  dark = false; assert.equal(m.initialLpTheme(), 'light');
  m.setLpTheme('dark');
  assert.equal(attrs['data-lpt'], 'dark'); assert.equal(store[LP_THEME_KEY], 'dark'); assert.ok(cls.has('lpt-anim'));
  assert.equal(m.initialLpTheme(), 'dark', 'saved choice beats the system');
  reduce = true; m.setLpTheme('light');
  assert.equal(attrs['data-lpt'], 'light'); assert.ok(!cls.has('lpt-anim'), 'reduced motion: no animation class');
  delete globalThis.document; delete globalThis.localStorage; delete globalThis.matchMedia;
});

test('CSS: dark tokens for the whole landing, sunset / moonrise only under .lpt-anim, reduced-motion guard', () => {
  const css = read('src/styles.css');
  assert.match(css, /html\[data-lpt='dark'\] \{[^}]*--bg: #0b0b0b/);
  assert.match(css, /html\[data-lpt='dark'\]\.lpt-anim \.hz-sun \{ transition: transform/);
  assert.match(css, /html\[data-lpt='dark'\]\.lpt-anim \.hz-moon \{ transition: transform/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.hz-bf/);
  assert.match(css, /\.hz-fg \{[^}]*mask-image/);
});

test('Vercel Hobby: still 12 serverless functions', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const fns = walk(new URL('../api', import.meta.url).pathname).filter((f) => /\.js$/.test(f) && !path.basename(f).startsWith('_'));
  assert.equal(fns.length, 12, fns.join('\n'));
});
