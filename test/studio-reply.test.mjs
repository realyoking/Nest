import './_env.mjs';
// Creator Studio follow-up AI edits: robust reading of malformed model replies, one silent retry, specific error text.
// Fixtures: test/fixtures/studio-bad-replies.json (shapes seen from flash replies + common LLM output faults).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAiReply, parseAiReply, nextBundleFromReply, retryNoteFor, RETRYABLE, aiErrorKey, applyEdits } from '../src/lib/plugins/project.js';
import { repairJson, parseReply, locate, searchReplaceBlocks } from '../src/lib/plugins/reply.js';
import { PLUGIN_STRINGS } from '../src/lib/plugins/strings.js';

const FX = JSON.parse(fs.readFileSync(new URL('./fixtures/studio-bad-replies.json', import.meta.url), 'utf8'));
const base = FX.base;

for (const c of FX.cases) {
  test(`reply fixture: ${c.name}`, () => {
    const rr = readAiReply(c.text);
    const nb = nextBundleFromReply(base, rr.reply, rr.problem);
    if (c.expect.problem) {
      assert.equal(rr.reply, null, 'no reply should be produced');
      assert.equal(rr.problem, c.expect.problem);
      assert.equal(nb.ok, false); assert.equal(nb.error, c.expect.problem);
      assert.ok(RETRYABLE.includes(nb.error), 'problem is retried once');
      return;
    }
    if (c.expect.error) { assert.ok(rr.reply); assert.equal(nb.ok, false); assert.equal(nb.error, c.expect.error); return; }
    assert.ok(rr.reply, `parsed (${rr.problem})`);
    assert.equal(rr.reply.kind, c.expect.kind);
    assert.ok(nb.ok, `applied: ${JSON.stringify(nb).slice(0, 200)}`);
    for (const [f, sub] of Object.entries(c.expect.has || {})) assert.ok(nb.bundle[f].includes(sub), `${f} contains ${sub}: ${nb.bundle[f].slice(0, 200)}`);
    if (c.expect.version) assert.equal(nb.bundle.manifest.version, c.expect.version);
    assert.equal(nb.bundle.manifest.id, 'pomo-tab', 'id kept');
    assert.ok(nb.bundle.manifest.capabilities.includes('tab'));
  });
}

