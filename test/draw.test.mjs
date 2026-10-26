import './_env.mjs';
// Run 8: drawing — optics diagram primitives (refraction / reflection macros, Snell's law), the ```nest-svg allowlist
// sanitizer, prompt self-knowledge and triggers, and the live flash refraction reply fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, splitBlocks, snell } from '../src/lib/nestui/spec.js';
import { sanitizeSvg } from '../src/lib/nestui/svg.js';
import { uiRule, wantsVisual, DRAW_SELF, NEST_UI_RULE } from '../src/lib/nestui/prompt.js';
import { nestGuide } from '../src/lib/grounding.js';

test("snell: air→glass, glass→air total internal reflection", () => {
  assert.ok(Math.abs(snell(1, 1.5, 40) - 25.37) < 0.02);
  assert.equal(snell(1.5, 1, 60), null);
  assert.ok(Math.abs(snell(1.33, 1, 30) - 41.68) < 0.05);
});

test('refraction macro expands to boundary + normal + rays + arcs + legend', () => {
  const n = normalize({ type: 'diagram', title: '光的折射', items: [{ type: 'refraction', n1: 1, n2: 1.5, angle: 40, media: ['空氣', '玻璃'], reflected: true, labels: { incident: '入射光線', refracted: '折射光線', reflected: '反射光線', normal: '法線' } }] });
  assert.equal(n.ok, true);
  const t = n.spec.items.map((i) => i.type);
  assert.deepEqual(t.slice(0, 3), ['boundary', 'normal', 'ray']);
  assert.equal(t.filter((x) => x === 'ray').length, 3);
  assert.equal(t.filter((x) => x === 'angle').length, 2);
  const b = n.spec.items[0]; assert.equal(b.top, '空氣'); assert.equal(b.bottom, '玻璃'); assert.equal(b.n2, 1.5);
  assert.ok(n.spec.items.some((i) => i.type === 'text' && /θ₂ ≈ 25\.4°/.test(i.text)));
  assert.equal(n.spec.items[1].dashed, true);
  assert.ok(n.spec.items.filter((i) => i.type === 'ray').every((r) => r.head === 'mid'));
  // refracted ray bends towards the normal (glass is denser): |dx/dy| smaller than the incident ray's
  const [inc, refr] = n.spec.items.filter((i) => i.type === 'ray');
  const slope = (r) => Math.abs((r.to[0] - r.from[0]) / (r.to[1] - r.from[1]));
  assert.ok(slope(refr) < slope(inc));
  // glass → air beyond the critical angle: no refracted ray, reflected ray + TIR note
  const tir = normalize({ type: 'diagram', items: [{ type: 'refraction', n1: 1.5, n2: 1, angle: 60 }] });
  assert.ok(tir.spec.items.some((i) => i.tKey === 'tir'));
  assert.equal(tir.spec.items.filter((i) => i.type === 'ray').length, 2);
  // primitives written by hand
  const p = normalize({ type: 'diagram', items: [{ type: 'boundary', from: [-5, 0], to: [5, 0], top: '空氣', bottom: '水', n1: 1, n2: 1.33 }, { type: 'normal', at: [0, 0] }, { type: 'ray', from: [-3, 4], to: [0, 0] }, { type: 'angle', at: [0, 0], from: 90, to: 127, label: 'i' }, { type: 'axes' }, { type: 'mirror', at: [3, 0], h: 4, kind: 'concave', f: 2 }, { type: 'reflection', angle: 30 }, { type: 'polyline', points: [[0, 0], [1, 1], [2, 0]] }] });
  assert.equal(p.ok, true);
  assert.ok(p.spec.items.length >= 13);
});

