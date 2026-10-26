// Shown instead of the signed-in app when this deployment has no Firebase project configured
// (VITE_FIREBASE_* missing at build time). The public landing pages still render.
import { missingFirebaseVars } from '../firebase-config.js';

export default function NotConfigured() {
  const missing = missingFirebaseVars();
  const box = { maxWidth: 560, margin: '12vh auto', padding: '28px 24px', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: 1.55, color: 'var(--ink, #0a0a0a)' };
  const code = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, background: 'var(--soft, #f2f2f2)', padding: '2px 6px', borderRadius: 6 };
  return (
    <main role="main" style={box} data-testid="firebase-not-configured">
      <h1 style={{ fontSize: 24, margin: '0 0 12px' }}>Firebase not configured</h1>
      <p>This copy of Nest was built without a Firebase project, so sign-in and the app are turned off.</p>
      <p>Create your own Firebase project, copy <span style={code}>.env.example</span> to <span style={code}>.env</span> (or set the
        variables in your hosting provider), fill in the values and rebuild. See the README for the full self-hosting guide.</p>
      {missing.length > 0 && (
        <p>Missing: {missing.map((k, i) => <span key={k}>{i ? ', ' : ''}<span style={code}>{k}</span></span>)}</p>
      )}
      <p><a href="/" style={{ color: 'inherit' }}>← Back to the home page</a></p>
    </main>
  );
}
