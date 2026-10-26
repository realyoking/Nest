// Home: HKO warning banner, morning go-out card, "revised yet?" nudge card + the live-data hooks behind them.
// Live data comes from /api/hk/* (cached server routes); demo / mock builds use static data and never call the network.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { trainsForLeg, stationName } from '../lib/transit.js';
import Icon from './Icon.jsx';
import { Button, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { hkGet, goItemKey, leavePlan, MTR_LINES, upcomingHolidays, EDB_WEATHER_URL, HKO_WARN_URL, hkHM, weatherLine } from '../lib/hk.js';
import { nudgeItems, hkDayKey } from '../lib/detect.js';
import { hkFeatures, normRegion, staticHolidays } from '../lib/regions/index.js';
import { demoInputs } from '../lib/digest.js';

const visible = () => typeof document === 'undefined' || document.visibilityState === 'visible';
function usePoll(fn, ms, deps) {
  useEffect(() => {
    let live = true;
    const run = () => { if (live && visible()) fn(() => live); };
    run();
    const iv = setInterval(run, ms);
    const vis = () => visible() && run();
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('nest:refresh', run); // Run 22: pull-to-refresh
    return () => { live = false; clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('nest:refresh', run); };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// Warnings (every 3 min; each call also triggers the server's new-warning check + family push), weather, holidays.
export function useHK() {
  const { be } = useBe();
  const { lang } = useI18n();
  const s = useSession();
  const mock = !!be.MOCK;
  // Run 11: HKO warnings / weather / 1823 holidays only for Hong Kong; other regions get their pack's static holidays.
  const region = normRegion(s.profile?.region);
  const hkOn = mock || !region || hkFeatures(region);
  const [warn, setWarn] = useState(() => (mock ? demoInputs(lang).warn : null));
  const [weather, setWeather] = useState(() => (mock ? demoInputs(lang).weather : null));
  const [holidays, setHolidays] = useState([]);
  usePoll(async (live) => { if (mock) return; if (!hkOn) { setWarn(null); return; } try { const j = await hkGet('warn', { lang }, { maxAge: 60e3 }); if (live()) setWarn(j); } catch {} }, 3 * 60e3, [lang, mock, hkOn]);
  usePoll(async (live) => { if (mock) return; if (!hkOn) { setWeather(null); return; } try { const j = await hkGet('weather', { lang }, { maxAge: 5 * 60e3 }); if (live()) setWeather(j); } catch {} }, 10 * 60e3, [lang, mock, hkOn]);
  useEffect(() => {
    if (mock) { setHolidays([]); return; }
    if (!hkOn) { setHolidays(upcomingHolidays(staticHolidays(region, Date.now(), 30).map((h) => ({ date: h.date, name: h.name })), Date.now(), 7)); return; }
    let live = true;
    hkGet('holidays', { lang }, { maxAge: 6 * 3600e3 }).then((j) => live && setHolidays(upcomingHolidays(j.publicHolidays || [], Date.now(), 7))).catch(() => {});
    return () => { live = false; };
  }, [lang, mock, hkOn, region]);
  return { warn: hkOn ? warn : null, weather: hkOn ? weather : null, holidays, hkOn };
}

// Go-out rows from Settings (users/{uid}.hk.goOut): next ETAs + suggested leave time, refreshed every 30 s.
export function useGoOut() {
  const { be } = useBe();
  const { lang } = useI18n();
  const s = useSession();
  const mock = !!be.MOCK;
  const rg = normRegion(s.profile?.region);
  const cfg = mock || !rg || hkFeatures(rg) ? (s.profile?.hk?.goOut || (mock ? DEMO_GO(lang) : null)) : null; // Run 11: go-out card is HK only
  const items = cfg?.items || [];
  const keys = items.map(goItemKey).join(',');
  const [data, setData] = useState(null);
  const [mtr, setMtr] = useState(null);
  usePoll(async (live) => {
    if (!keys) return;
    if (mock) { setData(demoEta(items)); return; }
    try { const j = await hkGet('eta', { items: keys }, { maxAge: 15e3 }); if (live()) setData(j); } catch {}
  }, 30e3, [keys, mock]);
  useEffect(() => {
    if (mock || !items.some((x) => x.co === 'mtr')) return;
    hkGet('mtr', {}, { maxAge: 3600e3 }).then(setMtr).catch(() => {});
  }, [keys, mock]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((n) => n + 1), 20e3); return () => clearInterval(i); }, []);
  const rows = useMemo(() => {
    const now = Date.now();
    const zh = lang !== 'en';
    const byKey = Object.fromEntries((data?.items || []).map((x) => [x.key, x]));
    const stName = (code) => { for (const l of mtr?.lines || []) { const st = l.stations.find((x) => x.code === code); if (st) return zh ? st.tc : st.en; } return code; };
    const out = [];
    items.forEach((it) => {
      const key = goItemKey(it); const d = byKey[key];
      if (it.co === 'mtr') {
        const line = MTR_LINES[it.line]?.[zh ? 0 : 1] || it.line;
        const st = data?.mtrStatus?.[it.line];
        const disrupted = st && st.status && st.status !== 'green';
        // Saved trip from the Transport tab: only trains that actually reach the destination, one combined row.
        if (it.toSta && it.leg) {
          const list = trainsForLeg(d?.mtr, it.leg, now);
          const etas = list.map((x) => x.t);
          out.push({ key: `${key}:${it.toSta}`, co: 'mtr', label: `${line} · ${stationName(it.sta, lang)} → ${stationName(it.toSta, lang)}`, sub: list[0] ? `${zh ? '往' : 'to '}${stationName(list[0].dest, lang)}` : '', etas, plan: leavePlan(etas, cfg, now), status: disrupted ? (zh ? '服務受阻' : 'Disrupted') : d?.mtr?.delay ? (zh ? '列車延誤' : 'Delayed') : '', disrupted });
          return;
        }
        const dirs = it.dir ? [it.dir] : ['UP', 'DOWN'];
        dirs.forEach((dir) => {
          const list = (d?.mtr?.[dir] || []).filter((x) => x.t >= now - 30e3);
          if (!list.length && d?.mtr) return;
          const etas = list.map((x) => x.t);
          out.push({ key: `${key}:${dir}`, co: 'mtr', label: `${line} · ${it.name || stName(it.sta)}`, sub: list[0] ? `${zh ? '往' : 'to '}${stName(list[0].dest)}` : '', etas, plan: leavePlan(etas, cfg, now), status: disrupted ? (zh ? '服務受阻' : 'Disrupted') : d?.mtr?.delay ? (zh ? '列車延誤' : 'Delayed') : '', disrupted });
        });
        return;
      }
      const etas = (d?.etas || []).map((x) => x.t).filter((x) => x >= now - 30e3);
      const dest = d?.etas?.[0] ? (zh ? d.etas[0].dest_tc : d.etas[0].dest_en) : it.dest || '';
      out.push({ key, co: it.co, label: `${it.route} ${dest ? `${zh ? '往' : 'to'} ${dest}` : ''}`.trim(), sub: it.name || '', etas, plan: leavePlan(etas, cfg, now), status: d?.error ? (zh ? '暫時未有資料' : 'No data') : '' });
    });
    return out;
  }, [data, mtr, keys, lang, tick, cfg?.walk, cfg?.arriveBy, cfg?.journey]); // eslint-disable-line react-hooks/exhaustive-deps
  return { configured: items.length > 0, rows, cfg, at: data?.at || 0 };
}
const DEMO_GO = (lang) => ({ walk: 4, arriveBy: '08:00', journey: 25, items: [
  { co: 'kmb', route: '87K', dir: 'O', svc: 1, stop: 'demo', name: lang === 'en' ? 'Sha Kok Estate' : '沙角邨', dest: lang === 'en' ? 'University Station' : '大學站' },
  { co: 'mtr', line: 'TML', sta: 'STW', dir: 'UP', name: lang === 'en' ? 'Shek Mun' : '石門' },
] });
function demoEta(items) {
  const now = Date.now();
  return { at: now, items: items.map((it) => (it.co === 'mtr'
    ? { key: goItemKey(it), mtr: { UP: [3, 7, 11].map((m) => ({ t: now + m * 60e3, dest: 'TUM' })), DOWN: [] } }
    : { key: goItemKey(it), etas: [6, 14, 23].map((m) => ({ t: now + m * 60e3, dest_tc: it.dest, dest_en: it.dest })) })) };
}

export function WarnBanner({ warn }) {
  const { t, lang } = useI18n();
  const top = (warn?.warnings || []).filter((w) => w.sev >= 2);
  if (!top.length && !warn?.school) return null;
  return (
    <div className={`warn-banner ${top.some((w) => w.sev >= 3) ? 'severe' : ''}`} role="alert">
      <Icon name="alert" size={20} />
      <div>
        <b>{top.map((w) => `${w.name}${w.type && !w.name.includes(w.type) ? (lang === 'en' ? ` (${w.type})` : `（${w.type}）`) : ''}`).join(lang === 'en' ? ' · ' : '、')}</b>
        {warn.school && <p>{warn.school.text}</p>}
        {(warn.suspension || []).slice(0, 1).map((x) => <a key={x.link} href={x.link} target="_blank" rel="noreferrer">{x.title}</a>)}
        <span className="warn-links"><a href={HKO_WARN_URL(lang)} target="_blank" rel="noreferrer">{t('today.hko')}</a> · <a href={EDB_WEATHER_URL(lang)} target="_blank" rel="noreferrer">{t('today.edb')}</a></span>
      </div>
    </div>
  );
}

export function GoOutCard({ go, weather, inPage = false }) {
  const { t } = useI18n();
  if (!go.configured) return null;
  const first = go.rows.find((r) => r.plan);
  const w = weather;
  return (
    <div className="card go-card">
      <div className="card-head">
        <h2><Icon name="bus" size={18} />{t('today.goOut')}</h2>
        {w && <span className="go-wx">{weatherLine(w, t)}</span>}
      </div>
      {first && (
        <p className={`go-leave ${first.plan.late ? 'late' : ''}`}>
          {first.plan.leaveAt - Date.now() < 60e3 ? t('today.leaveNow') : t('today.leaveIn', { n: Math.round((first.plan.leaveAt - Date.now()) / 60e3), time: hkHM(first.plan.leaveAt) })}
          <small>{first.plan.late ? t('today.late', { time: go.cfg.arriveBy }) : t('today.catch', { what: first.label, time: hkHM(first.plan.catchAt) })}</small>
        </p>
      )}
      <div className="go-rows">
        {go.rows.map((r) => (
          <div key={r.key} className={`go-row ${r.disrupted ? 'bad' : ''}`}>
            <Icon name={r.co === 'mtr' ? 'train' : 'bus'} size={18} />
            <div className="go-main"><b>{r.label}</b><small>{[r.sub, r.status].filter(Boolean).join(' · ')}</small></div>
            <div className="go-etas">{r.etas.length ? r.etas.slice(0, 3).map((e, i) => <span key={i} className={i ? '' : 'next'}>{Math.max(0, Math.round((e - Date.now()) / 60e3))}<i>{t('today.min')}</i></span>) : <span className="muted">—</span>}</div>
          </div>
        ))}
        {!go.rows.length && <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{t('today.noEta')}</p>}
      </div>
      {!inPage && <Link to="/app/transport" className="small muted go-edit">{t('today.editRoutes')}</Link>}
    </div>
  );
}

// Evening (18:00–23:59 HKT): tests / homework due tomorrow → "Revised yet?" Yes / Not yet (→ remind me later).
export function NudgeCard({ brief, inbox }) {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [later, setLater] = useState(null);
  const h = Number(new Date(Date.now() + 8 * 3600e3).toISOString().slice(11, 13));
  const tomorrow = hkDayKey(Date.now() + 864e5);
  const work = (brief?.googleclassroom || []).flatMap((a) => a.items?.work || []);
  const list = nudgeItems({ work, deadlines: s.profile?.deadlines || [], inbox, reminders: s.reminders }, tomorrow, s.user.uid)
    .filter((n) => !s.profile?.nudges?.[n.key]?.a || s.profile.nudges[n.key].a === 'later');
  const show = (h >= 18 || be.MOCK) && list.length;
  if (!show) return null;
  const answer = async (n, a) => { await be.saveProfile(s.user.uid, { nudges: { ...(s.profile?.nudges || {}), [n.key]: { a, at: Date.now(), title: n.title, due: n.due } } }); };
  const remind = async (n, when) => {
    const now = Date.now();
    const d = when === 'hour' ? new Date(now + 3600e3) : when === 'nine' ? new Date(Date.parse(`${hkDayKey(now)}T21:00:00+08:00`)) : new Date(Date.parse(`${tomorrow}T07:00:00+08:00`));
    await be.addReminder(s.family.id, { title: `${t(n.kind === 'test' ? 'today.revise' : 'today.finish')}${n.title}`, dueAt: d.getTime() > now ? d : new Date(now + 3600e3), memberId: s.user.uid });
    await answer(n, 'later2'); setLater(null); toast(t('home.added'));
  };
  const n = list[0];
  return (
    <div className="card nudge-card">
      <div className="nudge-top"><Icon name="book" size={18} /><span>{t(n.kind === 'test' ? 'today.nudgeTest' : 'today.nudgeHw')}</span>{list.length > 1 && <em>+{list.length - 1}</em>}</div>
      <b className="nudge-title">{n.title}</b>
      {n.sub && <small className="muted">{n.sub}</small>}
      <p className="nudge-q">{t(n.kind === 'test' ? 'today.revisedYet' : 'today.doneYet')}</p>
      {later === n.key ? (
        <div className="nudge-btns">
          <Button size="sm" variant="outline" onClick={() => remind(n, 'hour')}>{t('today.in1h')}</Button>
          {h < 21 && <Button size="sm" variant="outline" onClick={() => remind(n, 'nine')}>{t('today.at9')}</Button>}
          <Button size="sm" variant="outline" onClick={() => remind(n, 'morning')}>{t('today.at7')}</Button>
        </div>
      ) : (
        <div className="nudge-btns">
          <Button size="sm" icon="check" onClick={async () => { await answer(n, 'yes'); toast(t('today.great')); }}>{t(n.kind === 'test' ? 'today.yesRevised' : 'today.yesDone')}</Button>
          <Button size="sm" variant="outline" onClick={() => setLater(n.key)}>{t('today.notYet')}</Button>
        </div>
      )}
    </div>
  );
}

// ?nudge=<key>&ans=yes|later from a notification action.
export function useNudgeAnswer(search) {
  const { be } = useBe();
  const s = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useI18n();
  const done = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(search);
    const key = q.get('nudge'); const ans = q.get('ans');
    if (!key || done.current || !s.user) return;
    done.current = true;
    if (ans === 'yes') { be.saveProfile(s.user.uid, { nudges: { ...(s.profile?.nudges || {}), [key]: { a: 'yes', at: Date.now() } } }).then(() => toast(t('today.great'))).catch(() => {}); }
    nav('/app', { replace: true });
  }, [search, !!s.user]); // eslint-disable-line react-hooks/exhaustive-deps
}
