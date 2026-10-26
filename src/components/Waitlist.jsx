// Waitlist for the paid plans (Starter / Pro). Payments are NOT live — this only collects an email,
// the plan and an optional note through POST /api/waitlist. No payment code anywhere.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Field, Modal } from './ui.jsx';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { PLANS } from '../lib/plans.js';

const KEY = 'nest.waitlist';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const readJoined = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const markJoined = (plan, email) => {
  const j = readJoined(); j[plan] = email; localStorage.setItem(KEY, JSON.stringify(j));
  window.dispatchEvent(new Event('nest:waitlist'));
};
export function useJoined(plan) {
  const [v, setV] = useState(() => readJoined()[plan] || '');
  useEffect(() => {
    const f = () => setV(readJoined()[plan] || '');
    window.addEventListener('nest:waitlist', f); return () => window.removeEventListener('nest:waitlist', f);
  }, [plan]);
  return v;
}

export function WaitlistButton({ plan, billing = 'monthly', variant = 'outline', size, source = 'pricing' }) {
  const { t } = useI18n();
  const joined = useJoined(plan);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={joined ? 'secondary' : variant} size={size} icon={joined ? 'check' : undefined} onClick={() => setOpen(true)}>
        {joined ? t('waitlist.joined') : t('waitlist.join')}
      </Button>
      <WaitlistModal open={open} onClose={() => setOpen(false)} plan={plan} billing={billing} source={source} />
    </>
  );
}

export function WaitlistModal({ open, onClose, plan: initialPlan, billing: initialBilling = 'monthly', source }) {
  const { t, lang } = useI18n();
  const s = useSession();
  const { be } = useBe();
  const [plan, setPlan] = useState(initialPlan || 'starter');
  const [billing, setBilling] = useState(initialBilling);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(null);
  const userEmail = s?.user?.email || '';
  useEffect(() => {
    if (!open) return;
    setPlan(initialPlan || 'starter'); setBilling(initialBilling === 'yearly' ? 'yearly' : 'monthly'); setErr(''); setDone(null); setNote('');
    setEmail((e) => e || userEmail);
  }, [open, initialPlan, initialBilling, userEmail]);
  const planName = t(`pricing.names.${plan}`);

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!EMAIL_RE.test(em) || em.length > 254) { setErr(t('waitlist.badEmail')); return; }
    setBusy(true); setErr('');
    try {
      let token = null;
      if (s?.user) { try { token = await be.getIdToken(); } catch { token = null; } }
      const r = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: em, plan, billing, note: note.trim().slice(0, 500), lang, source }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { markJoined(plan, em); setDone({ already: !!j.already, email: em }); }
      else if (r.status === 429) setErr(t('waitlist.rate'));
      else if (j.error === 'bad_email') setErr(t('waitlist.badEmail'));
      else setErr(t('waitlist.fail'));
    } catch { setErr(t('waitlist.fail')); }
    setBusy(false);
  };

  if (!open) return null;
  return createPortal(
    <Modal open={open} onClose={onClose} title={done ? t('waitlist.done') : t('waitlist.title', { plan: planName })}>
      {done ? (
        <div className="stack wl-done">
          <span className="wl-check"><Icon name="check" size={22} /></span>
          <p style={{ fontWeight: 700, margin: 0 }}>
            {done.already ? t('waitlist.already', { plan: planName }) : t('waitlist.doneSub', { plan: planName, email: done.email })}
          </p>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <p className="muted small" style={{ fontWeight: 700, margin: 0 }}>{t('waitlist.sub')}</p>
          <div className="field">
            <span className="field-label">{t('waitlist.plan')}</span>
            <div className="segment wl-seg" role="radiogroup">
              {['starter', 'pro'].map((id) => (
                <button type="button" key={id} role="radio" aria-checked={plan === id} className={plan === id ? 'on' : ''} onClick={() => setPlan(id)}>{t(`pricing.names.${id}`)}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">{t('pricing.billing')}</span>
            <div className="segment wl-seg" role="radiogroup">
              {['monthly', 'yearly'].map((b) => (
                <button type="button" key={b} role="radio" aria-checked={billing === b} className={billing === b ? 'on' : ''} onClick={() => setBilling(b)}>
                  {t(`pricing.${b}`)} · HK${b === 'yearly' ? PLANS[plan].yearly : PLANS[plan].monthly}{t(b === 'yearly' ? 'pricing.perYear' : 'pricing.perMonth')}
                </button>
              ))}
            </div>
          </div>
          <Field label={t('waitlist.email')}>
            <input className="input" type="email" autoComplete="email" inputMode="email" required maxLength={254}
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label={t('waitlist.note')}>
            <textarea className="textarea" rows={3} maxLength={500} style={{ minHeight: 88 }}
              value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('waitlist.notePh')} />
          </Field>
          {err && <p className="wl-err" role="alert">{err}</p>}
          <Button type="submit" loading={busy}>{t('waitlist.submit')}</Button>
          <small className="muted" style={{ fontWeight: 600 }}>{t('waitlist.privacy')}</small>
        </form>
      )}
    </Modal>,
    document.body,
  );
}
