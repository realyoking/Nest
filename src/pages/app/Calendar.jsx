// Calendar tab: every connected calendar of the family in one view (day / week / month), Hong Kong time.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gateErrorText } from '../../lib/gate-errors.js';
import { Link } from 'react-router-dom';
import { Button, Field, Spinner, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { AppleConnectModal } from '../../components/AppleConnect.jsx';
import Sheet from '../../components/Sheet.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { REPEATS, REMINDER_OPTIONS, reminderLabel } from '../../lib/nestcal.js';
import { addAccount, ensureTokens, withAccount } from '../../lib/google.js';
import {
  PALETTE, NEST_CAL, viewRange, todayKey, addDays, addMonths, dayStart, dayKey, onDay, hkTime, toLocalInput, fromLocalInput,
  loadEvents, writeEvent, readVis, writeVis, readView, writeView, appleAccounts, shareSnapshot, sharedEvents, demoData, hkHolidaySource, regionHolidaySource, reminderSource,
} from '../../lib/calendar.js';

const HOUR = 44;
const NEST_DEFAULTS = { repeat: 'none', until: '', members: [], reminders: [10] };
const DAY = 864e5;

// Side-by-side columns for overlapping timed events of one day.
function layoutDay(list, key) {
  const a = dayStart(key); const b = a + DAY;
  const items = list.map((e) => ({ e, s: Math.max(e.startMs, a), f: Math.min(Math.max(e.endMs, e.startMs + 20 * 60e3), b) })).sort((x, y) => x.s - y.s || y.f - x.f);
  const out = []; let cluster = []; let end = -1;
  const flush = () => { const cols = []; cluster.forEach((it) => { let c = cols.findIndex((f) => f <= it.s); if (c < 0) { c = cols.length; cols.push(0); } cols[c] = it.f; it.col = c; }); cluster.forEach((it) => { it.cols = cols.length; out.push(it); }); cluster = []; };
  for (const it of items) { if (it.s >= end && cluster.length) flush(); cluster.push(it); end = Math.max(end, it.f); }
  if (cluster.length) flush();
  return out.map((it) => ({ ...it, top: ((it.s - a) / 3600e3) * HOUR, height: Math.max(((it.f - it.s) / 3600e3) * HOUR, 20) }));
}

export default function Calendar() {
  const { t, lang } = useI18n();
  const { be, demo } = useBe();
  const s = useSession();
  const toast = useToast();
  const uid = s.user?.uid;
  const profile = s.profile || {};
  const fid = s.family?.id || profile.familyId;
  const isDemo = demo || be.MOCK;

  const [view, setViewState] = useState(readView);
  const setView = (v) => { setViewState(v); writeView(v); };
  const [cursor, setCursor] = useState(todayKey);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [vis, setVis] = useState(() => readVis(uid));
  const [shares, setShares] = useState([]);
  const [shareErr, setShareErr] = useState(false);
  const [open, setOpen] = useState(null); // event detail
  const [form, setForm] = useState(null); // { mode, ev?, fields }
  const [confirmDel, setConfirmDel] = useState(null);
  const [formErr, setFormErr] = useState(''); // inline hint inside the event sheet (never a toast)
  const [appleOpen, setAppleOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [legendOpen, setLegendOpen] = useState(false);
  // Dismissed notices (per device, come back after 7 days).
  const dismissKey = `nest.cal.dismiss.${uid}`;
  const [dismissed, setDismissed] = useState(() => { try { return JSON.parse(localStorage.getItem(`nest.cal.dismiss.${uid}`) || '{}'); } catch { return {}; } });
  const dismiss = (k) => { const next = { ...dismissed, [k]: Date.now() }; setDismissed(next); try { localStorage.setItem(dismissKey, JSON.stringify(next)); } catch {} };
  const seq = useRef(0);

  const range = useMemo(() => viewRange(view, cursor), [view, cursor]);
  const appleSig = appleAccounts(profile).map((a) => a.appleId + a.at).join(',');
  const gSig = `${profile.connections?.googlecalendar ? 1 : 0}:${(profile.serviceAccounts?.googlecalendar || []).join(',')}:${Object.values(profile.googleVault || {}).map((v) => v?.at).join(',')}`;

  const load = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const r = isDemo ? demoData(lang, range.from, range.to) : await loadEvents(profile, range.from, range.to);
      const hk = await regionHolidaySource(isDemo || be.MOCK ? 'HK' : s.profile?.region, lang, r.calendars, { demo: isDemo || !!be.MOCK });
      if (n === seq.current) setData({ ...r, calendars: [...r.calendars, ...hk.calendars], events: [...r.events, ...hk.events] });
    } finally { if (n === seq.current) setLoading(false); }
  }, [range.from, range.to, appleSig, gSig, isDemo, lang, s.profile?.region]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (s.profile) load(); }, [load, !!s.profile]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isDemo && s.profile) ensureTokens(s.profile); }, [gSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Family shares (read) — others' snapshots only.
  useEffect(() => {
    if (!fid || !be.watchCalendarShares) return undefined;
    return be.watchCalendarShares(fid, (l) => setShares(l || []), (e) => { if (String(e?.code || '').includes('permission')) setShareErr(true); });
  }, [fid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Publish my snapshot (−7 … +60 days) when sharing is on, at most every 30 min per device.
  const sharing = !!profile.calendarShare;
  useEffect(() => {
    if (!sharing || !fid || !uid || isDemo || !be.saveCalendarShare) return;
    const k = `nest.cal.shareAt.${uid}`;
    if (Date.now() - (+localStorage.getItem(k) || 0) < 30 * 60e3) return;
    let live = true;
    (async () => {
      const from = dayStart(addDays(todayKey(), -7)); const to = dayStart(addDays(todayKey(), 60));
      const r = await loadEvents(profile, from, to);
      if (!live || (!r.events.length && r.errors.length)) return;
      try { await be.saveCalendarShare(fid, uid, shareSnapshot(r.events.filter((e) => e.source === 'google' || e.source === 'apple'), r.calendars, s.me?.displayName || '')); localStorage.setItem(k, String(Date.now())); setShareErr(false); }
      catch (e) { setShareErr(true); }
    })();
    return () => { live = false; };
  }, [sharing, fid, uid, appleSig, gSig]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleShare = async () => {
    if (isDemo) { toast(t('lp.demoOnly')); return; }
    const on = !sharing;
    await be.saveProfile(uid, { calendarShare: on });
    localStorage.removeItem(`nest.cal.shareAt.${uid}`);
    if (!on && be.deleteCalendarShare && fid) be.deleteCalendarShare(fid, uid).catch(() => {});
  };

  // Calendars incl. family members, with colours + visibility.
  const famShares = shares.filter((x) => x.uid && x.uid !== uid);
  const remSrc = useMemo(() => reminderSource(s.reminders, lang, s.memberName), [s.reminders, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendars = useMemo(() => {
    const own = (data?.calendars || []).slice().sort((a, b) => a.source.localeCompare(b.source) || a.account.localeCompare(b.account) || (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || a.name.localeCompare(b.name));
    const fam = famShares.map((x) => ({ key: `f|${x.uid}`, source: 'family', account: x.uid, name: x.name || s.memberName(x.uid) || t('calendar.family'), defaultOn: true, writable: false, updatedAt: x.updatedAt }));
    return [...own, ...fam, ...remSrc.calendars].map((c, i) => ({ ...c, color: PALETTE[i % PALETTE.length], on: vis[c.key] ?? c.defaultOn !== false }));
  }, [data, shares, vis, remSrc]); // eslint-disable-line react-hooks/exhaustive-deps
  const calBy = useMemo(() => Object.fromEntries(calendars.map((c) => [c.key, c])), [calendars]);
  const events = useMemo(() => {
    const fam = famShares.flatMap(sharedEvents);
    return [...(data?.events || []), ...fam, ...remSrc.events].filter((e) => calBy[e.calKey]?.on && e.startMs < range.to && e.endMs >= range.from)
      .sort((a, b) => a.startMs - b.startMs || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0));
  }, [data, shares, calBy, range, remSrc]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggleCal = (key) => { const c = calBy[key]; const next = { ...vis, [key]: !c.on }; setVis(next); writeVis(uid, next); };

  const writable0 = calendars.filter((c) => c.writable && c.source !== 'family');
  // The native Nest family calendar is always writable, even before the first load finishes.
  const writable = writable0.some((c) => c.key === 'nest|events') ? writable0 : [{ ...NEST_CAL(), color: PALETTE[0], on: true }, ...writable0];
  const ownSources = !!profile.connections?.googlecalendar || appleAccounts(profile).length > 0 || isDemo;
  const hasSources = true; // HK holidays + Nest reminders are always there
  const groups = useMemo(() => {
    const m = new Map();
    calendars.forEach((c) => { const k = `${c.source}|${c.account}`; if (!m.has(k)) m.set(k, { source: c.source, account: c.account, list: [] }); m.get(k).list.push(c); });
    return [...m.values()];
  }, [calendars]);

  // ---- navigation ----
  const step = (n) => setCursor((k) => (view === 'day' ? addDays(k, n) : view === 'week' ? addDays(k, 7 * n) : addMonths(k, n)));
  const fmt = (opts, ms) => new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', ...opts }).format(new Date(ms));
  const label = view === 'month' ? fmt({ year: 'numeric', month: 'long' }, dayStart(cursor) + 12 * 3600e3)
    : view === 'week' ? `${fmt({ month: 'short', day: 'numeric' }, range.from + 3600e3)} – ${fmt({ month: 'short', day: 'numeric' }, range.to - 3600e3)}`
      : fmt({ month: 'long', day: 'numeric', weekday: 'long' }, range.from + 3600e3);
  // Compact title for phones (iOS-style): the month for week view, a short date for day view.
  const m1 = fmt({ year: 'numeric', month: 'long' }, range.from + 3600e3); const m2 = fmt({ year: 'numeric', month: 'long' }, range.to - 3600e3);
  const shortLabel = view === 'week' ? (m1 === m2 ? m1 : `${fmt({ month: 'short' }, range.from + 3600e3)} – ${fmt({ month: 'short' }, range.to - 3600e3)}`)
    : view === 'day' ? fmt({ month: 'short', day: 'numeric', weekday: 'short' }, range.from + 3600e3) : label;

  // ---- write ----
  const errText = (e) => gateErrorText(e, t) || t(`calendar.errors.${['write_scope_missing', 'reauth', 'google_forbidden', 'not_found', 'apple_conflict', 'apple_recurring', 'apple_auth', 'timeout'].includes(e.code) ? e.code : 'generic'}`) + (e.detail && !['apple_auth'].includes(e.code) ? ` (${e.detail})` : '');
  const newEvent = (key = cursor, hour) => {
    if (demo) { toast(t('lp.demoOnly')); return; } // landing demo only; the mock build writes to the in-memory Nest calendar
    const h = hour ?? Math.min(23, new Date(Date.now() + 8 * 3600e3).getUTCHours() + 1);
    const start = dayStart(key) + h * 3600e3;
    // New events go to the native Nest family calendar by default (no Google / Apple needed). A Google or Apple calendar is
    // only written when the user explicitly picks it in the form.
    const def = writable.find((c) => c.key === 'nest|events') || NEST_CAL();
    setForm({ mode: 'create', fields: { title: '', calKey: def.key, allDay: false, start: toLocalInput(start), end: toLocalInput(start + 3600e3), startDate: key, endDate: key, location: '', description: '', ...NEST_DEFAULTS } });
  };
  const editEvent = (ev) => {
    setOpen(null);
    if (ev.source === 'nest' && ev.nest) {
      const n = ev.nest; const sMs = n.allDay ? Date.parse(`${n.start}T00:00:00+08:00`) : Date.parse(n.start); const eMs = n.allDay ? Date.parse(`${n.end}T00:00:00+08:00`) : Date.parse(n.end);
      setForm({ mode: 'update', ev, fields: { title: n.title, calKey: 'nest|events', allDay: !!n.allDay, start: toLocalInput(n.allDay ? sMs + 9 * 3600e3 : sMs), end: toLocalInput(n.allDay ? sMs + 10 * 3600e3 : eMs), startDate: dayKey(sMs), endDate: dayKey(n.allDay ? eMs - 1 : eMs), location: n.location || '', description: n.notes || '', repeat: n.repeat || 'none', until: n.until || '', members: n.members || [], reminders: n.reminders || [] } });
      return;
    }
    setForm({ mode: 'update', ev, fields: { title: ev.title, calKey: ev.calKey, allDay: ev.allDay, start: toLocalInput(ev.allDay ? ev.startMs + 9 * 3600e3 : ev.startMs), end: toLocalInput(ev.allDay ? ev.startMs + 10 * 3600e3 : ev.endMs), startDate: dayKey(ev.startMs), endDate: dayKey(ev.allDay ? ev.endMs - 1 : ev.endMs), location: ev.location || '', description: ev.description || '' } });
  };
  const save = async () => {
    const f = form.fields;
    setFormErr('');
    if (!f.title.trim()) { setFormErr(t('calendar.needTitle')); return; }
    const fields = f.allDay
      ? { title: f.title.trim(), allDay: true, start: f.startDate, end: addDays(f.endDate < f.startDate ? f.startDate : f.endDate, 1), location: f.location, description: f.description }
      : { title: f.title.trim(), allDay: false, start: fromLocalInput(f.start), end: fromLocalInput(f.end), location: f.location, description: f.description };
    if (!f.allDay && Date.parse(fields.end) < Date.parse(fields.start)) { setFormErr(t('calendar.badTime')); return; }
    const target = calBy[f.calKey] || writable.find((c) => c.key === f.calKey) || NEST_CAL();
    if ((form.ev?.source || target.source) === 'nest') Object.assign(fields, { notes: f.description, repeat: f.repeat || 'none', until: f.repeat !== 'none' ? f.until || '' : '', members: f.members || [], reminders: f.reminders || [] });
    setBusy('save');
    try {
      if (form.mode === 'create') await writeEvent('create', { cal: target, fields });
      else await writeEvent('update', { ev: form.ev, fields });
      toast(t(form.mode === 'create' ? 'calendar.created' : 'calendar.updated'));
      setForm(null); load();
    } catch (e) { setFormErr(errText(e)); } finally { setBusy(''); }
  };
  const del = async (ev) => {
    setBusy('del');
    try { await writeEvent('delete', { ev }); toast(t('calendar.deleted')); setConfirmDel(null); setOpen(null); load(); }
    catch (e) { toast(errText(e), 'err'); } finally { setBusy(''); }
  };
  const grant = async (email) => {
    if (isDemo) { toast(t('lp.demoOnly')); return; }
    setBusy(`g:${email}`);
    try { const r = await addAccount({ hint: email, ret: '/app/calendar' }); if (!r.saved) await be.saveProfile(uid, withAccount(s.profile, r.acct, r.select || [])); await ensureTokens(s.profile, { force: true }); load(); }
    catch (e) { if (!/cancel|popup_closed|access_denied/.test(String(e.code || e.message))) toast(t('calendar.errors.generic'), 'err'); }
    finally { setBusy(''); }
  };

  // ---- notices ----
  const notices = [];
  (data?.accounts || []).forEach((a) => {
    if (a.source === 'google' && !a.ok) notices.push({ k: `r${a.account}`, text: t('calendar.reauth', { email: a.account }) + (a.detail ? ` (${a.detail})` : ''), btn: t('calendar.reconnect'), on: () => grant(a.account), b: `g:${a.account}` });
    else if (a.source === 'google' && !a.canWrite) notices.push({ k: `w${a.account}`, text: t('calendar.needWrite', { email: a.account }), short: t('calendar.readOnlyChip', { email: a.account }), btn: t('calendar.grantWrite'), on: () => grant(a.account), b: `g:${a.account}`, soft: true });
    if (a.source === 'apple' && !a.ok) notices.push({ k: `a${a.account}`, text: t('calendar.appleAuthFail', { email: a.account }), btn: t('calendar.connectApple'), on: () => setAppleOpen(true) });
    if (a.failedCalendars?.length) notices.push({ k: `f${a.account}`, text: t('calendar.calErr', { list: a.failedCalendars.map((x) => x.name || x.calendarId).join('、') }), soft: true });
  });
  (data?.errors || []).forEach((e) => notices.push({ k: `e${e.source}`, text: t('calendar.sourceErr', { src: t(`calendar.sources.${e.source}`), detail: e.detail || e.code }) }));
  if (!ownSources) notices.push({ k: 'connect', text: t('calendar.empty'), short: t('hkcal.connectChip'), btn: t('hkcal.connect'), on: () => { window.location.assign('/app/connections'); }, b: 'connect', soft: true });
  const shownNotices = notices.filter((n) => !(dismissed[n.k] && Date.now() - dismissed[n.k] < 7 * DAY));

  // ---- render helpers ----
  const chip = (e, compact) => {
    const c = calBy[e.calKey];
    return (
      <button key={e.id + (compact ? 'c' : '')} className={`cal-chip ${e.allDay ? 'allday' : ''}`} style={{ '--c': c?.color }} onClick={(x) => { x.stopPropagation(); setOpen(e); }} title={e.title}>
        {!e.allDay && <span className="cal-chip-dot" />}
        {!e.allDay && !compact && <span className="cal-chip-time">{hkTime(e.startMs)}</span>}
        <span className="cal-chip-title">{e.title || '—'}</span>
      </button>
    );
  };
  const weekdays = t('calendar.weekdays');
  const today = todayKey();

  const MonthView = () => (
    <div className="cal-month">
      <div className="cal-month-head">{weekdays.map((w) => <span key={w}>{w}</span>)}</div>
      <div className="cal-month-grid">
        {range.days.map((k) => {
          const list = events.filter((e) => onDay(e, k));
          const out = k.slice(0, 7) !== cursor.slice(0, 7);
          return (
            <div key={k} className={`cal-cell ${out ? 'out' : ''} ${k === today ? 'today' : ''}`} onClick={() => { setCursor(k); setView('day'); }} role="button" tabIndex={0} onKeyDown={(x) => x.key === 'Enter' && (setCursor(k), setView('day'))}>
              <span className="cal-cell-n">{+k.slice(8)}</span>
              <div className="cal-cell-list">{list.slice(0, 3).map((e) => chip(e, true))}</div>
              {list.length > 3 && <span className="cal-more">{t('calendar.more', { n: list.length - 3 })}</span>}
              {list.length > 0 && <span className="cal-dots" aria-hidden="true">{list.slice(0, 4).map((e) => <i key={e.id} style={{ background: calBy[e.calKey]?.color }} />)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current && view !== 'month') scrollRef.current.scrollTop = 7 * HOUR - 10; }, [view, cursor, !!data]); // eslint-disable-line react-hooks/exhaustive-deps
  const nowMs = Date.now();
  const TimeView = () => (
    <div className={`cal-time ${view === 'day' ? 'is-day' : ''}`} style={{ '--n': range.days.length }}>
      <div className="cal-time-head">
        <span />
        {range.days.map((k, i) => (
          <button key={k} className={`cal-dayhead ${k === today ? 'today' : ''}`} onClick={() => { setCursor(k); setView('day'); }}>
            <small>{weekdays[(i + (view === 'day' ? (new Date(`${k}T00:00:00Z`).getUTCDay() + 6) % 7 : 0)) % 7]}</small><b>{+k.slice(8)}</b>
          </button>
        ))}
      </div>
      <div className="cal-allday">
        <span className="cal-gutter-label">{t('calendar.allDay')}</span>
        {range.days.map((k) => <div key={k} className="cal-allday-cell">{events.filter((e) => e.allDay && onDay(e, k)).map((e) => chip(e, true))}</div>)}
      </div>
      <div className="cal-scroll" ref={scrollRef}>
        <div className="cal-grid" style={{ height: 24 * HOUR }}>
          <div className="cal-gutter">{Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * HOUR }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</span>)}</div>
          {range.days.map((k) => (
            <div key={k} className="cal-col" onDoubleClick={(x) => { const r = x.currentTarget.getBoundingClientRect(); newEvent(k, Math.floor((x.clientY - r.top) / HOUR)); }}>
              {Array.from({ length: 24 }, (_, h) => <i key={h} className="cal-line" style={{ top: h * HOUR }} />)}
              {k === today && <i className="cal-now" style={{ top: ((nowMs - dayStart(k)) / 3600e3) * HOUR }} />}
              {layoutDay(events.filter((e) => !e.allDay && onDay(e, k)), k).map((it) => {
                const c = calBy[it.e.calKey];
                return (
                  <button key={it.e.id} className="cal-ev" style={{ top: it.top, height: it.height - 2, left: `calc(${(it.col / it.cols) * 100}% + 2px)`, width: `calc(${100 / it.cols}% - 4px)`, '--c': c?.color }} onClick={() => setOpen(it.e)} title={it.e.title}>
                    <b>{it.e.title || '—'}</b>
                    {it.height > 34 && <small>{hkTime(it.e.startMs)} – {hkTime(it.e.endMs)}{it.e.location ? ` · ${it.e.location}` : ''}</small>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const Legend = () => (
    <div className="cal-legend">
      {groups.map((g) => (
        <div key={`${g.source}|${g.account}`} className="cal-legend-group">
          <span className="cal-legend-src">{t(`calendar.sources.${g.source}`)}{g.source === 'hk' || g.source === 'nest' || g.source === 'region' ? '' : ` · ${g.source === 'family' ? (g.list[0]?.name) : g.account}`}</span>
          {g.list.map((c) => (
            <button key={c.key} className={`cal-legend-row ${c.on ? 'on' : ''}`} style={{ '--c': c.color }} onClick={() => toggleCal(c.key)} aria-pressed={c.on} title={c.on ? t('calendar.hide') : t('calendar.show')}>
              <span className="cal-swatch">{c.on && <Icon name="check" size={12} stroke={3} />}</span>
              <span className="cal-legend-name">{g.source === 'family' ? t('calendar.sharedBy', { name: c.name }) : c.name}</span>
              {!c.writable && g.source !== 'family' && <small className="cal-ro">{t('calendar.readOnly')}</small>}
            </button>
          ))}
        </div>
      ))}
      {fid && (
        <div className="cal-share">
          <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <span className="cal-share-label"><b>{t('calendar.share')}</b><small>{t('calendar.shareSub')}</small></span>
            <button type="button" className={`toggle ${sharing ? 'on' : ''}`} role="switch" aria-checked={sharing} aria-label={t('calendar.share')} onClick={toggleShare} />
          </div>
          {shareErr && <small className="error-text cal-share-err">{t('calendar.shareFail')}</small>}
          {!famShares.length && !shareErr && <small className="muted cal-share-err">{t('calendar.familyNone')}</small>}
        </div>
      )}
      <div className="cal-legend-actions">
        <Button size="sm" variant="outline" icon="plus" onClick={() => setAppleOpen(true)}>{t('calendar.connectApple')}</Button>
        <Button size="sm" variant="ghost" to="/app/connections">{t('calendar.manage')}</Button>
      </div>
    </div>
  );

  const openCal = open && calBy[open.calKey];
  const ff = form?.fields;
  const setF = (patch) => setForm((x) => ({ ...x, fields: { ...x.fields, ...patch } }));

  return (
    <>
      <div className="cal-head">
        <div className="cal-head-row">
          <h1 className="cal-title">{hasSources ? <><span className="desk-only">{label}</span><span className="mob-only">{shortLabel}</span></> : t('calendar.title')}</h1>
          {hasSources && (
            <div className="cal-head-actions">
              {loading && <Spinner small />}
              <button className="cal-today" onClick={() => setCursor(todayKey())}>{t('calendar.today')}</button>
              <button className="icon-btn" aria-label={t('calendar.prev')} onClick={() => step(-1)}><Icon name="chevronRight" size={18} className="icon-flip" /></button>
              <button className="icon-btn" aria-label={t('calendar.next')} onClick={() => step(1)}><Icon name="chevronRight" size={18} /></button>
              <button className="cal-add" aria-label={t('calendar.newEvent')} title={t('calendar.newEvent')} onClick={() => newEvent()}><Icon name="plus" size={18} stroke={2.4} /></button>
            </div>
          )}
        </div>
        {hasSources && (
          <div className="cal-head-row2">
            <div className="segment cal-seg" role="tablist">
              {['day', 'week', 'month'].map((v) => <button key={v} role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{t(`calendar.views.${v}`)}</button>)}
            </div>
            <button className="icon-btn" aria-label={t('calendar.refresh')} title={t('calendar.refresh')} onClick={load}><Icon name="refresh" size={18} /></button>
            <button className="icon-btn cal-legend-btn" aria-label={t('calendar.calendars')} aria-expanded={legendOpen} onClick={() => setLegendOpen((x) => !x)}><Icon name="eye" size={18} /></button>
          </div>
        )}
      </div>

      {!hasSources ? (
        <div className="card cal-empty">
          <span className="empty-icon"><Icon name="calendar" size={22} /></span>
          <p>{t('calendar.empty')}</p>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button to="/app/connections" icon="plug">{t('calendar.connectGoogle')}</Button>
            <Button variant="outline" onClick={() => setAppleOpen(true)}>{t('calendar.connectApple')}</Button>
          </div>
        </div>
      ) : (
        <>
          {shownNotices.length > 0 && (
            <div className="cal-chips">
              {shownNotices.map((n) => (
                <div key={n.k} className={`cal-chipnote ${n.soft ? 'soft' : ''}`} role="status" title={n.text}>
                  <Icon name={n.soft ? 'lock' : 'shield'} size={14} />
                  <span className="cal-chipnote-t">{n.short || n.text}</span>
                  {n.btn && <button className="cal-chipnote-a" disabled={busy === n.b} onClick={n.on}>{busy === n.b ? <Spinner small /> : n.btn}</button>}
                  <button className="cal-chipnote-x" aria-label={t('calendar.dismiss')} onClick={() => dismiss(n.k)}><Icon name="x" size={14} /></button>
                </div>
              ))}
            </div>
          )}
          <div className={`cal-layout ${legendOpen ? 'legend-open' : ''}`}>
            <div className="cal-main card">
              {!data ? <div className="cal-loading"><Spinner /><span className="muted small">{t('calendar.loading')}</span></div> : view === 'month' ? MonthView() : TimeView()}
              {data && !events.length && view !== 'month' && <p className="muted small cal-none">{t('calendar.noEvents')}</p>}
            </div>
            <aside className="cal-side card">
              <h3 className="cal-side-title">{t('calendar.calendars')}</h3>
              {Legend()}
            </aside>
          </div>
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title || '—'} className="cal-sheet"
        footer={open && (open.htmlLink || (open.editable && !isDemo)) ? (
          <div className="sheet-actions">
            {open.htmlLink && <Button size="sm" variant="ghost" href={open.htmlLink} target="_blank" rel="noreferrer">{t('calendar.openGoogle')}</Button>}
            {open.editable && !isDemo && <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirmDel(open)}>{t('calendar.delete')}</Button>}
            {open.editable && !isDemo && <Button size="sm" onClick={() => editEvent(open)}>{t('calendar.edit')}</Button>}
          </div>
        ) : null}>
        {open && (
          <div className="stack cal-detail">
            <div className="cal-detail-row"><Icon name="calendar" size={18} /><span><b>{open.allDay
              ? (dayKey(open.endMs - 1) === dayKey(open.startMs) ? fmt({ month: 'long', day: 'numeric', weekday: 'short' }, open.startMs) : `${fmt({ month: 'short', day: 'numeric' }, open.startMs)} – ${fmt({ month: 'short', day: 'numeric' }, open.endMs - 1)}`) + ` · ${t('calendar.allDay')}`
              : `${fmt({ month: 'long', day: 'numeric', weekday: 'short' }, open.startMs)} · ${hkTime(open.startMs)} – ${dayKey(open.endMs) !== dayKey(open.startMs) ? fmt({ month: 'short', day: 'numeric' }, open.endMs) + ' ' : ''}${hkTime(open.endMs)}`}</b></span></div>
            <div className="cal-detail-row"><span className="cal-swatch on" style={{ '--c': openCal?.color }} /><span>{open.source === 'family' ? t('calendar.sharedBy', { name: openCal?.name }) + (open.calendarName ? ` · ${open.calendarName}` : '') : (open.source === 'hk' || open.source === 'nest' || open.source === 'region' ? (openCal?.name || '') : `${openCal?.name || ''} · ${open.account}`)}</span></div>
            {open.location && <div className="cal-detail-row"><Icon name="globe" size={18} /><span>{open.location}</span></div>}
            {open.source === 'nest' && open.nest && (
              <>
                {open.repeat && open.repeat !== 'none' && <div className="cal-detail-row"><Icon name="refresh" size={18} /><span>{t(`ncal.rep.${open.repeat}`)}{open.until ? ` · ${t('ncal.untilShort', { date: open.until })}` : ''}</span></div>}
                <div className="cal-detail-row"><Icon name="users" size={18} /><span>{(open.members || []).length ? open.members.map((u) => s.memberName(u)).filter(Boolean).join('、') : t('common.everyone')}</span></div>
                {(open.reminders || []).length > 0 && <div className="cal-detail-row"><Icon name="bell" size={18} /><span>{open.reminders.map((m) => reminderLabel(m, t)).join('、')}</span></div>}
              </>
            )}
            {open.description && <p className="cal-desc">{open.description}</p>}
            {open.recurring && <p className="fine" style={{ margin: 0 }}>{open.source === 'apple' ? t('calendar.appleRecurringNote') : t('calendar.recurringNote')}</p>}
            {!open.editable && !(open.source === 'apple' && open.recurring) && <p className="fine" style={{ margin: 0 }}>{t('calendar.readOnlyNote')}</p>}
          </div>
        )}
      </Sheet>

      <Sheet open={!!form} onClose={() => { setForm(null); setFormErr(''); }} title={form?.mode === 'create' ? t('calendar.newEvent') : t('calendar.edit')} className="cal-sheet"
        footer={ff ? (
          <div className="sheet-actions">
            <Button type="button" variant="ghost" onClick={() => setForm(null)}>{t('calendar.cancel')}</Button>
            <Button type="submit" form="cal-form" loading={busy === 'save'}>{form.mode === 'create' ? t('calendar.create') : t('calendar.save')}</Button>
          </div>
        ) : null}>
        {ff && (
          <form id="cal-form" className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
            {formErr && <p className="cal-formerr" role="alert"><Icon name="alert" size={15} />{formErr}</p>}
            <Field label={t('calendar.titleLabel')}><input className="input" autoFocus={form.mode === 'create' && typeof window !== 'undefined' && window.innerWidth > 720} value={ff.title} onChange={(e) => setF({ title: e.target.value })} placeholder={t('calendar.titlePh')} maxLength={300} /></Field>
            {form.mode === 'create' && (
              <Field label={t('calendar.calendar')}>
                <select className="select" value={ff.calKey} onChange={(e) => setF({ calKey: e.target.value })}>
                  {writable.map((c) => <option key={c.key} value={c.key}>{c.name}{c.source !== 'nest' && c.name !== c.account ? ` (${c.account})` : ''}</option>)}
                </select>
              </Field>
            )}
            <label className="row cal-allday-toggle"><span style={{ fontWeight: 800 }}>{t('calendar.allDay')}</span><button type="button" className={`toggle ${ff.allDay ? 'on' : ''}`} role="switch" aria-checked={ff.allDay} onClick={() => setF({ allDay: !ff.allDay })} /></label>
            <div className="cal-form-2">
              {ff.allDay ? (
                <>
                  <Field label={t('calendar.start')}><input className="input" type="date" value={ff.startDate} onChange={(e) => setF({ startDate: e.target.value, endDate: e.target.value > ff.endDate ? e.target.value : ff.endDate })} required /></Field>
                  <Field label={t('calendar.end')}><input className="input" type="date" value={ff.endDate} min={ff.startDate} onChange={(e) => setF({ endDate: e.target.value })} required /></Field>
                </>
              ) : (
                <>
                  <Field label={t('calendar.start')}><input className="input" type="datetime-local" value={ff.start} onChange={(e) => { const d = Date.parse(ff.end + ':00Z') - Date.parse(ff.start + ':00Z'); const ns = e.target.value; setF({ start: ns, end: ns && d >= 0 ? new Date(Date.parse(ns + ':00Z') + d).toISOString().slice(0, 16) : ff.end }); }} required /></Field>
                  <Field label={t('calendar.end')}><input className="input" type="datetime-local" value={ff.end} min={ff.start} onChange={(e) => setF({ end: e.target.value })} required /></Field>
                </>
              )}
            </div>
            {(form.ev?.source || (calBy[ff.calKey] || writable.find((c) => c.key === ff.calKey))?.source) === 'nest' && (
              <>
                <div className="cal-form-2">
                  <Field label={t('ncal.repeat')}>
                    <select className="select" value={ff.repeat || 'none'} onChange={(e) => setF({ repeat: e.target.value })}>
                      {REPEATS.map((r) => <option key={r} value={r}>{t(`ncal.rep.${r}`)}</option>)}
                    </select>
                  </Field>
                  {ff.repeat && ff.repeat !== 'none' && <Field label={t('ncal.until')}><input className="input" type="date" value={ff.until || ''} min={ff.startDate} onChange={(e) => setF({ until: e.target.value })} /></Field>}
                </div>
                <Field label={t('ncal.for')} hint={t('ncal.forHint')}>
                  <div className="ncal-chips">
                    <button type="button" className={!(ff.members || []).length ? 'on' : ''} onClick={() => setF({ members: [] })}>{t('common.everyone')}</button>
                    {s.members.map((m) => { const on = (ff.members || []).includes(m.uid); return <button type="button" key={m.uid} className={on ? 'on' : ''} onClick={() => setF({ members: on ? ff.members.filter((x) => x !== m.uid) : [...(ff.members || []), m.uid] })}>{m.displayName}</button>; })}
                  </div>
                </Field>
                <Field label={t('ncal.remind')}>
                  <div className="ncal-chips">
                    {REMINDER_OPTIONS.map((m) => { const on = (ff.reminders || []).includes(m); return <button type="button" key={m} className={on ? 'on' : ''} onClick={() => setF({ reminders: on ? ff.reminders.filter((x) => x !== m) : [...(ff.reminders || []), m] })}>{reminderLabel(m, t)}</button>; })}
                  </div>
                </Field>
              </>
            )}
            <Field label={t('calendar.location')}><input className="input" value={ff.location} onChange={(e) => setF({ location: e.target.value })} placeholder={t('calendar.locationPh')} /></Field>
            <Field label={t('calendar.notes')}><textarea className="textarea" rows={3} value={ff.description} onChange={(e) => setF({ description: e.target.value })} placeholder={t('calendar.notesPh')} /></Field>
            {form.ev?.recurring && <p className="fine" style={{ margin: 0 }}>{form.ev.source === 'nest' ? t('ncal.seriesNote') : t('calendar.recurringNote')}</p>}
          </form>
        )}
      </Sheet>

      <Sheet open={!!confirmDel} onClose={() => setConfirmDel(null)} title={t('calendar.deleteTitle')} className="cal-sheet cal-sheet-sm">
        {confirmDel && (
          <div className="stack">
            <p style={{ margin: 0, fontWeight: 700 }}>{t('calendar.deleteBody', { title: confirmDel.title, cal: calBy[confirmDel.calKey]?.name || '' })}</p>
            {confirmDel.source === 'nest' && confirmDel.recurring && <p className="fine" style={{ margin: 0 }}>{t('ncal.deleteSeries')}</p>}
            {confirmDel.recurring && <p className="fine" style={{ margin: 0 }}>{t('calendar.deleteRecurring')}</p>}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="ghost" onClick={() => setConfirmDel(null)}>{t('calendar.cancel')}</Button>
              <Button variant="danger" loading={busy === 'del'} onClick={() => del(confirmDel)}>{t('calendar.delete')}</Button>
            </div>
          </div>
        )}
      </Sheet>

      <AppleConnectModal open={appleOpen} onClose={() => setAppleOpen(false)} onDone={() => setTimeout(load, 300)} />
    </>
  );
}
