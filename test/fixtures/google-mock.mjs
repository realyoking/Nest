// In-memory Google services for tests + local harnesses (Run 12): Firestore REST (get with mask, commit with updateMask +
// preconditions + 1 MiB doc cap), Identity Toolkit sign-in, and a JWKS for Firebase ID tokens signed by idToken().
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
process.env.NEST_LEDGER_SECRET = 'test-secret';
process.env.FIREBASE_PROJECT_ID = 'nest-test-project';
export const docs = new Map(); // name → { fields(decoded), updateTime }
let tick = 0; export const commits = []; const SIZE_CAP = 1048576;
const { enc, decFields } = await import('../../api/_ops-lib.js');
const segsOf = (fpath) => fpath.match(/`((?:[^`\\]|\\.)*)`|[^.]+/g).map((x) => (x.startsWith('`') ? x.slice(1, -1).replace(/\\(.)/g, '$1') : x));
const getAt = (o, segs) => segs.reduce((a, k) => (a == null ? undefined : a[k]), o);
function setAt(o, segs, v) { let cur = o; for (const k of segs.slice(0, -1)) { if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}; cur = cur[k]; } if (v === undefined) delete cur[segs.at(-1)]; else cur[segs.at(-1)] = v; }
const encFields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)]));
const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
export const idToken = (email, uid, verified = true) => new SignJWT({ email, email_verified: verified, firebase: { sign_in_provider: 'password' } }).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer('https://securetoken.google.com/nest-test-project').setAudience('nest-test-project').setSubject(uid).setIssuedAt().setExpirationTime('1h').sign(privateKey);
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(typeof input === 'string' ? input : input.url);
  const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('/jwk/securetoken')) return J(200, { keys: [jwk] });
  if (url.includes('identitytoolkit.googleapis.com')) {
    const b = JSON.parse(init.body || '{}');
    return J(200, { idToken: `sys:${b.email}`, localId: `uid_${b.email.split('@')[0].replace(/[^a-z0-9]/gi, '')}`, expiresIn: '3600' });
  }
  if (url.includes('firestore.googleapis.com')) {
    if (url.endsWith(':commit')) {
      const { writes } = JSON.parse(init.body);
      for (const w of writes) {
        const name = w.update?.name || w.transform?.document; const cur = docs.get(name);
        if (w.currentDocument?.exists === false && cur) return J(409, { error: { status: 'ALREADY_EXISTS' } });
        if (w.currentDocument?.updateTime && cur?.updateTime !== w.currentDocument.updateTime) return J(400, { error: { status: 'FAILED_PRECONDITION' } });
        const next = structuredClone(cur?.fields || {});
        if (w.update) { const inc = decFields(w.update.fields); for (const f of w.updateMask.fieldPaths) setAt(next, segsOf(f), getAt(inc, segsOf(f))); }
        if (JSON.stringify(next).length > SIZE_CAP) return J(400, { error: { status: 'INVALID_ARGUMENT', message: 'Document exceeds maximum size' } });
        docs.set(name, { fields: next, updateTime: `t${++tick}` }); commits.push(name);
      }
      return J(200, {});
    }
    const name = decodeURIComponent(url.split('/v1/')[1].split('?')[0]);
    const d = docs.get(name); if (!d) return J(404, { error: { status: 'NOT_FOUND' } });
    return J(200, { name, fields: encFields(d.fields), updateTime: d.updateTime });
  }
  if (url.includes('apihub.agnes-ai.com')) throw new Error('no AI in tests');
  return realFetch(input, init);
};
