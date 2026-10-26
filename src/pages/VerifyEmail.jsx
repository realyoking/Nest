// Run 18 — "Check your email" gate for NEW email/password sign-ups (src/lib/email-verify-core.js needsVerify).
// Six digit boxes (numeric keyboard on iOS, one-time-code autofill, paste anywhere, auto-advance, backspace goes back).
// Every entered digit slides up out of a blur (same feel as the landing headline). Wrong code → shake + clear.
// Correct code → the tiles flip away, a check mark draws in, then the whole screen scales + blur-fades into the app.
// prefers-reduced-motion → no movement, just the check for a moment. Server: api/_email.js (Resend), fallback = Firebase link.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '../brand.jsx';
import { Button, LangSwitch } from '../components/ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import * as be from '../lib/backend.js';
import { sendCode, checkCode, finishVerified, recheckVerified } from '../lib/email-verify.js';
import { maskEmail, cleanCode } from '../lib/email-verify-core.js';

const N = 6;
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sentKey = (uid) => `nest.vf.sent.${uid}`;

export default function VerifyEmail({ user }) {
  const { t, uiLang } = useI18n();
  const navigate = useNavigate();
  const [digits, setDigits] = useState(() => Array(N).fill(''));
  const [gen, setGen] = useState(0); // bumps on clear so the digit animation replays
  const [phase, setPhase] = useState('idle'); // idle | checking | wrong | success | exit
  const [msg, setMsg] = useState(null); // { kind: 'err'|'ok', text }
  const [cool, setCool] = useState(0);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('code'); // code | fallback (Firebase link email)
  const [to, setTo] = useState(maskEmail(user?.email || ''));
  const refs = useRef([]);
  const busy = phase === 'checking' || phase === 'success' || phase === 'exit';

  const errText = (r) => {
    const k = r?.error || 'generic';
    if (k === 'wrong_code') return t('vf.err.wrong_code', { n: r.left ?? 0 });
    if (k === 'cooldown') return t('vf.err.cooldown', { s: r.retryAfter ?? 60 });
    return t(`vf.err.${k}`) === `vf.err.${k}` ? t('vf.err.generic') : t(`vf.err.${k}`);
  };

  const send = useCallback(async (manual) => {
    setSending(true); if (manual) setMsg(null);
    const r = await sendCode(uiLang);
    setSending(false);
    if (r.verified) { await finishVerified(); return; }
    if (r.fallback) { setMode('fallback'); setCool(60); return; }
    if (r.ok) {
      if (r.to) setTo(r.to);
      setCool(r.cooldown || 60);
      try { sessionStorage.setItem(sentKey(user.uid), String(Date.now())); } catch {}
      if (manual) setMsg({ kind: 'ok', text: t('vf.sent') });
      return;
    }
    if (r.error === 'cooldown') setCool(r.retryAfter || 60);
    if (r.error === 'cooldown' && !manual) return; // a code from a moment ago is still valid
    setMsg({ kind: 'err', text: errText(r) });
  }, [uiLang, user?.uid]);

  // First visit: send once (not again on a reload within 10 minutes — the earlier code is still valid).
  useEffect(() => {
    let last = 0; try { last = Number(sessionStorage.getItem(sentKey(user.uid))) || 0; } catch {}
    if (Date.now() - last > 9.5 * 60e3) send(false); else setCool(Math.max(0, 60 - Math.round((Date.now() - last) / 1000)));
    setTimeout(() => refs.current[0]?.focus(), 80);
  }, []);
  useEffect(() => { if (cool <= 0) return undefined; const id = setTimeout(() => setCool((c) => c - 1), 1000); return () => clearTimeout(id); }, [cool]);

  const clear = () => { setDigits(Array(N).fill('')); setGen((g) => g + 1); setTimeout(() => refs.current[0]?.focus(), 30); };

  const submit = async (code) => {
    setPhase('checking'); setMsg(null);
    const r = await checkCode(code);
    if (r.ok || r.verified) {
      setPhase('success');
      const rm = reduced();
      setTimeout(() => setPhase('exit'), rm ? 500 : 1350);
      setTimeout(() => finishVerified(), rm ? 700 : 1800);
      return;
    }
    setMsg({ kind: 'err', text: errText(r) });
    setPhase('wrong');
    setTimeout(() => { setPhase('idle'); clear(); }, reduced() ? 50 : 520);
  };

  const fill = (start, text) => {
    const ds = cleanCode(text).split('');
    if (!ds.length) return;
    const next = [...digits];
    let i = start;
    for (const d of ds) { if (i >= N) break; next[i++] = d; }
    setDigits(next);
    if (next.every(Boolean)) { refs.current[N - 1]?.blur(); submit(next.join('')); } else refs.current[Math.min(i, N - 1)]?.focus();
  };
  const onChange = (i, e) => {
    if (busy) return;
    const v = e.target.value;
    if (!v) { const next = [...digits]; next[i] = ''; setDigits(next); return; }
    fill(i, v.length > 1 && digits[i] && v.startsWith(digits[i]) ? v.slice(digits[i].length) : v);
  };
  const onKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); const next = [...digits]; next[i - 1] = ''; setDigits(next); refs.current[i - 1]?.focus(); }
    else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < N - 1) refs.current[i + 1]?.focus();
  };
  const onPaste = (i, e) => { e.preventDefault(); if (!busy) fill(digits.every(Boolean) ? 0 : i, e.clipboardData?.getData('text') || ''); };

  const changeEmail = async () => { if (!window.confirm(t('vf.changeConfirm'))) return; await be.signOut(); navigate('/auth?mode=up', { replace: true }); };
  const signOut = async () => { await be.signOut(); navigate('/auth', { replace: true }); };
  const iDid = async () => { setSending(true); const ok = await recheckVerified(); setSending(false); if (!ok) setMsg({ kind: 'err', text: t('vf.notYet') }); };

  return (
    <div className={`vf-screen${phase === 'exit' ? ' vf-exit' : ''}`} data-testid="verify-email" data-phase={phase}>
      <div className="vf-top"><BrandLogo lang={uiLang === 'en' ? 'en' : 'zh-Hant'} /><LangSwitch /></div>
      <main className="vf-card">
        <h1 className="vf-title">{phase === 'success' || phase === 'exit' ? t('vf.ok') : t('vf.title')}</h1>
        <p className="vf-sub">{mode === 'fallback' ? t('vf.subFallback', { email: to }) : t(sending && !cool ? 'vf.subSending' : 'vf.sub', { email: to })}</p>
        {mode === 'code' ? (
          <>
            <div className={`vf-tiles${phase === 'wrong' ? ' vf-shake' : ''}${phase === 'success' || phase === 'exit' ? ' vf-done' : ''}${phase === 'checking' ? ' vf-busy' : ''}`}
              role="group" aria-label={t('vf.label')}>
              {digits.map((d, i) => (
                <div key={i} className={`vf-tile${d ? ' on' : ''}`} style={{ '--i': i }}>
                  <input ref={(el) => { refs.current[i] = el; }} className="vf-in" value={d} onChange={(e) => onChange(i, e)} onKeyDown={(e) => onKey(i, e)} onPaste={(e) => onPaste(i, e)}
                    onFocus={(e) => e.target.select()} inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? N : 1}
                    aria-label={t('vf.digit', { n: i + 1 })} disabled={busy} data-testid={`vf-digit-${i}`} />
                  {d && <span key={`${gen}-${i}-${d}`} className="vf-d" aria-hidden="true">{d}</span>}
                </div>
              ))}
              <div className="vf-check" aria-hidden="true">
                <svg viewBox="0 0 52 52" width="64" height="64"><circle cx="26" cy="26" r="25" /><path d="M15 27.5l7.2 7.2L37.5 19" /></svg>
              </div>
            </div>
            <p className={`vf-msg${msg?.kind === 'err' ? ' err' : ''}`} role={msg?.kind === 'err' ? 'alert' : 'status'} aria-live="polite">
              {phase === 'checking' ? t('vf.checking') : msg?.text || '\u00a0'}
            </p>
            <Button variant="outline" className="btn-block vf-resend" disabled={cool > 0 || sending || busy} loading={sending} onClick={() => send(true)} data-testid="vf-resend">
              {cool > 0 ? t('vf.resendIn', { s: cool }) : t('vf.resend')}
            </Button>
            <p className="vf-hint">{t('vf.hint')}</p>
          </>
        ) : (
          <>
            <p className={`vf-msg${msg?.kind === 'err' ? ' err' : ''}`} role="status" aria-live="polite">{msg?.text || '\u00a0'}</p>
            <Button className="btn-block" loading={sending} onClick={iDid}>{t('vf.iDid')}</Button>
            <Button variant="outline" className="btn-block vf-resend" disabled={cool > 0 || sending} onClick={() => send(true)}>{cool > 0 ? t('vf.resendIn', { s: cool }) : t('vf.resend')}</Button>
          </>
        )}
        <div className="vf-links"><button type="button" onClick={changeEmail} data-testid="vf-change">{t('vf.change')}</button><span aria-hidden="true">·</span><button type="button" onClick={signOut}>{t('vf.signOut')}</button></div>
      </main>
    </div>
  );
}
