import './_env.mjs';
// Run 12: landing demo blank on /en/ · /zh-hant/ · /zh-hans/ (route-context leak) + auth-aware CTA + compact account menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route, UNSAFE_LocationContext, UNSAFE_RouteContext } from 'react-router-dom';
import { readAuthHint, writeAuthHint, ctaState, AUTH_HEAD_SCRIPT, AUTH_HINT_KEY } from '../src/lib/auth-hint.js';

const h = React.createElement;
const origErr = console.error; console.error = (m, ...a) => { if (String(m).includes('useLayoutEffect')) return; origErr(m, ...a); };
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; };

// Inner app the way DemoApp mounts it, inside an outer page router at `outerPath`.
function render(outerPath, resetRouteCtx) {
  const inner = h(MemoryRouter, { initialEntries: ['/app'] }, h(Routes, null, h(Route, { path: '/app', element: h('p', null, 'DEMO-CONTENT') })));
  const isolated = h(UNSAFE_LocationContext.Provider, { value: null }, resetRouteCtx ? h(UNSAFE_RouteContext.Provider, { value: { outlet: null, matches: [], isDataRoute: false } }, inner) : inner);
  return renderToString(h(MemoryRouter, { initialEntries: [outerPath] }, h(Routes, null, ['/', '/en', '/zh-hant', '/zh-hans'].map((p) => h(Route, { key: p, path: p, element: isolated })))));
}

test('demo: inner routes render on every landing URL once the route context is reset', () => {
  for (const p of ['/', '/en', '/zh-hant', '/zh-hans']) assert.match(render(p, true), /DEMO-CONTENT/, p);
});
test('demo: reproduces the Run 11 bug without the reset (outer /zh-hant base leaks)', () => {
  const orig = console.warn; console.warn = () => {};
  try { assert.doesNotMatch(render('/zh-hant', false), /DEMO-CONTENT/); } finally { console.warn = orig; }
});
test('DemoApp.jsx resets UNSAFE_RouteContext around its MemoryRouter', () => {
  const src = fs.readFileSync(new URL('../src/components/DemoApp.jsx', import.meta.url), 'utf8');
  assert.match(src, /UNSAFE_RouteContext\.Provider value=\{DEMO_ROUTE_CTX\}/);
  assert.match(src, /DEMO_ROUTE_CTX = \{ outlet: null, matches: \[\], isDataRoute: false \}/);
  assert.ok(src.indexOf('UNSAFE_RouteContext.Provider') < src.indexOf('<MemoryRouter'));
});

