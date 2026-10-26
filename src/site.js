// The ONE place that says which domain Nest lives on. Imported by the client (src/), the SEO build (seo/)
// and the serverless functions (api/). Public values only.
//
// SITE is the canonical origin for everything public: canonical / hreflang / og / JSON-LD / sitemap / robots / llms.txt /
// IndexNow / invite-link fallback / emails. The old *.vercel.app hostnames 301 to SITE (vercel.json, host-based),
// except /api/*, /__/* and /oauth-callback.html.
import { env, envList } from './env.js';

// Configurable per deployment (see .env.example):
//   VITE_SITE_URL           canonical origin, e.g. https://nest.example.com (no trailing slash)
//   VITE_LEGACY_HOSTS       optional, comma-separated old hostnames that may also run auth / receive OAuth returns
//   VITE_GITHUB_OAUTH_HOST  optional, host whose /api/github/callback is registered on your GitHub OAuth App
// When VITE_SITE_URL is not set the site is NOT assumed to be the upstream nesty.cyou: the browser uses its own origin
// and Node (SEO build, functions) uses http://localhost:5173, so an unconfigured fork never sends OAuth callbacks,
// emails or canonical links to the upstream deployment.
const UPSTREAM_SITE = 'https://nesty.cyou';
const runtimeOrigin = typeof location !== 'undefined' && /^https?:$/.test(location.protocol || '') ? location.origin : 'http://localhost:5173';
const SITE_URL = new URL(env('VITE_SITE_URL') || runtimeOrigin);
export const SITE_CONFIGURED = !!env('VITE_SITE_URL');
export const SITE_HOST = SITE_URL.host;
export const SITE = SITE_URL.origin;
// True only for the upstream deployment (nesty.cyou); upstream-only host lists below apply nowhere else.
export const IS_UPSTREAM = SITE === UPSTREAM_SITE;
// Upstream: the former canonical host is still the GitHub OAuth App callback host (https://heynest.vercel.app/api/github/callback
// is registered on GitHub and must not change), so the GitHub start/callback hop runs there. Forks default to their own site.
export const LEGACY_PRIMARY_HOST = env('VITE_GITHUB_OAUTH_HOST') || (IS_UPSTREAM ? 'heynest.vercel.app' : SITE_HOST);
export const LEGACY_HOSTS = env('VITE_LEGACY_HOSTS') ? envList('VITE_LEGACY_HOSTS')
  : IS_UPSTREAM ? ['heynest.vercel.app', 'kabo-family.vercel.app', 'nestfamily.vercel.app', 'nesthk.vercel.app', 'nestfam.vercel.app'] : [];
export const GITHUB_ORIGIN = `https://${LEGACY_PRIMARY_HOST}`;

// ---- THE auth switch ---------------------------------------------------------------------------------------------
// true  = Firebase Auth runs same-origin on nesty.cyou (authDomain nesty.cyou via the /__/auth proxy) and the Google
//         connector uses https://nesty.cyou/oauth-callback.html + /api/oauth/callback.
// false = the site falls back to authDomain <project>.firebaseapp.com and the Google connector sends users
//         to the legacy primary host.
// Requires https://<site>/__/auth/handler, /oauth-callback.html and /api/oauth/callback as redirect URIs (and the site
// as a JS origin) on your Google OAuth web client, and the site as a Firebase authorized domain.
export const AUTH_ON_SITE = true;

// Hostnames where Firebase Auth runs same-origin and the Google connector may start/finish (callbacks registered).
export const APP_HOSTS = AUTH_ON_SITE ? [SITE_HOST, ...LEGACY_HOSTS] : [...LEGACY_HOSTS];
// Where signed-in OAuth flows land when the current host is not in APP_HOSTS.
export const APP_ORIGIN = AUTH_ON_SITE ? SITE : `https://${LEGACY_PRIMARY_HOST}`;
// Origins allowed as a return target after the GitHub hop.
export const RETURN_ORIGINS = [SITE, `https://www.${SITE_HOST}`, ...LEGACY_HOSTS.map((h) => `https://${h}`)];

// ---- Run 18: sub-sites -------------------------------------------------------------------------------------------
// The blog and changelog LIVE on their own hosts (vercel.json host rewrites serve the same prerendered / store-rendered
// pages there); canonical / hreflang / sitemap use these URLs, old nesty.cyou/<seg>/blog|changelog paths 301 here.
//   blog:      https://blog.nesty.cyou/<seg>/  ·  https://blog.nesty.cyou/<seg>/<slug>
//   changelog: https://changelog.nesty.cyou/<seg>/
//   status:    https://status.nesty.cyou/  (status page, language picked client-side)
export const BLOG_ORIGIN = `https://blog.${SITE_HOST}`;
export const CHANGELOG_ORIGIN = `https://changelog.${SITE_HOST}`;
export const STATUS_ORIGIN = `https://status.${SITE_HOST}`;
export const SUB_HOSTS = [`blog.${SITE_HOST}`, `changelog.${SITE_HOST}`, `status.${SITE_HOST}`];
// Public URL of a site page key for a language segment ('en', 'zh-hant', …). null = not a sub-site page.
export function subsiteUrl(seg, page) {
  if (page === 'changelog') return `${CHANGELOG_ORIGIN}/${seg}/`;
  if (page === 'blog') return `${BLOG_ORIGIN}/${seg}/`;
  if (typeof page === 'string' && page.startsWith('blog/')) return `${BLOG_ORIGIN}/${seg}/${page.slice(5)}`;
  if (page === 'status') return statusUrl(seg);
  return null;
}
// The status page speaks en / zh-Hant / zh-Hans (public/status.html reads ?lang=); other languages get the bare URL.
export const statusUrl = (seg) => (seg === 'zh-hant' ? `${STATUS_ORIGIN}/?lang=zh-Hant` : seg === 'zh-hans' ? `${STATUS_ORIGIN}/?lang=zh-Hans` : `${STATUS_ORIGIN}/`);
