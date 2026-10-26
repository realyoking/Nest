// Run 23: structured reply cards in AI 助理 (reminder / checklist / schedule) with one-tap add / complete.
// State lives on the assistant message (cardState: { [i]: { added: {itemIdx: reminderId|'event'}, done: {itemIdx: true} } }),
// so taps survive reloads and the model is told what really happened (cardsNote in Agent.jsx).
import { useState } from 'react';
import Icon from './Icon.jsx';
import { Button, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { fromLocalInput } from '../lib/dates.js';
import { reminderPayloads } from '../lib/chat-cards.js';
import { runCard } from './ActionCard.jsx';

const ICON = { reminder: 'bell', checklist: 'check', schedule: 'calendar' };
function memberUid(s, name) {
  const v = String(name || '').trim().toLowerCase();
  if (!v) return s.user.uid;
  if (['everyone', 'all', 'family', '全家', '所有人', 'ทุกคน'].includes(v)) return '';
  return s.members.find((m) => String(m.displayName || '').toLowerCase() === v)?.uid || s.user.uid;
}
const md = (d) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '');

export default function ChatCards({ cards = [], state = {}, onState, readOnly = false }) {
  if (!cards.length) return null;
  return <div className="ccards" data-testid="chat-cards">{cards.map((c, i) => <OneCard key={i} c={c} st={state[i] || {}} onState={(st) => onState?.(i, st)} readOnly={readOnly} />)}</div>;
}

