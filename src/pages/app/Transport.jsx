// 出行 / Transport: pick a start and a destination → MTR route (lines, interchanges, direction), live next trains going
// your way, KMB bus routes between the two places with ETAs, ride time and a suggested leave time. Saved trips live on
// the owner-only profile (users/{uid}.hk.trips) and can feed the Home go-out card (users/{uid}.hk.goOut.items).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { hkGet, hkHM, leavePlan } from '../../lib/hk.js';
import { allStations, stationName, lineName, LINE_COLORS, planMtr, linesAt } from '../../lib/transit.js';
import HKSettings from '../../components/HKSettings.jsx';
import { useGoOut, GoOutCard } from '../../components/HomeCards.jsx';
import { LocalInfo } from '../../components/RegionGate.jsx';
import { hkFeatures, normRegion } from '../../lib/regions/index.js';
// Run 11: live MTR / KMB data is Hong Kong only; other regions see their pack's transport links instead.
export default function Transport() {
  const { t } = useI18n();
  const s = useSession();
  const r = normRegion(s.profile?.region);
  if (!r || hkFeatures(r)) return <TransportHK />;
  return (
    <>
      <PageHeader title={t('app.nav.transport')} />
      <div className="card" data-testid="transport-hk-only"><p className="muted" style={{ fontWeight: 600, marginTop: 0 }}>{t('region.hkOnly')}</p><LocalInfo region={r} /></div>
    </>
  );
}

const LAST = 'nest.tr.last';
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST) || '{}'); } catch { return {}; } };

function StationPicker({ label, value, onChange, placeholder }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const all = useMemo(() => allStations(), []);
  const ql = q.trim().toLowerCase().replace(/\s+/g, '');
  const hits = (ql ? all.filter((s) => s.tc.includes(q.trim()) || s.en.toLowerCase().replace(/\s+/g, '').includes(ql) || s.code.toLowerCase() === ql) : all).slice(0, 40);
  const ref = useRef(null);
  useEffect(() => { const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h); }, []);
  return (
    <div className="tr-pick" ref={ref}>
      <span className="tr-pick-l">{label}</span>
      <input className="input" value={open ? q : value ? stationName(value, lang) : ''} placeholder={placeholder} onFocus={() => { setOpen(true); setQ(''); }} onChange={(e) => { setQ(e.target.value); setOpen(true); }} aria-label={label} />
      {value && !open && <span className="tr-lines">{linesAt(value).map((l) => <i key={l} style={{ background: LINE_COLORS[l] }} title={lineName(l, lang)} />)}</span>}
      {open && (
        <div className="tr-list" role="listbox">
          {hits.map((s) => (
            <button type="button" key={s.code} className="tr-opt" onClick={() => { onChange(s.code); setOpen(false); setQ(''); }}>
              <span className="tr-opt-n"><b>{lang === 'en' ? s.en : s.tc}</b><small>{lang === 'en' ? s.tc : s.en}</small></span>
              <span className="tr-lines">{s.lines.map((l) => <i key={l} style={{ background: LINE_COLORS[l] }} title={lineName(l, lang)} />)}</span>
            </button>
          ))}
          {!hits.length && <p className="muted small" style={{ padding: 12, margin: 0 }}>—</p>}
        </div>
      )}
    </div>
  );
}

// Demo / mock data (no network): computed route + fake trains/buses.
function demoPlan(from, to, lang) {
  const plan = planMtr(from, to); const now = Date.now();
  if (!plan) return { at: now };
  const first = plan.legs.find((l) => l.line !== 'WALK');
  return { at: now, plan: { ...plan, legs: plan.legs.map((l) => ({ ...l, towards: l.dir === 'fwd' ? '' : '' })) }, trains: [2, 6, 10, 14].map((m) => ({ t: now + m * 60e3, dest: first.to, plat: '1' })),
    buses: [{ co: 'kmb', route: '81', dir: 'O', svc: '1', stopId: 'x', stop: lang === 'en' ? 'TAI WAI STATION' : '大圍站', dest: lang === 'en' ? 'WO CHE' : '禾輋', stops: 4, minutes: 8, etas: [now + 4 * 60e3, now + 16 * 60e3] }] };
}

