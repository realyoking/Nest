import './_env.mjs';
// Studio projects (src/lib/plugins/project.js) + the 10 data permissions (bridge gate, server gate, data shapers).
// node --test test/studio-perms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PERMS, SOON, HIGH_DATA, VERIFIED_ONLY, NEVER } from '../src/lib/plugins/permissions.js';
import { METHODS, IMPLEMENTED, gate, validateMessage, RateLimiter } from '../src/lib/plugins/bridge.js';
import { validateBundle } from '../src/lib/plugins/manifest.js';
import { serverGate, shapeGmail, shapeMemories, shapeNotices, shapeBills, shapeQuiz, shapeClassroom, shapeTransport, senderName, classroomDue, budgetOk, pruneLog, logEntry } from '../src/lib/plugins/data.js';
import { diffLines, diffStats, compactDiff, bundleDiff, applyEdits, parseAiReply, nextBundleFromReply, contextParts, summarizeTurns, buildAiMessages, bumpPatch, versionForSubmit, cleanWorkingBundle, cleanTurn, sameBundle, editNote, AI_CODE_LIMIT, PROJECT_LIMITS, nameFromPrompt, cleanChangelog } from '../src/lib/plugins/project.js';

const TEN = ['calendar.write', 'memory.read', 'memory.write', 'study.read', 'notices.read', 'bills.read', 'transport.read', 'gmail.read', 'classroom.read', 'media.photo'];
const man = (permissions, extra = {}) => ({ id: 'perm-lab', name: 'Perm Lab', version: '1.0.0', category: 'tools', capabilities: ['tab'], permissions, tab: { title: 'Lab' }, ...extra });

// ---------------- permissions ----------------
test('all 10 former "coming soon" permissions are enabled and validate', () => {
  assert.deepEqual(SOON, []);
  for (const p of TEN) { assert.ok(PERMS[p], p); assert.ok(!PERMS[p].soon, `${p} still soon`); }
  const v = validateBundle({ manifest: man(TEN), html: '<p>x</p>', css: '', js: '' });
  assert.ok(v.ok, v.errors?.join(', '));
  for (const p of TEN) assert.ok(v.bundle.manifest.permissions.includes(p), p);
});
test('risk labels: Gmail / Classroom / calendar.write / memory are high; Gmail verified-only', () => {
  for (const p of ['gmail.read', 'classroom.read', 'calendar.write', 'memory.read', 'memory.write']) assert.equal(PERMS[p].risk, 'high', p);
  assert.deepEqual(HIGH_DATA.sort(), ['calendar.write', 'classroom.read', 'gmail.read', 'memory.read', 'memory.write']);
  assert.deepEqual(VERIFIED_ONLY, ['gmail.read']);
  for (const p of TEN) { assert.ok(PERMS[p].en && PERMS[p].zh && PERMS[p].enD && PERMS[p].zhD, p); }
});
test('private chats / secrets / tokens stay never-grantable', () => {
  for (const p of ['chats.read', 'secrets', 'tokens.read', 'cookies', 'password']) {
    assert.ok(NEVER.includes(p));
    const v = validateBundle({ manifest: man([p]), html: '<p>x</p>', css: '', js: '' });
    assert.ok(!v.ok, `${p} must be rejected`);
  }
  assert.ok(!Object.keys(METHODS).some((m) => /chat|secret|token|cookie|password|oauth/i.test(m)), 'no API for private data');
});
test('every bridge method has a host handler', () => {
  for (const m of Object.keys(METHODS)) assert.ok(IMPLEMENTED.has(m), m);
});

