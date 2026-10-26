// Minimal emulation of Vercel's routing for vercel.json `rewrites` (filesystem first, then rewrites in order, first match wins).
// Used by test/seo.test.mjs and scripts/serve-dist.mjs to check that static SEO pages win over the SPA fallback locally.
// Supports the source syntax this project uses: :name(regex), :name*, :name, and raw regex groups.
import fs from 'node:fs';
import path from 'node:path';

export function compileSource(src) {
  // Run 18: balanced-paren scan (sources now nest lookaheads 2+ levels deep).
  const group = (i) => { let d = 0; for (let j = i; j < src.length; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === '(') d++; else if (src[j] === ')' && --d === 0) return j; } throw new Error(`unbalanced ${src}`); };
  let re = '';
  for (let i = 0; i < src.length;) {
    const m = src.slice(i).match(/^:(\w+)/);
    if (m) {
      const name = m[1]; let j = i + m[0].length;
      if (src[j] === '(') { const end = group(j); re += `(?<${name}>${src.slice(j + 1, end)})`; i = end + 1; }
      else if (src[j] === '*') { re += `(?<${name}>.*)`; i = j + 1; }
      else { re += `(?<${name}>[^/]+)`; i = j; }
    } else if (src[i] === '(') { const end = group(i); re += src.slice(i, end + 1); i = end + 1; }
    else { re += src[i]; i++; }
  }
  return new RegExp(`^${re}/?$`);
}
export function fill(dest, groups = {}) {
  return dest.replace(/:(\w+)\*?/g, (_, n) => (groups[n] ?? ''));
}
// Run 18: optional `host` — rewrites with has:[{type:'host'}] only match that host; rewrites without `has` match every host.
export function resolve(pathname, { dist, config, host = 'nesty.cyou' }) {
  const clean = decodeURIComponent(pathname.split('?')[0]);
  const fileOf = (p) => { const f = path.join(dist, p); return fs.existsSync(f) && fs.statSync(f).isFile() ? f : null; };
  if (clean === '/') return { file: fileOf('/index.html'), via: 'filesystem' };
  const direct = fileOf(clean);
  if (direct) return { file: direct, via: 'filesystem' };
  for (const r of config.rewrites || []) {
    if (r.has && !r.has.every((h) => h.type !== 'host' || h.value === host)) continue;
    const m = clean.match(compileSource(r.source));
    if (!m) continue;
    const dest = fill(r.destination, m.groups || {});
    if (/^https?:/.test(dest)) return { proxy: dest, via: r.source };
    return { file: fileOf(dest.split('?')[0]), dest, via: r.source };
  }
  return { file: null, via: 'none' };
}
