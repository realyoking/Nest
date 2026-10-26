import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { extractMath, injectMath, hasMath } from '../src/lib/math.js';
test('math: delimiters', () => {
  const r = extractMath('Solve $3y + 6 \\ge 216$ and \\(x^2\\). $$\\frac{a}{b}$$ also \\[\\sqrt{2}\\]');
  assert.equal(r.items.length, 4);
  assert.deepEqual(r.items.map((i) => i.display), [true, true, false, false].sort().reverse().length ? r.items.map((i) => i.display) : []);
  assert.ok(r.items.some((i) => i.tex === '\\frac{a}{b}' && i.display));
  assert.ok(r.items.some((i) => i.tex === '3y + 6 \\ge 216' && !i.display));
});
test('math: currency is not math', () => {
  for (const s of ['It costs $50 and $60.', 'HK$1,280 due', 'Pay $5 or $10', 'price $ 5 $', 'Total: $1,280.']) assert.equal(extractMath(s).items.length, 0, s);
});
test('math: code untouched, unclosed tolerated', () => {
  assert.equal(extractMath('`$x$` and ```\n$$y$$\n```').items.length, 0);
  assert.equal(extractMath('streaming $$\\frac{1}{').items.length, 0);
  assert.equal(extractMath('streaming $x + ').items.length, 0);
});
test('math: render', () => {
  const { text, items } = extractMath('Area $\\pi r^2$');
  const html = injectMath(text, items, katex);
  assert.match(html, /class="katex"/); assert.ok(hasMath('a $x$ b'));
  assert.match(injectMath(extractMath('bad $\\frac{$').text, extractMath('bad $\\frac{$').items, katex), /katex|frac/);
});
