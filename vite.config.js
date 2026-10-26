import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// 简体中文: STRINGS['zh-Hant'] → opencc-js (hk→cn) + wording fixes, generated at build time as a virtual module.
function zhHans() {
  const ID = 'virtual:nest-zh-hans';
  return {
    name: 'nest-zh-hans',
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    async load(id) {
      if (id !== '\0' + ID) return null;
      const stamp = `?t=${Date.now()}`;
      const { STRINGS } = await import(pathToFileURL(path.resolve('src/lib/strings.js')).href + stamp);
      const { hansDict } = await import(pathToFileURL(path.resolve('src/lib/hans.js')).href + stamp);
      this.addWatchFile(path.resolve('src/lib/strings.js'));
      return `export default ${JSON.stringify(hansDict(STRINGS['zh-Hant']))};`;
    },
  };
}

// Crawlers do not run JS: write dist/beta/index.html (the same SPA shell) with beta-specific share tags.
function betaShareHtml() {
  return {
    name: 'nest-beta-share', apply: 'build',
    closeBundle() {
      const out = path.resolve(this.environment?.config?.build?.outDir || globalThis.__nestOutDir || 'dist');
      const src = path.join(out, 'index.html');
      if (!fs.existsSync(src)) return;
      const T = 'Nest beta: first 10 families get Pro free';
      const D = "Join the Nest beta — the first 10 families get Nest Pro free for a month. Your family's AI home: homework tutor, quizzes, memory and reminders.";
      let h = fs.readFileSync(src, 'utf8')
        .replace(/<title>[^<]*<\/title>/, `<title>${T}</title>`)
        .replace(/(property="og:url" content=")[^"]*/, `$1${globalThis.__nestSite}/beta`)
        .replace(/(rel="canonical" href=")[^"]*/, `$1${globalThis.__nestSite}/beta`)
        .replace(/(property="og:title" content=")[^"]*/, `$1${T}`).replace(/(name="twitter:title" content=")[^"]*/, `$1${T}`)
        .replace(/(property="og:description" content=")[^"]*/, `$1${D}`).replace(/(name="twitter:description" content=")[^"]*/, `$1${D}`)
        .replace(/(name="description" content=")[^"]*/, `$1${D}`)
        .replace(/og-v2\.png/g, 'og-beta-v2.png')
        .replace(/(og:image:alt" content=")[^"]*/, `$1${T}`).replace(/(twitter:image:alt" content=")[^"]*/, `$1${T}`);
      fs.mkdirSync(path.join(out, 'beta'), { recursive: true });
      fs.writeFileSync(path.join(out, 'beta', 'index.html'), h);
    },
  };
}

// pdf.js CMaps + standard font data → dist/pdfjs/ (CJK PDFs read as empty text without them). Build only; both modes.
function pdfjsAssets() {
  return {
    name: 'nest-pdfjs-assets', apply: 'build',
    closeBundle() {
      const out = path.resolve(this.environment?.config?.build?.outDir || globalThis.__nestOutDir || 'dist');
      if (!fs.existsSync(out)) return;
      for (const d of ['cmaps', 'standard_fonts']) {
        const src = path.resolve('node_modules/pdfjs-dist', d); const dst = path.join(out, 'pdfjs', d);
        fs.mkdirSync(dst, { recursive: true });
        for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      }
    },
  };
}

// SEO/GEO (Run 9): prerendered static pages in 3 languages, root landing content, spa.html shell, robots.txt, sitemap.xml,
// llms.txt, IndexNow key — all generated here so Vercel's remote build makes them (nothing extra to upload). Production only.
// Runs after nest-beta-share (both closeBundle; beta is synchronous and listed first, so it has already read the plain shell).
function nestSeo(mode) {
  return {
    name: 'nest-seo', apply: 'build',
    async closeBundle() {
      if (mode === 'mock') return;
      const out = path.resolve(this.environment?.config?.build?.outDir || globalThis.__nestOutDir || 'dist');
      const { buildSeo } = await import(pathToFileURL(path.resolve('seo/build.js')).href + `?t=${Date.now()}`);
      buildSeo(out);
    },
  };
}

// Self-hosting: public/auth/action.html and public/status.html are plain static files (no bundler), so the deployment's
// public values are written into the built copies here instead of being hard-coded in the repo.
function nestPublicConfig() {
  return {
    name: 'nest-public-config', apply: 'build',
    async closeBundle() {
      const out = path.resolve(this.environment?.config?.build?.outDir || globalThis.__nestOutDir || 'dist');
      const site = await import(pathToFileURL(path.resolve('src/site.js')).href);
      const { CONTACT_EMAIL } = await import(pathToFileURL(path.resolve('src/contact.js')).href);
      const vals = {
        __NEST_FIREBASE_API_KEY__: process.env.VITE_FIREBASE_API_KEY || '',
        __NEST_OK_HOSTS__: [site.SITE_HOST, `www.${site.SITE_HOST}`, ...site.LEGACY_HOSTS].join(','),
        __NEST_CHANGELOG_URL__: site.CHANGELOG_ORIGIN,
        __NEST_SITE_URL__: site.SITE,
        __NEST_SITE_HOST__: site.SITE_HOST,
        __NEST_CONTACT_EMAIL__: CONTACT_EMAIL,
      };
      for (const rel of ['auth/action.html', 'status.html']) {
        const f = path.join(out, rel);
        if (!fs.existsSync(f)) continue;
        let h = fs.readFileSync(f, 'utf8');
        for (const [k, v] of Object.entries(vals)) h = h.split(k).join(v.replace(/['"<>\\]/g, ''));
        fs.writeFileSync(f, h);
      }
    },
  };
}

// Make .env / .env.<mode> VITE_* values visible to the Node-side build steps (SEO pages, public HTML) as well as the bundle.
function exposeEnv(mode) {
  const E = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [k, v] of Object.entries(E)) if (process.env[k] === undefined) process.env[k] = v;
  const missing = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'].filter((k) => !process.env[k]);
  if (missing.length && mode !== 'mock') console.warn(`\n[nest] Firebase not configured (${missing.join(', ')} missing) — the app will show a setup screen. See README / .env.example.\n`);
  if (!process.env.VITE_SITE_URL && mode !== 'mock') console.warn('[nest] VITE_SITE_URL not set — canonical links, sitemap and emails use http://localhost:5173. Set it to your deployment URL.\n');
  globalThis.__nestSite = (process.env.VITE_SITE_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

export default defineConfig(({ mode }) => (exposeEnv(mode), (globalThis.__nestOutDir = mode === 'mock' ? 'dist-mock' : 'dist'), {
  plugins: [react(), zhHans(), betaShareHtml(), pdfjsAssets(), nestSeo(mode), nestPublicConfig()],
  resolve: {
    alias: mode === 'mock'
      ? { './backend.real.js': path.resolve('src/lib/backend.mock.js') }
      : {},
  },
  build: { chunkSizeWarningLimit: 1500 },
}));
