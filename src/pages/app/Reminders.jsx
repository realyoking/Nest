import { useEffect, useState } from 'react';
import { useSwipeRow } from '../../lib/use-gestures.js';
import { MemberName } from '../../components/Identity.jsx';
import { Avatar, Button, Empty, Field, IconButton, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { dueLabel, fromLocalInput, toLocalInput } from '../../lib/dates.js';
import { useBe } from '../../lib/be-context.jsx';

export function ReminderForm({ initial = {}, onDone }) {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [title, setTitle] = useState(initial.title || '');
  const [due, setDue] = useState(initial.dueAt ? toLocalInput(initial.dueAt) : toLocalInput(new Date(Date.now() + 864e5)).slice(0, 11) + (s.prefs?.defaultReminderTime || '09:00'));
  const [member, setMember] = useState(initial.memberId ?? s.user.uid);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); if (!title.trim()) return;
    setBusy(true);
    try {
      await be.addReminder(s.family.id, { title: title.trim(), dueAt: fromLocalInput(due), memberId: member });
      toast(t('home.added')); setTitle(''); onDone?.();
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  return (
    <form className="stack" onSubmit={submit}>
      <Field><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('reminders.titlePh')} maxLength={120} /></Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label={t('reminders.due')}><input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Field label={t('reminders.member')}>
          <select className="select input" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">{t('common.everyone')}</option>
            {s.members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
          </select>
        </Field>
      </div>
      <Button type="submit" icon="plus" loading={busy} disabled={!title.trim()}>{t('common.add')}</Button>
    </form>
  );
}

// Run 22: swipe left (touch) = complete an open reminder / delete a done one, with an undo toast. The check button and
// the trash button stay as the accessible ways to do the same. Deletes wait for the undo toast to expire.
const HIDDEN_REM = new Set();
const HIDE_EVT = 'nest:rem-hidden';
const setRemHidden = (id, on) => { if (on) HIDDEN_REM.add(id); else HIDDEN_REM.delete(id); window.dispatchEvent(new Event(HIDE_EVT)); };
export function useVisibleReminders(list) {
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener(HIDE_EVT, f); return () => window.removeEventListener(HIDE_EVT, f); }, []);
  return list.filter((r) => !HIDDEN_REM.has(r.id));
}
const REM_L = {
  'zh-Hant': { done: (x) => `已完成「${x}」`, deleted: (x) => `已刪除「${x}」`, swipeDone: '完成', swipeDel: '刪除' },
  en: { done: (x) => `Done: ${x}`, deleted: (x) => `Deleted: ${x}`, swipeDone: 'Done', swipeDel: 'Delete' },
};
const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

export function ReminderRow({ r, i = 0 }) {
  const { be } = useBe();
  const { t, lang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const L = REM_L[lang === 'en' ? 'en' : 'zh-Hant'];
  const [pop, setPop] = useState(false);
  const overdue = !r.done && r.dueAt && r.dueAt < new Date();
  const fail = () => toast(t('common.error'), 'err');
  const setDone = (done) => be.updateReminder(s.family.id, r.id, { done }).catch(fail);
  // Completing: a short check "pop" first, then the write (the row then leaves an open-only list).
  const complete = ({ undo } = {}) => {
    if (r.done) { setDone(false); return; }
    setPop(true);
    const go = () => {
      setDone(true);
      if (undo) toast(L.done(r.title), 'ok', { action: { label: t('agent.undo'), onClick: () => setDone(false) } });
    };
    if (undo || reducedMotion()) go(); else setTimeout(go, 460);
    setTimeout(() => setPop(false), 900);
  };
  const remove = () => {
    let undone = false;
    setRemHidden(r.id, true);
    toast(L.deleted(r.title), 'ok', {
      action: { label: t('agent.undo'), onClick: () => { undone = true; setRemHidden(r.id, false); } },
      onExpire: () => { if (!undone) be.deleteReminder(s.family.id, r.id).then(() => setRemHidden(r.id, false), () => { setRemHidden(r.id, false); fail(); }); },
    });
  };
  const sw = useSwipeRow({ onCommit: () => (r.done ? remove() : complete({ undo: true })) });
  const on = r.done || pop;
  return (
    <div className={`swipe-row sw-${sw.phase}${pop ? ' just-done' : ''}`} style={{ '--i': Math.min(i, 8) }} data-testid="reminder-row">
      <div className={`swipe-bg ${r.done ? 'del' : ''}`} aria-hidden="true" style={{ opacity: sw.dx < 0 ? Math.min(1, -sw.dx / 60) : 0 }}>
        <span><Icon name={r.done ? 'trash' : 'check'} size={18} stroke={2.4} />{r.done ? L.swipeDel : L.swipeDone}</span>
      </div>
      <div className="list-row swipe-fg" ref={sw.ref} {...sw.bind} style={sw.dx ? { transform: `translate3d(${sw.dx}px,0,0)` } : undefined}>
        <button className={`check ${on ? 'on' : ''}${pop ? ' pop' : ''}`} style={{ width: 24, height: 24 }} aria-label={t('reminders.markDone')} aria-pressed={!!r.done}
          onClick={() => complete()}>{on && <Icon name="check" size={14} stroke={2.5} />}</button>
        <div className="list-row-main">
          <b style={on ? { color: '#a3a3a3', textDecoration: 'line-through' } : null} className={pop ? 'strike-in' : ''}>{r.title}</b>
          <small style={overdue ? { color: 'var(--red)' } : null}>{dueLabel(r.dueAt, t, fmtDate)}</small>
        </div>
        <span className={`pill ${r.memberId ? 'pill-who' : ''}`}>{r.memberId && <Avatar name={s.memberName(r.memberId)} src={s.photoOf(r.memberId)} size={18} />}{r.memberId ? <MemberName uid={r.memberId} name={s.memberName(r.memberId) || '—'} size={11} /> : t('common.everyone')}</span>
        <IconButton icon="trash" label={t('common.delete')} onClick={remove} />
      </div>
    </div>
  );
}

export default function Reminders() {
  const { t } = useI18n();
  const s = useSession();
  const [filter, setFilter] = useState('open');
  const [who, setWho] = useState('all');
  const list = useVisibleReminders(s.reminders)
    .filter((r) => (filter === 'open' ? !r.done : filter === 'done' ? r.done : true))
    .filter((r) => (who === 'all' ? true : r.memberId === who))
    .sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity));
  return (
    <>
      <PageHeader title={t('reminders.title')} sub={t('reminders.sub')} />
      <div className="grid-2">
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="plus" size={18} />{t('common.new')}</h2></div>
          <ReminderForm />
        </Reveal>
        <Reveal className="card" delay={80}>
          <div className="chips" style={{ marginBottom: 10 }}>
            {['open', 'done', 'all'].map((f) => <button key={f} className={`chip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{t(`reminders.${f}`)}</button>)}
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={`chip ${who === 'all' ? 'on' : ''}`} onClick={() => setWho('all')}>{t('common.everyone')}</button>
            {s.members.map((m) => <button key={m.uid} className={`chip chip-who ${who === m.uid ? 'on' : ''}`} onClick={() => setWho(m.uid)}><Avatar name={m.displayName} src={s.photoOf(m.uid)} size={24} /><MemberName uid={m.uid} name={m.displayName} size={12} /></button>)}
          </div>
          {list.length ? list.map((r, i) => <ReminderRow key={r.id} r={r} i={i} />) : <Empty icon="bell" text={t('reminders.empty')} />}
        </Reveal>
      </div>
    </>
  );
}
