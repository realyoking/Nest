import './_env.mjs';
// Run 11: demo-pollution scan values + waitlist placeholder classification (only test/empty entries are deletable).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classifyWaitlist, DEMO_HANDLES, DEMO_NAMES, DEMO_FAMILIES, KEEP_TEST } from '../api/ops.js';
test('waitlist placeholders: real entries are never deletable', () => {
  assert.equal(classifyWaitlist(undefined), 'empty');
  assert.equal(classifyWaitlist({ pro: { email: 'qa@example.com' } }), 'test');
  assert.equal(classifyWaitlist({ pro: { email: 'a@nest-test.invalid' }, starter: { email: 'b@example.org' } }), 'test');
  assert.equal(classifyWaitlist({ pro: { email: 'someone@gmail.com' } }), 'real');
  assert.equal(classifyWaitlist({ pro: { email: 'qa@example.com' }, starter: { email: 'mum@outlook.com' } }), 'real');
});
test('demo values match the landing demo seed', () => {
  const seed = fs.readFileSync('src/lib/mock-core.js', 'utf8');
  for (const n of ['媽媽', '爸爸', 'Mum', 'Dad', 'Ethan']) { assert.ok(seed.includes(`'${n}'`), n); assert.ok(DEMO_NAMES.includes(n)); }
  for (const f of ['陳家', 'The Chans']) { assert.ok(seed.includes(`'${f}'`)); assert.ok(DEMO_FAMILIES.includes(f)); }
  assert.ok(DEMO_HANDLES.includes('mum'));
  assert.deepEqual(KEEP_TEST, ['nest-test-owner@nest-test.invalid', 'nest-test-member@nest-test.invalid']);
});
test('repair-profile can restore the name from the account profile', () => {
  const ops = fs.readFileSync('api/ops.js', 'utf8');
  assert.match(ops, /body\?\.nameFromProfile/); assert.match(ops, /fsGet\(`users\/\$\{uid\}`, st\)/);
  assert.match(fs.readFileSync('src/pages/admin/Admin.jsx', 'utf8'), /nameFromProfile: !repN\.trim\(\) \|\| undefined/);
});
