import { isTestDomainEmail } from '../../lib/test-domains.js';
import { useEffect, useState } from 'react';
import { gateErrorText } from '../../lib/gate-errors.js';
import PublicLayout from '../../components/PublicLayout.jsx';
import { BlurText, Reveal } from '../../components/Reveal.jsx';
import { Button, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { promoStatus, stashPromo, lastResult, clearPromo, claimBeta, saveResult } from '../../lib/promo.js';
import { useBe } from '../../lib/be-context.jsx';

// /beta (and ?promo=BETA): the first 10 families get Pro free for a month, whole family, no card.
export default function Beta() {
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const [st, setSt] = useState(null);
  const [res, setRes] = useState(lastResult);
  const [busy, setBusy] = useState(false);
  const { be } = useBe();
  // Visiting /beta never claims and never stores anything server-side: it only reads the public counter.
  useEffect(() => {
    let live = true;
    const load = () => promoStatus().then((d) => { if (live) setSt(d); }).catch(() => { if (live) setSt({ open: true, unknown: true }); });
    load();
    const f = (e) => { setRes(e.detail); load(); };
    window.addEventListener('nest:promo', f);
    return () => { live = false; window.removeEventListener('nest:promo', f); };
  }, []);

  const signedIn = s.status === 'ready' || s.status === 'onboarding';
  const full = st && st.open === false && res?.status !== 'claimed' && res?.status !== 'already';
  const until = (res?.until && new Date(res.until)) || s.gift?.until;
  const date = until ? fmtDate(until, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const mine = res?.status === 'claimed' || res?.status === 'already' || (s.gift?.source === 'beta');
  const testAcct = isTestDomainEmail(s.user?.email) || /@(system\.heynest\.invalid|official\.heynest\.invalid)$/i.test(s.user?.email || '');
  const ineligible = testAcct || res?.code === 'test_account_ineligible';
  useEffect(() => { if (s.status === 'ready') clearPromo(); }, [s.status]);
  const claim = async () => {
    if (busy) return; setBusy(true);
    try { const r = await claimBeta(be.getIdToken); saveResult(r); setRes(r); s.refreshPlan?.(); }
    catch (e) { const r = { status: 'error', code: e.code, ...(e.feature ? { feature: e.feature } : {}) }; saveResult(r); setRes(r); }
    finally { setBusy(false); }
  };
  const later = () => stashPromo(); // remember to come back here after sign-in / onboarding (no claim)

  return (
    <PublicLayout>
      <section className="wrap beta">
        <div className="beta-top">
          <Reveal><span className="pill dark beta-tag">{t('promo.tag')}</span></Reveal>
          <BlurText as="h1" text={full ? t('promo.fullTitle') : t('promo.title')} key={full ? 'f' : 'o'} />
          <Reveal as="p" delay={150}>{full ? t('promo.fullSub') : t('promo.sub')}</Reveal>

          {!full && (
            <Reveal delay={220} className="beta-slots" aria-live="polite">
              {st == null ? <Spinner small /> : st.remaining == null ? <span>{t('promo.slotsUnknown')}</span> : (
                <>
                  <div className="beta-dots" aria-hidden="true">{Array.from({ length: st.max || 10 }, (_, i) => <span key={i} className={i < (st.claimed || 0) ? 'on' : ''} />)}</div>
                  <b>{t('promo.slotsLeft', { n: st.remaining, max: st.max || 10 })}</b>
                </>
              )}
            </Reveal>
          )}

          <Reveal delay={280} className="beta-cta">
            {mine ? (
              <div className="beta-done">
                <Icon name="check" size={20} stroke={2.5} />
                <span>{res?.status === 'already' ? t('promo.already', { date }) : t('promo.claimed', { date })}</span>
              </div>
            ) : null}
            {res?.status === 'already_user' && <div className="beta-note">{t('promo.alreadyUser')}</div>}
            {res?.status === 'error' && <div className="beta-note">{res.code === 'test_account_ineligible' ? t('promo.testIneligible') : gateErrorText(res, t) || t('promo.error')}</div>}
            {res?.status === 'full' && <div className="beta-note">{t('promo.fullToast')}</div>}
            {s.status === 'ready' ? (
              mine ? <Button size="lg" to="/app" iconRight="arrowRight">{t('common.openApp')}</Button>
                : ineligible ? (<><div className="beta-note" data-testid="beta-ineligible">{t('promo.testIneligible')}</div><Button size="lg" variant="secondary" to="/app">{t('common.openApp')}</Button></>)
                  : full ? <Button size="lg" variant="secondary" to="/app">{t('common.openApp')}</Button>
                    : (<>
                      <Button size="lg" onClick={claim} disabled={busy || st == null} iconRight={busy ? undefined : 'arrowRight'} data-testid="beta-claim">{busy ? <Spinner small /> : t('promo.claimBtn')}</Button>
                      <Button size="lg" variant="secondary" to="/app">{t('promo.notNow')}</Button>
                    </>)
            ) : s.status === 'onboarding' ? (
              <Button size="lg" to="/onboarding" onClick={later} iconRight="arrowRight">{t('promo.finishSetup')}</Button>
            ) : (
              <>
                <Button size="lg" to="/auth?mode=up&next=/beta" onClick={later} iconRight="arrowRight">{full ? t('common.start') : t('promo.cta')}</Button>
                <Button size="lg" variant="secondary" to="/auth?next=/beta" onClick={later}>{t('promo.haveAccount')}</Button>
              </>
            )}
          </Reveal>
          {!full && <Reveal as="p" delay={340} className="beta-fine">{s.status === 'ready' && !mine ? t('promo.fineSignedIn') : t('promo.fine')}</Reveal>}
        </div>

        <div className="beta-points">
          {['family', 'card', 'revert'].map((k, i) => (
            <Reveal className="beta-point" key={k} delay={120 + i * 80}>
              <Icon name={k === 'family' ? 'users' : k === 'card' ? 'lock' : 'calendar'} size={20} />
              <div><b>{t(`promo.points.${k}.0`)}</b><small>{t(`promo.points.${k}.1`)}</small></div>
            </Reveal>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
}
