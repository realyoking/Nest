// Deploys this folder to a Vercel project (VERCEL_PROJECT, default the upstream "kabo-family") via the REST API (Vercel builds it).
// Auth header is injected for api.vercel.com by the sandbox.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.resolve('.');
const SKIP = new Set(['node_modules', 'dist', 'dist-mock', '.vercel', 'scripts', 'test', '.git']);
const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f); const rel = path.relative(ROOT, p);
    if (SKIP.has(rel.split(path.sep)[0])) continue;
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(rel);
  }
})(ROOT);
// Changelog reminder: the newest src/ or api/ change (HKT calendar day) must not be newer than the newest changelog entry.
// Soft warning by default; NEST_CHANGELOG_STRICT=1 refuses to deploy. `node scripts/deploy.mjs --check-only` runs just this check.
async function changelogCheck() {
  const { CHANGELOG } = await import(path.join(ROOT, 'src/data/changelog.js'));
  const latest = CHANGELOG[0];
  let newest = 0; let newestFile = '';
  for (const rel of files) {
    if (!/^(src|api)\//.test(rel.split(path.sep).join('/')) || rel.endsWith('changelog.js')) continue;
    const t = fs.statSync(rel).mtimeMs; if (t > newest) { newest = t; newestFile = rel; }
  }
  const hkDay = new Date(newest + 8 * 3600e3).toISOString().slice(0, 10);
  if (hkDay > latest.date) {
    const msg = `CHANGELOG: newest change ${newestFile} is from ${hkDay} HKT but the latest changelog entry (${latest.version}) is ${latest.date}. Add an entry to src/data/changelog.js for user-visible changes.`;
    if (process.env.NEST_CHANGELOG_STRICT === '1') { console.error(`REFUSING TO DEPLOY — ${msg}`); process.exit(2); }
    console.warn(`WARNING — ${msg}`);
  } else console.log(`changelog OK: ${latest.version} (${latest.date} HKT) covers changes up to ${hkDay} HKT`);
}
await changelogCheck();
if (process.argv.includes('--check-only')) process.exit(0);
const API = 'https://api.vercel.com';
const meta = [];
for (const rel of files) {
  const buf = fs.readFileSync(rel); const sha = crypto.createHash('sha1').update(buf).digest('hex');
  meta.push({ file: rel.split(path.sep).join('/'), sha, size: buf.length, rel });
}
const curlJson = (url, body) => JSON.parse(execFileSync('curl', ['-s', ...(body ? ['-X', 'POST', '-H', 'content-type: application/json', '--data-binary', '@-'] : []), url], { input: body || '' }).toString());
const PROJECT = process.env.VERCEL_PROJECT || 'kabo-family'; // your Vercel project name
const create = () => curlJson(`${API}/v13/deployments?skipAutoDetectionConfirmation=1`, JSON.stringify({ name: PROJECT, project: PROJECT, target: 'production', files: meta.map(({ file, sha, size }) => ({ file, sha, size })),
    projectSettings: { framework: 'vite', buildCommand: 'vite build', outputDirectory: 'dist', installCommand: 'npm install' } }));
// Upload ONLY the files Vercel does not have yet (the free plan allows 5,000 file uploads a day; uploading all 265 files on
// every deploy exhausted it on 2026-10-18). Vercel answers `missing_files` with the shas it needs.
let d = create();
if (d.error && d.error.code === 'missing_files') {
  const need = new Set(d.error.missing || []);
  let n = 0;
  for (const m of meta) {
    if (!need.has(m.sha)) continue; need.delete(m.sha);
    const out = execFileSync('curl', ['-s', '-X', 'POST', `${API}/v2/files`, '-H', 'content-type: application/octet-stream', '-H', `x-vercel-digest: ${m.sha}`, '--data-binary', `@${m.rel}`]).toString();
    if (out && out.includes('"error"')) { console.error('upload failed', m.rel, out); process.exit(1); }
    n++;
  }
  console.log('uploaded', n, 'changed files of', meta.length);
  d = create();
} else console.log('no uploads needed');
if (d.error) { console.error(JSON.stringify(d)); process.exit(1); }
console.log('deployment', d.id, d.url);
fs.writeFileSync('/tmp/deploy-id', d.id);
for (let i = 0; i < 22; i++) {
  await new Promise((s) => setTimeout(s, 4000));
  const s = curlJson(`${API}/v13/deployments/${d.id}`);
  process.stdout.write(s.readyState + ' ');
  if (['READY', 'ERROR', 'CANCELED'].includes(s.readyState)) { console.log('\n', s.readyState, s.alias || ''); break; }
}
