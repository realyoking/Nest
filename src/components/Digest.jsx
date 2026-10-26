// Grouped 今日摘要 / notifications view: filter chips (All + categories with counts), urgent items pinned on top,
// one compact collapsible section per category showing its top 3 ("Show all" expands), and the suggestion sheet
// (accept / edit / dismiss) for school notices, bills, tests and AI inbox items.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Button, Field, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { CAT_ICON, withoutPinned, inboxCat } from '../lib/digest.js';
import { billReminderTimes, hkDayKey, pickSigner, daysUntil } from '../lib/detect.js';
import { fromLocalInput } from '../lib/dates.js';
import { selectedFor, canWriteCalendar } from '../lib/google.js';
import { writeEvent } from '../lib/calendar.js';
import { weatherLine } from '../lib/hk.js';
import { aiContext } from '../lib/session.jsx';
import { aiPrefs } from '../lib/prefs.js';

const TOP = 3;
const CAP = 30;
// Reminder dueAt may be an HK wall-clock string ("2026-10-21T08:00") or an ISO instant — return HK [date, time].
const hkLocal = (v) => {
  if (!v) return ['', ''];
  const s = String(v);
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s) && Number.isFinite(Date.parse(s))) { const l = new Date(Date.parse(s) + 8 * 3600e3).toISOString(); return [l.slice(0, 10), l.slice(11, 16)]; }
  return [s.slice(0, 10), s.slice(11, 16)];
};
const hm = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(11, 16);

export function useWhen() {
  const { t, fmtDate } = useI18n();
  return (x) => {
    if (x.tag === 'overdue') return t('today.tag.overdue');
    if (x.tag === 'today') return x.at && x.kind !== 'work' ? `${t('common.today')} ${hm(x.at)}` : t('common.today');
    if (x.tag === 'tomorrow') return t('common.tomorrow');
    if (x.tag && x.tag.startsWith('in')) return t('today.tag.inDays', { n: x.tag.slice(2) });
    if (x.kind === 'event') return x.allDay ? (x.day === 'today' ? t('common.today') : t('common.tomorrow')) : `${x.day === 'today' ? '' : `${t('common.tomorrow')} `}${hm(x.at)}`;
    if (x.due) return fmtDate(new Date(`${x.due}T12:00:00+08:00`));
    if (x.at) return hkDayKey(x.at) === hkDayKey() ? hm(x.at) : fmtDate(new Date(x.at));
    return '';
  };
}

function Row({ x, onOpen }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const when = useWhen();
  if (x.kind === 'weather') {
    const w = x.weather;
    return (
      <div className="dg-row dg-static">
        <div className="dg-main">
          <b>{weatherLine(w, t)}</b>
          <small>{w.forecast || w.today?.desc || ''}</small>
        </div>
      </div>
    );
  }
  if (x.kind === 'transit') {
    return (
      <button className="dg-row" onClick={() => onOpen?.(x)}>
        <div className="dg-main"><b>{x.title}</b><small>{x.etas.length ? x.etas.slice(0, 3).map((e) => t('today.mins', { n: Math.max(0, Math.round((e - Date.now()) / 60e3)) })).join(' · ') : t('today.noEta')}{x.status ? ` · ${x.status}` : ''}</small></div>
        {x.plan && <span className={`pill ${x.plan.late ? 'warn' : 'dark'}`}>{t('today.leaveAt', { time: hm(x.plan.leaveAt) })}</span>}
      </button>
    );
  }
  const title = x.kind === 'warning' ? `${x.title}${x.type && !x.title.includes(x.type) ? (lang === 'en' ? ` (${x.type})` : `（${x.type}）`) : ''}` : x.title;
  const amount = x.amount ? `HK$${Number(x.amount).toLocaleString('en-HK')}` : '';
  const meta = when(x);
  const open = () => {
    if (x.inboxId || x.kind === 'mail' || x.kind === 'note') return onOpen?.(x);
    if (x.kind === 'reminder') return nav('/app/reminders');
    if (x.kind === 'holiday' || x.kind === 'event') return nav('/app/calendar');
    if (x.href) window.open(x.href, '_blank', 'noopener');
  };
  const clickable = x.inboxId || x.href || ['reminder', 'holiday', 'event', 'mail', 'note'].includes(x.kind);
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag className={`dg-row ${x.urgent ? 'urgent' : ''} ${clickable ? '' : 'dg-static'}`} onClick={clickable ? open : undefined}>
      {x.urgent && <i className="dg-dot" aria-hidden="true" />}
      <div className="dg-main">
        <b>{title}{x.unread ? <span className="dg-unread" aria-label={t('today.unread')} /> : null}</b>
        {(x.sub || x.detected || x.needsReply) && <small>{[x.needsReply ? t('today.needsReply') : '', x.sub, x.detected ? t('today.detected') : ''].filter(Boolean).join(' · ')}</small>}
      </div>
      <div className="dg-meta">
        {amount && <b>{amount}</b>}
        {meta && <span className={x.urgent ? 'hot' : ''}>{meta}</span>}
      </div>
    </Tag>
  );
}

