import './_env.mjs';
// Run 28: dropdown / menu contrast in light and dark. The landing's pre-rendered CSS (inline <style> after the app
// stylesheet) used to set .lang-menu{background:#fff} globally, so the React menu showed near-white dark-theme text on
// white. Guard: static CSS is scoped to #seo, menus read theme tokens, and token pairs meet WCAG AA (4.5:1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scopeCss } from '../seo/render.js';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const render = readFileSync(new URL('../seo/render.js', import.meta.url), 'utf8');

const lum = (hex) => {
  const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const tokens = (block) => Object.fromEntries([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{3,6})/gi)].map((m) => [m[1], m[2]]));
const blockOf = (sel) => { const i = css.indexOf(sel); return css.slice(i, css.indexOf('}', i)); };

test('menu components never hard-code a white background', () => {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(([, sel]) => /(lang-menu|am-menu|model-|think-|ctx-menu|dropdown|popover)/.test(sel));
  assert.ok(rules.length > 5);
  for (const [, sel, body] of rules) assert.ok(!/background:\s*(#fff\b|#ffffff\b|white\b)/i.test(body), `hard-coded white bg in ${sel.trim()}`);
  assert.match(blockOf('.lang-menu { position: absolute'), /background: var\(--surface\); color: var\(--ink\)/);
});

test('landing pre-rendered CSS is scoped to #seo (cannot override the React UI)', () => {
  const m = render.match(/const HOME_CSS = \(\) => `([^`]*)`/);
  assert.ok(m, 'HOME_CSS found');
  assert.match(m[1], /scopeCss\(NAV_CSS_CORE \+ FOOT_CSS, '#seo'\)/);
  assert.doesNotMatch(m[1], /\$\{NAV_CSS\}/);
  const out = scopeCss('.lang-menu{background:#fff}.a,.b:hover{x:1}@media (max-width:640px){.c{y:2}}html[data-x] .d{z:3}', '#seo');
  assert.equal(out, '#seo .lang-menu{background:#fff}#seo .a,#seo .b:hover{x:1}@media (max-width:640px){#seo .c{y:2}}html[data-x] #seo .d{z:3}');
  assert.doesNotMatch(render.match(/const NAV_CSS_CORE = `([^`]*)`/)[1], /\.lang-menu\{[^}]*background:#fff/);
});

test('light, app-dark and landing-dark tokens meet WCAG AA for menu text', () => {
  const light = tokens(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
  const appDark = tokens(blockOf("html[data-theme='dark'] {"));
  const lpDark = tokens(blockOf("html[data-lpt='dark'] {"));
  for (const [name, t] of [['light', light], ['app dark', appDark], ['landing dark', lpDark]]) {
    assert.ok(contrast(t.ink, t.surface) >= 4.5, `${name} ink/surface ${contrast(t.ink, t.surface)}`);
    assert.ok(contrast(t.ink, t.soft) >= 4.5, `${name} ink/soft (selected + hover) ${contrast(t.ink, t.soft)}`);
    assert.ok(contrast(t.muted, t.surface) >= 4.5, `${name} muted/surface ${contrast(t.muted, t.surface)}`);
    assert.ok(contrast(t['on-ink'], t.ink) >= 4.5, `${name} toast on-ink/ink`);
  }
});

test('dark selects get a light chevron and themed options', () => {
  assert.match(css, /html\[data-theme='dark'\] \.select, html\[data-lpt='dark'\] \.select \{ background-image: url\("[^"]*stroke='%23f2f2f2'/);
  assert.match(css, /html\[data-theme='dark'\] select option[^{]*\{ background: var\(--surface\); color: var\(--ink\); \}/);
});
