import { useState } from 'react';
import PublicLayout from '../../components/PublicLayout.jsx';
import { BlurText, Reveal } from '../../components/Reveal.jsx';
import { Button } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { PLANS, PLAN_ORDER, perMonthOfYearly } from '../../lib/plans.js';
import { WaitlistButton } from '../../components/Waitlist.jsx';

// Monthly / Yearly switch (yearly = 17% off). Shared by /pricing, onboarding and the in-app Usage page.
export function BillingToggle({ value, onChange, style }) {
  const { t } = useI18n();
  return (
    <div className="segment billing-toggle" role="radiogroup" aria-label={t('pricing.billing')} style={style}>
      <button type="button" role="radio" aria-checked={value === 'monthly'} className={value === 'monthly' ? 'on' : ''} onClick={() => onChange('monthly')}>{t('pricing.monthly')}</button>
      <button type="button" role="radio" aria-checked={value === 'yearly'} className={value === 'yearly' ? 'on' : ''} onClick={() => onChange('yearly')}>{t('pricing.yearly')} <span className="pill dark" style={{ height: 22 }}>{t('pricing.save')}</span></button>
    </div>
  );
}
export function PlanPrice({ id, billing, small }) {
  const { t } = useI18n();
  const p = PLANS[id];
  const yearly = billing === 'yearly';
  const price = yearly ? p.yearly : p.monthly;
  return (
    <div className={small ? 'price price-sm' : 'price'}>
      <b>HK${price}</b><span>{yearly ? t('pricing.perYear') : t('pricing.perMonth')}</span>
      {yearly && p.monthly > 0 && <small className="price-eq">{t('pricing.approxMonth', { n: perMonthOfYearly(p.yearly) })} · <s>HK${p.monthly * 12}</s></small>}
    </div>
  );
}

export function PlanCards({ current, onChoose, compact }) {
  const { t } = useI18n();
  const [billing, setBilling] = useState('monthly');
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: compact ? 20 : 40 }}>
        <BillingToggle value={billing} onChange={setBilling} />
      </div>
      <div className="plans" style={compact ? { gridTemplateColumns: '1fr', paddingBottom: 0 } : null}>
        {PLAN_ORDER.map((id, i) => {
          const p = PLANS[id];
          const isCur = current === id;
          return (
            <Reveal className={`plan ${id === 'starter' ? 'featured' : ''}`} key={id} delay={i * 90}>
              {id === 'starter' && <span className="plan-tag">Popular</span>}
              <h3>{t(`pricing.names.${id}`)}</h3>
              <div className="plan-desc">{t(`pricing.desc.${id}`)}</div>
              <PlanPrice id={id} billing={billing} />
              <div className="plan-cap">
                <div className="plan-cap-top"><span>{t('pricing.capacityLabel')}</span><b>{t(`pricing.capacity.${id}`)}</b></div>
                <div className="plan-cap-bar"><span style={{ width: `${(p.capacity / 8) * 100}%` }} /></div>
                <small>{t('pricing.fine', { d: p.daily.toLocaleString(), w: p.weekly.toLocaleString() })}</small>
              </div>
              <ul>{t(`pricing.features.${id}`).map((f) => <li key={f}><Icon name="check" size={18} />{f}</li>)}</ul>
              {id === 'free' ? (
                isCur ? <Button variant="secondary" disabled>{t('pricing.current')}</Button>
                  : <Button {...(onChoose ? { onClick: () => onChoose('free') } : { to: '/auth?mode=up' })}>{t('pricing.free')}</Button>
              ) : (
                <WaitlistButton plan={id} billing={billing} variant={id === 'starter' ? 'primary' : 'outline'} source={onChoose ? 'onboarding' : 'pricing'} />
              )}
            </Reveal>
          );
        })}
      </div>
    </>
  );
}

export default function Pricing() {
  const { t } = useI18n();
  const s = useSession();
  return (
    <PublicLayout>
      <section className="wrap">
        <div className="pricing-top">
          <BlurText as="h1" text={t('pricing.title')} />
          <Reveal as="p" delay={200}>{t('pricing.sub')}</Reveal>
        </div>
        <PlanCards current={s.family?.plan} />
        <p className="note" style={{ paddingBottom: 8 }}>{t('pricing.usageNote')}</p>
        <p className="note"><Icon name="lock" size={16} />{t('pricing.early')}</p>
      </section>
    </PublicLayout>
  );
}
