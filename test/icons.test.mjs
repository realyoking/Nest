import './_env.mjs';
// App icon registry (2026-10-18): every entry has its files; auto = Sky 06–18 HKT, Night otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ICONS, ICON_IDS, resolveIcon, validChoice, iconPath, AUTO } from '../src/lib/icons.js';
import { IDENTITY_STRINGS } from '../src/lib/strings-identity.js';

test('registry: 8 icons incl. the required set, every file present', () => {
  assert.deepEqual(ICON_IDS.sort(), ['anime', 'classic', 'japan', 'mono', 'neon', 'night', 'sky', 'sunset']);
  for (const { id } of ICONS) {
    for (const f of ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png', 'apple-180.png', 'fav-32.png', 'mark-64.png', 'manifest.webmanifest']) {
      assert.ok(fs.existsSync(`public${iconPath(id, f)}`), `${id}/${f}`);
    }
    const m = JSON.parse(fs.readFileSync(`public/icons/${id}/manifest.webmanifest`, 'utf8'));
    assert.equal(m.id, '/app'); // same installed-app identity for every icon
    assert.ok(m.icons.every((x) => x.src.startsWith(`/icons/${id}/`)));
    for (const l of ['zh-Hant', 'en']) assert.ok(IDENTITY_STRINGS[l].icon.names[id], `${l} name ${id}`);
  }
});

test('auto resolves by Hong Kong time', () => {
  assert.equal(resolveIcon(AUTO, Date.parse('2026-10-18T02:00:00Z')), 'sky');   // 10:00 HKT
  assert.equal(resolveIcon(AUTO, Date.parse('2026-10-18T13:30:00Z')), 'night'); // 21:30 HKT
  assert.equal(resolveIcon(AUTO, Date.parse('2026-10-17T22:00:00Z')), 'sky');   // 06:00 HKT
  assert.equal(resolveIcon(AUTO, Date.parse('2026-10-18T10:00:00Z')), 'night'); // 18:00 HKT
  assert.equal(resolveIcon('neon'), 'neon');
  assert.equal(resolveIcon('bogus'), 'sky');
  assert.ok(validChoice('auto') && validChoice('mono') && !validChoice('x'));
});
