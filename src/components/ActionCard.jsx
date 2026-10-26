// One-tap action card for chat (local parse → instant preview, model may refine via ```nest-card```).
// Simple types complete in place (Confirm); complex ones (recurring / family events) open a prefilled form sheet.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Button, Field, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { cardWhen } from '../lib/intent.js';
import { fromLocalInput } from '../lib/dates.js';
import { writeEvent, NEST_CAL } from '../lib/calendar.js';
import { REPEATS, REMINDER_OPTIONS, reminderLabel } from '../lib/nestcal.js';

const ICON = { reminder: 'bell', event: 'calendar', task: 'check', memory: 'brain', shopping: 'receipt' };
export const TYPES = ['reminder', 'event', 'task', 'memory', 'shopping'];

// Runs a card. Returns a short result key for the toast.
export async function runCard(c, { be, s, t }) {
  const fid = s.family.id;
  if (c.type === 'memory') { await be.addMemory(fid, { text: c.title, tag: '' }); return 'memory'; }
  if (c.type === 'shopping') { await be.addReminder(fid, { title: `${t('intent.shopPrefix')}${c.title}`, dueAt: null, memberId: '' }); return 'shopping'; }
  if (c.type === 'task') { await be.addReminder(fid, { title: c.title, dueAt: c.date ? fromLocalInput(`${c.date}T${c.time || s.prefs.defaultReminderTime || '09:00'}`) : null, memberId: c.member || s.user.uid }); return 'task'; }
  if (c.type === 'reminder') { await be.addReminder(fid, { title: c.title, dueAt: c.date ? fromLocalInput(`${c.date}T${c.time || '09:00'}`) : null, memberId: c.member ?? s.user.uid }); return 'reminder'; }
  // event → native Nest family calendar
  const startMs = c.allDay || !c.time ? null : fromLocalInput(`${c.date}T${c.time}`).getTime();
  const fields = c.allDay || !c.time
    ? { title: c.title, allDay: true, start: c.date, end: '', location: c.location || '', notes: c.notes || '' }
    : { title: c.title, allDay: false, start: new Date(startMs).toISOString(), end: new Date(startMs + (Number(c.duration) || 60) * 60e3).toISOString(), location: c.location || '', notes: c.notes || '' };
  await writeEvent('create', { cal: NEST_CAL(), fields: { ...fields, repeat: c.repeat || 'none', until: c.until || '', members: c.member ? [c.member] : (c.members || []), reminders: c.reminders || [60] } });
  return 'event';
}

