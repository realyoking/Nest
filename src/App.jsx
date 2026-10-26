import { INTL, SEG } from './lib/langs.js';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { registerServiceWorker } from './lib/push.js';
import { useSession } from './lib/session.jsx';
import { AppMark } from './brand.jsx';
import { completeRedirect, watchSignInElsewhere } from './lib/backend.js';
import AuthHandoff from './components/AuthHandoff.jsx';
import NotConfigured from './components/NotConfigured.jsx';
import { isFirebaseConfigured } from './firebase-config.js';
import { consumeOAuthReturn, oauthErrorKey } from './lib/google.js';
import { useI18n } from './lib/i18n.jsx';
import { useToast } from './components/ui.jsx';
import Landing from './pages/public/Landing.jsx';
import Pricing from './pages/public/Pricing.jsx';
import { Terms, Privacy } from './pages/public/Legal.jsx';
import Auth from './pages/public/Auth.jsx';
import Join from './pages/public/Join.jsx';
import Onboarding from './pages/Onboarding.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import { needsVerify } from './lib/email-verify-core.js';
import AppShell from './components/AppShell.jsx';
import Home from './pages/app/Home.jsx';
import Agent from './pages/app/Agent.jsx';
import Tutor from './pages/app/Tutor.jsx';
import Quiz from './pages/app/Quiz.jsx';
import Memory from './pages/app/Memory.jsx';
import NestieMemory from './pages/app/NestieMemory.jsx';
import Files from './pages/app/Files.jsx';
const Scanner = lazy(() => import('./pages/app/Scanner.jsx')); // Run 24: on-device scanner (lazy chunk)
import Reminders from './pages/app/Reminders.jsx';
import Family from './pages/app/Family.jsx';
import Connections from './pages/app/Connections.jsx';
import Usage from './pages/app/Usage.jsx';
import Settings from './pages/app/Settings.jsx';
import Changelog from './pages/app/Changelog.jsx';
import Calendar from './pages/app/Calendar.jsx';
import Subscriptions from './pages/app/Subscriptions.jsx';
import Transport from './pages/app/Transport.jsx';
import More from './pages/app/More.jsx';
import Beta from './pages/public/Beta.jsx';
import Admin from './pages/admin/Admin.jsx';
import { PromoClaimer } from './components/Promo.jsx';
import { PluginProvider } from './lib/plugins/runtime.jsx';
import PluginStore, { PluginDetail, CreatorPage } from './pages/app/PluginStore.jsx';
import PluginStudio from './pages/app/PluginStudio.jsx';
import ProfileEdit from './pages/app/ProfileEdit.jsx';
import { PluginTabPage } from './components/PluginSettings.jsx';

export const Splash = () => <div className="splash"><AppMark size={48} /></div>;

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function RequireApp({ children }) {
  const s = useSession();
  const loc = useLocation();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'out') return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (needsVerify(s.user)) return <VerifyEmail user={s.user} />; // Run 18: new email/password sign-ups confirm their address first
  if (s.status === 'onboarding') return <Navigate to="/onboarding" replace />;
  return children;
}
function RequireOnboarding({ children }) {
  const s = useSession();
  if (s.status === 'loading') return <Splash />;
  if (s.status === 'out') return <Navigate to="/auth" replace />;
  if (needsVerify(s.user)) return <VerifyEmail user={s.user} />;
  return children;
}

// Finishes a Google connector OAuth that came back by full-page redirect (iOS / installed app).
function OAuthReturn() {
  const s = useSession();
  const { t } = useI18n();
  const toast = useToast();
  // Re-check when the app comes back to the foreground (iOS home-screen app returning from the Safari sheet).
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const f = () => { if (document.visibilityState !== 'hidden' && localStorage.getItem('nest.oauth.result')) setNonce((n) => n + 1); };
    document.addEventListener('visibilitychange', f); window.addEventListener('focus', f); window.addEventListener('pageshow', f);
    return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('focus', f); window.removeEventListener('pageshow', f); };
  }, []);
  useEffect(() => {
    if (!s.user || !s.profile || !localStorage.getItem('nest.oauth.result')) return;
    consumeOAuthReturn(s.profile, s.user.uid).then((r) => {
      if (!r) return;
      toast(t('connections.accountAdded', { email: r.acct.email }));
      window.dispatchEvent(new Event('nest:oauth-done'));
    }).catch((e) => { const k = oauthErrorKey(e); if (k !== 'cancelled') toast(t(`connections.oauthErr.${k}`), 'err'); });
  }, [s.user, s.profile, nonce]);
  return null;
}

// Forks / self-hosts without VITE_FIREBASE_* set: public pages render, everything that needs Firebase shows a setup screen.
const FIREBASE_MISSING = !isFirebaseConfigured && import.meta.env.MODE !== 'mock';
const NEEDS_FIREBASE = /^\/(app|auth|admin|join|onboarding|beta)(\/|$)/;

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => { watchSignInElsewhere(); }, []);
  useEffect(() => { completeRedirect().catch((e) => { sessionStorage.setItem('nest.authErr', e?.code || 'unknown'); window.dispatchEvent(new Event('nest:auth-error')); }); }, []);
  useEffect(() => { registerServiceWorker(navigate); }, []);
  if (FIREBASE_MISSING && NEEDS_FIREBASE.test(pathname)) return <NotConfigured />;
  return (
    <>
      <ScrollTop />
      <OAuthReturn />
      <PromoClaimer />
      <AuthHandoff />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/en" element={<Landing />} />
        <Route path="/zh-hant" element={<Landing />} />
        <Route path="/zh-hans" element={<Landing />} />
        {INTL.map((l) => <Route key={l} path={`/${SEG[l]}`} element={<Landing />} />)}
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/beta" element={<Beta />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/join/:token" element={<Join />} />
        <Route path="/join" element={<Join />} />
        <Route path="/onboarding" element={<RequireOnboarding><Onboarding /></RequireOnboarding>} />
        <Route path="/app" element={<RequireApp><PluginProvider><AppShell /></PluginProvider></RequireApp>}>
          <Route index element={<Home />} />
          <Route path="agent" element={<Agent />} />
          <Route path="agent/:cid" element={<Agent />} />
          <Route path="tutor" element={<Tutor />} />
          <Route path="quiz" element={<Quiz />} />
          <Route path="memory" element={<Memory />} />
          <Route path="reminders" element={<Reminders />} />
          <Route path="family" element={<Family />} />
          <Route path="connections" element={<Connections />} />
          <Route path="usage" element={<Usage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/memory" element={<NestieMemory />} />
          <Route path="files" element={<Files />} />
          <Route path="files/scan" element={<Suspense fallback={<div className="sc-page" aria-busy="true" />}><Scanner /></Suspense>} />
          <Route path="changelog" element={<Changelog />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="more" element={<More />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="transport" element={<Transport />} />
          <Route path="store" element={<PluginStore />} />
          <Route path="store/p/:id" element={<PluginDetail />} />
          <Route path="store/c/:handle" element={<CreatorPage />} />
          <Route path="u/:handle" element={<CreatorPage />} />
          <Route path="profile" element={<ProfileEdit />} />
          <Route path="studio" element={<PluginStudio />} />
          <Route path="studio/p/:prj" element={<PluginStudio />} />
          <Route path="studio/:id" element={<PluginStudio />} />
          <Route path="p/:pid" element={<PluginTabPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
