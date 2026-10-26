// Run 12: auth-aware primary CTA (免費開始 ↔ 進入應用) without a flash. A NON-secret device flag mirrors the Firebase
// session: localStorage 'nest.auth' = 'in' | 'out', written ONLY by the real backend's auth listener (backend.real.js) —
// never by the landing demo (it uses the mock backend, and demo-guard keeps nest* writes in memory anyway).
// The static pages read it in a tiny inline <head> script (AUTH_HEAD_SCRIPT) and set <html data-auth="in|out">;
// CSS shows one of two CTA variants. React pages start from the flag and switch to the live session when it is known.
export const AUTH_HINT_KEY = 'nest.auth';
const FB_KEY_RE = /^firebase:authUser:/;

export function readAuthHint(store = typeof localStorage !== 'undefined' ? localStorage : null) {
  try {
    if (!store) return null;
    const v = store.getItem(AUTH_HINT_KEY);
    if (v === 'in' || v === 'out') return v;
    // Fallback: Firebase's browserLocalPersistence copy (only present when IndexedDB was unavailable).
    for (let i = 0; i < store.length; i++) if (FB_KEY_RE.test(store.key(i) || '')) return 'in';
  } catch {}
  return null;
}
export function writeAuthHint(signedIn, store = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { store?.setItem(AUTH_HINT_KEY, signedIn ? 'in' : 'out'); } catch {}
}
// Session status (session.jsx) → 'in' | 'out' | null (unknown → neutral placeholder).
export function ctaState(status, hint) {
  if (status === 'ready' || status === 'onboarding') return 'in';
  if (status === 'out') return 'out';
  return hint || null;
}
// Static pages: no hint = never signed in on this device since Run 12 → signed-out CTA (the first visit to any app page
// writes the flag). Inline, synchronous, before <body> paints.
export const AUTH_HEAD_SCRIPT = `<script>(function(){var a='out';try{var v=localStorage.getItem('${AUTH_HINT_KEY}');if(v==='in')a='in';else if(v!=='out'){for(var i=0;i<localStorage.length;i++){if(/^firebase:authUser:/.test(localStorage.key(i)||'')){a='in';break}}}}catch(e){}document.documentElement.setAttribute('data-auth',a)})()</script>`;
export const AUTH_CTA_CSS = 'html[data-auth="in"] .cta-out{display:none!important}html:not([data-auth="in"]) .cta-in{display:none!important}';

