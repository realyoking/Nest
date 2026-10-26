import './_env.mjs';
// zh-Hant = standard Hong Kong written Chinese (書面語) everywhere (user decision 2026-10-18): no Cantonese colloquial
// characters and no Taiwan-only words in any UI string. User input and explicit Cantonese examples in prompts are exempt.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS } from '../src/lib/strings.js';
import { zhDateStyle } from '../src/lib/zhdate.js';

export const COLLOQUIAL = /(尋日|琴日|聽日|嘅|咗|唔|喺|佢|冇|嚟|啲|嘢|咩|乜|噉|嗰|呢個|呢啲|呢度|而家|點樣|(?<![關联聯])係|嚔|囉|喎|睇|畀|攞|搵|諗|早晨！)/;
const TW_ONLY = /(網路|軟體|使用者|帳號|品質|列印|硬碟|行動裝置|簡訊|視訊|部落格|貼文|滑鼠|數位|計程車|捷運|公車|國中|補習班)/;
// Keys whose value is a quoted user example (the user may type Cantonese); none needed today.
const ALLOW = new Set([]);

function flat(o, p = '', out = []) {
  for (const [k, v] of Object.entries(o || {})) {
    const q = p ? `${p}.${k}` : k;
    if (typeof v === 'string') out.push([q, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => (typeof x === 'string' ? out.push([`${q}[${i}]`, x]) : flat(x, `${q}[${i}]`, out)));
    else if (v && typeof v === 'object') flat(v, q, out);
  }
  return out;
}

test('every zh-Hant UI string is HK 書面語 (no Cantonese colloquial, no Taiwan-only words)', () => {
  const bad = flat(STRINGS['zh-Hant']).filter(([k, v]) => !ALLOW.has(k) && (COLLOQUIAL.test(v) || TW_ONLY.test(v)));
  assert.deepEqual(bad.map(([k, v]) => `${k}: ${v}`), []);
});
test('chat history groups and dates', () => {
  assert.deepEqual(STRINGS['zh-Hant'].agent.groups, { ...STRINGS['zh-Hant'].agent.groups, today: '今天', yesterday: '昨天', week: '過去 7 天', month: '過去 30 天', older: '更早' });
  assert.equal(zhDateStyle(new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(new Date('2026-10-18T04:00:00Z'))), '2026年10月18日（週日）');
});
test('hard-coded zh-Hant strings in pages / push / server are 書面語 too', () => {
  const files = ['src/components/Announcements.jsx', 'src/pages/admin/AdminAnnouncements.jsx', 'src/pages/admin/AdminConfig.jsx', 'api/_admin.js', 'src/components/NestUI.jsx', 'src/lib/nestui/prompt.js', 'src/pages/app/Agent.jsx', 'src/pages/app/Home.jsx', 'src/pages/app/Usage.jsx', 'api/_push-lib.js', 'api/_brief-push.js', 'src/pages/public/Landing.jsx', 'src/pages/public/Beta.jsx'];
  const bad = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line) || /RegExp|=\s*\/|\.test\(|\.replace\(\//.test(line)) return; // comments + regexes (they match user input)
      for (const m of line.matchAll(/(['`])((?:(?!\1).)*[\u3400-\u9fff](?:(?!\1).)*)\1/g)) if (COLLOQUIAL.test(m[2])) bad.push(`${f}:${i + 1}: ${m[2].slice(0, 80)}`);
    });
  }
  assert.deepEqual(bad, []);
});
test('AI prompt: zh-Hant replies in HK 書面語 unless Cantonese is explicitly asked', () => {
  const src = fs.readFileSync('api/chat.js', 'utf8');
  assert.match(src, /香港通行的標準繁體中文書面語/);
  assert.match(src, /不要評論、解釋或提及這些語言規則/);
  assert.match(src, /CANTO_RE/); assert.match(src, /COLLOQ_RE/);
});
import { toWritten, writtenStream } from '../src/lib/chatctx.js';
test('Cantonese → 書面語 safety net (streamed deltas too); code + quotes untouched', () => {
  const t = 'Claude 最新模型係 Fable 同 Mythos，佢哋有冇關係？x 就係 5。用咗 14%。「點樣加成員」\n```nest-actions\n[{"title":"係"}]\n```';
  const w = toWritten(t);
  assert.match(w, /最新模型是 Fable 和 Mythos，他們有沒有關係？x 就是 5。用了 14%。「點樣加成員」/);
  assert.match(w, /"title":"係"/);
  const s = writtenStream(); let o = '';
  for (const ch of t.match(/[\s\S]{1,2}/g)) o += s.push(ch);
  o += s.flush();
  assert.equal(o, w);
});
