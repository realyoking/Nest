import { TEST_DOMAIN_SRC } from './test-domains.js';
// Run 18 — email verification by 6-digit code (pure helpers shared by the client gate and api/_email.js).
// Only email/password sign-ups made AFTER the cutoff must verify. Google / Apple sign-ins (or accounts that also linked a
// social provider) skip; accounts created before the feature shipped are treated as verified (never locked out); the
// standing test accounts, system accounts and the official account are exempt.
export const VERIFY_CUTOFF = Date.parse('2026-10-20T10:45:00Z'); // 18:45 HKT 2026-10-20 — accounts created before Run 18 count as verified
export const CODE_TTL_MS = 10 * 60e3;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_MS = 60e3;
export const MAX_SENDS_PER_HOUR = 5;
export const EXEMPT_EMAIL_RE = new RegExp(`@(${TEST_DOMAIN_SRC}|system\\.heynest\\.invalid|waitlist\\.heynest\\.invalid|official\\.heynest\\.invalid)$`, 'i');

export function needsVerify(user) {
  if (!user || user.emailVerified) return false;
  const email = String(user.email || '').toLowerCase();
  if (!email || EXEMPT_EMAIL_RE.test(email)) return false;
  const providers = (user.providerData || []).map((p) => p && p.providerId).filter(Boolean);
  if (!providers.includes('password') || providers.some((p) => p !== 'password')) return false;
  const created = Number(user.metadata?.createdAt) || Date.parse(user.metadata?.creationTime || '') || 0;
  if (!created || created < VERIFY_CUTOFF) return false;
  return true;
}
// Six digits from a CSPRNG, uniform (rejection sampling, no modulo bias).
export function makeCode(rand = (n) => crypto.getRandomValues(new Uint32Array(n))) {
  const lim = 4294967296 - (4294967296 % 1000000);
  for (;;) { const [x] = rand(1); if (x < lim) return String(x % 1000000).padStart(6, '0'); }
}
export const cleanCode = (s) => String(s || '').replace(/\D/g, '').slice(0, 6);
// Constant-time compare of two hex strings of equal length.
export function sameHex(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length || !a.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const maskEmail = (e) => String(e || '').replace(/^(.)(.*)(.@)/, (_, a, m, b) => a + '•'.repeat(Math.min(6, Math.max(1, m.length))) + b);
