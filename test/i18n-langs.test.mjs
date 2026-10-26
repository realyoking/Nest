import './_env.mjs';
// Run 14: 12 languages — registry, translation coverage (no missing → blank), structure parity with English,
// placeholders/links kept, English fallback for in-app strings, AI language rule, static switcher + routes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANGS, LANG_IDS, INTL, detectLang, pathLang, normLang, SEG, SEG_LANG } from '../src/lib/langs.js';
import { FLAG_CODES, flagSvg } from '../src/lib/flag-svg.js';
import { STRINGS } from '../src/lib/strings.js';
import APP from '../src/locales/index.js';
import { COPY } from '../seo/content.js';
import { switchHref } from '../src/lib/sitenav.js';
import { appStrings, langMenu, copyFor } from '../seo/render.js';
import { normPref } from '../src/lib/prefs.js';

const leaves = (o, p = '', out = []) => { if (typeof o === 'string') out.push([p, o]); else if (Array.isArray(o)) o.forEach((x, i) => leaves(x, `${p}[${i}]`, out)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) leaves(v, p ? `${p}.${k}` : k, out); return out; };
const dig = (o, path) => path.replace(/\[(\d+)\]/g, '.$1').split('.').reduce((x, k) => (x == null ? x : x[k]), o);
const ph = (s) => (String(s).match(/\{\w+\}|HK\$\{?\w*\}?/g) || []).sort().join(',');
const links = (s) => (String(s).match(/\]\(([^)]+)\)/g) || []).sort().join(',');

test('registry: 12 languages, unique ids/segments, a flag each, no RTL', () => {
  assert.equal(LANGS.length, 12);
  assert.deepEqual(LANG_IDS, ['en', 'zh-Hant', 'zh-Hans', 'ja', 'ko', 'es', 'fr', 'de', 'pt-BR', 'id', 'vi', 'th']);
  assert.equal(new Set(LANGS.map((l) => l.seg)).size, 12);
  for (const l of LANGS) { assert.ok(FLAG_CODES.includes(l.flag), `${l.id} flag ${l.flag}`); assert.ok(flagSvg(l.flag).startsWith('<svg')); assert.ok(l.label && l.short && l.hreflang && l.og); }
  assert.deepEqual(LANGS.filter((l) => l.id !== 'en' && !l.id.startsWith('zh')).map((l) => l.flag), ['jp', 'kr', 'es', 'fr', 'de', 'br', 'id', 'vn', 'th']);
  assert.ok(!LANGS.some((l) => /^(ar|he|fa|ur)/.test(l.id)));
});

test('browser / URL language detection', () => {
  const cases = [[['ja-JP'], 'ja'], [['ko'], 'ko'], [['es-419'], 'es'], [['fr-CA'], 'fr'], [['de-AT'], 'de'], [['pt-PT'], 'pt-BR'], [['pt-BR'], 'pt-BR'], [['id-ID'], 'id'], [['in'], 'id'], [['vi'], 'vi'], [['th-TH'], 'th'],
    [['zh-CN'], 'zh-Hans'], [['zh-HK'], 'zh-Hant'], [['zh-TW'], 'zh-Hant'], [['en-GB'], 'en'], [['ru', 'ja'], 'ja'], [['ru'], 'zh-Hant'], [[], 'zh-Hant']];
  for (const [list, want] of cases) assert.equal(detectLang(list), want, list.join());
  assert.equal(pathLang('/ja/'), 'ja'); assert.equal(pathLang('/pt-br/pricing'), 'pt-BR'); assert.equal(pathLang('/th'), 'th'); assert.equal(pathLang('/app'), ''); assert.equal(pathLang('/idx'), '');
  assert.equal(normLang('ja-JP'), 'ja'); assert.equal(normLang('简体'), 'zh-Hans'); assert.equal(normLang('xx'), undefined);
  assert.equal(normPref('lang', 'ko'), 'ko'); assert.equal(normPref('lang', 'pt'), 'pt-BR'); assert.equal(normPref('lang', 'en'), 'en'); assert.equal(normPref('lang', 'zh-Hant'), 'zh-Hant');
  for (const l of LANGS) assert.equal(SEG_LANG[SEG[l.id]], l.id);
});

test('language switch targets: same page in the other language; posts → that language’s blog', () => {
  assert.equal(switchHref('/', 'ja'), '/ja/');
  assert.equal(switchHref('/zh-hant/', 'pt-BR'), '/pt-br/');
  assert.equal(switchHref('/en/pricing', 'th'), '/th/pricing');
  assert.equal(switchHref('/ko/faq', 'zh-Hans'), '/zh-hans/faq');
  assert.equal(switchHref('/en/blog/nest-vs-chatgpt', 'ja'), 'https://blog.nesty.cyou/ja/'); // Run 18: blog on its own host
  assert.equal(switchHref('/pricing', 'de'), '/de/pricing');
});