test('files reply keeps the files the model did not send', () => {
  const nb = nextBundleFromReply(base, parseAiReply('```css\nbutton { color: red; }\n```'));
  assert.ok(nb.ok); assert.equal(nb.bundle.html, base.html); assert.equal(nb.bundle.js, base.js); assert.match(nb.bundle.css, /red/);
  assert.equal(nextBundleFromReply(null, parseAiReply('```css\nbutton{}\n```')).error, 'no_manifest', 'first version needs a manifest');
});
test('unclosed code fence = truncated, never applied', () => {
  const r = readAiReply('```html\n<div>ok</div>\n```\n```js\nlet a = 1;\nfunction f() {');
  assert.equal(r.problem, 'truncated');
});
test('repairJson: closes a cut-off object and reports it', () => {
  const r = repairJson('{"a": "x\ny", "b": [1, 2,');
  assert.equal(r.truncated, true); assert.deepEqual(JSON.parse(r.text), { a: 'x\ny', b: [1, 2] });
  const ok = repairJson('{"a": 1,}');
  assert.equal(ok.truncated, false); assert.deepEqual(JSON.parse(ok.text), { a: 1 });
});
test('valid JSON is untouched (no repair flag); text after the object ignored', () => {
  const r = parseReply('{"edits":[{"file":"css","find":"a","replace":"b"}],"notes":"n"}\n\nHope this helps {smile}');
  assert.ok(r.ok); assert.equal(r.reply.repaired, undefined); assert.equal(r.reply.edits.length, 1);
});
test('locate: exact, CRLF, whitespace-insensitive; misses stay misses', () => {
  assert.deepEqual(locate('abc def', 'def'), { i: 4, len: 3 });
  assert.ok(locate('a {\n  color: red;\n}', 'a {\r\n  color: red;\r\n}'));
  assert.ok(locate('a {\n  color: red;\n}', 'a { color:red; }'));
  assert.equal(locate('a { color: red; }', 'color: blue'), null);
  const ap = applyEdits(base, [{ file: 'css', find: '#time {font-size:48px;', replace: '#time { font-size: 50px;' }]);
  assert.ok(ap.ok); assert.match(ap.bundle.css, /50px/);
});
test('search/replace blocks pick up the file from the marker or the line above', () => {
  const b = searchReplaceBlocks('```css\n<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n```');
  assert.equal(b.length, 1); assert.equal(b[0].file, 'css'); assert.equal(b[0].find, 'a'); assert.equal(b[0].replace, 'b');
});
test('retry notes are specific', () => {
  assert.match(retryNoteFor({ error: 'edit_failed', failed: [{ file: 'js', find: 'setInterval(tick)' }] }), /COMPLETE plugin JSON[\s\S]*js: "setInterval\(tick\)"/);
  assert.match(retryNoteFor({ error: 'truncated' }, { hasCode: true }), /cut off[\s\S]*edits/);
  assert.match(retryNoteFor({ error: 'truncated' }, { hasCode: false }), /SMALLER plugin/);
  assert.match(retryNoteFor({ error: 'not_json' }), /ONLY one JSON object/);
  assert.match(retryNoteFor({ error: 'no_change' }), /no usable edits/);
  for (const e of ['stalled', 'stream_failed', 'prose', 'empty', 'no_manifest']) assert.ok(RETRYABLE.includes(e));
  assert.ok(!RETRYABLE.includes('limit_reached') && !RETRYABLE.includes('edits_without_code'));
});
test('error text: every reply problem has its own zh-Hant + en line (no generic 「AI 未能產生有效的插件」)', () => {
  const zh = PLUGIN_STRINGS['zh-Hant'].prj.aiErr; const en = PLUGIN_STRINGS.en.prj.aiErr;
  for (const k of ['truncated', 'not_json', 'unparsable', 'prose', 'empty', 'no_manifest', 'edit_failed', 'no_change', 'edits_without_code', 'stalled', 'stream_failed', 'network', 'server']) {
    assert.ok(zh[k] && en[k], k); assert.ok(!zh[k].includes('未能產生有效的插件'));
    assert.ok(!/[咗嘅唔係喺佢哋嚟啲冇]/.test(zh[k]), `書面語 ${k}`);
  }
  const k1 = aiErrorKey({ code: 'bad_reply', why: 'edit_failed', failed: [{ file: 'css', find: '.btn {   color: red; }' }] });
  assert.equal(k1.key, 'prj.aiErr.edit_failed'); assert.deepEqual(k1.params, { file: 'css', find: '.btn { color: red; }' });
  assert.deepEqual(aiErrorKey({ code: 'bad_reply', why: 'prose', detail: '抱歉' }), { key: 'prj.aiErr.prose', params: { d: '抱歉' } });
  assert.equal(aiErrorKey({ code: 'stalled' }).key, 'prj.aiErr.stalled');
  assert.equal(aiErrorKey({ code: 'limit_reached' }).key, 'chat.limit');
  assert.deepEqual(aiErrorKey({ code: 'upstream_timeout' }), { key: 'prj.aiErr.server', params: { code: 'upstream_timeout' } });
});
test('large reply parses fast (no quadratic scan)', () => {
  const big = '{"manifest":{"id":"big-one","name":"B","capabilities":["tab"]},"html":"' + '<div class="x">y</div>\n'.repeat(4000) + '","css":"","js":"","notes":"n"}';
  const t0 = Date.now(); const r = parseReply(big); const ms = Date.now() - t0;
  assert.ok(r.ok, r.problem); assert.ok(ms < 500, `${ms} ms`);
});
