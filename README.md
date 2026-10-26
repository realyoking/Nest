# Nest 巢 — your family's AI home

Nest is an AI helper for families: a homework tutor, revision quizzes, shared family memory, reminders and a
family calendar in one installable web app. It works in 12 languages and adds local information for your region.

- **Live:** https://nesty.cyou
- **Old domain:** https://heynest.vercel.app (redirects to nesty.cyou)

## Features

- **AI assistant** — chat with automatic model routing and fallbacks, an optional thinking mode, web-search grounding
  with source chips, maths typesetting (KaTeX) and simple drawings.
- **Homework tutor and quizzes** — step-by-step help, revision quizzes, PDF and photo input (on-device document scanner).
- **Family memory and reminders** — shared memories, an AI agent that creates and edits reminders with undo, and push
  notifications (Web Push / PWA).
- **Calendar and connections** — Google (Gmail, Calendar, Classroom, Drive) and Apple / CalDAV calendars, a daily brief
  and proactive suggestions.
- **Families** — invite by link or six-digit code, parent and student roles, per-family usage limits and plans.
- **Plugins** — a plugin store, a plugin studio and sandboxed plugin runtime with explicit permissions.
- **Public site** — prerendered landing, features, pricing, FAQ, blog, changelog and status pages in 12 languages, with
  sitemap, robots.txt and llms.txt generated at build time.
- **Admin** — a small admin panel (allow-listed accounts only) for stats, announcements, blog and test-data cleanup.

## Stack

- **Frontend:** React 18 + Vite single-page app (`src/`), installable PWA with a service worker.
- **Backend:** Firebase Authentication + Cloud Firestore (security rules in `firestore.rules`).
- **Serverless:** Vercel Functions in `api/` (files starting with `_` are shared modules, not endpoints). Routes,
  redirects, headers and crons are in `vercel.json`.
- **Email:** Resend. **Push:** `web-push` with VAPID keys.
- **Tests:** Node's built-in test runner (`node --test`).

## Self-hosting

Everything that identifies a deployment — Firebase project, OAuth clients, domain, admin and contact emails — comes
from environment variables. A fork never needs (and never uses) the upstream project's data or keys.

### 1. Create your own Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. **Authentication:** enable the *Google* and *Email/Password* providers. Under *Settings → Authorized domains* add
   your site's domain (for example `nest.example.com`).
3. **Firestore:** create a database (production mode).
4. **Project settings → Your apps:** add a *Web app* and copy its config values into the `VITE_FIREBASE_*` variables.
5. **Service account (server):** *Project settings → Service accounts → Generate new private key*. Put the JSON on a
   single line in `FIREBASE_SERVICE_ACCOUNT` and set `FIREBASE_PROJECT_ID`.

### 2. Configure environment variables

