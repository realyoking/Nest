// Nest 巢 service worker: offline app shell + Web Push.
// - Navigations: network first, fall back to the cached shell (index.html) when offline.
// - /assets/* (hashed, immutable): cache first. Fonts: stale-while-revalidate.
// - Never caches /api/*, Firebase or Google APIs.
// - push: shows the notification from the JSON payload {title, body, url, tag}.
// - notificationclick: focuses an open Nest window and navigates it, or opens a new one.
const VERSION = 'nest-sw-v9'; // v9: 12 language URLs (/ja/ /ko/ /es/ /fr/ /de/ /pt-br/ /id/ /vi/ /th/) skipped like the others (2026-10-19 Run 14); v8: static SEO pages (/en/, /zh-hant/, /zh-hans/, robots/sitemap/llms) never become the cached shell (2026-10-19); v7: boot rescue + navigation timeout + html-only shell (2026-10-18); v6: sky icons (2026-10-18); v2: Liquid Glass icons; v3: OAuth callback + /__/auth bypass; v4: flat icons + /api/oauth (2026-10-17); v5: notification actions (nudges)
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-rt`;
const PRECACHE = ['/', '/manifest.webmanifest?v=4', '/favicon.svg?v=4', '/icon-192.png?v=4', '/icon-512.png?v=4', '/apple-touch-icon.png?v=4', '/badge-96.png?v=4'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(PRECACHE).catch(() => {});
    // Also precache the JS/CSS the current shell references, so the app opens offline.
    try {
      const html = await (await fetch('/', { cache: 'no-store' })).text();
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      const rt = await caches.open(RUNTIME);
      await rt.addAll(assets);
    } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/api/')) return;
  // Auth handlers and the connector OAuth callback must always hit the network (never cached as the shell).
  if (sameOrigin && (url.pathname.startsWith('/__/') || url.pathname === '/oauth-callback.html')) return;
  // Prerendered static pages (no app inside) are plain network pages: never served from / stored as the app shell.
  if (sameOrigin && (/^\/(en|zh-hant|zh-hans|ja|ko|es|fr|de|pt-br|id|vi|th)(\/|$)/.test(url.pathname) || /^\/(robots\.txt|sitemap\.xml|llms(-full)?\.txt)$/.test(url.pathname))) return;

  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith((async () => {
      // Network first; if the network has not answered in 6 s and a shell is cached, serve the shell (a stalled
      // request on a quick reload must never leave a blank page). Only real HTML 200s replace the cached shell.
      const net = fetch(req).then(async (res) => {
        if (res.ok && (res.headers.get('content-type') || '').includes('text/html')) (await caches.open(SHELL)).put('/', res.clone()).catch(() => {});
        return res;
      });
      const timeout = new Promise((r) => setTimeout(() => r(null), 6000));
      try {
        const first = await Promise.race([net, timeout]);
        if (first) return first;
        const cached = await caches.match('/');
        return cached || await net;
      } catch {
        return (await caches.match('/')) || new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } });
      }
    })());
    return;
  }
  if (sameOrigin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
      return res;
    })());
    return;
  }
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || (sameOrigin && /\.(png|svg|webmanifest)$/.test(url.pathname))) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })());
  }
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  const title = d.title || 'Nest 巢';
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    lang: d.lang || 'zh-Hant',
    data: { url: d.url || '/app' },
    // "Revised yet?" nudges: Yes / Not yet buttons (Android & desktop; iOS ignores actions and opens the app).
    ...(Array.isArray(d.actions) && d.actions.length ? { actions: d.actions.slice(0, 2).map((a) => ({ action: String(a.action), title: String(a.title) })), requireInteraction: false } : {}),
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const u = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin);
  if (event.action) u.searchParams.set('ans', event.action);
  const target = u.href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin !== self.location.origin) continue;
      try { await w.focus(); } catch {}
      // The SPA routes in place (keeps state, no reload).
      w.postMessage({ type: 'nest:navigate', url: target });
      return;
    }
    await self.clients.openWindow(target);
  })());
});

// Subscription rotated by the browser: tell an open window to re-register it.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ type: 'nest:resubscribe' }));
  })());
});
