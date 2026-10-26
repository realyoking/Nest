import { useAppConfig } from '../../lib/appconfig.jsx';
import { pendingPromo, clearPromo, stashPromo } from '../../lib/promo.js';
import { useEffect, useState } from 'react';
import { takeSignedOutReason } from '../../lib/gate-errors.js';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BrandLogo, AUTH_PROVIDERS } from '../../brand.jsx';
import Icon from '../../components/Icon.jsx';
import { useRef } from 'react';
import { Button, Field, LangSwitch, BrandIcon } from '../../components/ui.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import * as be from '../../lib/backend.js';
import { resetPasswordEmail } from '../../lib/email-verify.js';

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.7 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

// Run 12 (advoo-style): left rounded card = auto-rotating carousel of REAL Nest screenshots (the landing's feature shots,
// public/shots/<k>-<en|zh>.png) with the feature headline + caption and dots. Reduced motion → no auto-rotate.
export const AUTH_SLIDES = ['tutor', 'memory', 'agent', 'parent'];
export function AuthCarousel({ interval = 5000 }) {
  const { t, lang } = useI18n();
  const [i, setI] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    const rm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rm) return undefined;
    const id = setInterval(() => { if (!paused.current && !document.hidden) setI((n) => (n + 1) % AUTH_SLIDES.length); }, interval);
    return () => clearInterval(id);
  }, [interval]);
  return (
    <aside className="auth-card" aria-roledescription="carousel" aria-label={t('auth.tourLabel')}
      onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <div className="auth-card-dots-bg" aria-hidden="true" />
      {AUTH_SLIDES.map((k, n) => {
        const [label, title, body] = t(`lp.feats.${k}`);
        return (
          <figure key={k} className={`auth-slide${n === i ? ' on' : ''}`} aria-hidden={n !== i} data-testid={n === i ? 'auth-slide-on' : undefined}>
            <div className="auth-shot"><img src={`/shots/${k}-${lang === 'en' ? 'en' : 'zh'}.png`} alt={t('lp.shotAlt', { name: label })} width="1535" height="1080" loading={n === 0 ? 'eager' : 'lazy'} decoding="async" /></div>
            <figcaption><span className="auth-slide-label">{label}</span><b>{title}</b><small>{body}</small></figcaption>
          </figure>
        );
      })}
      <div className="auth-dots" role="tablist">
        {AUTH_SLIDES.map((k, n) => <button key={k} type="button" role="tab" aria-selected={n === i} aria-label={t(`lp.feats.${k}`)[0]} className={n === i ? 'on' : ''} onClick={() => setI(n)} />)}
      </div>
    </aside>
  );
}