test('in-app dictionaries: only real keys, same placeholders as English, nothing blank', () => {
  const enLeaves = new Map(leaves(STRINGS.en));
  for (const id of INTL) {
    const d = APP[id]; assert.ok(d && Object.keys(d).length > 5, `${id} dictionary`);
    for (const [p, v] of leaves(d)) {
      assert.ok(enLeaves.has(p), `${id}: ${p} does not exist in English (typo?)`);
      assert.ok(v.trim().length > 0, `${id}: ${p} blank`);
      assert.equal(ph(v), ph(enLeaves.get(p)), `${id}: ${p} placeholders`);
    }
    // the screens that must be translated: public nav, auth, landing, pricing, account menu, app nav
    for (const k of ['lang.label', 'common.start', 'common.signIn', 'nav.features', 'nav.blog', 'nav.menu', 'auth.titleIn', 'auth.submitUp', 'auth.errors.generic', 'lp.h1', 'lp.sub', 'lp.feats.tutor', 'landing.final.title', 'pricing.names.free', 'pricing.features.pro', 'acct.language', 'app.nav.home', 'settings.languageHint'])
      assert.ok(dig(d, k) != null, `${id}: ${k} translated`);
  }
});

test('English fallback: every English key resolves to a non-empty value in every added language (no blank, no key path)', () => {
  // Same resolution as src/lib/i18n.jsx t(): locale → English → zh-Hant → path.
  for (const id of INTL) {
    const merged = appStrings(id);
    const walk = (o, path = []) => { if (typeof o === 'string') { if (!o.trim()) return; const get = (r) => path.reduce((x, k) => (x == null ? x : x[k]), r); const got = get(merged);
      assert.ok(typeof got === 'string' && got.trim(), `${id}: ${path.join('/')} resolves`); if (get(APP[id]) == null) assert.equal(got, o, `${id}: ${path.join('/')} falls back to English`); return; }
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, [...path, k]); };
    walk(STRINGS.en); // intentionally empty English strings (e.g. plug.noBio) are skipped
  }
});

test('public copy: every added language translates every page with the same structure, facts and links as English', () => {
  const pages = ['', 'features', 'pricing', 'faq', 'plugins', 'changelog', 'blog'];
  const en = COPY.en;
  for (const id of INTL) {
    const c = COPY[id]; const raw = (k) => c.pages[k];
    for (const k of Object.keys(en.ui)) assert.ok(c.ui[k] != null, `${id} ui.${k}`);
    for (const k of ['changelogNote', 'blogNote', 'noPosts', 'notFound']) assert.ok(c.ui[k], `${id} ui.${k}`);
    for (const pg of pages) {
      const E = en.pages[pg]; const P = raw(pg);
      assert.notEqual(P.title, E.title, `${id}/${pg} title translated`);
      assert.notEqual(P.description, E.description, `${id}/${pg} description translated`);
      assert.equal(P.sections.length, E.sections.length, `${id}/${pg} sections`);
      P.sections.forEach((s, i) => {
        const e = E.sections[i];
        assert.deepEqual(Object.keys(s).sort(), Object.keys(e).sort(), `${id}/${pg}#${i} section keys`);
        for (const key of ['cards', 'steps', 'ul', 'faq', 'facts']) if (e[key]) assert.equal(s[key].length, e[key].length, `${id}/${pg}#${i} ${key} count`);
        if (e.img) assert.equal(s.img.name, e.img.name);
        if (e.p) assert.equal(links(s.p), links(e.p), `${id}/${pg}#${i} links`);
      });
      for (const [p, v] of leaves(P)) { assert.ok(v.trim(), `${id}/${pg} ${p} blank`); }
      // numbers that must survive translation
      const txt = JSON.stringify(P);
      if (pg === 'pricing') for (const n of ['HK$38', 'HK$78', 'HK$378', 'HK$777', '17']) assert.ok(txt.includes(n), `${id} pricing keeps ${n}`);
      if (pg === '') for (const n of ['100', '400']) assert.ok(txt.includes(n), `${id} home keeps ${n}`);
      if (pg === 'faq') assert.ok(txt.includes('hello@nest.example') && txt.includes('16.4'), `${id} faq facts`);
    }
    for (const k of Object.keys(en.ui.nav)) assert.ok(c.ui.nav[k], `${id} nav.${k}`);
    assert.equal(ph(c.ui.aiDay), ph(en.ui.aiDay)); assert.equal(ph(c.ui.members), ph(en.ui.members)); assert.equal(ph(c.ui.yearly), ph(en.ui.yearly));
    assert.equal(Object.keys(c.plugins || {}).length, 6, `${id} plugin names`);
  }
});

