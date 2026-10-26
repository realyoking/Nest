import './_env.mjs';
// Open-source hygiene: no deployment-specific credentials or personal identifiers in tracked files, and the Firebase
// config is environment-driven with no built-in fallback.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const tracked = (() => {
  try { return execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { return null; }
})();

test('no Firebase API keys, OAuth client ids or personal test domains in tracked files', { skip: !tracked && 'not a git checkout' }, () => {
  const bad = [/AIza[0-9A-Za-z_-]{30,}/, /heynest-test\.dev/, /\d{12}-[a-z0-9]{32}\.apps\.googleusercontent\.com/];
  for (const f of tracked) {
    if (!fs.existsSync(f) || /\.(png|jpe?g|webp|avif|ico|woff2?|ttf|gif)$/i.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8');
    for (const re of bad) assert.ok(!re.test(t), `${f} matches ${re}`);
  }
});

test('firebase config comes from VITE_FIREBASE_* with no hard-coded fallback', async () => {
  const src = fs.readFileSync('src/firebase-config.js', 'utf8');
  assert.ok(!/['"](?!VITE_)[A-Za-z0-9_:-]{20,}['"]/.test(src), 'no literal key-like strings');
  const { firebaseConfig, isFirebaseConfigured } = await import('../src/firebase-config.js');
  assert.equal(firebaseConfig.apiKey, 'test-api-key');
  assert.equal(firebaseConfig.projectId, 'nest-test-project');
  assert.equal(isFirebaseConfigured, true);
});

test('static auth/status pages get their public values at build time', () => {
  for (const f of ['public/auth/action.html', 'public/status.html']) {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.includes('__NEST_FIREBASE_API_KEY__'), `${f} key placeholder`);
  }
  assert.ok(fs.readFileSync('public/auth/action.html', 'utf8').includes("'__NEST_OK_HOSTS__'"));
  assert.match(fs.readFileSync('vite.config.js', 'utf8'), /nestPublicConfig\(\)/);
});

test('.env.example documents every VITE_FIREBASE_* variable with empty values', () => {
  const ex = fs.readFileSync('.env.example', 'utf8');
  for (const k of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID', 'MEASUREMENT_ID']) assert.match(ex, new RegExp(`^VITE_FIREBASE_${k}=\\s*(#.*)?$`, 'm'));
  for (const line of ex.split('\n')) if (/^[A-Z_0-9]+=/.test(line)) assert.match(line, /^[A-Z_0-9]+=\s*(#.*)?$/, `value set: ${line}`);
});
