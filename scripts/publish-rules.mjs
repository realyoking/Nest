// Publishes firestore.rules to the Firebase project through the Firebase Rules REST API
// (avoids the console editor). Needs a Google OAuth access token for an account with
// Firebase Rules Admin (or Owner/Editor) on the project, with the
// https://www.googleapis.com/auth/firebase (or cloud-platform) scope.
//
//   GOOGLE_ACCESS_TOKEN=ya29.... node scripts/publish-rules.mjs [--dry-run]
//   (one way to get a token: `gcloud auth print-access-token` after `gcloud auth login`)
//
// Steps: 1) create a ruleset from firestore.rules (the API compiles it and rejects syntax errors),
//        2) point the release "cloud.firestore" at the new ruleset.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (!PROJECT) { console.error('Set FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID) to your Firebase project id.'); process.exit(1); }
const TOKEN = process.env.GOOGLE_ACCESS_TOKEN;
const DRY = process.argv.includes('--dry-run');
const API = 'https://firebaserules.googleapis.com/v1';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, '..', 'firestore.rules'), 'utf8');

if (!TOKEN) { console.error('Set GOOGLE_ACCESS_TOKEN.'); process.exit(1); }
const h = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' };
async function call(method, url, body) {
  const r = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { console.error(method, url, r.status, JSON.stringify(j, null, 2)); process.exit(1); }
  return j;
}

const files = [{ name: 'firestore.rules', content: source }];
if (DRY) {
  // Compile-check only: the test endpoint reports syntax/semantic issues without publishing.
  const t = await call('POST', `${API}/projects/${PROJECT}:test`, { source: { files } });
  const issues = t.issues || [];
  console.log(issues.length ? JSON.stringify(issues, null, 2) : 'Rules compile cleanly (dry run, not published).');
  process.exit(issues.some((i) => i.severity === 'ERROR') ? 1 : 0);
}

const ruleset = await call('POST', `${API}/projects/${PROJECT}/rulesets`, { source: { files } });
console.log('ruleset created:', ruleset.name);
const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
const rel = await fetch(`${API}/${releaseName}`, { headers: h });
if (rel.status === 404) {
  await call('POST', `${API}/projects/${PROJECT}/releases`, { name: releaseName, rulesetName: ruleset.name });
} else {
  await call('PATCH', `${API}/${releaseName}`, { release: { name: releaseName, rulesetName: ruleset.name } });
}
console.log('published: cloud.firestore ->', ruleset.name);
