// PWA install + Web Push on the client.
// - Service worker registration (public/sw.js), install-prompt capture (beforeinstallprompt), platform detection.
// - Subscribing this device (VAPID) and storing it through /api/push/subscribe (server picks the subcollection,
//   or the owner-only profile map when the live Firestore rules do not allow the subcollection yet).
// - Local checks while the app is open (Hobby-plan cron runs only daily): reminders due in the next 15 min,
//   homework/tests due within 24 h, family birthdays today. Shown through the service worker, once each.
import { inQuietHours } from './prefs.js';
import { reportGate } from './gate-errors.js';
import { personContext as personCtx } from './memory.js';

// VAPID public key (public by design). The private key exists only in Vercel env (VAPID_PRIVATE_KEY).
export const VAPID_PUBLIC_KEY = 'BG_kzcKzAZiClkm2miBf2L7ero7_yyiccWMYFbmv9zH5LAib4yyH57If59oFoOKNGZdCGm606koE9OMnQJGvmtw';
const IS_MOCK = import.meta.env.MODE === 'mock';

// ---------- Platform ----------
export function platform() {
  if (typeof navigator === 'undefined') return {};
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const ios = /iP(hone|od|ad)/.test(ua) || iPadOS;
  const m = ua.match(/OS (\d+)[_.](\d+)/);
  const v = m || ua.match(/Version\/(\d+)\.(\d+)/);
  const iosVersion = ios && v ? +v[1] * 100 + +v[2] : 0; // 1604 = iOS 16.4
  const android = /Android/i.test(ua);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
  const pushApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  return {
    ios, ipad: iPadOS || /iPad/.test(ua), iosVersion, iosSafari, android, standalone,
    pushApi,
    // iOS: push only for Home-Screen web apps on 16.4+.
    pushPossible: ios ? iosVersion >= 1604 : pushApi,
    needsInstallForPush: ios && !standalone,
  };
}

// ---------- Service worker + install prompt ----------
let deferredPrompt = null;
const installListeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; installListeners.forEach((f) => f(true)); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; installListeners.forEach((f) => f(false)); });
}
export const canPromptInstall = () => !!deferredPrompt;
export function onInstallAvailable(f) { installListeners.add(f); return () => installListeners.delete(f); }
export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  const e = deferredPrompt; deferredPrompt = null;
  e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' }));
  installListeners.forEach((f) => f(false));
  return r.outcome;
}

export function registerServiceWorker(navigate) {
  if (IS_MOCK || !('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  const reg = () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'nest:navigate' && e.data.url) {
      const u = new URL(e.data.url, location.origin);
      navigate ? navigate(u.pathname + u.search) : location.assign(u.href);
    }
    if (e.data?.type === 'nest:resubscribe') resubscribeHook?.();
  });
}
let resubscribeHook = null;
export const setResubscribeHook = (f) => { resubscribeHook = f; };

const swReady = () => (IS_MOCK || !('serviceWorker' in navigator) ? Promise.resolve(null) : Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 4000))]));

// ---------- Subscription ----------
function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
export const permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