function OneCard({ c, st, onState, readOnly }) {
  const { be } = useBe();
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const added = st.added || {}; const done = st.done || {};
  const fid = s.family.id;
  const defTime = s.prefs?.defaultReminderTime || '09:00';
  const save = (patch) => onState?.({ added, done, ...patch });
  const addReminder = async (p) => {
    const due = p.due ? fromLocalInput(p.due) : null;
    const ref = await be.addReminder(fid, { title: p.title.slice(0, 200), dueAt: due && !isNaN(due) ? due : null, memberId: memberUid(s, p.member) });
    return ref?.id || 'r';
  };
  const run = async (key, fn) => { if (busy || readOnly) return; setBusy(key); try { await fn(); } catch { toast(t('r23.cards.failed'), 'err'); } finally { setBusy(null); } };
  const payloads = reminderPayloads(c, { defaultTime: defTime });

  if (c.type === 'reminder') {
    const id = added[0]; const isDone = !!done[0];
    const when = c.date ? `${md(c.date)}${c.time ? ` ${c.time}` : ''}` : t('r23.cards.noDate');
    const who = c.member ? (memberUid(s, c.member) === '' ? t('r23.cards.everyone') : c.member) : '';
    return (
      <div className={`ccard ccard-reminder${isDone ? ' is-done' : ''}`} data-type="reminder">
        <div className="ccard-h"><Icon name={ICON.reminder} size={16} /><span>{t('r23.cards.reminder')}</span></div>
        <div className="ccard-main"><b>{c.title}</b><small>{[when, who].filter(Boolean).join(' · ')}</small></div>
        <div className="ccard-btns">
          {!id && <Button size="sm" icon="plus" loading={busy === 'add'} disabled={readOnly} onClick={() => run('add', async () => { const rid = await addReminder(payloads[0]); save({ added: { 0: rid } }); toast(t('r23.cards.added')); })} data-testid="ccard-add">{t('r23.cards.add')}</Button>}
          {id && !isDone && <Button size="sm" variant="outline" icon="check" loading={busy === 'done'} onClick={() => run('done', async () => { if (id !== 'r') await be.updateReminder(fid, id, { done: true }); save({ done: { 0: true } }); toast(t('r23.cards.completed')); })} data-testid="ccard-complete">{t('r23.cards.complete')}</Button>}
          {id && <span className="ccard-ok"><Icon name="check" size={14} />{isDone ? t('r23.cards.completed') : t('r23.cards.added')}</span>}
        </div>
      </div>
    );
  }

  if (c.type === 'checklist') {
    const total = c.items.length; const n = c.items.filter((_, k) => done[k]).length;
    const left = c.items.map((_, k) => k).filter((k) => !added[k] && !done[k]);
    return (
      <div className="ccard ccard-list" data-type="checklist">
        <div className="ccard-h"><Icon name={ICON.checklist} size={16} /><span>{c.title || t('r23.cards.checklist')}</span><small>{t('r23.cards.progress', { done: n, total })}</small></div>
        <div className="ccard-bar" aria-hidden="true"><i style={{ width: `${total ? (n / total) * 100 : 0}%` }} /></div>
        <ul className="ccard-items">
          {c.items.map((it, k) => (
            <li key={k}>
              <button type="button" className={`ccard-tick${done[k] ? ' on' : ''}`} aria-pressed={!!done[k]} disabled={readOnly} data-testid="ccard-tick"
                onClick={() => run(`t${k}`, async () => {
                  const on = !done[k];
                  const rid = added[k];
                  if (rid && rid !== 'r') await be.updateReminder(fid, rid, { done: on });
                  save({ done: { ...done, [k]: on } });
                })}>
                <span className="ccard-box" aria-hidden="true">{done[k] && <Icon name="check" size={12} stroke={2.6} />}</span>
                <span className="ccard-txt">{it}</span>
                {added[k] && <small className="ccard-tag">{t('r23.cards.added')}</small>}
              </button>
            </li>
          ))}
        </ul>
        {!readOnly && left.length > 0 && (
          <div className="ccard-btns">
            <Button size="sm" variant="outline" icon="bell" loading={busy === 'all'} data-testid="ccard-addall" onClick={() => run('all', async () => {
              const next = { ...added };
              for (const k of left) next[k] = await addReminder(payloads[k]);
              save({ added: next }); toast(t('r23.cards.addedAll', { n: left.length }));
            })}>{t('r23.cards.addAll')}</Button>
          </div>
        )}
      </div>
    );
  }

  // schedule
  const left = c.items.map((_, k) => k).filter((k) => !added[k]);
  const addOne = async (k) => {
    const x = c.items[k];
    if (x.date) { await runCard({ type: 'event', title: x.title, date: x.date, time: x.time, allDay: !x.time }, { be, s, t }); return 'event'; }
    return addReminder(payloads[k]);
  };
  return (
    <div className="ccard ccard-sched" data-type="schedule">
      <div className="ccard-h"><Icon name={ICON.schedule} size={16} /><span>{c.title || t('r23.cards.schedule')}</span></div>
      <ul className="ccard-items sched">
        {c.items.map((x, k) => (
          <li key={k}>
            <span className="ccard-when">{x.date ? fmtDate(new Date(`${x.date}T12:00:00+08:00`), { month: 'short', day: 'numeric', weekday: 'short' }) : t('r23.cards.noDate')}{x.time ? <b>{x.time}</b> : null}</span>
            <span className="ccard-txt">{x.title}</span>
            {added[k] ? <span className="ccard-ok"><Icon name="check" size={14} /></span>
              : !readOnly && <button type="button" className="ccard-plus" aria-label={`${t('r23.cards.addEvent')}: ${x.title}`} disabled={!!busy} data-testid="ccard-plus"
                onClick={() => run(`s${k}`, async () => { const r = await addOne(k); save({ added: { ...added, [k]: r } }); toast(t('r23.cards.addedEvent')); })}><Icon name="plus" size={15} /></button>}
          </li>
        ))}
      </ul>
      {!readOnly && left.length > 1 && (
        <div className="ccard-btns">
          <Button size="sm" variant="outline" icon="calendar" loading={busy === 'all'} onClick={() => run('all', async () => {
            const next = { ...added };
            for (const k of left) next[k] = await addOne(k);
            save({ added: next }); toast(t('r23.cards.addedEvent'));
          })}>{t('r23.cards.addEvent')} · {left.length}</Button>
        </div>
      )}
    </div>
  );
}