Copy `.env.example` to `.env` for local development, or set the same names in Vercel → Project → Settings →
Environment Variables (Production and Preview). Every variable is documented in `.env.example`. The minimum to run:

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Your Firebase web-app config |
| `VITE_SITE_URL` | Your public URL, e.g. `https://nest.example.com` (canonical links, emails, OAuth return URLs) |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT` | Server access to Firestore / Auth |
| `AGNES_API_KEY` (and optionally `ORCAROUTER_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`) | AI providers |
| `VITE_CONTACT_EMAIL`, `NEST_ADMIN_EMAILS` | Public contact address; admin allow-list (server only) |
| `TOKEN_ENC_KEY`, `NEST_LEDGER_SECRET`, `CRON_SECRET` | Server secrets (long random strings; `TOKEN_ENC_KEY` is 32 bytes base64) |

`VITE_*` values are compiled into the public JavaScript bundle and the static pages, so only put public identifiers
there — never secrets. Without the `VITE_FIREBASE_*` values the public pages still build and render, and every app
route shows a *"Firebase not configured"* screen instead of crashing.

Optional features and their variables: Google connections (`VITE_GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`), GitHub connection (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `VITE_GITHUB_OAUTH_HOST`),
email (`RESEND_API_KEY`, `NEST_EMAIL_FROM`), push (`VAPID_*`), web search (`TAVILY_API_KEY`, `FIRECRAWL_API_KEY`),
search-console verification (`VITE_GOOGLE_SITE_VERIFICATION`, `VITE_INDEXNOW_KEY`).

### 3. Point the domain-specific config at your project

A few things cannot be read from environment variables and must be edited in a fork:

- **`vercel.json`** — the `/__/auth/*` and `/__/firebase/*` rewrites proxy to `https://<project>.firebaseapp.com`.
  Replace the project id with yours (this keeps redirect sign-in working on iOS Safari and installed PWAs). The
  host-based redirects for the upstream's old `*.vercel.app` hostnames only trigger on those hostnames and can be removed.
- **Google OAuth client** (Google Cloud console → APIs & Services → Credentials): add your site as an authorized
  JavaScript origin and add `https://<your-site>/__/auth/handler`, `https://<your-site>/oauth-callback.html` and
  `https://<your-site>/api/oauth/callback` as redirect URIs.
- **Sub-sites** — the blog, changelog and status pages are linked as `blog.`, `changelog.` and `status.` subdomains of
  `VITE_SITE_URL` (see `src/site.js`). Add those domains to your Vercel project, or adjust `src/site.js`.
- **Branding** — `index.html` and the copy in `seo/` describe the upstream site; edit them for your own deployment.

If `VITE_SITE_URL` is missing, the build warns and falls back to the browser's own origin (and `http://localhost:5173`
on the server), so an unconfigured fork never sends OAuth callbacks, emails or canonical links to nesty.cyou.

### 4. Deploy the Firestore rules

Publish `firestore.rules` in the Firebase console (Firestore → Rules), or with the Rules REST API:

```bash
FIREBASE_PROJECT_ID=your-project GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/publish-rules.mjs --dry-run
FIREBASE_PROJECT_ID=your-project GOOGLE_ACCESS_TOKEN=$(gcloud auth print-access-token) node scripts/publish-rules.mjs
```

### 5. Run and deploy

```bash
npm install
npm run dev          # local dev server (uses your .env)
npm run build        # production build → dist/ (also prerenders the public pages)
npm run build:mock   # in-memory mock backend, for screenshots only (never deploy)
```

Deploy with the Vercel CLI / Git integration (framework: Vite, build `vite build`, output `dist`), or with
`VERCEL_PROJECT=<your-project> node scripts/deploy.mjs`, which uploads the source through the Vercel REST API and lets
Vercel build it (it expects the Vercel auth header to be supplied by your environment).

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/deploy.mjs` | Deploy to Vercel via the REST API (uploads only changed files; warns when the changelog is behind the code) |
| `scripts/publish-rules.mjs` | Publish `firestore.rules` through the Firebase Rules API |
| `scripts/indexnow.mjs` | Submit the live sitemap to IndexNow |
| `scripts/vercel-routes.mjs` | Resolve a path against `vercel.json` routes (used by tests) |
| `scripts/serve-dist.mjs` | Serve `dist/` locally with the Vercel routing rules |
| `scripts/*-shots.mjs`, `scripts/overflow-check.mjs` | Screenshot and layout checks (need a local Chrome via `CHROME`) |
| `scripts/gen-regions.mjs`, `scripts/render-icons.mjs`, `scripts/icon-*.mjs` | Asset generators |

## Tests

```bash
NO_LIVE=1 node --test test/*.test.mjs
```

Tests use fake configuration from `test/_env.mjs` and never touch a real project. Live tests are skipped unless
`LIVE=1` (they need network access and real credentials).

## Project layout

```
api/          Vercel Functions (endpoints) and shared server modules (_*.js)
public/       Static files (icons, images, auth action page, status page, service worker)
seo/          Build-time prerendering of the public pages (run by the nest-seo Vite plugin)
src/          React app: pages/, components/, lib/ (backend, AI, i18n…), site.js (domains), env.js (config)
test/         node:test suites
firestore.rules  Firestore security rules
vercel.json      Routes, redirects, headers, crons
```

## Contributing

Issues and pull requests are welcome. Please run the tests before opening a pull request, and never commit real
keys — `.env` files are git-ignored; document new variables in `.env.example` instead.

## License

No license has been chosen yet (no LICENSE file; `package.json` says `UNLICENSED`). Until one is added, all rights are reserved by the author; please open an issue if
you would like to use the code.
