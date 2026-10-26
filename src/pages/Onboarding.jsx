import { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo, AppMark } from '../brand.jsx';
import { BlurText, Reveal } from '../components/Reveal.jsx';
import { Button, Field, LangSwitch, BrandIcon, useToast } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { PlanCards } from './public/Pricing.jsx';
import { addAccount, withAccount, oauthErrorKey } from '../lib/google.js';
import * as be from '../lib/backend.js';
import { pendingPromo, clearPromo } from '../lib/promo.js';
// After onboarding, a pending /beta visit returns there (to the claim button); nothing is claimed automatically.
const backToBeta = () => { const p = !!pendingPromo(); if (p) clearPromo(); return p; };

const TOTAL = 7;
const RegionPicker = lazy(() => import('../components/RegionPicker.jsx'));
import { setActiveRegion, normRegion } from '../lib/regions/index.js';
const GOOGLE = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];

export default function Onboarding() {
  const { t, lang } = useI18n();
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [choice, setChoice] = useState('create');
  const [famName, setFamName] = useState('');
  const [code, setCode] = useState('');
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('parent');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState(['gmail', 'googlecalendar']);
  const [region, setRegion] = useState(() => normRegion(s.profile?.region));
  useEffect(() => { if (!region && s.profile?.region) setRegion(normRegion(s.profile.region)); }, [s.profile?.region]); // eslint-disable-line react-hooks/exhaustive-deps
  // Required step: the region is saved to the owner-only profile (users/<uid>.region) before moving on.
  const saveRegion = async () => {
    if (!region) return;
    setBusy(true); setErr('');
    try { await be.saveProfile(s.user.uid, { region, regionAt: Date.now() }); setActiveRegion(region); next(); }
    catch (e) { setErr(`${t('region.saveFailed')}${e.code ? ` (${e.code})` : ''}`); } finally { setBusy(false); }
  };

  useEffect(() => { if (s.status === 'ready') nav(backToBeta() ? '/beta' : '/app', { replace: true }); }, [s.status]);
  useEffect(() => { if (s.family && step < 5) setStep(5); }, [!!s.family]);
  // Back from Google (full-page redirect on iPhone / installed app): the account is saved by OAuthReturn → next step.
  useEffect(() => {
    const f = () => setStep((n) => (n === 5 ? 6 : n));
    window.addEventListener('nest:oauth-done', f); return () => window.removeEventListener('nest:oauth-done', f);
  }, []);
  useEffect(() => { if (!name) setName(s.user?.displayName || ''); }, [s.user]);

  const next = () => { setErr(''); setStep((x) => x + 1); };
  const checkCode = async () => {
    setBusy(true); setErr('');
    try {
      const inv = await be.resolveInviteInput(code);
      if (!inv) { setErr(t('onboarding.invalidCode')); return; }
      setInvite(inv); setRole('student'); next();
    } catch { setErr(t('onboarding.invalidCode')); } finally { setBusy(false); }
  };
  const commit = async () => {
    setBusy(true); setErr('');
    try {
      if (choice === 'create') await be.createFamily({ name: famName.trim(), displayName: name.trim(), role });
      else await be.joinFamily(invite, { displayName: name.trim(), role });
      setStep(5);
    } catch (e) {
      setErr(e.code === 'permission-denied' && choice === 'join' ? t('onboarding.full') : `${t('common.error')}${e.code ? ` (${e.code})` : ''}`);
    } finally { setBusy(false); }
  };
  const connect = async () => {
    setBusy(true); setErr('');
    try {
      const { acct } = await addAccount({ ids: picked, select: picked, ret: '/onboarding' });
      const patch = withAccount(s.profile, acct, picked);
      await be.saveProfile(s.user.uid, { ...patch, connections: Object.fromEntries(GOOGLE.map((g) => [g, picked.includes(g)])) });
      toast(t('connections.connected'));
      next();
    } catch (e) { const k = oauthErrorKey(e); if (k !== 'cancelled') setErr(t(`connections.oauthErr.${k}`)); } finally { setBusy(false); }
  };
  const finish = async () => {
    setBusy(true);
    try { await be.saveProfile(s.user.uid, { onboarded: true, lang }); nav(backToBeta() ? '/beta' : '/app', { replace: true }); } finally { setBusy(false); }
  };

  return (
    <div className="ob">
      <div className="ob-top">
        <Link to="/"><BrandLogo lang={lang} /></Link>
        <div className="row"><LangSwitch compact /><Button variant="ghost" size="sm" onClick={() => be.signOut()}>{t('common.signOut')}</Button></div>
      </div>
      <div className="ob-bar"><span style={{ width: `${(step / TOTAL) * 100}%` }} /></div>
      <div className="ob-body" key={step}>
        <div className="ob-step route-in">{t('onboarding.step', { n: step, total: TOTAL })}</div>

        {step === 1 && (
          <>
            <Reveal style={{ marginBottom: 28 }}><AppMark size={72} /></Reveal>
            <BlurText as="h1" text={t('onboarding.welcomeTitle')} />
            <Reveal as="p" delay={200}>{t('onboarding.welcomeSub')}</Reveal>
            <div className="ob-actions"><Button size="lg" iconRight="arrowRight" onClick={next}>{t('common.start')}</Button></div>
          </>
        )}

        {step === 2 && (
          <>
            <BlurText as="h1" text={t('region.title')} />
            <Reveal as="p" delay={100}>{t('region.sub')}</Reveal>
            <div style={{ marginTop: 18 }} data-testid="ob-region">
              <Suspense fallback={<div className="globe" style={{ height: 320 }} />}><RegionPicker value={region} onChange={setRegion} /></Suspense>
              {err && <div className="error-text" style={{ marginTop: 12 }}>{err}</div>}
            </div>
            <div className="ob-actions">
              <Button variant="secondary" size="lg" onClick={() => setStep(1)}>{t('common.back')}</Button>
              <Button size="lg" disabled={!region} loading={busy} onClick={saveRegion} data-testid="region-continue">{region ? t('region.continue') : t('region.choose')}</Button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <BlurText as="h1" text={t('onboarding.choiceTitle')} />
            <Reveal delay={150} style={{ marginTop: 24 }}>
              {[['create', 'home'], ['join', 'link']].map(([k, icon]) => (
                <button key={k} className={`choice ${choice === k ? 'on' : ''}`} onClick={() => { setChoice(k); setErr(''); }}>
                  <span className="choice-icon"><Icon name={icon} /></span>
                  <span><b>{t(`onboarding.${k}`)}</b><small>{t(`onboarding.${k}Sub`)}</small></span>
                </button>
              ))}
              <div style={{ marginTop: 20 }}>
                {choice === 'create' ? (
                  <Field label={t('onboarding.familyName')}><input className="input" value={famName} onChange={(e) => setFamName(e.target.value)} placeholder={t('onboarding.familyNamePh')} maxLength={40} /></Field>
                ) : (
                  <Field label={t('onboarding.code')}><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('onboarding.codePh')} autoCapitalize="characters" /></Field>
                )}
              </div>
              {err && <div className="error-text" style={{ marginTop: 12 }}>{err}</div>}
            </Reveal>
            <div className="ob-actions">
              <Button variant="secondary" size="lg" onClick={() => setStep(2)}>{t('common.back')}</Button>
              {choice === 'create'
                ? <Button size="lg" disabled={!famName.trim()} onClick={next}>{t('common.next')}</Button>
                : <Button size="lg" disabled={!code.trim()} loading={busy} onClick={checkCode}>{t('common.next')}</Button>}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <BlurText as="h1" text={t('onboarding.roleTitle')} />
            {invite && <Reveal as="p" delay={100}>{t('onboarding.joiningAs', { name: invite.familyName })}</Reveal>}
            <Reveal className="stack" delay={150} style={{ marginTop: invite ? 0 : 24 }}>
              <div className="roles">
                {['parent', 'student'].map((r) => (
                  <button key={r} className={`choice ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>
                    <span className="choice-icon"><Icon name={r === 'student' ? 'book' : 'user'} /></span><b>{t(`common.${r}`)}</b>
                  </button>
                ))}
              </div>
              <Field label={t('onboarding.displayName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('onboarding.displayNamePh')} maxLength={30} /></Field>
              {err && <div className="error-text">{err}</div>}
            </Reveal>
            <div className="ob-actions">
              <Button variant="secondary" size="lg" onClick={() => setStep(3)}>{t('common.back')}</Button>
              <Button size="lg" disabled={!name.trim()} loading={busy} onClick={commit}>{t('common.next')}</Button>
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <BlurText as="h1" text={t('onboarding.connectTitle')} />
            <Reveal as="p" delay={100}>{t('onboarding.connectSub')}</Reveal>
            <Reveal delay={150}>
              {GOOGLE.map((g) => {
                const on = picked.includes(g);
                return (
                  <button key={g} className={`choice ${on ? 'on' : ''}`} onClick={() => setPicked((l) => on ? l.filter((x) => x !== g) : [...l, g])}>
                    <span className="choice-icon" style={{ background: '#fff', border: '1px solid #ebebeb' }}><BrandIcon id={g} size={24} /></span>
                    <span style={{ flex: 1 }}><b>{({ gmail: 'Gmail', googlecalendar: 'Google Calendar', googleclassroom: 'Google Classroom', googledrive: 'Google Drive' })[g]}</b><small>{t(`connections.desc.${g}`)}</small></span>
                    <span className={`toggle ${on ? 'on' : ''}`} />
                  </button>
                );
              })}
              <p className="fine">{t('connections.unverified')}</p>
              {err && <div className="error-text">{err}</div>}
            </Reveal>
            <div className="ob-actions">
              <Button variant="secondary" size="lg" onClick={next}>{t('onboarding.skip')}</Button>
              <Button size="lg" disabled={!picked.length} loading={busy} onClick={connect}>{t('connections.connect')}</Button>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <BlurText as="h1" text={t('onboarding.planTitle')} />
            <Reveal as="p" delay={100}>{t('onboarding.planSub')}</Reveal>
            <PlanCards current={null} onChoose={next} compact />
          </>
        )}

        {step === 7 && (
          <>
            <Reveal style={{ marginBottom: 28 }}><span className="feature-icon" style={{ width: 64, height: 64, borderRadius: 20 }}><Icon name="check" size={30} stroke={2.5} /></span></Reveal>
            <BlurText as="h1" text={t('onboarding.doneTitle')} />
            <Reveal as="p" delay={200}>{t('onboarding.doneSub')}</Reveal>
            <div className="ob-actions"><Button size="lg" iconRight="arrowRight" loading={busy} onClick={finish}>{t('onboarding.enter')}</Button></div>
          </>
        )}
      </div>
    </div>
  );
}
