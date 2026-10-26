import './_env.mjs';
// Nick Launches featured badge: public footers only (SPA PublicLayout + static seo footer), never inside /app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NL_BADGE } from '../seo/render.js';

const HREF = 'href="https://nicklaunches.com/products/nest/"';
const IMG = 'src="https://nicklaunches.com/badges/featured.png"';
test('static footer badge: exact link, lazy, fixed size', () => {
  for (const s of [HREF, IMG, 'alt="Nest on Nick Launches"', 'width="244"', 'height="56"', 'loading="lazy"', 'decoding="async"', 'target="_blank"', 'rel="noopener"']) assert.ok(NL_BADGE.includes(s), s);
  assert.match(fs.readFileSync('seo/render.js', 'utf8'), /footerAbout\)\}<\/p>\$\{NL_BADGE\}/);
});
test('SPA public footer has the badge; app shell does not', () => {
  const pl = fs.readFileSync('src/components/PublicLayout.jsx', 'utf8');
  for (const s of [HREF, IMG, 'width="244"', 'height="56"', 'loading="lazy"', 'decoding="async"']) assert.ok(pl.includes(s), s);
  const appFiles = fs.readdirSync('src/pages/app').map((f) => fs.readFileSync(`src/pages/app/${f}`, 'utf8'));
  assert.ok(appFiles.every((s) => !s.includes('nicklaunches')));
  assert.match(fs.readFileSync('src/styles.css', 'utf8'), /\.footer-badge img \{[^}]*max-width: 100%; height: auto;/);
});