export default function ActionCard({ card, onDone, onDismiss, compact }) {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [c, setC] = useState(card);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const set = (p) => setC((x) => ({ ...x, ...p }));
  if (card.status === 'replaced') return null; // superseded by the assistant's confirm card for the same item
  if (card.status === 'done' || card.status === 'dismissed') {
    const to = card.type === 'event' ? '/app/calendar' : card.type === 'memory' ? '/app/memory' : '/app/reminders';
    return (
      <div className={`acard done ${compact ? 'compact' : ''}`}>
        <Icon name={card.status === 'done' ? 'check' : 'x'} size={15} />
        <span>{card.status === 'done' ? t(`intent.added.${card.type}`) : t('intent.dismissed')}</span>
        {card.status === 'done' && <Link to={to} className="acard-link">{t(`intent.open.${card.type === 'event' ? 'event' : card.type === 'memory' ? 'memory' : 'reminder'}`)} ›</Link>}
      </div>
    );
  }
  const confirm = async (cc = c) => {
    if (cc.type === 'event' && cc.complex && !form) { setForm(true); return; }
    setBusy(true);
    try { if (!be.MOCK || be.addReminder) await runCard(cc, { be, s, t }); toast(t(`intent.added.${cc.type}`)); onDone?.(cc); setForm(false); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const who = c.member ? s.memberName(c.member) : (c.type === 'event' ? t('common.everyone') : '');
  return (
    <div className={`acard ${compact ? 'compact' : ''}`}>
      <div className="acard-top">
        <Icon name={ICON[c.type]} size={17} />
        <div className="acard-text">
          <b>{t(`intent.verb.${c.type}`)}{cardWhen(c) ? <span className="acard-when">{cardWhen(c)}</span> : null}{c.repeat && c.repeat !== 'none' ? <span className="acard-when">{t(`ncal.rep.${c.repeat}`)}</span> : null}</b>
          <span>{c.title}{who ? ` · ${who}` : ''}</span>
        </div>
      </div>
      {edit && (
        <div className="acard-edit">
          <div className="ncal-chips">{TYPES.map((x) => <button type="button" key={x} className={c.type === x ? 'on' : ''} onClick={() => set({ type: x, complex: x === 'event' ? c.complex : false })}>{t(`intent.type.${x}`)}</button>)}</div>
          <input className="input" value={c.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} aria-label={t('today.titleLabel')} />
          {['reminder', 'event', 'task'].includes(c.type) && (
            <div className="acard-row">
              <input className="input" type="date" value={c.date || ''} onChange={(e) => set({ date: e.target.value })} aria-label={t('today.date')} />
              <input className="input" type="time" value={c.time || ''} onChange={(e) => set({ time: e.target.value, allDay: !e.target.value })} aria-label={t('today.time')} />
            </div>
          )}
          {['reminder', 'event', 'task'].includes(c.type) && (
            <select className="select input" value={c.member || ''} onChange={(e) => set({ member: e.target.value })} aria-label={t('reminders.member')}>
              <option value="">{t('common.everyone')}</option>
              {s.members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
            </select>
          )}
        </div>
      )}
      <p className="acard-pending"><b className="pending-tag">{t('intent.pending')}</b> · {t('intent.pendingHint')}</p>
      <div className="acard-btns">
        <Button size="sm" icon="check" loading={busy} disabled={!c.title?.trim() || (['reminder', 'event'].includes(c.type) && !c.date)} onClick={() => confirm()}>{c.type === 'event' && c.complex ? t('intent.openForm') : t('common.confirm')}</Button>
        <Button size="sm" variant="outline" onClick={() => (c.type === 'event' ? setForm(true) : setEdit((v) => !v))}>{edit ? t('common.done') : t('common.edit')}</Button>
        <Button size="sm" variant="ghost" onClick={() => onDismiss?.()}>{t('home.dismiss')}</Button>
      </div>
      {form && <EventForm c={c} onClose={() => setForm(false)} onSave={(cc) => { setC(cc); return confirm({ ...cc, complex: false }); }} busy={busy} />}
    </div>
  );
}

// Structured sheet for complex tasks (recurring family events), prefilled from the sentence.
export function EventForm({ c, onClose, onSave, busy }) {
  const { t } = useI18n();
  const s = useSession();
  const [f, setF] = useState(() => ({ title: c.title, date: c.date || '', time: c.time || '', duration: 60, repeat: c.repeat || 'none', until: '', members: c.member ? [c.member] : [], reminders: c.reminders || [60], location: '', notes: '' }));
  const set = (p) => setF((x) => ({ ...x, ...p }));
  return (
    <Sheet open onClose={onClose} title={t('intent.formTitle')} footer={<div className="sheet-actions"><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button loading={busy} disabled={!f.title.trim() || !f.date} onClick={() => onSave({ ...c, ...f, type: 'event', allDay: !f.time, member: '', members: f.members })}>{t('calendar.create')}</Button></div>}>
      <div className="stack">
        <Field label={t('calendar.titleLabel')}><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} /></Field>
        <div className="cal-form-2">
          <Field label={t('today.date')}><input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
          <Field label={t('today.time')} hint={t('intent.allDayHint')}><input className="input" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} /></Field>
        </div>
        <div className="cal-form-2">
          <Field label={t('ncal.repeat')}><select className="select" value={f.repeat} onChange={(e) => set({ repeat: e.target.value })}>{REPEATS.map((r) => <option key={r} value={r}>{t(`ncal.rep.${r}`)}</option>)}</select></Field>
          {f.repeat !== 'none' && <Field label={t('ncal.until')}><input className="input" type="date" value={f.until} min={f.date} onChange={(e) => set({ until: e.target.value })} /></Field>}
        </div>
        <Field label={t('ncal.for')}>
          <div className="ncal-chips">
            <button type="button" className={!f.members.length ? 'on' : ''} onClick={() => set({ members: [] })}>{t('common.everyone')}</button>
            {s.members.map((m) => { const on = f.members.includes(m.uid); return <button type="button" key={m.uid} className={on ? 'on' : ''} onClick={() => set({ members: on ? f.members.filter((x) => x !== m.uid) : [...f.members, m.uid] })}>{m.displayName}</button>; })}
          </div>
        </Field>
        <Field label={t('ncal.remind')}>
          <div className="ncal-chips">{REMINDER_OPTIONS.map((m) => { const on = f.reminders.includes(m); return <button type="button" key={m} className={on ? 'on' : ''} onClick={() => set({ reminders: on ? f.reminders.filter((x) => x !== m) : [...f.reminders, m] })}>{reminderLabel(m, t)}</button>; })}</div>
        </Field>
        <Field label={t('calendar.location')}><input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}