// ---------------- malicious plugin vs the bridge gate ----------------
const methodOf = { 'calendar.write': 'calendar.create', 'memory.read': 'memory.list', 'memory.write': 'memory.add', 'study.read': 'study.list', 'notices.read': 'notices.list', 'bills.read': 'bills.list', 'transport.read': 'transport.get', 'gmail.read': 'gmail.summary', 'classroom.read': 'classroom.list', 'media.photo': 'media.pickPhoto' };
test('malicious: calls without declaring the permission are refused', () => {
  const m = validateBundle({ manifest: man([]), html: '<p>x</p>', css: '', js: '' }).bundle.manifest;
  for (const [perm, method] of Object.entries(methodOf)) assert.equal(gate(method, { manifest: m, granted: TEN, surface: 'tab' }), 'permission_not_declared', `${perm}`);
});
test('malicious: declared but not approved → permission_denied; revoked → permission_revoked; approved → allowed', () => {
  const m = validateBundle({ manifest: man(TEN), html: '<p>x</p>', css: '', js: '' }).bundle.manifest;
  for (const [perm, method] of Object.entries(methodOf)) {
    assert.equal(gate(method, { manifest: m, granted: [], surface: 'tab' }), 'permission_denied', perm);
    assert.equal(gate(method, { manifest: m, granted: TEN, denied: [perm], surface: 'tab' }), 'permission_revoked', perm);
    assert.equal(gate(method, { manifest: m, granted: TEN, surface: 'tab' }), null, perm);
  }
});
test('malicious: unknown / forged methods and oversize params', () => {
  assert.equal(validateMessage({ nest: 1, ch: 'c', id: 1, method: 'gmail.token', params: {} }, 'c').error, 'unknown_method');
  assert.equal(validateMessage({ nest: 1, ch: 'c', id: 2, method: '__proto__', params: {} }, 'c').error, 'unknown_method');
  assert.equal(validateMessage({ nest: 1, ch: 'c', id: 3, method: 'memory.add', params: { text: 'x'.repeat(40000) } }, 'c').error, 'too_big');
  assert.ok(validateMessage({ nest: 1, ch: 'other', id: 4, method: 'gmail.summary' }, 'c').ignore, 'wrong channel ignored');
  const g = validateMessage({ nest: 1, ch: 'c', id: 5, method: 'gmail.summary', params: { limit: 500 } }, 'c');
  assert.equal(g.params.limit, 10, 'Gmail per-call limit capped at 10');
  assert.equal(validateMessage({ nest: 1, ch: 'c', id: 6, method: 'classroom.list', params: { limit: 99, days: 999 } }, 'c').params.limit, 15);
  assert.equal(validateMessage({ nest: 1, ch: 'c', id: 7, method: 'media.pickPhoto', params: { maxSize: 99999 } }, 'c').params.maxSize, 1600);
  assert.match(validateMessage({ nest: 1, ch: 'c', id: 8, method: 'calendar.create', params: { title: '', start: Date.now() } }, 'c').error, /bad_params/);
  assert.match(validateMessage({ nest: 1, ch: 'c', id: 9, method: 'calendar.update', params: { id: '../../users/x', fields: {} } }, 'c').error, /bad_params/);
});
test('rate limits: Gmail 3/min, memory.add 3/min, photo 2/30 s', () => {
  let t = 0; const rl = new RateLimiter(undefined, () => t);
  assert.ok(rl.take('gmail.summary') && rl.take('gmail.summary') && rl.take('gmail.summary'));
  assert.equal(rl.take('gmail.summary'), false);
  t += 61e3; assert.ok(rl.take('gmail.summary'));
  const r2 = new RateLimiter(undefined, () => t);
  assert.ok(r2.take('memory.add') && r2.take('memory.add') && r2.take('memory.add')); assert.equal(r2.take('memory.add'), false);
  assert.ok(r2.take('media.pickPhoto') && r2.take('media.pickPhoto')); assert.equal(r2.take('media.pickPhoto'), false);
});

