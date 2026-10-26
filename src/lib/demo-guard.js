// Run 10 (2026-10-19): the landing-page demo must NEVER touch the real account.
// Root cause of the '@mum' incident: the demo runs the real Settings page; its save() called profileSave() from
// plugins/api.js, which takes the REAL Firebase ID token from backend.js — so a signed-in visitor playing with the
// demo on '/' rewrote their own public profile (handle 'mum', name 媽媽).
// While any <DemoApp> is mounted:
//   • backend.js refuses token reads (getIdToken / currentUser) and every write-style function (DemoBlocked),
//   • window.fetch refuses /api/* requests that carry an Authorization header,
//   • nest.* localStorage / sessionStorage writes go to an in-memory overlay (device UI language excepted).
let active = 0;
export const demoActive = () => active > 0;
export class DemoBlocked extends Error { constructor(what = '') { super('demo_blocked'); this.code = 'demo_blocked'; this.what = what; } }

const KEEP_REAL = new Set(['nest.lang', 'nest.auth']); // device UI language (landing toggle) + the real session's CTA flag (auth-hint.js, written only by backend.real) stay real
const overlay = new Map(); // `${kind}:${key}` → value | null (removed)
const isOurs = (k) => typeof k === 'string' && (k.startsWith('nest') || k === 'mockmode') && !KEEP_REAL.has(k);

let installed = false;
function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = function guardedFetch(input, init) {
    if (active > 0) {
      try {
        const url = new URL(typeof input === 'string' ? input : input?.url || String(input), window.location.href);
        const h = new Headers((init && init.headers) || (typeof input === 'object' && input?.headers) || undefined);
        if (url.origin === window.location.origin && url.pathname.startsWith('/api/') && h.has('authorization')) {
          return Promise.reject(new DemoBlocked(`fetch ${url.pathname}`));
        }
      } catch (e) { if (e instanceof DemoBlocked) return Promise.reject(e); }
    }
    return realFetch(input, init);
  };
  try {
    const P = window.Storage && window.Storage.prototype;
    if (P) {
      const kindOf = (st) => (st === window.sessionStorage ? 's' : 'l');
      const { getItem, setItem, removeItem } = P;
      P.getItem = function (k) { if (active > 0 && isOurs(k)) { const o = overlay.get(`${kindOf(this)}:${k}`); if (o !== undefined) return o; } return getItem.call(this, k); };
      P.setItem = function (k, v) { if (active > 0 && isOurs(k)) { overlay.set(`${kindOf(this)}:${k}`, String(v)); return undefined; } return setItem.call(this, k, v); };
      P.removeItem = function (k) { if (active > 0 && isOurs(k)) { overlay.set(`${kindOf(this)}:${k}`, null); return undefined; } return removeItem.call(this, k); };
    }
  } catch {}
}
// Returns a release function. Safe to call more than once per mount (the counter only drops once per enter).
export function enterDemo() {
  install();
  active += 1;
  let done = false;
  return () => { if (done) return; done = true; active = Math.max(0, active - 1); if (!active) overlay.clear(); };
}
// Test hook (node): reset state.
export function _resetDemoGuard() { active = 0; overlay.clear(); }

// One-time cleanup (Run 10): before the guard existed the demo (mock uid 'u1', family 'f1') could write device keys
// such as plan / brief / plugin caches. Remove nest* keys that are scoped to the demo ids. Runs once per device.
export const DEMO_KEY_RE = /^nest.*(^|[.:_/-])(u1|f1)([.:_/-]|$)/;
export function cleanDemoKeys(store) {
  const out = [];
  try {
    if (!store || store.getItem('nest.demoClean.v1')) return out;
    for (let i = store.length - 1; i >= 0; i--) { const k = store.key(i); if (k && DEMO_KEY_RE.test(k)) { out.push(k); store.removeItem(k); } }
    store.setItem('nest.demoClean.v1', String(Date.now()));
  } catch {}
  return out;
}