function TransportHK() {
  const { t, lang } = useI18n();
  const { be, demo } = useBe();
  const s = useSession();
  const toast = useToast();
  const isDemo = demo || be.MOCK;
  const hk = s.profile?.hk || {};
  const trips = hk.trips || (isDemo ? [{ from: 'TAW', to: 'SHT' }, { from: 'STW', to: 'UNI' }] : []);
  const last = readLast();
  const [from, setFrom] = useState(last.from || trips[0]?.from || '');
  const [to, setTo] = useState(last.to || trips[0]?.to || '');
  const [walk, setWalk] = useState(String(hk.goOut?.walk ?? 5));
  const [arriveBy, setArriveBy] = useState(hk.goOut?.arriveBy || '');
  // The going-out setup on this page and the planner share the walking minutes / arrive-by time.
  useEffect(() => { if (hk.goOut?.walk != null) setWalk(String(hk.goOut.walk)); }, [hk.goOut?.walk]);
  useEffect(() => { if (hk.goOut?.arriveBy) setArriveBy(hk.goOut.arriveBy); }, [hk.goOut?.arriveBy]);
  const go = useGoOut();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [, setTick] = useState(0);
  useEffect(() => { try { localStorage.setItem(LAST, JSON.stringify({ from, to })); } catch {} }, [from, to]);
  useEffect(() => { const i = setInterval(() => setTick((n) => n + 1), 15e3); return () => clearInterval(i); }, []);
  const load = async (force = false) => {
    if (!from || !to || from === to) { setData(null); return; }
    if (isDemo) { setData(demoPlan(from, to, lang)); return; }
    setLoading(true); setErr('');
    try {
      const j = await hkGet('plan', { from, to, lang }, { maxAge: force ? 0 : 15e3 });
      setData(j);
      // Bus list still warming up on the server → ask again shortly.
      if (j.busesPending) setTimeout(() => hkGet('plan', { from, to, lang, r: String(Date.now() % 1e5) }).then((k) => setData((d) => (d && d.from === k.from && d.to === k.to ? k : d))).catch(() => {}), 5000);
    } catch { setErr(t('tr.error')); } finally { setLoading(false); }
  };
  useEffect(() => { setData(null); load(); const i = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 30e3); return () => clearInterval(i); }, [from, to, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const plan = data?.plan;
  const trains = (data?.trains || []).filter((x) => x.t >= Date.now() - 30e3);
  const lp = plan && trains.length ? leavePlan(trains.map((x) => x.t), { walk: Number(walk) || 0, arriveBy, journey: plan.minutes }) : null;
  const isFav = trips.some((x) => x.from === from && x.to === to);
  const onHomeKey = (x) => (hk.goOut?.items || []).some((it) => it.co === 'mtr' && it.sta === x.from && it.toSta === x.to);
  const saveHK = async (patch) => { if (isDemo) { toast(t('lp.demoOnly')); return false; } try { await be.saveProfile(s.user.uid, { hk: { ...hk, ...patch } }); return true; } catch { toast(t('common.error'), 'err'); return false; } };
  const toggleFav = async () => {
    const next = isFav ? trips.filter((x) => !(x.from === from && x.to === to)) : [{ from, to }, ...trips].slice(0, 8);
    if (await saveHK({ trips: next })) toast(isFav ? t('tr.removeFav') : t('tr.saved'));
  };
  const toggleHome = async (x) => {
    const p = planMtr(x.from, x.to); const first = p?.legs.find((l) => l.line !== 'WALK');
    if (!first) return;
    const cur = hk.goOut || { items: [], walk: Number(walk) || 5, arriveBy: '', journey: 0 };
    const items = onHomeKey(x) ? cur.items.filter((it) => !(it.co === 'mtr' && it.sta === x.from && it.toSta === x.to))
      : [{ co: 'mtr', line: first.line, sta: x.from, toSta: x.to, leg: { line: first.line, from: first.from, to: first.to }, name: `${stationName(x.from, lang)} → ${stationName(x.to, lang)}` }, ...cur.items].slice(0, 6);
    if (await saveHK({ goOut: { ...cur, items, walk: Number(walk) || cur.walk || 5, journey: p.minutes } })) toast(onHomeKey(x) ? t('tr.removeFav') : t('tr.onHomeOn'));
  };
  const mins = (ms) => Math.max(0, Math.round((ms - Date.now()) / 60e3));

  return (
    <div className="tr-page">
      <PageHeader title={t('tr.title')} sub={t('tr.sub')} />
      {go.configured && <GoOutCard go={go} inPage />}
      <HKSettings delay={0} collapsible />
      <h2 className="tr-sec-h">{t('tr.plannerTitle')}</h2>
      <div className="card tr-form">
        <StationPicker label={t('tr.from')} value={from} onChange={setFrom} placeholder={t('tr.fromPh')} />
        <button type="button" className="tr-swap" aria-label={t('tr.swap')} onClick={() => { setFrom(to); setTo(from); }}><Icon name="swap" size={18} /></button>
        <StationPicker label={t('tr.to')} value={to} onChange={setTo} placeholder={t('tr.toPh')} />
      </div>

      {trips.length > 0 && (
        <div className="tr-favs" aria-label={t('tr.fav')}>
          {trips.map((x) => (
            <button key={`${x.from}-${x.to}`} type="button" className={`tr-fav ${x.from === from && x.to === to ? 'on' : ''}`} onClick={() => { setFrom(x.from); setTo(x.to); }}>
              <Icon name="star" size={14} />{stationName(x.from, lang)} → {stationName(x.to, lang)}{onHomeKey(x) && <small> · {t('app.nav.home')}</small>}
            </button>
          ))}
        </div>
      )}

      {(!from || !to) && <p className="muted tr-hint">{t('tr.pickBoth')}</p>}
      {from && to && from === to && <p className="muted tr-hint">{t('tr.same')}</p>}

      {plan && (
        <section className="card tr-card">
          <div className="card-head">
            <h2><Icon name="train" size={18} />{t('tr.mtr')}</h2>
            <span className="muted small">{t('tr.ride', { n: plan.minutes })}</span>
          </div>
          <ol className="tr-legs">
            {plan.legs.map((l, i) => (
              <li key={i} className="tr-leg">
                {l.line === 'WALK'
                  ? <span className="tr-leg-line walk"><Icon name="walk" size={14} />{t('tr.walkLink')}</span>
                  : <span className="tr-leg-line" style={{ background: LINE_COLORS[l.line] }}>{lineName(l.line, lang)}</span>}
                <span className="tr-leg-t"><b>{stationName(l.from, lang)} → {stationName(l.to, lang)}</b>
                  <small>{[l.towards ? t('tr.towards', { st: stationName(l.towards, lang) }) : '', l.stops ? t('tr.stops', { n: l.stops }) : '', t('tr.ride', { n: l.minutes })].filter(Boolean).join(' · ')}</small></span>
              </li>
            ))}
          </ol>
          {(data.status && data.status !== 'green') && <p className="tr-status"><Icon name="alert" size={14} />{t('tr.status')}{data.statusMsg ? ` — ${data.statusMsg}` : ''}</p>}
          <div className="tr-next">
            <span className="tr-next-l">{t('tr.next')} · {stationName(plan.legs.find((l) => l.line !== 'WALK')?.from, lang)}</span>
            <div className="tr-etas">
              {trains.slice(0, 4).map((x, i) => (
                <span key={i} className={`tr-eta ${i ? '' : 'first'}`}><b>{mins(x.t) === 0 ? t('tr.now') : t('tr.inMin', { n: mins(x.t) })}</b><small>{hkHM(x.t)} · {t('tr.towards', { st: stationName(x.dest, lang) })}{x.plat ? ` · ${t('tr.plat', { n: x.plat })}` : ''}</small></span>
              ))}
              {!trains.length && <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{loading ? t('tr.loading') : t('tr.noTrains')}</p>}
            </div>
          </div>
          <div className="cal-form-2 tr-leave-f">
            <Field label={t('tr.walk')}><input className="input" inputMode="numeric" value={walk} onChange={(e) => setWalk(e.target.value.replace(/\D/g, '').slice(0, 2))} /></Field>
            <Field label={t('tr.arriveBy')}><input className="input" type="time" value={arriveBy} onChange={(e) => setArriveBy(e.target.value)} /></Field>
          </div>
          {lp && (
            <p className={`tr-leave ${lp.late ? 'late' : ''}`}>
              <b>{lp.leaveAt - Date.now() < 60e3 ? t('tr.leaveNow') : t('tr.leaveBy', { time: hkHM(lp.leaveAt) })}</b>
              <small>{lp.late ? t('tr.late', { time: arriveBy }) : t('tr.catchT', { time: hkHM(lp.catchAt), arr: hkHM(lp.catchAt + plan.minutes * 60e3) })}</small>
            </p>
          )}
          <div className="tr-acts">
            <Button size="sm" variant={isFav ? 'outline' : 'primary'} icon="star" onClick={toggleFav}>{isFav ? t('tr.removeFav') : t('tr.saveFav')}</Button>
            <Button size="sm" variant="outline" icon="home" onClick={() => toggleHome({ from, to })}>{onHomeKey({ from, to }) ? t('tr.onHomeOn') : t('tr.onHome')}</Button>
            <Button size="sm" variant="ghost" icon="refresh" loading={loading} onClick={() => load(true)}>{t('tr.refresh')}</Button>
          </div>
          <p className="fine" style={{ margin: '8px 0 0' }}>{t('tr.estimate')}{data.at ? ` · ${t('tr.updated', { time: hkHM(data.at) })}` : ''}</p>
        </section>
      )}

      {plan && (
        <section className="card tr-card">
          <div className="card-head"><h2><Icon name="bus" size={18} />{t('tr.buses')}</h2></div>
          {(data.buses == null || data.busesPending) && <p className="muted small">{t('tr.loading')}</p>}
          {data.buses && !data.buses.length && <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{t('tr.noBus')}</p>}
          <div className="tr-buses">
            {(data.buses || []).map((b) => (
              <div key={`${b.route}-${b.dir}`} className="tr-bus">
                <span className="tr-route">{b.route}</span>
                <span className="tr-bus-t"><b>{t('tr.busAt', { stop: b.stop, dest: b.dest })}</b><small>{b.stops ? t('tr.busStops', { n: b.stops }) : ''}</small></span>
                <span className="tr-bus-e">{b.etas.length ? b.etas.slice(0, 2).map((e, i) => <span key={i} className={i ? '' : 'next'}>{mins(e)}<i>{t('today.min')}</i></span>) : <span className="muted">—</span>}</span>
              </div>
            ))}
          </div>
          <p className="fine" style={{ margin: '8px 0 0' }}>{t('tr.busHint')}</p>
        </section>
      )}
      {err && <p className="error-text small" style={{ fontWeight: 700 }}>{err}</p>}
    </div>
  );
}
