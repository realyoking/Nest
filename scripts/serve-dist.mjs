// Serve dist/ with vercel.json rewrites emulated (local checks only). PORT=4199 node scripts/serve-dist.mjs
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { resolve } from './vercel-routes.mjs';
const dist = path.resolve(process.env.DIST || 'dist');
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.avif': 'image/avif' };
http.createServer((req, res) => {
  const r = resolve(new URL(req.url, 'http://x').pathname, { dist, config });
  if (r.proxy) { res.writeHead(502, { 'x-route': r.via }); return res.end('proxy ' + r.proxy); }
  if (!r.file) { res.writeHead(404, { 'x-route': r.via }); return res.end('404'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(r.file)] || 'application/octet-stream', 'x-route': r.via, 'x-file': path.relative(dist, r.file) });
  fs.createReadStream(r.file).pipe(res);
}).listen(+process.env.PORT || 4199, () => console.log('serving', dist));
