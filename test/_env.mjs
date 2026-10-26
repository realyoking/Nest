// Test configuration: imported first by every test file so modules that read the environment at load time
// (src/env.js, src/site.js, src/firebase-config.js, api/_ops-lib.js …) see stable, fake values.
// None of these are real credentials. VITE_SITE_URL is the upstream site because the SEO/redirect tests check it.
const DEFAULTS = {
  VITE_SITE_URL: 'https://nesty.cyou',
  VITE_FIREBASE_API_KEY: 'test-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'nest-test-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'nest-test-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'nest-test-project.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000',
  VITE_GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
  VITE_CONTACT_EMAIL: 'hello@nest.example',
  VITE_ADMIN_EMAILS: 'admin@nest.example',
  NEST_ADMIN_EMAILS: 'admin@nest.example',
  NEST_OFFICIAL_UID: 'officialUid0000000000000001',
  NEST_TEST_FAMILY_ID: 'testFamily000000001',
  VITE_GOOGLE_SITE_VERIFICATION: 'testGscToken1,testGscToken2',
  VITE_INDEXNOW_KEY: '0123456789abcdef0123456789abcdef',
};
for (const [k, v] of Object.entries(DEFAULTS)) process.env[k] = v;
delete process.env.VITE_TEST_EMAIL_DOMAINS; // tests use the default reserved domain (nest-test.invalid)