export default function Auth() {
  const { t, lang, uiLang } = useI18n();
  const ac = useAppConfig();
  const closed = ac.loaded && ac.signup?.open === false;
  const s = useSession();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'up' ? 'up' : 'in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  // Forced sign-out (admin 「登出所有裝置」 → session_revoked): say why once.
  const [why] = useState(() => takeSignedOutReason());
  const next = params.get('next');

  useEffect(() => {
    if (s.status === 'ready') { const beta = next === '/beta' || (!next && pendingPromo()); if (beta) clearPromo(); nav(beta ? '/beta' : next && next.startsWith('/') && !next.startsWith('//') ? next : '/app', { replace: true }); }
    else if (s.status === 'onboarding') { if (next === '/beta') stashPromo(); nav(next && next.startsWith('/join') ? next : '/onboarding', { replace: true }); }
  }, [s.status]);

  const fail = (e) => setErr(t(`auth.errors.${e.code}`) !== `auth.errors.${e.code}` ? t(`auth.errors.${e.code}`) : t('auth.errors.generic'));
  // A Google/Apple sign-in that came back by redirect (iPhone / installed app) and failed.
  useEffect(() => {
    const show = () => { const c = sessionStorage.getItem('nest.authErr'); if (c) { sessionStorage.removeItem('nest.authErr'); if (c !== 'auth/redirect-cancelled-by-user') fail({ code: c }); } };
    show(); window.addEventListener('nest:auth-error', show); return () => window.removeEventListener('nest:auth-error', show);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (key, fn) => {
    setErr(''); setMsg(''); setBusy(key);
    try { await fn(); } catch (e) { if (e.code !== 'auth/cancelled-popup-request') fail(e); } finally { setBusy(''); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (mode === 'reset') return run('email', async () => { await resetPasswordEmail(email, uiLang); setMsg(t('auth.resetSent')); }); // Run 18: branded Resend email, Firebase fallback
    if (mode === 'up') { if (closed) { setMsg(t('acfg.signupClosed')); return; } return run('email', () => be.signUpEmail(email, pw, name)); }
    return run('email', () => be.signInEmail(email, pw));
  };
  const title = mode === 'up' ? t('auth.titleUp') : mode === 'reset' ? t('auth.titleReset') : t('auth.titleIn');

  return (
    <div className="auth-page auth2">
      <AuthCarousel />
      <main className="auth-main">
        <div className="auth-top">
          <Link to="/"><BrandLogo size={22} lang={lang} /></Link>
          <LangSwitch />
        </div>
        <div className="auth-box route-in" key={mode}>
          <h1 data-testid="auth-title">{title}</h1>
          <p className="auth-sub">
            {mode === 'in' && <>{t('auth.noAccount')} <button type="button" onClick={() => setMode('up')}>{t('auth.signUpLink')}</button></>}
            {mode === 'up' && <>{t('auth.haveAccount')} <button type="button" onClick={() => setMode('in')}>{t('auth.signInLink')}</button></>}
            {mode === 'reset' && t('auth.resetHint')}
          </p>
          {mode !== 'reset' && (
            <div className="auth-form">
              {AUTH_PROVIDERS.google && (
                <Button variant="provider" className="btn-provider btn-block" loading={busy === 'google'} onClick={() => run('google', be.signInGoogle)}>
                  {busy !== 'google' && <GoogleG />}{t('auth.google')}
                </Button>
              )}
              {AUTH_PROVIDERS.apple && (
                <Button variant="apple" className="btn-apple btn-block" loading={busy === 'apple'} onClick={() => run('apple', be.signInApple)}>
                  {busy !== 'apple' && <span style={{ color: '#fff' }}><BrandIcon id="applecalendar" size={18} mono /></span>}{t('auth.apple')}
                </Button>
              )}
              <div className="divider">{t('common.or')}</div>
            </div>
          )}
          {why && <div className="notice" role="status" data-testid="signed-out-why">{t(`acfg.gate.${why}`)}</div>}
          {mode === 'up' && closed && <div className="notice" role="status" data-testid="signup-closed">{t('acfg.signupClosed')}</div>}
          <form className="auth-form" onSubmit={submit}>
            {mode === 'up' && (
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required placeholder={t('auth.name')} aria-label={t('auth.name')} />
            )}
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder={t('auth.email')} aria-label={t('auth.email')} />
            {mode !== 'reset' && (
              <div className="pw-wrap">
                <input className="input" type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={6} required placeholder={t('auth.password')} aria-label={t('auth.password')} />
                <button type="button" className="pw-eye" onClick={() => setShowPw((v) => !v)} aria-label={t(showPw ? 'auth.hidePw' : 'auth.showPw')} aria-pressed={showPw}><Icon name={showPw ? 'eyeOff' : 'eye'} size={16} /></button>
              </div>
            )}
            {mode === 'in' && <div className="auth-forgot"><button type="button" onClick={() => setMode('reset')}>{t('auth.forgot')}</button></div>}
            {err && <div className="error-text" role="alert">{err}</div>}
            {msg && <div className="ok-text">{msg}</div>}
            <Button type="submit" className="btn-block" loading={busy === 'email'}>
              {mode === 'up' ? t('auth.submitUp') : mode === 'reset' ? t('auth.submitReset') : t('auth.submitIn')}
            </Button>
            {mode === 'reset' && <div className="auth-forgot center"><button type="button" onClick={() => setMode('in')}>{t('auth.toIn')}</button></div>}
          </form>
          <p className="fine">
            {lang === 'en'
              ? <>By continuing you agree to the <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</>
              : <>繼續即表示你同意<Link to="/terms">《服務條款》</Link>及<Link to="/privacy">《私隱政策》</Link>。</>}
          </p>
        </div>
      </main>
    </div>
  );
}
