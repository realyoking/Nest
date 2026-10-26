import './_env.mjs';
// Plugin system unit tests: manifest validation, API message validation, theme sanitizer, permission gating,
// rate limits, storage caps, sandbox document, templates, seeds, server helpers, chat history grouping.
// node --test test/plugins.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, validateBundle, settingsValues, coerceSetting, themeFor, newPermissions, cleanIcon, cleanVideo, LIMITS } from '../src/lib/plugins/manifest.js';
import { sanitizeTheme, cleanColor, backgroundCss, mergeThemes } from '../src/lib/plugins/theme.js';
import { validateMessage, gate, RateLimiter, pluginStorage } from '../src/lib/plugins/bridge.js';
import { buildSrcdoc, cspFor, SANDBOX_FLAGS } from '../src/lib/plugins/sandbox.js';
import { fromTemplate, blankBundle } from '../src/lib/plugins/templates.js';
import { SEEDS } from '../src/lib/plugins/seeds.js';
import { parsePluginReply, pluginSystemPrompt } from '../src/lib/plugins/ai-prompt.js';
import { versionFor, isListed, isSafe, card, cleanCreatorInput, rateOk, ADMIN_PLUGIN_ACTIONS } from '../api/_plugins.js';
import { isTestEmail } from '../api/_ops-lib.js';
import { cleanTitle } from '../api/ops.js';

const base = { id: 'my-widget', name: 'My Widget', capabilities: ['widget'], permissions: [] };

