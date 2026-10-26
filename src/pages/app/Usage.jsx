import { Avatar, Button, PageHeader, Progress, useToast } from '../../components/ui.jsx';
import { gateErrorText } from '../../lib/gate-errors.js';
import { redeemCode } from '../../lib/promo.js';
import { hkYmd } from '../../lib/plan-resolve.js';
import * as be from '../../lib/backend.js';
import { Reveal } from '../../components/Reveal.jsx';
import UsageMeter from '../../components/UsageMeter.jsx';
import { useState } from 'react';
import { WaitlistButton } from '../../components/Waitlist.jsx';
import { BillingToggle, PlanPrice } from '../public/Pricing.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { GiftBanner } from '../../components/Promo.jsx';
import { attachLimits } from '../../lib/attach-core.js';

// Promo code (Run 8b): codes made in the admin panel give the family Pro for N months (server: /api/promo/claim).
function RedeemCode() {
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault(); if (!code.trim()) return; setBusy(true);
    try { const r = await redeemCode(be.getIdToken, code); toast(t('acfg.code.ok', { date: r.until ? fmtDate(new Date(r.until), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) : hkYmd(r.until) })); setCode(''); s.refreshPlan?.(); }
    catch (err) { toast(gateErrorText(err, t) || (t(`acfg.code.err.${err.code}`) !== `acfg.code.err.${err.code}` ? t(`acfg.code.err.${err.code}`) : t('acfg.code.err.bad_code')), 'err'); } finally { setBusy(false); }
  };
  return (
    <form className="card" onSubmit={go} data-testid="redeem-code">
      <div className="card-head"><h2>{t('acfg.code.title')}</h2></div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input className="input" style={{ flex: '1 1 180px' }} value={code} maxLength={24} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('acfg.code.ph')} aria-label={t('acfg.code.title')} autoCapitalize="characters" />
        <Button type="submit" loading={busy} disabled={!code.trim()}>{t('acfg.code.go')}</Button>
      </div>
    </form>
  );
}

export default function Usage() {
  const { t, lang } = useI18n();
  const s = useSession();
  const total = s.usage.weekTotal;
  const per = s.usage.weekPerMember;
  const [billing, setBilling] = useState('monthly');
  const share = (n) => (total ? Math.round((n / total) * 100) : 0);
  return (
    <>
      <PageHeader title={t('usage.title')} sub={t('usage.sub')} />
      <GiftBanner />
      <div className="grid-2">
        <Reveal className="card">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="pill dark" data-testid="plan-pill">{s.planLabel(t).full}</span>
            <span className="muted small" style={{ fontWeight: 800 }}>{s.plan.capacity > 1 ? t('usage.capacity', { x: s.plan.capacity }) : t('usage.capacityFree')}</span>
          </div>
          <UsageMeter big />
          <p className="muted small" style={{ fontWeight: 700, margin: '18px 0 0' }}>{t('usage.explain')}</p>
          <p className="small" style={{ fontWeight: 800, margin: '10px 0 0' }} data-testid="att-today">{lang === 'en' ? `Attachments today: ${s.attToday || 0} / ${attachLimits(s.plan.id).daily} · up to ${attachLimits(s.plan.id).perMsg} per message` : `今天附件：${s.attToday || 0} / ${attachLimits(s.plan.id).daily} · 每則訊息最多 ${attachLimits(s.plan.id).perMsg} 個`}</p>
          <div style={{ marginTop: 20 }}><Button variant="outline" to="/pricing">{t('usage.upgrade')}</Button></div>
        </Reveal>
        <RedeemCode />
        {s.planKnown && s.plan.id === 'free' && (
          <Reveal className="card" delay={60}>
            <div className="card-head"><h2>{t('waitlist.card')}</h2></div>
            <p className="muted small" style={{ fontWeight: 700, marginTop: -6 }}>{t('waitlist.cardSub')}</p>
            <BillingToggle value={billing} onChange={setBilling} style={{ marginBottom: 6 }} />
            {['starter', 'pro'].map((id) => (
              <div className="list-row" key={id}>
                <div className="list-row-main">
                  <b>{t(`pricing.names.${id}`)}</b>
                  <PlanPrice id={id} billing={billing} small />
                  <div className="muted small" style={{ fontWeight: 700 }}>{t(`pricing.capacity.${id}`)} · {t(`pricing.desc.${id}`)}</div>
                </div>
                 <WaitlistButton plan={id} billing={billing} size="sm" variant={id === 'starter' ? 'primary' : 'outline'} source="app-usage" />
              </div>
            ))}
          </Reveal>
        )}
        <Reveal className="card" delay={80}>
          <div className="card-head"><h2>{t('usage.perMember')}</h2></div>
          <p className="muted small" style={{ fontWeight: 700, marginTop: -6 }}>{t('usage.perMemberSub')}</p>
          {s.members.map((m) => {
            const p = share(per[m.uid] || 0);
            return (
              <div className="list-row" key={m.uid}>
                <Avatar name={m.displayName} src={s.photoOf(m.uid)} size={32} />
                <div className="list-row-main">
                  <div className="row" style={{ justifyContent: 'space-between' }}><b>{m.displayName}</b><span className="small" style={{ fontWeight: 800 }}>{p}%</span></div>
                  <div style={{ marginTop: 6 }}><Progress value={p} max={100} calm /></div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </>
  );
}