function Section({ cat, items, forceAll, onOpen }) {
  const { t } = useI18n();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(true);
  const shown = forceAll || all ? items.slice(0, CAP) : items.slice(0, TOP);
  const n = items.filter((x) => x.kind !== 'weather').length;
  return (
    <section className="dg-sec">
      <button className="dg-sec-h" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Icon name={CAT_ICON[cat.id]} size={17} />
        <span>{t(`today.cat.${cat.id}`)}</span>
        {n > 0 && <em className={cat.urgent ? 'hot' : ''}>{n}</em>}
        <Icon name="chevronDown" size={16} className={`dg-chev ${open ? 'on' : ''}`} />
      </button>
      {open && (
        <div className="dg-list">
          {shown.map((x) => <Row key={x.id} x={x} onOpen={onOpen} />)}
          {!forceAll && items.length > TOP && (
            <button className="dg-more" onClick={() => setAll((v) => !v)}>{all ? t('today.showLess') : t('today.showAll', { n: items.length })}</button>
          )}
        </div>
      )}
    </section>
  );
}

// digest = buildDigest(...). `only` limits to some categories (notifications list). Empty → `empty` node.
export function DigestView({ digest, onOpen, empty, pin = true, compactChips = false }) {
  const { t } = useI18n();
  const [f, setF] = useState('all');
  const cats = digest.cats.filter((c) => c.items.length);
  const pinned = pin ? digest.pinned : [];
  const total = cats.reduce((n, c) => n + c.count, 0);
  if (!cats.length) return empty || null;
  const sel = cats.find((c) => c.id === f);
  return (
    <div className="dg">
      {cats.length > 1 && (
        <div className={`dg-chips ${compactChips ? 'compact' : ''}`} role="tablist">
          <button role="tab" aria-selected={!sel} className={!sel ? 'on' : ''} onClick={() => setF('all')}>{t('today.all')}{total ? <em>{total}</em> : null}</button>
          {cats.map((c) => (
            <button key={c.id} role="tab" aria-selected={sel?.id === c.id} className={sel?.id === c.id ? 'on' : ''} onClick={() => setF(c.id)}>
              <Icon name={c.icon} size={14} />{t(`today.cat.${c.id}`)}{c.count ? <em className={c.urgent ? 'hot' : ''}>{c.count}</em> : null}
            </button>
          ))}
        </div>
      )}
      {sel ? <Section key={sel.id} cat={sel} items={sel.items} forceAll onOpen={onOpen} /> : (
        <>
          {pinned.length > 0 && (
            <div className="dg-pinned">
              <div className="dg-pinned-h"><Icon name="alert" size={15} />{t('today.urgent')}</div>
              {pinned.map((x) => <Row key={x.id} x={x} onOpen={onOpen} />)}
            </div>
          )}
          {cats.map((c) => { const items = withoutPinned(c, pinned); return items.length ? <Section key={c.id} cat={c} items={items} onOpen={onOpen} /> : null; })}
        </>
      )}
    </div>
  );
}

