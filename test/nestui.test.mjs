import './_env.mjs';
// ```nest-ui``` blocks: safe expression parser, fence splitting (streaming), spec validation, prompt gating.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compile, parse } from '../src/lib/nestui/expr.js';
import { splitBlocks, normalize, texLabel, labelParts, repairJson } from '../src/lib/nestui/spec.js';
import { uiRule, wantsVisual, NEST_UI_RULE } from '../src/lib/nestui/prompt.js';

test('expr: arithmetic, precedence, implicit multiplication, functions, degrees', () => {
  const f = (s, sc = {}, v = ['x']) => compile(s, v).fn(sc);
  assert.equal(f('1+2*3^2'), 19);
  assert.equal(f('-x^2', { x: 3 }), -9);
  assert.equal(f('2x+1', { x: 4 }), 9);
  assert.equal(f('3(x+1)', { x: 1 }), 6);
  assert.equal(f('2^3^2'), 512);
  assert.ok(Math.abs(f('sin(30*deg)') - 0.5) < 1e-12);
  assert.ok(Math.abs(f('sind(30)') - 0.5) < 1e-12);
  assert.equal(f('max(1, x, 2)', { x: 5 }), 5);
  assert.equal(f('a*x^2+b*x+c', { x: 2, a: 1, b: -3, c: 2 }, ['x', 'a', 'b', 'c']), 0);
  assert.ok(Number.isNaN(f('1/0')) || f('1/0') === Infinity || Number.isNaN(f('sqrt(-1)')));
  assert.ok(Number.isNaN(f('sqrt(-1)')));
  assert.equal(f('2×3−1'), 5);
});

