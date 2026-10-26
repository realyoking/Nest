// Family subscriptions: grouped by member, monthly total, purpose, last used, renewal + decider. Data via
// src/lib/subs-api.js (server-stored so the pre-renewal decision push can be scheduled). Never cancels anything.
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Empty, Field, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { listSubs, writeSub, onSubsChange } from '../../lib/subs-api.js';
import { CYCLES, currentRenewal, daysUntil, deciderOf, fmtMoney, groupByMember, monthlyCost, monthlyTotal, usageHint, yearlyTotal } from '../../lib/subs.js';

const EMPTY = { service: '', purpose: '', amount: '', cycle: 'monthly', renewDate: '', member: '', decider: '', cancelUrl: '', notes: '' };

export function useSubs() {
  const { be, demo } = useBe();
  const [subs, setSubs] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let live = true;
    const load = () => listSubs({ demo: demo || be.MOCK }).then((l) => { if (live) { setSubs(l); setErr(''); } }).catch((e) => { if (live) { setSubs((x) => x || []); setErr(e.code || 'error'); } });
    load();
    const off = onSubsChange(load);
    return () => { live = false; off(); };
  }, [demo, be.MOCK]);
  return { subs, err };
}

export function renewText(t, sub, fmtDate) {
  const r = currentRenewal(sub);
  if (!r) return t('subs.noRenew');
  const n = daysUntil(r);
  if (n === 0) return t('subs.renewsToday');
  if (n <= 14) return t('subs.renewsIn', { n });
  return t('subs.renewsOn', { date: fmtDate ? fmtDate(new Date(`${r}T12:00:00+08:00`), { month: 'short', day: 'numeric' }) : r });
}