// ---------- suggestion sheet ----------
export function InboxSheet({ item, onClose }) {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const kind = item?.kind || 'ai';
  const parents = s.members.filter((m) => m.role === 'parent');
  const calAccounts = be.MOCK ? ['chan.family@gmail.com'] : selectedFor(s.profile, 'googlecalendar').filter((e) => canWriteCalendar(e));
  const [rDate, rTime] = hkLocal(item?.reminder?.dueAt);
  const initDate = item?.date || rDate;
  const [f, setFState] = useState(() => ({
    title: item?.kind === 'bill' ? (item.payee || item.title) : (item?.reminder?.title && item.kind !== 'notice' ? item.reminder.title : item?.title || ''),
    date: initDate, time: item?.time || (item?.kind === 'notice' || !item?.kind ? rTime : '') || '',
    signer: item?.signer || pickSigner(s.members, s.user.uid, s.family?.ownerId), amount: item?.amount || '',
    cal: !!calAccounts.length && kind === 'notice' && !!initDate, calAccount: calAccounts[0] || '',
  }));
  const [busy, setBusy] = useState('');
  const set = (p) => setFState((x) => ({ ...x, ...p }));
  if (!item) return null;
  const fid = s.family.id;
  const lead = Number(s.prefs.billLead) || 3;
  const done = async (status, msg) => { await be.updateInboxItem(fid, item.id, { status }); toast(msg); onClose(); };
  const run = (k, f2) => async () => { setBusy(k); try { await f2(); } catch (e) { toast(t('common.error'), 'err'); } finally { setBusy(''); } };
  const dueAt = (date, time) => (date ? fromLocalInput(`${date}T${time || s.prefs.defaultReminderTime || '09:00'}`) : null);

  const accept = run('ok', async () => {
    const title = f.title.trim() || item.title;
    if (kind === 'sub') {
      const { writeSub } = await import('../lib/subs-api.js');
      await writeSub('create', { sub: { service: title, purpose: item.purpose || '', amount: Number(f.amount || item.amount) || 0, cycle: item.cycle || 'monthly', renewDate: f.date || item.renewDate || '', cancelUrl: item.cancelUrl || '', member: s.user.uid } });
      await done('accepted', t('subs.addedFromEmail')); return;
    }
    if (kind === 'bill') {
      const times = billReminderTimes(f.date, lead);
      const label = `${t('today.pay')} ${title}${f.amount ? ` HK$${f.amount}` : ''}`;
      if (!times.length) await be.addReminder(fid, { title: label, dueAt: dueAt(f.date, '09:00') || null, memberId: s.user.uid });
      for (const d of times) await be.addReminder(fid, { title: label, dueAt: d, memberId: s.user.uid });
      await be.updateInboxItem(fid, item.id, { status: 'accepted', payee: title, ...(f.amount ? { amount: Number(f.amount) } : {}), date: f.date || '' });
      toast(t('today.billAdded', { n: Math.max(1, times.length) })); onClose(); return;
    }
    if (kind === 'test' || kind === 'homework') {
      // Revise the evening before (19:00) — or today at the default time if that has passed.
      let d = f.date ? new Date(Date.parse(`${f.date}T19:00:00+08:00`) - 864e5) : null;
      if (d && d.getTime() < Date.now()) d = new Date(Date.now() + 3600e3);
      await be.addReminder(fid, { title: `${t(kind === 'test' ? 'today.revise' : 'today.finish')}${title}`, dueAt: d, memberId: s.user.uid });
      await done('accepted', t('home.added')); return;
    }
    await be.addReminder(fid, { title, dueAt: dueAt(f.date, f.time), memberId: kind === 'notice' ? (f.signer || '') : s.user.uid });
    if (kind === 'notice' && f.cal && f.calAccount && f.date && !be.MOCK) {
      const fields = f.time
        ? { title, allDay: false, start: fromLocalInput(`${f.date}T${f.time}`).toISOString(), end: new Date(fromLocalInput(`${f.date}T${f.time}`).getTime() + 3600e3).toISOString(), location: '', description: item.body || '' }
        : { title, allDay: true, start: f.date, end: hkDayKey(Date.parse(`${f.date}T12:00:00+08:00`) + 864e5), location: '', description: item.body || '' };
      try { await writeEvent('create', { cal: { source: 'google', account: f.calAccount, calendarId: 'primary' }, fields }); } catch { toast(t('today.calFailed'), 'err'); }
    }
    await done('accepted', t('home.added'));
  });
  const n = f.date ? daysUntil(f.date) : null;
  const title = kind === 'sub' ? t('subs.fromEmail') : t(`today.kind.${kind}`);
  return (
    <Sheet open onClose={onClose} title={title} footer={(
      <div className="dg-sheet-foot">
        {kind === 'bill' && <Button variant="outline" loading={busy === 'paid'} onClick={run('paid', () => done('paid', t('today.markedPaid')))}>{t('today.paid')}</Button>}
        <Button variant="ghost" loading={busy === 'x'} onClick={run('x', () => done('dismissed', t('today.dismissed')))}>{t('home.dismiss')}</Button>
        {!(kind === 'bill' && item.status === 'accepted') && <Button icon="check" loading={busy === 'ok'} onClick={accept}>{t(kind === 'sub' ? 'subs.addFromEmail' : kind === 'bill' ? 'today.addBillReminders' : kind === 'notice' ? 'today.accept' : 'home.addReminder')}</Button>}
      </div>
    )}>
      <div className="stack">
        {item.src?.from && <p className="muted small dg-src"><Icon name={item.src.type === 'classroom' ? 'book' : 'mail'} size={14} />{item.src.from}{item.src.subject && item.src.subject !== item.title ? ` · ${item.src.subject}` : ''}</p>}
        {item.body && <p className="dg-body">{item.body}</p>}
        <Field label={kind === 'bill' ? t('today.payee') : kind === 'sub' ? t('subs.service') : t('today.titleLabel')}><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} /></Field>
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label={kind === 'bill' ? t('today.dueDate') : kind === 'notice' || kind === 'ai' ? t('today.date') : t('today.testDate')}>
            <input className="input" type="date" value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </Field>
          {kind === 'bill' || kind === 'sub'
            ? <Field label={t('today.amount')}><input className="input" inputMode="decimal" value={f.amount} onChange={(e) => set({ amount: e.target.value.replace(/[^\d.]/g, '') })} placeholder="HK$" /></Field>
            : (kind === 'notice' || kind === 'ai') && <Field label={t('today.time')}><input className="input" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} /></Field>}
        </div>
        {kind === 'notice' && (
          <Field label={t('today.signer')} hint={t('today.signerHint')}>
            <select className="select input" value={f.signer} onChange={(e) => set({ signer: e.target.value })}>
              <option value="">{t('common.everyone')}</option>
              {(parents.length ? parents : s.members).map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}
            </select>
          </Field>
        )}
        {kind === 'notice' && calAccounts.length > 0 && (
          <label className="dg-check"><input type="checkbox" checked={f.cal} onChange={(e) => set({ cal: e.target.checked })} />{t('today.addToGoogle', { email: f.calAccount })}</label>
        )}
        {kind === 'bill' && <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{item.status === 'accepted' ? t('today.billHasReminders') : t('today.billPlan', { n: lead })}{n != null ? ` · ${n < 0 ? t('today.tag.overdue') : n === 0 ? t('common.today') : t('today.tag.inDays', { n })}` : ''}</p>}
        {(kind === 'test' || kind === 'homework') && <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{t('today.revisePlan')}</p>}
        {item.src?.link && <a className="small dg-link" href={item.src.link} target="_blank" rel="noreferrer">{t(item.src.type === 'classroom' ? 'today.openClassroom' : 'today.openEmail')} <Icon name="arrowRight" size={14} /></a>}
      </div>
    </Sheet>
  );
}
export { inboxCat };