test('expr: rejects anything that is not maths (no eval / Function / property access)', () => {
  for (const s of ['alert(1)', 'constructor', '__proto__', 'x.constructor', 'this', 'globalThis', 'window', 'x;1', 'x=1', '`x`', '"x"', "eval('1')", 'Function("return 1")', 'x[0]', 'a', 'pow(2)', '', 'x'.repeat(300), '('.repeat(60) + 'x' + ')'.repeat(60)]) {
    assert.equal(compile(s, ['x']).ok, false, s);
  }
  // the evaluator is a tree walk: the source never contains eval / new Function
  const src = fs.readFileSync('src/lib/nestui/expr.js', 'utf8').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(src, /\beval\s*\(|new\s+Function|Function\s*\(/);
  assert.throws(() => parse('1+', ['x']));
});

test('splitBlocks: markdown + closed block + pending (streaming) block', () => {
  const t = 'Before\n```nest-ui\n{"type":"steps","steps":["a","b"]}\n```\nMiddle\n```nest-ui\n{"type":"quiz","quest';
  const p = splitBlocks(t);
  assert.deepEqual(p.map((x) => x.kind), ['md', 'ui', 'md', 'ui-pending']);
  assert.equal(p[1].spec.steps.length, 2);
  assert.deepEqual(splitBlocks('plain').map((x) => x.kind), ['md']);
});

test('invalid blocks fall back to readable text, never throw', () => {
  const bad = splitBlocks('```nest-ui\n{not json}\n```');
  assert.equal(bad[0].kind, 'ui-bad');
  const unknown = splitBlocks('```nest-ui\n{"type":"html","html":"<script>alert(1)</script>"}\n```');
  assert.equal(unknown[0].kind, 'ui-bad');
  const q = splitBlocks('```nest-ui\n{"type":"quiz","title":"小測","questions":[{"q":"1+1?","options":["1"],"answer":3}]}\n```');
  assert.equal(q[0].kind, 'ui-bad'); assert.match(q[0].text, /小測/); assert.match(q[0].text, /1\+1/);
  const evil = splitBlocks('```nest-ui\n{"type":"plot","fn":"fetch(1)"}\n```');
  assert.equal(evil[0].kind, 'ui-bad');
  assert.equal(JSON.parse(repairJson('{"a":[1,2,],}')).a.length, 2);
});

test('normalize: plot sliders, parametric projectile, points; reserved names dropped', () => {
  const n = normalize({ type: 'plot', fn: 'a*x^2+b*x+c', domain: [-5, 5], sliders: [{ name: 'a', min: -3, max: 3, value: 1 }, { name: 'b' }, { name: 'c' }, { name: 'x' }, { name: 'sin' }], points: [{ x: '-b/(2*a)', y: 'c-b^2/(4*a)', label: '頂點' }] });
  assert.equal(n.ok, true); assert.deepEqual(n.spec.sliders.map((s) => s.name), ['a', 'b', 'c']); assert.equal(n.spec.points.length, 1);
  const p = normalize({ type: 'plot', fn: [{ x: 'v*cos(k*deg)*t', y: 'v*sin(k*deg)*t-4.9*t^2', t: [0, 10], tMax: '2*v*sin(k*deg)/9.8' }], sliders: [{ name: 'v', min: 5, max: 30, value: 20 }, { name: 'k', min: 10, max: 80, value: 45 }] });
  assert.equal(p.ok, true); assert.equal(p.spec.fns[0].kind, 'param'); assert.ok(p.spec.fns[0].tMax);
  assert.equal(normalize({ type: 'plot', fn: 'q*x', sliders: [] }).ok, false); // unknown variable
});

test('normalize: diagram (incline + forces, circuit, lens), chart, quiz, steps, flashcards, timeline, compare', () => {
  const d = normalize({ type: 'diagram', items: [{ type: 'incline', angle: 30, forces: [{ dir: 'weight', label: '$mg$' }, 'normal', { dir: 'friction' }] }, { type: 'battery', from: [0, 0], to: [2, 0] }, { type: 'lens', at: [5, 0], f: 2 }, { type: 'script', src: 'x' }, { type: 'arrow', from: [0, 0], to: [1, 1], color: 'url(javascript:1)' }] });
  assert.equal(d.ok, true); assert.equal(d.spec.items.length, 4); assert.equal(d.spec.items[0].forces.length, 3);
  assert.equal(d.spec.items[3].color, 'red'); // unknown colour → palette default, never a raw CSS value
  assert.equal(normalize({ type: 'chart', kind: 'bar', labels: ['A'], series: [{ name: 's', data: [1, 'x', 3] }] }).spec.series[0].data.join(','), '1,0,3');
  assert.equal(normalize({ type: 'quiz', questions: [{ q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 'C' }] }).spec.questions[0].answer, 2);
  assert.equal(normalize({ type: 'steps', steps: ['one', { title: 'two', body: 'b' }] }).spec.steps.length, 2);
  assert.equal(normalize({ type: 'flashcards', cards: [{ front: 'f', back: 'b' }, { front: 'x' }] }).spec.cards.length, 1);
  assert.equal(normalize({ type: 'timeline', events: [{ date: '1911', title: '辛亥革命' }] }).ok, true);
  assert.equal(normalize({ type: 'compare', columns: ['有絲分裂', '減數分裂'], rows: [{ label: '子細胞', values: ['2', '4'] }] }).ok, true);
  assert.equal(normalize({ type: 'compare', columns: ['only'], rows: [{ label: 'x', values: ['1'] }] }).ok, false);
});

test('labels: LaTeX → SVG text', () => {
  assert.equal(texLabel('$mg\\cos\\theta$'), 'mg cos θ');
  assert.equal(texLabel('30^\\circ'), '30°');
  assert.equal(texLabel('v_0^2'), 'v₀²');
  assert.deepEqual(labelParts(texLabel('$F_N$')), [{ t: 'F' }, { t: 'N', sub: true }]);
});

test('prompt: only for tutor or visual-looking chat questions; compact', () => {
  assert.equal(wantsVisual('tutor', 'hi'), true);
  for (const q of ['解釋拋射運動', '畫一個斜面上木塊的受力圖', '有絲分裂和減數分裂的分別，用表格', '二次函數 y=ax^2+bx+c，可以用滑桿嗎', '給我 3 條小測題', 'projectile motion']) assert.equal(wantsVisual('chat', q), true, q);
  for (const q of ['hi', '早晨', '提醒我聽日交功課', '我係咩 plan？']) assert.equal(wantsVisual('chat', q), false, q);
  assert.ok(!/nest-ui containing/.test(uiRule('chat', 'hi')) && /you CAN draw/.test(uiRule('chat', 'hi')), 'hi gets only the short drawing line');
  assert.ok(NEST_UI_RULE.length < 4600, `rule is ${NEST_UI_RULE.length} chars`);
  assert.match(uiRule('tutor', 'x'), /REVEAL_ANSWER/);
});

// Real agnes-3.0-flash replies (2026-10-18, work/run6/live-ui.mjs): every block must render as a component once the reply
// has finished — including a missing closing fence, a key that lost its colon and a stray quote after a number.
test('live flash replies (fixtures) all parse into components', () => {
  const fx = JSON.parse(fs.readFileSync('test/fixtures/nestui-live.json', 'utf8'));
  const want = { quiz: 'quiz', mitosis: 'compare', projectile: 'plot', quadratic: 'plot', incline: 'diagram', quiz_v2: 'quiz', projectile_v2: 'plot' };
  for (const [k, type] of Object.entries(want)) {
    const p = splitBlocks(fx[k], { final: true });
    assert.ok(p.some((x) => x.kind === 'ui' && x.spec.type === type), `${k}: ${p.map((x) => x.kind).join(',')}`);
  }
  // mitosis ended with a stray ` and no fence: the explanation after the JSON is still shown as text
  assert.match(splitBlocks(fx.mitosis, { final: true }).at(-1).text, /簡單來説/);
  // while streaming, the same unclosed block is a placeholder
  assert.equal(splitBlocks(fx.mitosis).at(-1).kind, 'ui-pending');
});