// ---------------- server gate (api/calendar.js op=pdata) ----------------
const P0 = { creatorUid: 'creator', listed: true, live: 2, safeV: 0, verified: false };
const I0 = { granted: ['gmail.read', 'classroom.read', 'calendar.write'], removed: false, dev: false };
const S0 = { on: true, perms: ['gmail.read', 'classroom.read', 'calendar.write'], denied: [] };
const sg = (o) => serverGate({ perm: 'classroom.read', uid: 'u1', plugin: P0, install: I0, state: S0, verifiedOnly: VERIFIED_ONLY, ...o });
test('server gate: install / grant / revoke / off / removed', () => {
  assert.equal(sg({}), '');
  assert.equal(sg({ plugin: null }), 'plugin_not_found');
  assert.equal(sg({ plugin: { ...P0, deleted: true } }), 'plugin_not_found');
  assert.equal(sg({ install: null }), 'not_installed');
  assert.equal(sg({ install: { ...I0, removed: true } }), 'not_installed');
  assert.equal(sg({ state: undefined }), 'not_installed');
  assert.equal(sg({ state: { ...S0, on: false } }), 'plugin_off');
  assert.equal(sg({ plugin: { ...P0, listed: false } }), 'plugin_removed');
  assert.equal(sg({ install: { ...I0, granted: [] } }), 'permission_denied');
  assert.equal(sg({ state: { ...S0, perms: [] } }), 'permission_denied', 'profile must agree with the install record');
  assert.equal(sg({ state: { ...S0, denied: ['classroom.read'] } }), 'permission_revoked');
  assert.equal(sg({ install: { ...I0, dev: true } }), 'not_installed', 'dev installs only for the creator');
  assert.equal(sg({ uid: 'creator', install: { ...I0, dev: true }, plugin: { ...P0, listed: false, live: 0 } }), '', 'creator test install of a draft');
});
test('server gate: Gmail needs Safe or Verified (creator dev install exempt)', () => {
  assert.equal(sg({ perm: 'gmail.read' }), 'needs_verified_plugin');
  assert.equal(sg({ perm: 'gmail.read', plugin: { ...P0, safeV: 1 } }), 'needs_verified_plugin', 'Safe label of an older version does not count');
  assert.equal(sg({ perm: 'gmail.read', plugin: { ...P0, safeV: 2 } }), '');
  assert.equal(sg({ perm: 'gmail.read', plugin: { ...P0, verified: true } }), '');
  assert.equal(sg({ perm: 'gmail.read', uid: 'creator', install: { ...I0, dev: true } }), '');
});
test('server budget per user+plugin+method', () => {
  const k = `u|p|gmail|${Math.random()}`;
  for (let i = 0; i < 6; i++) assert.ok(budgetOk(k, 6, 60e3, 1000 + i));
  assert.equal(budgetOk(k, 6, 60e3, 1010), false);
  assert.ok(budgetOk(k, 6, 60e3, 70000));
});

