import './_env.mjs';
// AI 助理 attachments: type detection, Office text extraction, chunk selection, payload + persistence shape, limits.
// node --test test/attach.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { kindOf, officeText, selectChunks, buildContent, persistable, persistPlan, mergeAttChunks, historyText, attachLimits, attachCountOf, filePart, TEXT_PER_FILE, TEXT_SAVED_PER_FILE } from '../src/lib/attach-core.js';

test('kindOf', () => {
  assert.equal(kindOf('a.HEIC', ''), 'heic'); assert.equal(kindOf('x', 'image/heif'), 'heic');
  assert.equal(kindOf('a.jpg', 'image/jpeg'), 'image'); assert.equal(kindOf('clip.MOV', 'video/quicktime'), 'video');
  assert.equal(kindOf('r.pdf', ''), 'pdf'); assert.equal(kindOf('r.docx', ''), 'docx'); assert.equal(kindOf('r.xlsx', ''), 'xlsx'); assert.equal(kindOf('r.pptx', ''), 'pptx');
  assert.equal(kindOf('n.txt', ''), 'txt'); assert.equal(kindOf('d.csv', 'text/csv'), 'csv'); assert.equal(kindOf('old.doc', ''), 'legacy-office'); assert.equal(kindOf('a.exe', 'application/x-msdownload'), null);
});
test('DOCX / PPTX / XLSX text', () => {
  const docx = zipSync({ 'word/document.xml': strToU8('<w:document><w:body><w:p><w:r><w:t>家長通告</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">日期：2026年10月30日 </w:t></w:r><w:r><w:t>&amp; 回條</w:t></w:r></w:p></w:body></w:document>') });
  assert.equal(officeText('docx', docx), '家長通告\n日期：2026年10月30日 & 回條');
  const pptx = zipSync({ 'ppt/slides/slide2.xml': strToU8('<p:sld><a:p><a:r><a:t>Second</a:t></a:r></a:p></p:sld>'), 'ppt/slides/slide1.xml': strToU8('<p:sld><a:p><a:r><a:t>Title</a:t></a:r></a:p><a:p><a:r><a:t>Point A</a:t></a:r></a:p></p:sld>'), 'ppt/slides/slide10.xml': strToU8('<p:sld><a:p><a:r><a:t>Ten</a:t></a:r></a:p></p:sld>') });
  assert.equal(officeText('pptx', pptx), '[Slide 1]\nTitle\nPoint A\n\n[Slide 2]\nSecond\n\n[Slide 3]\nTen');
  const xlsx = zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Fees" sheetId="1"/></sheets></workbook>'),
    'xl/sharedStrings.xml': strToU8('<sst><si><t>Item</t></si><si><t>Amount</t></si><si><t>Bus</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>350</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Lunch</t></is></c><c r="B3"><v>120.5</v></c></row></sheetData></worksheet>'),
  });
  assert.equal(officeText('xlsx', xlsx), '[Sheet Fees]\nItem,Amount\nBus,,350\nLunch,120.5');
});
test('large documents keep the start + chunks related to the question', () => {
  const filler = (n) => '這是一般內容，沒有特別資料。'.repeat(n);
  const text = `開頭：學期資料。${filler(400)}重要：家長日在11月14日舉行，請帶回條。${filler(400)}`;
  const r = selectChunks(text, '家長日是哪一天？');
  assert.equal(r.truncated, true); assert.ok(r.kept <= TEXT_PER_FILE); assert.ok(r.text.startsWith('開頭'));
  assert.ok(r.text.includes('家長日在11月14日'), 'relevant chunk kept');
  assert.equal(selectChunks('short', 'q').truncated, false);
  assert.match(filePart({ name: 'big.pdf', pages: 30, text }, '家長日', 'zh-Hant', { tokens: 2000 }), /^\[附件檔案：big\.pdf，共 30 頁——文件較長/);
  assert.match(filePart({ name: 'big.pdf', pages: 30, text }, '家長日', 'zh-Hant'), /^\[附件檔案：big\.pdf，共 30 頁——全文/);
});
test('payload: images, video keyframes, files; persistence never stores full images', () => {
  const img = { id: 'a', kind: 'image', name: 'notice.jpg', status: 'ready', data: 'data:image/jpeg;base64,AAAA', thumb: 'data:image/jpeg;base64,TT' };
  const vid = { id: 'b', kind: 'video', name: 'clip.mp4', status: 'ready', dur: 12.4, frames: ['data:image/jpeg;base64,F1', 'data:image/jpeg;base64,F2'], thumb: 'data:image/jpeg;base64,TV', url: 'blob:x' };
  const doc = { id: 'c', kind: 'file', ftype: 'pdf', name: 'r.pdf', status: 'ready', pages: 2, text: 'x'.repeat(TEXT_SAVED_PER_FILE + 50) };
  const bad = { id: 'd', kind: 'file', name: 'bad.doc', status: 'error' };
  const c = buildContent('幫我看看', [img, vid, doc, bad], 'zh-Hant');
  assert.equal(c[0].text, '幫我看看');
  assert.equal(c.filter((p) => p.type === 'image_url').length, 3);
  assert.ok(c.some((p) => p.type === 'text' && /影片 clip\.mp4，12 秒/.test(p.text)));
  assert.ok(c.some((p) => p.type === 'text' && /附件檔案：r\.pdf/.test(p.text)));
  assert.equal(buildContent('hi', []), 'hi');
  const saved = persistable([img, vid, doc, bad]);
  assert.equal(saved.length, 3);
  assert.ok(saved.every((a) => !a.data && !a.frames && !a.url));
  // Full text is kept: too long for the message doc → preview inline + chunk docs that merge back to the full text.
  assert.equal(saved[2].chars, TEXT_SAVED_PER_FILE + 50); assert.equal(saved[2].split, 3); assert.equal(saved[2].text.length, 2000);
  const pp = persistPlan([img, vid, doc, bad]);
  const merged = mergeAttChunks([{ id: 'm1', role: 'user', atts: pp.atts }, ...pp.chunks.map((c, i) => ({ id: `k${i}`, role: 'attext', of: 'm1', ...c }))]);
  assert.equal(merged.length, 1); assert.equal(merged[0].atts[2].text, doc.text); assert.equal(merged[0].atts[2].split, undefined);
  assert.ok(JSON.stringify(saved).length < 900_000);
  assert.match(historyText({ content: 'q', atts: saved }, 'zh-Hant'), /\[相片：notice\.jpg\]\n\[影片：clip\.mp4\]\n\[r\.pdf\]/);
});
test('limits: free vs pro, video frames count once, unknown plan = free', () => {
  assert.deepEqual(attachLimits('free'), { perMsg: 3, daily: 10, fileMB: 10, videoSec: 30 });
  assert.equal(attachLimits('pro').perMsg, 8); assert.equal(attachLimits('pro').videoSec, 60); assert.equal(attachLimits('weird').perMsg, 3);
  const eight = Array.from({ length: 8 }, () => ({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,A' } }));
  assert.equal(attachCountOf(1, [{ type: 'text', text: 'v' }, ...eight]), 1);
  assert.equal(attachCountOf(0, [...eight, ...eight]), 2);
  assert.equal(attachCountOf(3, 'text'), 3);
});

import { attachmentCard } from '../src/lib/intent.js';
import { toTraditional } from '../src/lib/chatctx.js';
test('attachment card: drops past / malformed, keeps future, fixes simplified title', () => {
  const now = new Date('2026-10-18T10:36:00Z'); // 18:36 HKT
  assert.equal(attachmentCard({ type: 'reminder', title: 'x', date: '2026-10-17' }, { now }), null);
  assert.equal(attachmentCard({ type: 'reminder', title: 'mango', date: '2026-10-18', time: '09:00' }, { now }), null);
  assert.equal(attachmentCard({ type: 'reminder', title: 'x', date: '2026-10-18' }, { now }), null); // guessed 09:00 already past
  assert.equal(attachmentCard({ type: 'note', title: 'x', date: '2026-10-30' }, { now }), null);
  const ev = attachmentCard({ type: 'event', title: 'Parents day', date: '2026-10-18' }, { now });
  assert.equal(ev.allDay, true);
  const r = attachmentCard({ type: 'reminder', title: '泳课缴费', date: '2026-11-06', time: '25:00' }, { now, fixText: toTraditional });
  assert.equal(r.title, '泳課繳費'); assert.equal(r.time, '09:00'); assert.equal(r.timeGuessed, true);
  assert.equal(attachmentCard({ type: 'reminder', title: '回條', date: '2026-10-23', time: '18:00' }, { now }).time, '18:00');
});