test('zh-Hant rules unchanged: HK 書面語 copy (Run 14 edits included)', () => {
  const COLLOQUIAL = /(嘅|咗|唔|喺|佢|冇|嚟|啲|嘢|咩|乜|噉|嗰|呢個|呢啲|而家|點樣|(?<![關联聯])係)/;
  const bad = leaves(COPY['zh-Hant']).concat(leaves(STRINGS['zh-Hant'].landing)).filter(([, s]) => COLLOQUIAL.test(s));
  assert.deepEqual(bad, []);
});

test('static language dropdown: 12 links, current marked, posts without a translation link to the blog index', () => {
  const html = langMenu('ja', 'blog/nest-vs-chatgpt', null, copyFor('ja').ui);
  assert.equal((html.match(/data-setlang=/g) || []).length, 12);
  assert.match(html, /href="https:\/\/blog\.nesty\.cyou\/ja\/" hreflang="ja"[^>]*aria-current="true"/);
  assert.match(html, /href="https:\/\/blog\.nesty\.cyou\/en\/nest-vs-chatgpt" hreflang="en"/);
  assert.match(html, /href="https:\/\/blog\.nesty\.cyou\/th\/" hreflang="th"/);
  assert.match(html, /<use href="#flag-jp"\/>/);
  const home = langMenu('es', '', null, copyFor('es').ui);
  assert.match(home, /href="\/pt-br\/" hreflang="pt-BR" lang="pt-BR"/);
  assert.match(home, /class="lang-long">Español<\/span><span class="lang-short">ES</);
});

test('AI reply language: added languages get their own rule (head, tail, final, strong); still agnes-3.0-flash only', () => {
  const src = fs.readFileSync('api/chat.js', 'utf8');
  assert.match(src, /const INTL_RULE = \(name\) =>/);
  assert.match(src, /isIntl\(body\.lang\) \? INTL_RULE\(LBY\[body\.lang\]\.ai\)/);
  assert.match(src, /sys\.split\(LANG_HEAD\.en\)\.join\(intlRule\.head\)\.split\(LANG_TAIL\.en\)\.join\(intlRule\.tail\)/);
  assert.match(src, /intlRule \? intlRule\.strong/); assert.match(src, /intlRule \? intlRule\.final/);
  assert.ok(!/agnes-3\.0-pro['"]/.test(src.replace(/\/\/.*$/gm, '')), 'no pro model');
  const ai = fs.readFileSync('src/lib/ai.js', 'utf8');
  assert.match(ai, /if \(\(l === 'en' \|\| l == null\) && isIntl\(a\)\) return a;/);
  for (const l of LANGS) assert.ok(l.ai, `${l.id} ai name`);
});

test('routing: every language has its home + static pages + blog index; SW skips them; React routes them', () => {
  const vj = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const segs = LANGS.map((l) => l.seg).join('|');
  for (const p of ['', '/', '/features', '/pricing', '/faq', '/plugins'])
    assert.ok(vj.rewrites.some((r) => !r.has && r.source === `/:lang(${segs})${p}`), `rewrite /:lang${p}`);
  // Run 18: blog + changelog live on their own hosts (host rewrites); the old main-site paths 301 there.
  for (const [h, p] of [['blog.nesty.cyou', ''], ['blog.nesty.cyou', '/'], ['blog.nesty.cyou', '/:slug([a-z0-9-]+)'], ['changelog.nesty.cyou', ''], ['changelog.nesty.cyou', '/']])
    assert.ok(vj.rewrites.some((r) => r.has?.[0]?.value === h && r.source === `/:lang(${segs})${p}`), `${h} rewrite /:lang${p}`);
  for (const p of ['/changelog', '/blog', '/blog/:slug([a-z0-9-]+)'])
    assert.ok(vj.redirects.some((r) => r.source === `/:lang(${segs})${p}` && r.statusCode === 301 && /^https:\/\/(blog|changelog)\.nesty\.cyou\//.test(r.destination)), `301 /:lang${p}`);
  const sw = fs.readFileSync('public/sw.js', 'utf8'); assert.match(sw, new RegExp(segs.replace(/-/g, '\\-').replace(/\|/g, '\\|')));
  const app = fs.readFileSync('src/App.jsx', 'utf8'); assert.match(app, /INTL\.map\(\(l\) => <Route key=\{l\} path=\{`\/\$\{SEG\[l\]\}`\} element=\{<Landing \/>\} \/>\)/);
  const pl = fs.readFileSync('src/components/PublicLayout.jsx', 'utf8'); assert.ok(!pl.includes('LANG_SHORT') && pl.includes('<LangMenu />') && pl.includes('<LangList />'));
});