// ---------------- minimal data ----------------
test('Gmail summary: sender name only, no addresses, ids or links; capped', () => {
  const msgs = Array.from({ length: 30 }, (_, i) => ({ id: `m${i}`, threadId: 't', from: `"Ms Chan" <chan${i}@school.edu.hk>`, subject: `Reply to me at boss@corp.com ${i}`, snippet: 'Contact parent@example.com &amp; reply', date: 1e12 + i, unread: i % 2 === 0, link: 'https://mail.google.com/x' }));
  const out = shapeGmail(msgs, 99);
  assert.equal(out.length, 10);
  const s = JSON.stringify(out);
  assert.ok(!/@/.test(s), 'no email addresses'); assert.ok(!/mail\.google|"id"|threadId/.test(s));
  assert.deepEqual(Object.keys(out[0]).sort(), ['date', 'from', 'snippet', 'subject', 'unread']);
  assert.equal(out[0].from, 'Ms Chan');
  assert.equal(senderName('noreply@classroom.google.com'), 'classroom.google.com');
  assert.ok(out[0].snippet.length <= 140 && out[0].subject.length <= 120);
});
test('Classroom: course/title/due only, sorted, capped', () => {
  const due = classroomDue({ dueDate: { year: 2026, month: 10, day: 20 }, dueTime: { hours: 15, minutes: 59 } });
  assert.equal(due, Date.UTC(2026, 9, 20, 15, 59));
  const out = shapeClassroom(Array.from({ length: 20 }, (_, i) => ({ course: 'S3A', title: `HW ${i}`, due: due - i * 1000, alternateLink: 'https://classroom.google.com/x', description: 'secret' })), 99);
  assert.equal(out.length, 15);
  assert.ok(out[0].due <= out[1].due);
  assert.ok(!/classroom\.google|secret/.test(JSON.stringify(out)));
});
test('memory: only family-visible plain notes; never entities / insights / subs / private', () => {
  const out = shapeMemories([{ id: 'a', text: 'peanut allergy', createdAt: 5 }, { id: 'b', kind: 'entity', name: 'Dr Lee', text: 'x' }, { id: 'c', kind: 'insight', text: 'y' }, { id: 'd', kind: 'sub', text: 'z' }, { id: 'e', kind: 'chat', text: 'likes swimming', byPlugin: 'perm-lab' }], 50, 'perm-lab');
  assert.deepEqual(out.map((x) => x.id), ['a', 'e']);
  assert.equal(out[1].mine, true);
  assert.deepEqual(Object.keys(out[0]).sort(), ['at', 'id', 'mine', 'tag', 'text']);
});
test('notices / bills / quiz drop private fields', () => {
  const inbox = [{ kind: 'notice', title: '家長日', date: '2026-10-23', needsReply: true, status: 'new', src: { from: 'office@school.hk', id: 'gm1', link: 'x' }, body: 'full text' },
    { kind: 'bill', payee: 'CLP', amount: 412.5, date: '2026-10-30', status: 'new', src: { id: 'g2' } }, { kind: 'notice', title: 'old', status: 'dismissed' }];
  const n = shapeNotices(inbox); assert.equal(n.length, 1); assert.ok(!/office@|gm1|full text/.test(JSON.stringify(n)));
  const b = shapeBills([{ service: 'Netflix', amount: 93, cycle: 'monthly', renewDate: '2026-10-25', notes: 'pw hint', cancelUrl: 'https://x', member: 'uid123' }], inbox);
  assert.ok(!/pw hint|https:\/\/x|uid123|g2/.test(JSON.stringify(b)));
  assert.equal(b.bills[0].payee, 'CLP');
  const q = shapeQuiz([{ topic: 'Fractions', score: 8, total: 10, weakAreas: ['x'], uid: 'u1', createdAt: 1 }]);
  assert.deepEqual(Object.keys(q[0]).sort(), ['at', 'score', 'topic', 'total']);
});
test('transport: saved stops → minutes, no coordinates', () => {
  const now = 1e12;
  const items = [{ co: 'kmb', route: '1A', dir: 'O', stop: 'ABC', name: 'Sample stop', lat: 22.3, lng: 114.1 }, { co: 'mtr', line: 'TWL', sta: 'TST', dir: 'UP' }];
  const keyOf = (x) => (x.co === 'mtr' ? `mtr:${x.line}:${x.sta}` : `kmb:${x.route}:${x.dir}:1:${x.stop}`);
  const eta = { items: [{ key: 'kmb:1A:O:1:ABC', etas: [{ t: now + 3 * 60e3, dest_tc: '尖沙咀碼頭', dest_en: 'Star Ferry' }] }, { key: 'mtr:TWL:TST', mtr: { UP: [{ t: now + 120e3, dest: 'TSW' }] } }] };
  const out = shapeTransport(items, eta, { keyOf, now, stationName: (c) => `st-${c}` });
  assert.equal(out[0].minutes[0], 3); assert.equal(out[0].to, '尖沙咀碼頭');
  assert.equal(out[1].departures[0].minutes[0], 2); assert.equal(out[1].departures[0].to, 'st-TSW');
  assert.ok(!/22\.3|114\.1/.test(JSON.stringify(out)));
});
test('activity log entries are clipped and pruned', () => {
  const e = logEntry('perm-lab', 'memory.add', 'x'.repeat(500), 5);
  assert.equal(e.s.length, 120);
  const log = Object.fromEntries(Array.from({ length: 105 }, (_, i) => [`l${i}`, { at: i }]));
  assert.equal(pruneLog(log, 100).length, 5);
  assert.ok(pruneLog(log, 100).includes('l0'));
});