test('auth hint: read / write / Firebase-key fallback / unknown', () => {
  const s = store(); assert.equal(readAuthHint(s), null);
  writeAuthHint(true, s); assert.equal(s.getItem(AUTH_HINT_KEY), 'in'); assert.equal(readAuthHint(s), 'in');
  writeAuthHint(false, s); assert.equal(readAuthHint(s), 'out');
  assert.equal(readAuthHint(store({ 'firebase:authUser:abc:[DEFAULT]': '{}' })), 'in');
  assert.equal(readAuthHint(store({ [AUTH_HINT_KEY]: 'garbage' })), null);
});
test('auth CTA state: live session wins, hint only while loading, unknown → null (neutral)', () => {
  assert.equal(ctaState('ready', 'out'), 'in'); assert.equal(ctaState('onboarding', null), 'in');
  assert.equal(ctaState('out', 'in'), 'out'); assert.equal(ctaState('loading', 'in'), 'in'); assert.equal(ctaState('loading', null), null);
});
test('auth head script sets data-auth before paint (in / out / Firebase key)', () => {
  const run = (init) => { const ls = store(init); const attrs = {}; const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } } };
    new Function('localStorage', 'document', AUTH_HEAD_SCRIPT.replace(/^<script>|<\/script>$/g, ''))(ls, document); return attrs['data-auth']; };
  assert.equal(run({}), 'out'); assert.equal(run({ [AUTH_HINT_KEY]: 'in' }), 'in'); assert.equal(run({ [AUTH_HINT_KEY]: 'out' }), 'out');
  assert.equal(run({ 'firebase:authUser:k:[DEFAULT]': '{}' }), 'in');
});
test('demo guard keeps the CTA flag real; only backend.real writes it', () => {
  const g = fs.readFileSync(new URL('../src/lib/demo-guard.js', import.meta.url), 'utf8');
  assert.match(g, /KEEP_REAL = new Set\(\['nest\.lang', 'nest\.auth'\]\)/);
  const writers = ['src/lib/backend.mock.js', 'src/lib/mock-core.js', 'src/components/DemoApp.jsx'].filter((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('writeAuthHint'));
  assert.deepEqual(writers, []);
  assert.match(fs.readFileSync(new URL('../src/lib/backend.real.js', import.meta.url), 'utf8'), /writeAuthHint\(!!cur\)/);
});
test('static pages carry both CTA variants + the head script', async () => {
  const { renderPage, header } = await import('../seo/build.js');
  for (const [lang, start, enter] of [['en', 'Start free', 'Enter app'], ['zh-Hant', '免費開始', '進入應用'], ['zh-Hans', '免费开始', '进入应用']]) {
    const html = renderPage(lang, 'pricing');
    assert.ok(html.includes(AUTH_HEAD_SCRIPT));
    assert.match(html, new RegExp(`class="snav-cta cta-out" href="/auth\\?mode=up">${start}<`));
    assert.match(html, new RegExp(`class="snav-cta cta-in" href="/app">${enter}<`));
    assert.match(html, new RegExp(`class="btn cta-in" href="/app">${enter}<`));
    assert.ok(html.indexOf(AUTH_HEAD_SCRIPT) < html.indexOf('<body>'));
  }
});
test('account menu is compact (272px, 36px rows, 14px, capped height)', () => {
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const tail = css.slice(css.indexOf('Run 12 (2026-10-19): compact ChatGPT-style account popover'));
  assert.match(tail, /\.am-menu \{ width: 272px;/); assert.match(tail, /\.am-row \{[^}]*min-height: 36px;[^}]*font-size: 14px;/);
  const jsx = fs.readFileSync(new URL('../src/components/AccountMenu.jsx', import.meta.url), 'utf8');
  assert.match(jsx, /vh \* 0\.72/); assert.match(jsx, /size=\{32\}/); assert.doesNotMatch(jsx, /acct\.familySub|admin\.entrySub/);
});
test('admin default language never overrides a localized URL (/en/ stayed Chinese on live)', async () => {
  const src = fs.readFileSync(new URL('../src/lib/appconfig.jsx', import.meta.url), 'utf8');
  const i = src.indexOf('if (pathLang()) return;'); assert.ok(i > 0);
  assert.ok(i < src.indexOf('setLang(st.defaults.lang'));
});
test('auth page: carousel of real screenshots (4 slides, reduced-motion aware), compact one-viewport layout', () => {
  const src = fs.readFileSync(new URL('../src/pages/public/Auth.jsx', import.meta.url), 'utf8');
  assert.match(src, /AUTH_SLIDES = \['tutor', 'memory', 'agent', 'parent'\]/);
  assert.match(src, /prefers-reduced-motion: reduce/);
  for (const k of ['tutor', 'memory', 'agent', 'parent']) for (const l of ['en', 'zh']) assert.ok(fs.existsSync(new URL(`../public/shots/${k}-${l}.png`, import.meta.url)), `${k}-${l}`);
  const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.auth2 \{ height: 100vh; height: 100dvh;[^}]*overflow: hidden;/);
  assert.match(css, /@media \(max-width: 640px\), \(max-height: 560px\) \{[^@]*\.auth2 \.auth-card \{ display: none; \}/);
  for (const k of ['noAccount', 'signUpLink', 'resetHint', 'showPw', 'tourLabel']) assert.equal((fs.readFileSync(new URL('../src/lib/strings.js', import.meta.url), 'utf8').match(new RegExp(`${k}: '`, 'g')) || []).length, 2, k);
});
