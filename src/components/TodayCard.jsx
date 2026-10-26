// Run 23 「今日」 card (top of Home): weather · unfinished reminders (one-tap complete + undo) · family schedule today ·
// ONE AI suggestion sentence. The sentence costs at most one Agnes call per family per Hong Kong day: it is cached in
// Firestore by /api/app/today (and in localStorage per device), and falls back to a local rule-based tip.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Reveal } from './Reveal.jsx';
import { useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { useNestie } from './ProgressCard.jsx';
import { openReminders, todaySchedule, factsFor, fallbackLine, lineFor, hkDayOf } from '../lib/today.js';

const DEMO_LINES = {
  'zh-Hant': '今天天氣乾燥，記得多喝水；傍晚前要繳交午膳費。',
  en: 'It’s dry today — drink plenty of water, and the lunch fee is due by this evening.',
  th: 'วันนี้อากาศแห้ง ดื่มน้ำมาก ๆ และอย่าลืมจ่ายค่าอาหารกลางวันก่อนเย็นนี้',
};

export async function fetchTodayLines(be, fid, facts, { mock = false } = {}) {
  const day = hkDayOf();
  const key = `nest.today.${fid}.${day}`;
  try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c?.lines) return { lines: c.lines, cached: true }; } catch {}
  if (mock) return { lines: DEMO_LINES, cached: false, demo: true };
  const ask = async () => {
    const r = await fetch('/api/app/today', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await be.getIdToken()}` }, body: JSON.stringify({ facts }) });
    return r.ok ? r.json() : { failed: true };
  };
  let d = await ask();
  if (d.pending) { await new Promise((r) => setTimeout(r, 7000)); d = await ask(); }
  if (d.lines) { try { localStorage.setItem(key, JSON.stringify({ lines: d.lines })); } catch {} return { lines: d.lines, cached: !!d.cached }; }
  return { lines: null };
}

export default function TodayCard({ weather, warn, brief }) {
  const { be, demo } = useBe();
  const { t, uiLang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const n = useNestie();
  const [shares, setShares] = useState([]);
  useEffect(() => (be.watchCalendarShares ? be.watchCalendarShares(s.family.id, setShares) : undefined), [s.family.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [hide, setHide] = useState(() => new Set()); // just completed (undo window)
  const rems = useMemo(() => openReminders(s.reminders, Date.now(), 5).filter((r) => !hide.has(r.id)), [s.reminders, hide]);
  const sched = useMemo(() => todaySchedule({ shares, brief: brief || {} }), [shares, brief]);
  const [lines, setLines] = useState(null);
  const [loading, setLoading] = useState(true);
  const asked = useRef(false);
  // Ask once per mount, after the weather arrived (or 3 s, whichever first) so the one daily line knows about rain.
  useEffect(() => {
    if (asked.current) return undefined;
    const go = () => {
      if (asked.current) return; asked.current = true;
      const facts = factsFor({ weather, warn, reminders: rems, schedule: sched, members: s.members.map((m) => m.displayName), family: s.family.name });
      fetchTodayLines(be, s.family.id, facts, { mock: !!be.MOCK || demo }).then((r) => setLines(r.lines)).catch(() => {}).finally(() => setLoading(false));
    };
    if (weather) { go(); return undefined; }
    const tm = setTimeout(go, 3000);
    return () => clearTimeout(tm);
  }, [weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const ai = lineFor(lines, uiLang);
  const tip = ai || fallbackLine(uiLang, { weather, reminders: rems, schedule: sched });
  const d = weather?.today || weather?.tomorrow;
  const timeOf = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(11, 16);
  const complete = async (r) => {
    setHide((h) => new Set([...h, r.id]));
    let undone = false;
    toast(t('r23.today.completed', { t: r.title }), 'ok', {
      action: { label: t('r23.today.undo'), onClick: () => { undone = true; setHide((h) => { const x = new Set(h); x.delete(r.id); return x; }); } },
      onExpire: () => { if (!undone) be.updateReminder(s.family.id, r.id, { done: true }).catch(() => { toast(t('common.error'), 'err'); setHide((h) => { const x = new Set(h); x.delete(r.id); return x; }); }); },
    });
  };
  const nameOf = (uid) => (uid ? s.memberName(uid) : t('r23.cards.everyone'));

  return (
    <Reveal className="card today-card" data-testid="today-card">
      <div className="tc-head">
        <h2><Icon name="sparkle" size={18} />{t('r23.today.title')}</h2>
        <span className="tc-date">{fmtDate(new Date(), { month: 'long', day: 'numeric', weekday: 'short' })}</span>
      </div>
      <div className="tc-tip" data-testid="today-tip" data-ai={ai ? '1' : '0'}>
        {loading && !ai ? <span className="tc-skel" aria-label={t('r23.today.loading')}><i /><i /></span> : <p>{tip}</p>}
        <small>{ai ? t('r23.today.tipBy', { name: n.nestieName }) : t('r23.today.tipLocal')}</small>
      </div>
      <div className="tc-grid">
        <section className="tc-sec tc-wx" aria-label={t('r23.today.weather')}>
          <h3><Icon name="cloud" size={15} />{t('r23.today.weather')}</h3>
          {weather ? (
            <div className="tc-wx-row">
              {weather.temp != null && <b className="tc-temp">{weather.temp}°</b>}
              <span>{d ? `${d.min}–${d.max}°` : ''}{d?.psr ? <><br /><small>{t('r23.today.rain')} {d.psr}</small></> : null}</span>
            </div>
          ) : <p className="tc-empty">{t('r23.today.noWeather')}</p>}
        </section>
        <section className="tc-sec" aria-label={t('r23.today.reminders')}>
          <h3><Icon name="bell" size={15} />{t('r23.today.reminders')}{rems.length > 0 && <span className="tc-n">{rems.length}</span>}</h3>
          {rems.length ? (
            <ul className="tc-list">
              {rems.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <button type="button" className="tc-check" aria-label={`${t('r23.today.complete')}: ${r.title}`} onClick={() => complete(r)} data-testid="today-complete"><span /></button>
                  <span className="tc-li-main"><b>{r.title}</b><small className={r.overdue ? 'od' : ''}>{r.overdue ? t('r23.today.overdue') : r.today ? `${t('r23.today.today')} ${timeOf(r.ms)}` : hkDayOf(r.ms) === hkDayOf(Date.now() + 864e5) ? `${t('common.tomorrow')} ${timeOf(r.ms)}` : fmtDate(new Date(r.ms), { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · {nameOf(r.memberId)}</small></span>
                </li>
              ))}
              {rems.length > 3 && <li className="tc-more"><Link to="/app/reminders">{t('r23.today.more', { n: rems.length - 3 })} ›</Link></li>}
            </ul>
          ) : <p className="tc-empty">{t('r23.today.noReminders')}</p>}
        </section>
        <section className="tc-sec" aria-label={t('r23.today.schedule')}>
          <h3><Icon name="calendar" size={15} />{t('r23.today.schedule')}</h3>
          {sched.length ? (
            <ul className="tc-list sched">
              {sched.map((e, k) => <li key={k} className={e.ms < Date.now() - 3600e3 ? 'past' : ''}><span className="tc-time">{timeOf(e.ms)}</span><span className="tc-li-main"><b>{e.title}</b>{(e.who || e.where) && <small>{[e.who, e.where].filter(Boolean).join(' · ')}</small>}</span></li>)}
            </ul>
          ) : <p className="tc-empty">{t('r23.today.noSchedule')}</p>}
        </section>
      </div>
    </Reveal>
  );
}