// ---------------- projects ----------------
const B = (o = {}) => ({ manifest: { id: 'demo', name: 'Demo', version: '1.0.0', category: 'tools', capabilities: ['widget'], permissions: [] }, html: '<button id="b" class="btn">Go</button>\n<p>hi</p>', css: '.btn { color: red; }', js: "document.getElementById('b').onclick = () => nest.ui.toast('hi');", ...o });
test('line diff', () => {
  const d = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne');
  assert.deepEqual(diffStats(d), { add: 2, del: 1 });
  assert.equal(d.filter((x) => x.t === ' ').map((x) => x.s).join(''), 'acd');
  const c = compactDiff(diffLines(Array.from({ length: 50 }, (_, i) => `l${i}`).join('\n'), Array.from({ length: 50 }, (_, i) => (i === 25 ? 'X' : `l${i}`)).join('\n')), 2);
  assert.ok(c.length < 12 && c.some((x) => x.t === '…'));
  assert.deepEqual(bundleDiff(B(), B()), []);
  const bd = bundleDiff(B(), B({ css: '.btn { color: blue; }' }));
  assert.equal(bd.length, 1); assert.equal(bd[0].file, 'css');
});
test('AI reply: full JSON, fenced, and edits', () => {
  const full = parseAiReply('```json\n' + JSON.stringify({ ...B(), notes: 'made it' }) + '\n```');
  assert.equal(full.kind, 'full'); assert.equal(full.notes, 'made it');
  const e = parseAiReply(JSON.stringify({ edits: [{ file: 'css', find: 'color: red', replace: 'color: blue' }, { file: 'evil', find: 'x', replace: 'y' }], notes: 'blue' }));
  assert.equal(e.kind, 'edits'); assert.equal(e.edits.length, 1, 'unknown files dropped');
  const nb = nextBundleFromReply(B(), e);
  assert.ok(nb.ok); assert.match(nb.bundle.css, /blue/); assert.match(nb.bundle.html, /Go/, 'other files kept');
  const bad = nextBundleFromReply(B(), parseAiReply(JSON.stringify({ edits: [{ file: 'js', find: 'not there', replace: 'x' }] })));
  assert.equal(bad.error, 'edit_failed');
  assert.equal(nextBundleFromReply(null, e).error, 'edits_without_code');
  assert.equal(parseAiReply('sorry I cannot'), null);
  const ap = applyEdits(B(), [{ file: 'html', find: '', replace: '<div>settings</div>' }]);
  assert.ok(ap.ok && ap.bundle.html.endsWith('<div>settings</div>'));
});
test('context: older turns summarised, recent kept verbatim, current code always sent', () => {
  const turns = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'ai' : 'user', text: i % 2 ? `done ${i}` : `request ${i}`, at: i }));
  const cp = contextParts(turns, '', 0);
  assert.equal(cp.recent.length, 8); assert.equal(cp.summarizedUpTo, 12);
  assert.match(cp.summary, /request 0/); assert.match(cp.summary, /request 10/); assert.ok(!/request 12/.test(cp.summary));
  const cp2 = contextParts([...turns, { role: 'user', text: 'request 20', at: 20 }, { role: 'ai', text: 'ok', at: 21 }], cp.summary, cp.summarizedUpTo);
  assert.equal((cp2.summary.match(/request 0/g) || []).length, 1, 'already-summarised turns are not repeated');
  const { messages, tooBig } = buildAiMessages({ bundle: B({ css: '.btn{color:#123456}' }), summary: cp.summary, recent: cp.recent, prompt: 'make the button blue' });
  assert.equal(tooBig, false); assert.equal(messages.length, 3);
  assert.match(messages[0].content, /CURRENT PLUGIN/); assert.match(messages[0].content, /#123456/); assert.match(messages[0].content, /Summary of earlier/); assert.match(messages[0].content, /request 18/);
  assert.equal(messages[2].content, 'make the button blue');
  const big = buildAiMessages({ bundle: B({ js: 'x'.repeat(AI_CODE_LIMIT + 10) }), prompt: 'p' });
  assert.equal(big.tooBig, true); assert.ok(big.messages[0].content.length < AI_CODE_LIMIT + 2000);
  assert.ok(summarizeTurns(turns, 'x'.repeat(4000)).length <= PROJECT_LIMITS.summary + 2);
});
test('manual edits become part of the context', () => {
  const note = editNote(B(), B({ css: '.btn { color: green; }\n.x{}' }), 'en');
  assert.match(note, /Edited by hand: css \+2\/−1/);
  assert.equal(editNote(B(), B()), '');
});
test('versions + changelog helpers', () => {
  assert.equal(bumpPatch('1.2.9'), '1.2.10'); assert.equal(bumpPatch('x'), '1.0.1');
  assert.equal(versionForSubmit('1.0.0', '1.0.0'), '1.0.1'); assert.equal(versionForSubmit('1.1.0', '1.0.0'), '1.1.0');
  assert.equal(cleanChangelog(' a\u0001b '.repeat(1)), 'a b'); assert.equal(cleanChangelog('x'.repeat(900)).length, 500);
  assert.ok(sameBundle(B(), JSON.parse(JSON.stringify(B()))));
});
test('working copy + turn sanitising (server)', () => {
  assert.ok(cleanWorkingBundle(B()));
  assert.equal(cleanWorkingBundle({ ...B(), js: 'x'.repeat(PROJECT_LIMITS.bundleJson) }), null);
  assert.equal(cleanWorkingBundle([1, 2]), null);
  assert.deepEqual(Object.keys(cleanWorkingBundle({ manifest: 'bad', html: 5 })).sort(), ['css', 'html', 'js', 'manifest']);
  assert.equal(cleanTurn({ role: 'admin', text: 'x' }), null);
  assert.equal(cleanTurn({ role: 'user', text: '   ' }), null);
  assert.equal(cleanTurn({ role: 'user', text: 'y'.repeat(9000) }).text.length, 4000);
  assert.equal(nameFromPrompt('番茄鐘分頁，有長休息。再加設定'), '番茄鐘分頁，有長休息');
});