export async function currentSubscription() {
  const reg = await swReady();
  return reg ? reg.pushManager.getSubscription() : null;
}
// Device id the server uses ("s" + sha256(endpoint)[0:24]).
export async function subIdOf(endpoint) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return 's' + [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function api(path, getIdToken, init = {}) {
  const tok = await getIdToken();
  const r = await fetch(path, { ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}`, ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const err = Object.assign(new Error(j.error || `http_${r.status}`), { code: j.error || `http_${r.status}`, status: r.status, body: j, ...(j.message ? { gateMessage: j.message } : {}) }); reportGate(err); throw err; }
  return j;
}

// Asks for permission (must be called from a tap), subscribes and stores this device.
// Returns { id, stored } or throws Error('denied' | 'unsupported' | 'needs_install' | ...).
export async function enablePushOnThisDevice(getIdToken) {
  const pf = platform();
  if (pf.needsInstallForPush) throw new Error('needs_install');
  if (!pf.pushApi) throw new Error('unsupported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'denied' : 'dismissed');
  const reg = await swReady();
  if (!reg) throw new Error('no_sw');
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  const r = await api('/api/push/subscribe', getIdToken, { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON(), ua: navigator.userAgent }) });
  localStorage.setItem('nest.push.id', r.id);
  return r;
}
export async function disablePushOnThisDevice(getIdToken) {
  const sub = await currentSubscription();
  if (!sub) return;
  const id = await subIdOf(sub.endpoint);
  await sub.unsubscribe().catch(() => {});
  await api(`/api/push/subscribe?id=${id}`, getIdToken, { method: 'DELETE' }).catch(() => {});
  localStorage.removeItem('nest.push.id');
}
export async function removeDevice(getIdToken, id) {
  const sub = await currentSubscription();
  if (sub && (await subIdOf(sub.endpoint)) === id) return disablePushOnThisDevice(getIdToken);
  await api(`/api/push/subscribe?id=${id}`, getIdToken, { method: 'DELETE' });
}
export async function sendTestPush(getIdToken, lang) {
  const sub = await currentSubscription();
  return api('/api/push/test', getIdToken, { method: 'POST', body: JSON.stringify({ lang, subscription: sub ? sub.toJSON() : undefined }) });
}

// "iPhone · Safari", "Android · Chrome", "Mac · Chrome" …
export function deviceLabel(ua = '') {
  const os = /iPad/.test(ua) ? 'iPad' : /iPhone|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : '—';
  const br = /EdgA?\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /OPR\//.test(ua) ? 'Opera' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

// ---------- Classroom deadlines cache (read by the daily cron) ----------
// Stored on the owner-only profile doc (allowed by the current rules): users/{uid}.deadlines.
const TEST_RE = /測驗|考試|默書|小測|測試|段考|期考|\b(test|exam|quiz|dictation|assessment)s?\b/i;
export const isTestTitle = (t) => TEST_RE.test(t || '');
export function deadlinesFromClassroom(items) {
  const now = Date.now();
  return (items || []).filter((i) => i.date && i.date.getTime() > now - 864e5).slice(0, 25)
    .map((i) => ({ title: String(i.title).slice(0, 140), course: String(i.sub || '').split(' · ')[0].slice(0, 80), dueAt: i.date.toISOString(), kind: isTestTitle(i.title) ? 'test' : 'homework', ...(i.account ? { account: String(i.account).slice(0, 254) } : {}) }));
}

// ---------- Local checks while the app is open ----------
const seen = (k) => { try { return !!localStorage.getItem(`nest.n.${k}`); } catch { return true; } };
const mark = (k) => { try { localStorage.setItem(`nest.n.${k}`, String(Date.now())); } catch {} };
const hkDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function showLocal(title, body, url, tag) {
  const reg = await swReady();
  if (reg?.showNotification) return reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/badge-96.png', data: { url } });
  if (typeof Notification !== 'undefined') new Notification(title, { body, tag, icon: '/icon-192.png' });
}

// In-app banner for anything that fires while Nest is open (listened to in App.jsx → InAppNotice).
export const inApp = (title, body, url) => { try { window.dispatchEvent(new CustomEvent('nest:inapp', { detail: { title, body, url } })); } catch {} };

// Native Nest event reminders while the app is open: fetch the family's events every 5 min (cached server call),
// fire each reminder once per device (local notification when allowed + in-app banner).
let nestEvCache = { at: 0, list: [] };
async function nestTick(s, t, now) {
  // Re-read every minute (the server list is small); a write in this tab clears calendar.js's cache so new events count at once.
  if (Date.now() - nestEvCache.at > 55e3) {
    nestEvCache.at = Date.now();
    try { const { nestEventsRaw } = await import('./calendar.js'); nestEvCache.list = await nestEventsRaw({ maxAge: 50e3 }); } catch {}
  }
  const { firesBetween } = await import('./nestcal.js');
  nestEvCache.list.forEach((e) => {
    if (e.members?.length && !e.members.includes(s.user.uid)) return;
    firesBetween(e, now - 90e3, now + 30e3).forEach((f) => {
      const k = `ne.${e.id}.${f.occ}.${f.minutes}`;
      if (seen(k)) return; mark(k);
      const hm = new Date(f.occStart + 8 * 3600e3).toISOString().slice(11, 16);
      const body = [f.minutes === 0 ? t('ncal.rem.now') : reminderText(f.minutes, t), e.allDay ? t('calendar.allDay') : hm, e.location].filter(Boolean).join(' · ');
      inApp(e.title, body, '/app/calendar');
      const p = s.prefs;
      if (permission() === 'granted' && p.pushEnabled && !inQuietHours(p)) showLocal(e.title, body, '/app/calendar', `nev-${e.id}-${f.occ}-${f.minutes}`);
    });
  });
}
const reminderText = (m, t) => (m < 60 ? t('ncal.rem.inMin', { n: m }) : m < 1440 ? t('ncal.rem.inHour', { n: m / 60 }) : t('ncal.rem.inDay', { n: m / 1440 }));

// s = session; t = i18n t(). Returns a stop function.
export function startLocalChecks(getS, t) {
  if (IS_MOCK) return () => {};
  const tick = () => {
    const s0 = getS();
    if (s0?.user && s0.family) nestTick(s0, t, Date.now()).catch(() => {});
    const s = getS();
    if (!s?.user || permission() !== 'granted') return;
    const p = s.prefs;
    if (!p.pushEnabled || inQuietHours(p)) return;
    const now = Date.now();
    if (p.notifyReminders) {
      s.reminders.filter((r) => !r.done && r.dueAt && (!r.memberId || r.memberId === s.user.uid)).forEach((r) => {
        const due = r.dueAt.getTime();
        const k = `r.${r.id}.${due}`;
        if (due - now <= 15 * 60e3 && now - due < 15 * 60e3 && !seen(k)) {
          mark(k);
          // Context at the right moment: "Call Mum" → the last note the family kept about her.
          const pc = personCtx(s, r.title);
          const body = pc ? `${r.title} — ${t('mem2.lastTime', { note: pc.note })}` : r.title;
          showLocal(t('push.local.reminder'), body, '/app/reminders', `rem-${r.id}`); inApp(r.title, pc ? t('mem2.lastTime', { note: pc.note }) : t('push.local.reminder'), '/app/reminders');
        }
      });
    }
    (s.profile?.deadlines || []).forEach((d) => {
      const test = d.kind === 'test';
      if ((test && !p.notifyTests) || (!test && !p.notifyHomework)) return;
      const due = new Date(d.dueAt).getTime();
      const k = `d.${d.title}.${due}`;
      if (due > now && due - now <= 24 * 3600e3 && !seen(k)) { mark(k); showLocal(t(test ? 'push.local.test' : 'push.local.homework'), `${d.title}${d.course ? ` · ${d.course}` : ''}`, test ? '/app/quiz' : '/app/connections', `dl-${due}`); }
    });
    if (p.notifyBirthdays) {
      const today = hkDay(new Date());
      s.members.filter((m) => m.birthday && m.birthday.slice(5) === today.slice(5)).forEach((m) => {
        const k = `b.${m.uid}.${today}`;
        if (!seen(k)) { mark(k); showLocal(t('push.local.birthday'), t('push.local.birthdayBody', { name: m.displayName }), '/app/family', `bday-${m.uid}`); }
      });
    }
  };
  const first = setTimeout(tick, 4000);
  const iv = setInterval(tick, 60e3);
  const vis = () => document.visibilityState === 'visible' && tick();
  document.addEventListener('visibilitychange', vis);
  return () => { clearTimeout(first); clearInterval(iv); document.removeEventListener('visibilitychange', vis); };
}
