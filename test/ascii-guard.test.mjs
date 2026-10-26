import './_env.mjs';
// Run 8b wrap-up: server-side ASCII-art drawing guard (src/lib/nestui/ascii.js, used by api/chat.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isAsciiArt, hasAsciiDrawing, needsRedraw, hasVisualBlock, DRAW_ASK_RE } from '../src/lib/nestui/ascii.js';

const F = '```';
const bugReply = `好的，以下是光的折射示意圖：\n\n${F}\n          入射光線 (I)\n            \\\\\n             \\\\\n              \\\\\n   空氣        \\\\         法線\n---------------------*-------------------------\n   玻璃              \\\\\n                      \\\\  折射光線 (R)\n${F}\n\n入射角大於折射角。`;

test('the live bug reply (refraction drawn as ASCII art) is detected', () => {
  assert.equal(hasAsciiDrawing(bugReply), true);
  assert.equal(needsRedraw({ mode: 'chat', lastUser: '畫一個光的折射圖', content: bugReply }), true);
  assert.equal(needsRedraw({ mode: 'tutor', lastUser: 'draw the refraction of light', content: bugReply }), true);
});
test('no redraw when the user did not ask to draw, visuals are off, or the mode is not chat/tutor', () => {
  assert.equal(needsRedraw({ mode: 'chat', lastUser: '光的折射是甚麼？', content: bugReply }), false);
  assert.equal(needsRedraw({ mode: 'chat', lastUser: '畫一個光的折射圖', content: bugReply, visualsOn: false }), false);
  assert.equal(needsRedraw({ mode: 'quiz', lastUser: '畫圖', content: bugReply }), false);
});
test('real code blocks are never drawings', () => {
  assert.equal(isAsciiArt('js', 'const a = 1;\nconst b = a / 2;\n// ----------\nreturn a | b;'), false);
  assert.equal(isAsciiArt('', 'def f(x):\n    return x / 2\nprint(f(4))\nfor i in range(3):\n    print(i)'), false);
  assert.equal(isAsciiArt('', 'const x = 1;\nconst y = x * 2;\nconsole.log(x + y);'), false);
  assert.equal(hasAsciiDrawing(`${F}js\nconst refraction = (n1, n2, t) => Math.asin((n1 * Math.sin(t)) / n2);\n${F}`), false);
});
test('box-drawing and slash diagrams are drawings; a short block is not', () => {
  assert.equal(isAsciiArt('', '┌────┐\n│ R1 │───┐\n└────┘   │\n   ───────┘'), true);
  assert.equal(isAsciiArt('text', '    /\\\n   /  \\\n  /____\\'), true);
  assert.equal(isAsciiArt('', 'a / b'), false);
});
test('a reply with a nest-ui or nest-svg block is never re-asked', () => {
  const ok = `${F}nest-ui\n{"type":"refraction","n1":1,"n2":1.5,"angle":40}\n${F}\n\n${bugReply}`;
  assert.equal(hasAsciiDrawing(ok), false);
  assert.equal(hasVisualBlock(ok), true);
  assert.equal(hasVisualBlock(bugReply), false);
});
test('live drawing fixtures (Run 8) never trigger the guard', () => {
  const fx = JSON.parse(fs.readFileSync(new URL('./fixtures/draw-live.json', import.meta.url), 'utf8'));
  const texts = (Array.isArray(fx) ? fx : Object.values(fx)).map((x) => (typeof x === 'string' ? x : x.reply || x.text || x.content || '')).filter(Boolean);
  assert.ok(texts.length >= 3);
  for (const t of texts) assert.equal(hasAsciiDrawing(t), false, t.slice(0, 80));
});
test('draw request regex (zh-Hant / zh-Hans / en)', () => {
  for (const q of ['畫一個光的折射圖', '繪製電路圖', '画一只猫', 'Draw a cat', 'can you sketch a lens', 'diagram of a cell']) assert.ok(DRAW_ASK_RE.test(q), q);
  for (const q of ['光的折射是甚麼？', 'hi', 'withdraw money']) assert.ok(!DRAW_ASK_RE.test(q), q);
});
