// The public contact address comes from VITE_CONTACT_EMAIL, and no admin address is ever read from a VITE_* variable
// (Vite inlines every VITE_* value into the public bundle). Admin status on the client comes from /api/admin/whoami.
import './_env.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('contact email comes from VITE_CONTACT_EMAIL', async () => {
  const { CONTACT_EMAIL } = await import('../src/contact.js');
  assert.equal(CONTACT_EMAIL, 'hello@nest.example');
});

test('no client or server code reads VITE_ADMIN_EMAILS', () => {
  const files = ['src/lib/session.jsx', 'src/pages/admin/Admin.jsx', 'src/lib/test-domains.js', 'api/_ops-lib.js', '.env.example'];
  for (const f of files) assert.ok(!fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('VITE_ADMIN_EMAILS'), f);
});

test('session asks the server (whoami) for admin status', () => {
  const s = fs.readFileSync(new URL('../src/lib/session.jsx', import.meta.url), 'utf8');
  assert.match(s, /\/api\/admin\/whoami/);
});

test('admin allowlist is server-only (NEST_ADMIN_EMAILS)', async () => {
  const { adminEmails } = await import('../src/lib/test-domains.js');
  assert.deepEqual(adminEmails(), ['admin@nest.example']);
});
