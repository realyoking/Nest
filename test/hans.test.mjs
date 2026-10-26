import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { toHans, hansDict } from '../src/lib/hans.js';
import { STRINGS } from '../src/lib/strings.js';
import { normPref } from '../src/lib/prefs.js';
test('zh-Hans conversion + wording', () => {
  assert.equal(toHans('連接帳戶'), '连接账户');
  assert.equal(toHans('登出'), '退出登录');
  assert.equal(toHans('設定'), '设置');
  assert.equal(toHans('尚餘 {n} / {max} 個名額'), '尚余 {n} / {max} 个名额');
  const d = hansDict(STRINGS['zh-Hant']);
  const flat = JSON.stringify(d);
  assert.ok(!/[們這個說時會為來對學習課業試電話帳號]/.test(flat), 'no common traditional chars left');
  assert.equal(Object.keys(d).length, Object.keys(STRINGS['zh-Hant']).length);
});
test('lang pref accepts zh-Hans', () => {
  assert.equal(normPref('lang', 'zh-Hans'), 'zh-Hans'); assert.equal(normPref('lang', '简体中文'), 'zh-Hans'); assert.equal(normPref('lang', 'zh-Hant'), 'zh-Hant'); assert.equal(normPref('lang', 'en'), 'en');
});