// verify run (2026-10-18): AI bundles without capabilities are repaired to a tab so the preview renders.
import { repairBundle as _rb, nextBundleFromReply as _nb } from '../src/lib/plugins/project.js';
import { validateManifest as _vm } from '../src/lib/plugins/manifest.js';
test('repairBundle adds tab capability to a coded plugin without capabilities', () => {
  const b = { manifest: { id: 'focus-timer', name: 'Focus Timer', nameZh: '番茄鐘', version: '1.0.0', description: 'x' }, html: '<button>開始</button>', css: '', js: 'x=1' };
  const r = _nb(null, { kind: 'full', bundle: b });
  assert.deepEqual(r.bundle.manifest.capabilities, ['tab']);
  assert.equal(r.bundle.manifest.tab.titleZh, '番茄鐘');
  assert.equal(_vm(r.bundle.manifest).ok, true, JSON.stringify(_vm(r.bundle.manifest).errors));
  assert.deepEqual(_rb({ ...b, manifest: { ...b.manifest, capabilities: 'page' } }).manifest.capabilities, ['tab']);
  const theme = { manifest: { id: 'sky', name: 'Sky', capabilities: ['theme'], theme: { vars: {} } }, html: '', css: '', js: '' };
  assert.equal(_rb(theme), theme);
});