test('manifest: valid minimal + normalisation', () => {
  const v = validateManifest(base);
  assert.equal(v.ok, true, v.errors.join());
  assert.equal(v.manifest.version, '1.0.0');
  assert.equal(v.manifest.category, 'tools');
  assert.equal(v.manifest.widget.height, 140);
});
test('manifest: rejects bad id, unknown caps/perms, missing name', () => {
  const v = validateManifest({ id: 'Bad ID!', capabilities: ['widget', 'root'], permissions: ['chats.read'] });
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /id/.test(e)));
  assert.ok(v.errors.some((e) => /unknown capabilities: root/.test(e)));
  assert.ok(v.errors.some((e) => /never grantable: chats.read/.test(e)));
  assert.ok(validateManifest({ ...base, permissions: ['foo.bar'] }).errors.some((e) => /unknown permissions: foo.bar/.test(e)));
  assert.ok(v.errors.some((e) => /name/.test(e)));
  assert.deepEqual(v.manifest.permissions, ['ui.widget', 'storage']);
  assert.equal(validateManifest(null).ok, false);
  assert.equal(validateManifest({ ...base, capabilities: [] }).ok, false);
});
test('manifest: settings schema + coercion', () => {
  const v = validateManifest({ ...base, settings: [
    { key: 'mins', type: 'number', min: 1, max: 60, default: 25 }, { key: 'mode', type: 'select', options: ['a', 'b'] },
    { key: 'c', type: 'color', default: 'red' }, { key: 'bad key', type: 'text' }, { key: 'x', type: 'eval' }] });
  assert.equal(v.ok, false);
  const m = v.manifest;
  assert.deepEqual(m.settings.map((s) => s.key), ['mins', 'mode', 'c']);
  assert.equal(m.settings[2].default, '#0a0a0a');
  assert.deepEqual(settingsValues(m, { mins: 500, mode: 'zzz', c: '#FFAA00', extra: 1 }), { mins: 60, mode: 'a', c: '#ffaa00' });
  assert.equal(coerceSetting({ type: 'time' }, '25:00'), undefined);
  assert.equal(coerceSetting({ type: 'toggle' }, 'true'), undefined);
});
test('bundle: 200 KB code limit', () => {
  assert.equal(validateBundle({ manifest: base, html: '<b>hi</b>', css: '', js: '' }).ok, true);
  const big = validateBundle({ manifest: base, html: '', css: '', js: 'x'.repeat(LIMITS.code + 1) });
  assert.equal(big.ok, false); assert.ok(big.errors.some((e) => /limit 200 KB/.test(e)));
  assert.equal(validateBundle({ manifest: base, html: '', css: '', js: '' }).ok, false);
});
test('icons / video URLs', () => {
  assert.equal(cleanIcon('/plugins/sky-theme/icon.svg'), '/plugins/sky-theme/icon.svg');
  assert.equal(cleanIcon('https://evil.example/x.png'), '');
  assert.equal(cleanIcon('javascript:alert(1)'), '');
  assert.equal(cleanIcon('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.ok(cleanIcon('data:image/png;base64,iVBORw0KGgo='));
  assert.equal(cleanVideo('https://youtu.be/abc'), 'https://youtu.be/abc');
  assert.equal(cleanVideo('http://youtu.be/abc'), '');
  assert.equal(cleanVideo('https://evil.example/page'), '');
});

test('theme sanitizer: only whitelisted vars and strict values', () => {
  const t = sanitizeTheme({ vars: {
    '--ink': '#123456', '--bg': 'red; } body { display:none', '--surface': 'rgba(255,255,255,0.9)', '--radius': '20px', '--radius-sm': '999px',
    'color': '#000', '--evil': '#fff', '--muted': 'url(https://x/y)', '--line': 'expression(alert(1))', '--soft': 'hsl(200, 50%, 50%)' },
  font: 'Comic Sans MS', background: { colors: ['#fff', 'javascript:1', '#000'], angle: 999, image: 'https://evil/x.png' }, scheme: 'neon' });
  assert.deepEqual(t.vars, { '--ink': '#123456', '--surface': 'rgba(255,255,255,0.9)', '--radius': '20px', '--soft': 'hsl(200, 50%, 50%)' });
  assert.equal(t.font, undefined);
  assert.deepEqual(t.background, { type: 'gradient', colors: ['#fff', '#000'], angle: 360 });
  assert.equal(t.scheme, undefined);
  assert.equal(cleanColor('#abc'), '#abc'); assert.equal(cleanColor('rgb(300,0,0)'), null); assert.equal(cleanColor('#abcd</style>'), null);
  assert.equal(backgroundCss({ type: 'gradient', colors: ['#fff', '#000'], angle: 90 }), 'linear-gradient(90deg, #fff, #000)');
  assert.match(backgroundCss({ type: 'image', image: '/plugins/sky-theme/clouds.svg', size: 'cover' }), /^url\("\/plugins\/sky-theme\/clouds\.svg"\)/);
});
test('theme sanitizer: capability gating', () => {
  const onlyFont = sanitizeTheme({ vars: { '--ink': '#000000' }, font: 'Quicksand', background: { colors: ['#fff', '#000'] } }, ['font']);
  assert.deepEqual(onlyFont.vars, {}); assert.equal(onlyFont.font, 'Quicksand'); assert.equal(onlyFont.background, undefined);
  const merged = mergeThemes([{ vars: { '--ink': '#111111' } }, { vars: { '--ink': '#222222', '--bg': '#ffffff' }, font: 'Quicksand' }]);
  assert.deepEqual(merged.vars, { '--ink': '#222222', '--bg': '#ffffff' }); assert.equal(merged.font, 'Quicksand');
});
test('theme variants follow the select setting', () => {
  const m = validateManifest(SEEDS[0].manifest).manifest;
  assert.equal(themeFor(m, {}).vars['--bg'], '#eaf4ff');
  assert.equal(themeFor(m, { style: 'night' }).scheme, 'dark');
  assert.equal(themeFor(m, { style: 'nope' }).vars['--bg'], '#eaf4ff');
});

test('bridge: message validation', () => {
  assert.equal(validateMessage(null).ignore, true);
  assert.equal(validateMessage({ nest: 1, ch: 'other', id: 1, method: 'ui.toast' }, 'ch1').ignore, true);
  assert.equal(validateMessage({ nest: 1, ch: 'ch1', id: 0, method: 'ui.toast' }, 'ch1').ignore, true);
  assert.equal(validateMessage({ nest: 1, ch: 'ch1', id: 3, method: 'eval' }, 'ch1').error, 'unknown_method');
  assert.equal(validateMessage({ nest: 1, ch: 'ch1', id: 3, method: '__proto__' }, 'ch1').error, 'unknown_method');
  assert.equal(validateMessage({ nest: 1, ch: 'ch1', id: 3, method: 'toString' }, 'ch1').error, 'unknown_method');
  const ok = validateMessage({ nest: 1, ch: 'ch1', id: 7, method: 'ui.toast', params: { text: '<img src=x onerror=1>hello' } }, 'ch1');
  assert.equal(ok.ok, true); assert.equal(ok.params.text.includes('<'), false);
  assert.match(validateMessage({ nest: 1, ch: 'ch1', id: 8, method: 'storage.set', params: { key: 'a b', value: 1 } }, 'ch1').error, /bad_params/);
  assert.match(validateMessage({ nest: 1, ch: 'ch1', id: 9, method: 'storage.set', params: { key: 'k', value: 'x'.repeat(20000) } }, 'ch1').error, /bad_params|too_big/);
  assert.match(validateMessage({ nest: 1, ch: 'ch1', id: 9, method: 'reminders.create', params: { title: '' } }, 'ch1').error, /bad_params/);
  assert.match(validateMessage({ nest: 1, ch: 'ch1', id: 9, method: 'reminders.create', params: { title: 'x', dueAt: 'not a date' } }, 'ch1').error, /bad_params/);
  const r = validateMessage({ nest: 1, ch: 'ch1', id: 9, method: 'reminders.create', params: { title: '  Revise  ', dueAt: '2026-10-20T09:00:00+08:00' } }, 'ch1');
  assert.equal(r.params.title, 'Revise'); assert.equal(r.params.dueAt, Date.parse('2026-10-20T09:00:00+08:00'));
  assert.equal(validateMessage({ nest: 1, ch: 'ch1', id: 9, method: 'ui.resize', params: { height: 99999 } }, 'ch1').params.height, 2000);
});
test('bridge: permission + capability gating', () => {
  const m = { capabilities: ['widget'], permissions: ['reminders.write'] };
  assert.equal(gate('reminders.create', { manifest: m, granted: [], surface: 'widget' }), 'permission_denied');
  assert.equal(gate('reminders.create', { manifest: m, granted: ['reminders.write'], surface: 'widget' }), null);
  assert.equal(gate('reminders.list', { manifest: m, granted: ['reminders.read'], surface: 'widget' }), 'permission_not_declared');
  assert.equal(gate('calendar.list', { manifest: m, granted: ['calendar.read'], surface: 'widget' }), 'permission_not_declared');
  assert.equal(gate('members.list', { manifest: m, granted: [], surface: 'widget' }), 'permission_not_declared');
  assert.equal(gate('theme.set', { manifest: m, granted: [], surface: 'widget' }), 'capability_not_declared');
  assert.equal(gate('theme.set', { manifest: { capabilities: ['theme'] }, granted: [], surface: 'tab' }), null);
  assert.equal(gate('ui.resize', { manifest: m, granted: [], surface: 'background' }), 'wrong_surface');
  assert.equal(gate('storage.get', { manifest: m, granted: [], surface: 'widget' }), null);
  assert.equal(gate('nope', { manifest: m }), 'unknown_method');
  assert.equal(gate('storage.get', { manifest: m, granted: [], denied: ['storage'], surface: 'widget' }), 'permission_revoked');
  assert.equal(gate('reminders.create', { manifest: m, granted: ['reminders.write'], denied: ['reminders.write'], surface: 'widget' }), 'permission_revoked');
  assert.deepEqual(newPermissions({ permissions: ['reminders.write', 'calendar.read'] }, ['reminders.write']), ['calendar.read']);
});
test('bridge: rate limiter', () => {
  let t = 0; const rl = new RateLimiter(undefined, () => t);
  for (let i = 0; i < 3; i++) assert.equal(rl.take('ui.toast'), true);
  assert.equal(rl.take('ui.toast'), false);
  for (let i = 0; i < 5; i++) assert.equal(rl.take('reminders.create'), true);
  assert.equal(rl.take('reminders.create'), false);
  t += 61e3; assert.equal(rl.take('ui.toast'), true);
  const g = new RateLimiter(undefined, () => 0); let n = 0; while (g.take('storage.get')) n++; assert.equal(n, 40);
});
test('bridge: storage cap', () => {
  const mem = new Map(); const back = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  const s = pluginStorage(back, 'ns', 100);
  assert.equal(s.set('a', 'x'.repeat(50)), true);
  assert.throws(() => s.set('b', 'y'.repeat(80)), /storage_full/);
  assert.deepEqual(s.keys(), ['a']);
  const other = pluginStorage(back, 'ns2', 100); assert.equal(other.get('a'), null);
});

test('sandbox document: CSP first, no network, no breakout', () => {
  assert.equal(SANDBOX_FLAGS, 'allow-scripts');
  assert.equal(SANDBOX_FLAGS.includes('allow-same-origin'), false);
  const csp = cspFor('https://heynest.vercel.app');
  for (const d of ["default-src 'none'", "connect-src 'none'", "frame-src 'none'", "form-action 'none'", "base-uri 'none'", "object-src 'none'", "worker-src 'none'"]) assert.ok(csp.includes(d), d);
  assert.equal(/img-src[^;]*https:(?!\/\/heynest)/.test(csp), false);
  const doc = buildSrcdoc({ html: '<p>x</p>', css: 'p{}</style><script>alert(1)</script>', js: 'var s="</script><script>alert(2)</script>"' }, { channel: 'c1', context: { lang: 'en', note: '</script><script>bad()</script>', x: "$'$&" } });
  assert.ok(doc.indexOf('Content-Security-Policy') < doc.indexOf('<style>'));
  assert.equal(doc.includes('</style><script>alert(1)'), false);
  assert.equal(doc.includes('</script><script>alert(2)'), false);
  assert.equal(doc.includes('</script><script>bad()'), false);
  assert.ok(doc.includes("$'$&"));
  assert.ok(doc.includes('<style>p{}<\\/style>')); // the CSS stays inside its <style> (raw text), cannot close it
});

test('templates + blank bundle + seeds are valid', () => {
  for (const k of ['theme', 'tab', 'widget', 'reminders']) { const v = validateBundle(fromTemplate(k, {})); assert.equal(v.ok, true, `${k}: ${v.errors}`); }
  assert.deepEqual(fromTemplate('reminders', {}).manifest.permissions, ['reminders.write']);
  assert.equal(validateBundle(blankBundle()).ok, true);
  assert.equal(SEEDS.length, 6);
  for (const s of SEEDS) assert.equal(validateBundle(s).ok, true, s.id);
  assert.ok(SEEDS.some((s) => s.manifest.permissions.includes('reminders.write')));
});
test('AI reply parsing + prompt', () => {
  const j = parsePluginReply('Sure!\n```json\n{"manifest":{"id":"x-y-z","name":"X"},"html":"<b>1</b>","css":"","js":"","notes":"ok"}\n```');
  assert.equal(j.manifest.id, 'x-y-z'); assert.equal(j.notes, 'ok');
  assert.equal(parsePluginReply('no json here'), null);
  assert.equal(parsePluginReply('{"html":"x"}'), null);
  assert.match(pluginSystemPrompt('zh-Hant'), /nest\.storage/);
});

test('server: listing, versions, safe label, creator input', () => {
  const p = { id: 'a-b-c', creatorUid: 'u1', listed: true, live: 2, draftV: 3, safeV: 2 };
  assert.equal(isListed(p), true); assert.equal(isListed({ ...p, deleted: true }), false); assert.equal(isListed(p, { banned: true }), false);
  assert.equal(isSafe(p), true); assert.equal(isSafe({ ...p, live: 3 }), false);
  assert.equal(versionFor(p, { uid: 'u2' }), 2);
  assert.equal(versionFor(p, { uid: 'u2' }, 3), 2); // others never get a draft
  assert.equal(versionFor(p, { uid: 'u1' }, 3), 3); // creator tests own draft
  assert.equal(versionFor(p, { uid: 'u9', admin: true }, 3), 3);
  assert.equal(versionFor({ ...p, listed: false }, { uid: 'u2' }), null);
  assert.equal(versionFor({ ...p, listed: false, live: 0 }, { uid: 'u1' }), 3);
  assert.equal(versionFor(p, { uid: 'u2', creatorBanned: true }), null);
  assert.equal(card(p, { u1: { handle: 'maker', verified: true } }).creator.handle, 'maker');
  assert.equal(card(p).safe, true);
  assert.deepEqual(cleanCreatorInput({ handle: '@Study_Buddy', bio: 'hi' }), { handle: 'study_buddy', bio: 'hi', pfp: '' });
  assert.throws(() => cleanCreatorInput({ handle: 'a' }), /bad_handle/);
  assert.throws(() => cleanCreatorInput({ handle: 'abc', pfp: 'https://x/y.png' }), /bad_pfp/);
  assert.ok(ADMIN_PLUGIN_ACTIONS.includes('safe'));
  let ok = 0; for (let i = 0; i < 10; i++) if (rateOk('t|x', 5, 1000, 0)) ok++; assert.equal(ok, 5);
});
test('promo test-account exclusion + chat titles', () => {
  assert.equal(isTestEmail('nest-test-owner@nest-test.invalid'), true);
  assert.equal(isTestEmail('NEST-TEST-MEMBER@NEST-TEST.INVALID'), true);
  assert.equal(isTestEmail('nest-ledger@system.heynest.invalid'), true);
  assert.equal(isTestEmail('mum@gmail.com'), false);
  assert.equal(isTestEmail('x@nest-test.invalid.evil.com'), false);
  assert.equal(cleanTitle('「數學測驗溫習計劃。」', 'zh-Hant'), '數學測驗溫習計劃');
  assert.equal(cleanTitle('Title: "Weekend Plans!"\nmore', 'en'), 'Weekend Plans');
});

import { groupChats } from '../src/lib/chat-history.js';
test('chat history groups (HKT days)', () => {
  const now = Date.parse('2026-10-18T15:00:00+08:00');
  const at = (s) => new Date(Date.parse(s));
  const g = groupChats([
    { id: 'a', updatedAt: at('2026-10-18T00:30:00+08:00') }, { id: 'b', updatedAt: at('2026-10-17T23:50:00+08:00') },
    { id: 'c', updatedAt: at('2026-10-13T12:00:00+08:00') }, { id: 'd', updatedAt: at('2026-09-25T12:00:00+08:00') },
    { id: 'e', updatedAt: at('2026-07-01T12:00:00+08:00') }, { id: 'f', updatedAt: at('2026-07-02T12:00:00+08:00'), pinned: true },
  ], now);
  assert.deepEqual(g.map(([k, l]) => [k, l.map((x) => x.id)]), [['pinned', ['f']], ['today', ['a']], ['yesterday', ['b']], ['week', ['c']], ['month', ['d']], ['older', ['e']]]);
});

// ---- expanded permissions (2026-10-18) ----
import { PERMS, NEVER, SOON, DATA_PERMS, impliedFor, cleanDomains, maxRisk, sortByRisk } from '../src/lib/plugins/permissions.js';
import { IMPLEMENTED, METHODS } from '../src/lib/plugins/bridge.js';
test('permissions: registry is complete and private data is never grantable', () => {
  for (const [id, p] of Object.entries(PERMS)) { assert.ok(['low', 'medium', 'high'].includes(p.risk), id); assert.ok(p.en && p.zh && p.enD && p.zhD, id); }
  for (const bad of ['chats.read', 'chats', 'secrets', 'tokens.read', 'chatmemory.read', 'password']) {
    const v = validateManifest({ ...base, permissions: [bad] });
    assert.equal(v.ok, false, bad); assert.ok(v.errors.some((e) => /never grantable/.test(e)), bad); assert.ok(!v.manifest.permissions.includes(bad));
  }
  assert.ok(!Object.keys(PERMS).some((p) => /^(chats?|secrets?|tokens?)/.test(p)));
  assert.ok(NEVER.includes('chats.read'));
});
test('permissions: coming-soon ones are rejected; every grantable method has a host handler', () => {
  for (const p of SOON) assert.ok(validateManifest({ ...base, permissions: [p] }).errors.some((e) => /not available yet/.test(e)), p);
  for (const [m, spec] of Object.entries(METHODS)) if (!spec.perm || !SOON.includes(spec.perm)) assert.ok(IMPLEMENTED.has(m), `${m} needs a handler`);
});
test('permissions: reasons, domains, implied, risk', () => {
  const v = validateManifest({ ...base, capabilities: ['widget', 'automation'], permissions: ['network', 'reminders.write', 'ai.use'], network: { domains: ['api.example.com', 'https://img.example.org/x', '127.0.0.1', 'heynest.vercel.app'] }, permissionReasons: { network: 'Loads the menu', 'reminders.write': 'x'.repeat(300), 'calendar.read': 'not declared' }, features: 'One\n\nTwo\n' });
  assert.deepEqual(v.manifest.network.domains, ['api.example.com', 'img.example.org']);
  assert.ok(v.errors.some((e) => /bad domain 127/.test(e)) && v.errors.some((e) => /heynest.vercel.app is not allowed/.test(e)));
  assert.equal(v.manifest.permissionReasons.network, 'Loads the menu');
  assert.equal(v.manifest.permissionReasons['reminders.write'].length, 140);
  assert.equal(v.manifest.permissionReasons['calendar.read'], undefined);
  assert.equal(v.manifest.features, 'One\nTwo');
  assert.ok(v.manifest.permissions.includes('background.schedule') && v.manifest.permissions.includes('storage'));
  assert.deepEqual(impliedFor(['theme']), ['appearance.theme']);
  assert.equal(maxRisk(['ai.use', 'network']), 'high'); assert.equal(maxRisk([]), null);
  assert.deepEqual(sortByRisk(['weather.read', 'network', 'ai.use']), ['network', 'ai.use', 'weather.read']);
  assert.ok(!DATA_PERMS.includes('storage'));
  assert.deepEqual(cleanDomains(['*.example.com', 'bad_host', 'x.googleapis.com']), ['*.example.com']);
});
test('bridge: revoked implied permission blocks theme / storage; old manifests without implied perms still work', () => {
  const old = { capabilities: ['theme', 'widget'], permissions: [] };
  assert.equal(gate('theme.set', { manifest: old, granted: [], surface: 'widget' }), null);
  assert.equal(gate('storage.set', { manifest: old, granted: [], surface: 'widget' }), null);
  assert.equal(gate('theme.set', { manifest: old, granted: [], denied: ['appearance.theme'], surface: 'widget' }), 'permission_revoked');
  assert.equal(gate('ai.ask', { manifest: { capabilities: ['widget'], permissions: ['ai.use'] }, granted: [], surface: 'widget' }), 'permission_denied');
  assert.equal(gate('ai.ask', { manifest: { capabilities: ['widget'], permissions: ['ai.use'] }, granted: ['ai.use'], surface: 'widget' }), null);
  assert.match(validateMessage({ nest: 1, ch: 'c', id: 1, method: 'links.open', params: { url: 'javascript:alert(1)' } }, 'c').error, /bad_params/);
  assert.match(validateMessage({ nest: 1, ch: 'c', id: 1, method: 'links.open', params: { url: 'http://example.com' } }, 'c').error, /https_only/);
  assert.equal(newPermissions({ permissions: ['ai.use', 'storage'] }, [], ['ai.use']).length, 0);
});
test('chat: plugin assist mode has no family context and no actions', async () => {
  const { systemPrompt } = await import('../api/chat.js');
  const s = systemPrompt('assist', 'zh-Hant', { plugin: 'Quiz Maker', memories: ['secret family fact'], reminders: ['x'] });
  assert.match(s, /Quiz Maker/); assert.match(s, /NO family data/); assert.doesNotMatch(s, /secret family fact/); assert.doesNotMatch(s, /```nest-actions/);
});