test('nest-svg sanitizer: strips scripts, handlers, foreignObject, external hrefs, style/url(); keeps shapes', () => {
  const evil = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" onload="alert(1)">
    <script>alert('x')</script><script href="https://evil.example/x.js"/>
    <style>rect{fill:url(https://evil.example/a)}</style>
    <foreignObject width="100" height="100"><div xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></div></foreignObject>
    <a href="javascript:alert(1)"><circle cx="5" cy="5" r="5"/></a>
    <image href="https://evil.example/p.png" x="0" y="0"/><use xlink:href="https://evil.example/s.svg#x"/>
    <animate attributeName="href" to="javascript:alert(1)"/><set attributeName="onclick" to="alert(1)"/>
    <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="black"/></marker></defs>
    <rect x="10" y="10" width="100" height="50" fill="url(https://evil.example/g)" stroke="#000" onclick="alert(1)" style="fill:red" class="x"/>
    <line x1="0" y1="0" x2="50" y2="50" stroke="red" marker-end="url(#arr)" onmouseover="alert(1)"/>
    <line x1="0" y1="0" x2="50" y2="50" marker-end="url(https://evil.example/m#arr)"/>
    <text x="20" y="80" fill="white" font-size="14">貓 &lt;b&gt; &#106;avascript:</text>
    <path d="M10 10 L 20 20 javascript:alert(1)"/>
    <g transform="translate(10,10) expression(alert(1))"><circle cx="1" cy="1" r="1"/></g>
  </svg>`;
  const r = sanitizeSvg(evil, { idPrefix: 't1' });
  assert.equal(r.ok, true);
  const s = r.svg;
  for (const bad of [/<script/i, /onload|onclick|onmouseover|onerror/i, /foreignObject/i, /<a[\s>]/i, /<image/i, /<use/i, /<animate|<set/i, /<style/i, /style=/i, /class="x"/, /href/i, /evil\.example/, /url\(https?:/i, /expression\(/i, /<img/i, /<div/i])
    assert.doesNotMatch(s, bad, String(bad));
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 900 600" width="100%"/);
  assert.match(s, /<marker id="t1-arr"/); assert.match(s, /marker-end="url\(#t1-arr\)"/);
  assert.match(s, /<rect x="10" y="10" width="100" height="50" stroke="currentColor"><\/rect>/); // url() fill dropped, black → theme ink
  assert.match(s, /fill="var\(--nui-bg\)"/); // white → theme background
  assert.match(s, /貓 &lt;b&gt; javascript:<\/text>/); // text stays text (escaped)
  assert.doesNotMatch(s, /<path d="M10 10 L 20 20 java/); // invalid path data dropped
  assert.match(s, /<g><circle/); // bad transform dropped, child kept
  // nothing drawable / not svg / too large
  assert.equal(sanitizeSvg('<div>hi</div>').ok, false);
  assert.equal(sanitizeSvg('<svg><script>alert(1)</script></svg>').ok, false);
  assert.equal(sanitizeSvg('<svg>' + '<rect/>'.repeat(700) + '</svg>').ok, false);
});

test('splitBlocks: ```nest-svg → svg part; broken svg → friendly bad card; streaming → pending', () => {
  const ok = splitBlocks('一隻貓：\n```nest-svg\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="orange"/></svg>\n```\n完成。', { final: true });
  assert.deepEqual(ok.map((p) => p.kind), ['md', 'svg', 'md']);
  assert.match(ok[1].svg, /<circle cx="50" cy="50" r="30" fill="var\(--nui-orange\)">/);
  const unclosed = splitBlocks('```nest-svg\n<svg viewBox="0 0 10 10"><rect width="5" height="5"/></svg>\n說明', { final: true });
  assert.deepEqual(unclosed.map((p) => p.kind), ['svg', 'md']);
  assert.equal(splitBlocks('```nest-svg\n<svg><rect', {}).at(-1).kind, 'ui-pending');
  const bad = splitBlocks('```nest-ui\n{"type":"diagram","items":[{"type":"nothing"}]}\n```', { final: true });
  assert.equal(bad[0].kind, 'ui-bad'); assert.doesNotMatch(bad[0].text || '', /\{"type"/); // never raw JSON
  // a plain ```svg code block stays a code block (the user may want the code)
  assert.equal(splitBlocks('```svg\n<svg/>\n```', { final: true })[0].kind, 'md');
});

test('prompt: the AI knows it can draw; visuals rule for 畫/繪/draw/diagram/圖 and drawing follow-ups', () => {
  for (const q of ['畫一個光的折射圖', '你識唔識畫圖？', '可以繪製一個電路圖嗎', 'draw a cat', 'can you make a diagram of refraction', '光的折射', '幫我畫隻貓'])
    assert.equal(wantsVisual('chat', q), true, q);
  // follow-up after an ASCII drawing / a visual block
  assert.equal(wantsVisual('chat', 'You only draw I', { user: '畫一個光的折射圖', assistant: '```\n  \\\n   \\\n```' }), true);
  assert.equal(wantsVisual('chat', '再大一點', { user: 'hi', assistant: '```nest-ui\n{}\n```' }), true);
  assert.equal(wantsVisual('chat', '多謝', { user: 'hi', assistant: '你好！' }), false);
  assert.match(uiRule('chat', 'hi'), /you CAN draw/); // short self-knowledge line always
  assert.match(DRAW_SELF, /never draw with ASCII art/i); assert.match(DRAW_SELF, /cannot create photos/);
  assert.match(NEST_UI_RULE, /refraction/); assert.match(NEST_UI_RULE, /nest-svg/); assert.match(NEST_UI_RULE, /NEVER draw with ASCII art/);
  assert.match(NEST_UI_RULE, /Asked whether you can draw/);
  assert.equal(uiRule('quiz', '畫圖'), ''); // structured modes untouched
  assert.match(nestGuide('zh-Hant'), /畫圖：/); assert.match(nestGuide('en'), /Drawing:/);
});

// Real agnes-3.0-flash replies captured by work/run8/live-draw.mjs (new prompt passed as an app note).
test('live flash drawing replies (fixtures) render as diagrams, never ASCII art', () => {
  const f = 'test/fixtures/draw-live.json';
  if (!fs.existsSync(f)) return;
  const fx = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [k, v] of Object.entries(fx)) {
    if (!v.expectVisual) continue;
    const parts = splitBlocks(v.text, { final: true });
    assert.ok(parts.some((p) => p.kind === 'ui' || p.kind === 'svg'), `${k}: ${parts.map((p) => p.kind).join(',')}`);
    assert.ok(!parts.some((p) => p.kind === 'md' && /```(?!nest)[\s\S]*[\\/|]{2,}[\s\S]*```/.test(p.text)), `${k}: ASCII art code block`);
  }
  if (fx.canDraw) assert.doesNotMatch(fx.canDraw.text, /(不能|無法|不會|未能)(畫|繪)|can(no|')t draw/i);
});

test('1.8.0 changelog entry for drawing; Cantonese "can you draw" reply → 書面語', async () => {
  const { CHANGELOG } = await import('../src/data/changelog.js');
  const e = CHANGELOG.find((x) => x.version === '1.8.0');
  assert.ok(e && e.date === '2026-10-19' && /畫圖/.test(e['zh-Hant'].title));
  const { toWritten } = await import('../src/lib/chatctx.js');
  assert.equal(toWritten('識呀，我可以直接在度畫圖。照片同寫實插圖做唔到。'), '可以，我可以直接在這裏畫圖。照片和寫實插圖做不到。');
  assert.equal(toWritten('兩張圖同樣重要'), '兩張圖同樣重要');
});
