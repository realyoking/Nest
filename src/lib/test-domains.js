// Email domains of a deployment's own test accounts (VITE_TEST_EMAIL_DOMAINS, comma-separated; see .env.example).
// Accounts on these domains are tagged "test": exempt from email verification and the beta promo, excluded from
// admin stats and eligible for the admin test-data cleanup. The default is a reserved .invalid domain no real user has.
import { envList } from '../env.js';
export const TEST_EMAIL_DOMAINS = envList('VITE_TEST_EMAIL_DOMAINS').length ? envList('VITE_TEST_EMAIL_DOMAINS') : ['nest-test.invalid'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Regex source matching any of the test domains (no anchors), e.g. "a\.test|b\.test".
export const TEST_DOMAIN_SRC = TEST_EMAIL_DOMAINS.map(esc).join('|');
export const isTestDomainEmail = (e) => new RegExp(`@(${TEST_DOMAIN_SRC})$`, 'i').test(String(e || '').trim());
// Admin allowlist — server only (NEST_ADMIN_EMAILS). Never put admin addresses in a VITE_* variable: Vite inlines
// every VITE_* value into the public bundle. The client learns admin status from GET /api/admin/whoami.
export const adminEmails = () => envList('NEST_ADMIN_EMAILS');