// ---------- email: details + "Draft reply" (never sent automatically) ----------
const b64 = (d) => { try { const bin = atob(String(d).replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); } catch { return ''; } };
function mailText(payload) {
  let plain = ''; let html = '';
  const walk = (p) => { if (!p) return; if (p.mimeType === 'text/plain' && p.body?.data && !plain) plain = b64(p.body.data); else if (p.mimeType === 'text/html' && p.body?.data && !html) html = b64(p.body.data); (p.parts || []).forEach(walk); };
  walk(payload);
  const txt = plain || html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return txt.replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, 4000);
}
const addrOf = (from) => (/<([^>]+)>/.exec(from || '') || [])[1] || (/\S+@\S+/.exec(from || '') || [])[0] || '';

export function MailSheet({ item, onClose }) {
  const { be, ai } = useBe();
  const { t, lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const subject = item.title || '';
  const make = async () => {
    setBusy(true); setErr(''); setDraft('');
    try {
      let body = '';
      let from = item.sub || '';
      if (!be.MOCK && item.account && item.mid) {
        const { tokenFor, ensureTokens } = await import('../lib/google.js');
        await ensureTokens(s.profile).catch(() => {});
        const tk = tokenFor(item.account)?.token;
        if (tk) {
          const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.mid}?format=full`, { headers: { authorization: `Bearer ${tk}` } });
          if (r.ok) { const j = await r.json(); body = mailText(j.payload); from = (j.payload?.headers || []).find((h) => h.name.toLowerCase() === 'from')?.value || from; }
        }
      }
      const prompt = `${lang === 'en' ? 'Draft a reply to this email.' : '請為以下電郵草擬回覆。'}\n\nFrom: ${from}\nSubject: ${subject}\n\n${body || item.snippet || ''}`;
      const text = await ai.streamChat({ mode: 'draft', lang, messages: [{ role: 'user', content: prompt }], context: aiContext(s), prefs: aiPrefs(s.prefs), onDelta: setDraft });
      setDraft(text);
    } catch (e) { setErr(e?.code === 'limit_reached' ? t('agent.limit') : t('common.error')); } finally { setBusy(false); }
  };
  const to = addrOf(item.sub);
  const reSubj = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const gmailUrl = `https://mail.google.com/mail/?authuser=${encodeURIComponent(item.account || '')}&view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(reSubj)}&body=${encodeURIComponent(draft)}`;
  const copy = async () => { try { await navigator.clipboard.writeText(draft); toast(t('common.copied')); } catch { toast(t('common.error'), 'err'); } };
  return (
    <Sheet open onClose={onClose} title={subject || t('today.cat.gmail')} footer={(
      <div className="dg-sheet-foot">
        {item.href && <Button variant="ghost" href={item.href} target="_blank" rel="noreferrer">{t('today.openEmail')}</Button>}
        {!draft && <Button icon="sparkle" loading={busy} onClick={make}>{t('draft.make')}</Button>}
        {draft && !busy && <Button variant="outline" icon="copy" onClick={copy}>{t('common.copy')}</Button>}
        {draft && !busy && <Button icon="mail" href={gmailUrl} target="_blank" rel="noreferrer">{t('draft.openGmail')}</Button>}
      </div>
    )}>
      <div className="stack">
        <p className="muted small dg-src"><Icon name="mail" size={14} />{item.sub}{item.account ? ` · ${item.account}` : ''}</p>
        {item.snippet && <p className="dg-body">{item.snippet}</p>}
        {(draft || busy) && (
          <Field label={t('draft.label')} hint={t('draft.hint')}>
            <textarea className="textarea" rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} />
          </Field>
        )}
        {draft && !busy && <Button size="sm" variant="ghost" icon="refresh" onClick={make}>{t('home.regenerate')}</Button>}
        {err && <p className="error-text small" style={{ fontWeight: 700 }}>{err}</p>}
        <p className="fine" style={{ margin: 0 }}>{t('draft.never')}</p>
      </div>
    </Sheet>
  );
}
