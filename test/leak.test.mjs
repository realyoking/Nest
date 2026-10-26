import './_env.mjs';
import test from 'node:test'; import assert from 'node:assert/strict';
import { cutLeak, LEAK_RE } from '../src/lib/nestui/ascii.js';
test('cutLeak trims hallucinated <system> tail (Run 10 live reply)', () => {
  const live = '沒問題：\n\n```nest-ui\n{"type":"refraction"}\n```\n\n<system>\n[system] 以下是與問題相關的 Wikipedia 搜尋結果';
  assert.equal(cutLeak(live), '沒問題：\n\n```nest-ui\n{"type":"refraction"}\n```');
  assert.equal(cutLeak('答案\n[system] foo'), '答案');
  assert.equal(cutLeak('plain <system> word inline'), 'plain <system> word inline');
  assert.equal(LEAK_RE.test('普通回覆\n第二行'), false);
});