export default function Subscriptions() {
  const { t, fmtDate } = useI18n();
  const { demo, be } = useBe();
  const s = useSession();
  const toast = useToast();
  const { subs, err } = useSubs();
  const [form, setForm] = useState(null); // { id?, f }
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState('');
  const members = s.members || [];
  const groups = useMemo(() => groupByMember(subs || [], members), [subs, members]);
  const name = (uid) => (uid ? s.memberName(uid) || '—' : t('subs.family'));
  const isDemo = demo || be.MOCK;

  const save = async (e) => {
    e?.preventDefault();
    const f = form.f;
    if (!f.service.trim()) return;
    setBusy('save');
    try { await writeSub(form.id ? 'update' : 'create', { id: form.id, sub: { ...f, amount: Number(f.amount) || 0 } }, { demo: isDemo }); toast(t('subs.saved')); setForm(null); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('del');
    try { await writeSub('delete', { id: del.id }, { demo: isDemo }); toast(t('subs.deleted')); setDel(null); setForm(null); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const used = async (x) => { try { await writeSub('used', { id: x.id }, { demo: isDemo }); toast(t('subs.usedToday')); } catch { toast(t('common.error'), 'err'); } };
  const set = (p) => setForm((x) => ({ ...x, f: { ...x.f, ...p } }));
  const total = monthlyTotal(subs || []);
  const defDecider = deciderOf({}, s.family || {}, members);

  return (
    <div className="subs-page">
      <PageHeader title={t('subs.title')} sub={t('subs.sub')} actions={<Button icon="plus" onClick={() => setForm({ f: { ...EMPTY } })}>{t('subs.add')}</Button>} />
      <div className="card subs-total">
        <div>
          <span className="subs-total-l">{t('subs.monthly')}</span>
          <b className="subs-total-v">{fmtMoney(total)}</b>
        </div>
        <span className="muted small">{t('subs.count', { n: (subs || []).length })} · {t('subs.yearly', { amt: fmtMoney(yearlyTotal(subs || [])) })}</span>
      </div>
      {subs === null && <p className="muted">{t('common.loading')}</p>}
      {subs && !subs.length && <Empty icon="receipt" text={err ? t('common.error') : t('subs.empty')} action={<Button icon="plus" onClick={() => setForm({ f: { ...EMPTY } })}>{t('subs.add')}</Button>} />}
      {groups.map((g) => (
        <section key={g.uid || 'fam'} className="ios-group subs-group">
          <h2 className="ios-group-h subs-gh"><span className="row" style={{ gap: 8 }}>{g.uid ? <Avatar name={name(g.uid)} src={s.photoOf?.(g.uid)} size={22} /> : <Icon name="users" size={16} />}{name(g.uid)}</span><span>{fmtMoney(g.monthly)}{t('subs.per.monthly')}</span></h2>
          <div className="ios-list">
            {g.subs.map((x) => {
              const r = currentRenewal(x); const n = daysUntil(r); const u = usageHint(x);
              return (
                <div key={x.id} className="sub-row">
                  <button type="button" className="sub-main" onClick={() => setForm({ id: x.id, f: { ...EMPTY, ...x, amount: x.amount ? String(x.amount) : '' } })}>
                    <span className="sub-ic"><Icon name="receipt" size={17} /></span>
                    <span className="sub-text">
                      <b>{x.service}</b>
                      <small>{[x.purpose, renewText(t, x, fmtDate)].filter(Boolean).join(' · ')}</small>
                      <small className={u.stale ? 'sub-stale' : ''}>{u.days == null ? t('subs.neverUsed') : u.days === 0 ? t('subs.usedToday') : t('subs.lastUsed', { n: u.days })}{u.stale ? ` · ${t('subs.stale')}` : ''}{x.decision?.renewal === r && r ? ` · ${t(`subs.decided.${x.decision.choice}`)}` : ''}</small>
                    </span>
                    <span className="sub-amt"><b>{fmtMoney(x.amount)}</b><small>{t(`subs.per.${x.cycle}`)}</small>{x.cycle !== 'monthly' && <small>{t('subs.approx', { amt: fmtMoney(monthlyCost(x)) })}</small>}</span>
                  </button>
                  <div className="sub-acts">
                    {u.days !== 0 && <Button size="sm" variant="ghost" icon="check" onClick={() => used(x)}>{t('subs.markUsed')}</Button>}
                    {x.cancelUrl && <Button size="sm" variant="ghost" icon="link" href={x.cancelUrl} target="_blank" rel="noreferrer">{t('subs.cancelPage')}</Button>}
                    {n != null && n <= 3 && n >= 0 && <span className="sub-soon">{n === 0 ? t('subs.renewsToday') : t('subs.renewsIn', { n })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? t('subs.edit') : t('subs.add')}
        footer={form ? (
          <div className="sheet-actions">
            {form.id && <Button type="button" variant="danger" onClick={() => setDel({ id: form.id, name: form.f.service })}>{t('subs.del')}</Button>}
            <Button type="submit" form="sub-form" loading={busy === 'save'} disabled={!form.f.service.trim()}>{t('calendar.save')}</Button>
          </div>
        ) : null}>
        {form && (
          <form id="sub-form" className="stack" onSubmit={save}>
            <Field label={t('subs.service')}><input className="input" value={form.f.service} onChange={(e) => set({ service: e.target.value })} placeholder={t('subs.servicePh')} maxLength={80} required /></Field>
            <Field label={t('subs.purpose')}><input className="input" value={form.f.purpose} onChange={(e) => set({ purpose: e.target.value })} placeholder={t('subs.purposePh')} maxLength={80} /></Field>
            <div className="cal-form-2">
              <Field label={t('subs.amount')}><input className="input" inputMode="decimal" value={form.f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0" /></Field>
              <Field label={t('subs.cycle')}><select className="select input" value={form.f.cycle} onChange={(e) => set({ cycle: e.target.value })}>{CYCLES.map((c) => <option key={c} value={c}>{t(`subs.cyc.${c}`)}</option>)}</select></Field>
            </div>
            <Field label={t('subs.renew')}><input className="input" type="date" value={form.f.renewDate} onChange={(e) => set({ renewDate: e.target.value })} /></Field>
            <div className="cal-form-2">
              <Field label={t('subs.member')}><select className="select input" value={form.f.member} onChange={(e) => set({ member: e.target.value })}><option value="">{t('subs.family')}</option>{members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}</select></Field>
              <Field label={t('subs.decider')} hint={t('subs.deciderHint')}><select className="select input" value={form.f.decider || ''} onChange={(e) => set({ decider: e.target.value })}><option value="">{`${name(defDecider)} (${t('common.default')})`}</option>{members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}</select></Field>
            </div>
            <Field label={t('subs.cancelUrl')}><input className="input" type="url" value={form.f.cancelUrl} onChange={(e) => set({ cancelUrl: e.target.value })} placeholder="https://" /></Field>
            <Field label={t('subs.notes')}><textarea className="textarea" rows={2} value={form.f.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} /></Field>
            <p className="fine" style={{ margin: 0 }}>{t('subd.never')}</p>
          </form>
        )}
      </Sheet>
      <Sheet open={!!del} onClose={() => setDel(null)} title={t('subs.del')}
        footer={<div className="sheet-actions"><Button variant="ghost" onClick={() => setDel(null)}>{t('calendar.cancel')}</Button><Button variant="danger" loading={busy === 'del'} onClick={remove}>{t('subs.del')}</Button></div>}>
        <p>{del && t('subs.delConfirm', { name: del.name })}</p>
      </Sheet>
    </div>
  );
}
