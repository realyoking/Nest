// Settings → 出門及交通 (Hong Kong): routes / stations for the Home go-out card, walking minutes, "arrive by" + journey
// time. Stored on the owner-only profile: users/{uid}.hk.goOut = { items: [...], walk, arriveBy, journey }.
// Stop picker: KMB / Citybus → route → direction → searchable stop list; MTR → line → station (all via /api/hk/*).
import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Reveal } from './Reveal.jsx';
import { Button, Field, IconButton, Spinner, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { hkGet, goItemKey, MTR_LINES } from '../lib/hk.js';

export default function HKSettings({ delay = 100, collapsible = false }) {
  const { be } = useBe();
  const { t, lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const zh = lang !== 'en';
  const cfg = s.profile?.hk?.goOut || { items: [], walk: 5, arriveBy: '', journey: 0 };
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible || !(cfg.items || []).length);
  useEffect(() => { if (typeof location !== 'undefined' && location.hash === '#hk') setTimeout(() => document.getElementById('hk')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350); }, []);
  const save = async (patch) => {
    try { await be.saveProfile(s.user.uid, { hk: { ...(s.profile?.hk || {}), goOut: { ...cfg, ...patch } } }); } catch { toast(t('common.error'), 'err'); }
  };
  const remove = (k) => save({ items: cfg.items.filter((x) => goItemKey(x) !== k) });
  const label = (x) => (x.co === 'mtr' ? `${MTR_LINES[x.line]?.[zh ? 0 : 1] || x.line} · ${x.name || x.sta}${x.dir ? ` · ${x.dirLabel || x.dir}` : ''}` : `${x.co === 'kmb' ? (zh ? '九巴' : 'KMB') : (zh ? '城巴' : 'Citybus')} ${x.route}${x.dest ? ` ${zh ? '往' : 'to'} ${x.dest}` : ''}`);
  return (
    <Reveal className="card" delay={delay} id="hk">
      <div className="hk-head">
        <h2 className="set-h">{collapsible ? t('tr.setup') : t('hkset.title')}</h2>
        {collapsible && (cfg.items || []).length > 0 && <Button size="sm" variant={expanded ? 'primary' : 'outline'} onClick={() => setExpanded((v) => !v)}>{expanded ? t('tr.done') : t('tr.edit')}</Button>}
      </div>
      {collapsible && !expanded ? (
        <p className="muted small hk-sum">{t('tr.setupSum', { n: cfg.items.length, w: cfg.walk ?? 5 })}{cfg.arriveBy ? t('tr.setupArrive', { t: cfg.arriveBy }) : ''}</p>
      ) : (<>
      <p className="muted small" style={{ marginTop: -6, fontWeight: 600 }}>{t('hkset.lead')}</p>
      <div className="hk-items">
        {cfg.items.map((x) => (
          <div className="hk-item" key={goItemKey(x)}>
            <Icon name={x.co === 'mtr' ? 'train' : 'bus'} size={18} />
            <div><b>{label(x)}</b>{x.co !== 'mtr' && <small>{x.name}</small>}</div>
            <IconButton icon="x" label={t('common.delete')} onClick={() => remove(goItemKey(x))} />
          </div>
        ))}
        {cfg.items.length < 6 && <Button size="sm" variant="outline" icon="plus" onClick={() => setOpen(true)}>{t('hkset.add')}</Button>}
      </div>
      <div className="set-row">
        <div className="set-text"><b>{t('hkset.walk')}</b><small>{t('hkset.walkHint')}</small></div>
        <div className="set-ctl"><input className="input hk-num" type="number" min="0" max="60" value={cfg.walk ?? 5} onChange={(e) => save({ walk: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} /></div>
      </div>
      <div className="set-row">
        <div className="set-text"><b>{t('hkset.arriveBy')}</b><small>{t('hkset.arriveHint')}</small></div>
        <div className="set-ctl hk-arrive">
          <input className="input" type="time" value={cfg.arriveBy || ''} onChange={(e) => save({ arriveBy: e.target.value })} aria-label={t('hkset.arriveBy')} />
          <input className="input hk-num" type="number" min="0" max="180" placeholder={t('hkset.mins')} value={cfg.journey || ''} onChange={(e) => save({ journey: Math.max(0, Math.min(180, Number(e.target.value) || 0)) })} aria-label={t('hkset.journey')} />
        </div>
      </div>
      </>)}
      {open && <StopPicker onClose={() => setOpen(false)} onPick={async (x) => { if (cfg.items.some((y) => goItemKey(y) === goItemKey(x))) { setOpen(false); return; } await save({ items: [...cfg.items, x] }); setOpen(false); toast(t('hkset.added')); }} />}
    </Reveal>
  );
}

function StopPicker({ onClose, onPick }) {
  const { be } = useBe();
  const { t, lang } = useI18n();
  const zh = lang !== 'en';
  const [co, setCo] = useState('kmb');
  const [route, setRoute] = useState('');
  const [dirs, setDirs] = useState(null);
  const [dir, setDir] = useState(null);
  const [stops, setStops] = useState(null);
  const [q, setQ] = useState('');
  const [mtr, setMtr] = useState(null);
  const [line, setLine] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mock = !!be.MOCK;
  useEffect(() => { setDirs(null); setDir(null); setStops(null); setErr(''); }, [co]);
  useEffect(() => {
    if (co !== 'mtr' || mtr) return;
    if (mock) { setMtr({ lines: [{ line: 'TML', tc: '屯馬綫', en: 'Tuen Ma Line', stations: [{ code: 'STW', tc: '石門', en: 'Shek Mun' }, { code: 'TAW', tc: '大圍', en: 'Tai Wai' }] }] }); return; }
    hkGet('mtr', {}, { maxAge: 3600e3 }).then(setMtr).catch(() => setErr(t('hkset.loadFail')));
  }, [co]); // eslint-disable-line react-hooks/exhaustive-deps
  const findRoute = async (e) => {
    e?.preventDefault();
    const r = route.trim().toUpperCase(); if (!r) return;
    setBusy(true); setErr(''); setDir(null); setStops(null);
    try {
      const j = mock ? { routes: [{ dir: 'O', svc: '1', orig_tc: '恆安', orig_en: 'Heng On', dest_tc: '大學站', dest_en: 'University Station' }] } : await hkGet('routes', { co, route: r });
      setDirs(j.routes || []); if (!(j.routes || []).length) setErr(t('hkset.noRoute'));
    } catch { setErr(t('hkset.loadFail')); } finally { setBusy(false); }
  };
  const pickDir = async (d) => {
    setDir(d); setBusy(true); setErr(''); setQ('');
    try {
      const j = mock ? { stops: [{ id: 'demo', seq: 1, tc: '沙角邨', en: 'Sha Kok Estate' }, { id: 'demo2', seq: 2, tc: '博康邨', en: 'Pok Hong Estate' }] } : await hkGet('stops', { co, route: route.trim().toUpperCase(), dir: d.dir, svc: d.svc });
      setStops(j.stops || []);
    } catch { setErr(t('hkset.loadFail')); } finally { setBusy(false); }
  };
  const shown = useMemo(() => (stops || []).filter((x) => !q || `${x.tc} ${x.en}`.toLowerCase().includes(q.toLowerCase())), [stops, q]);
  const lineObj = mtr?.lines?.find((l) => l.line === line);
  return (
    <Sheet open onClose={onClose} title={t('hkset.pickTitle')}>
      <div className="segment hk-seg" role="tablist">
        {[['kmb', zh ? '九巴' : 'KMB'], ['ctb', zh ? '城巴' : 'Citybus'], ['mtr', zh ? '港鐵' : 'MTR']].map(([k, l]) => <button key={k} role="tab" aria-selected={co === k} className={co === k ? 'on' : ''} onClick={() => setCo(k)}>{l}</button>)}
      </div>
      {err && <p className="error-text small" style={{ fontWeight: 700 }}>{err}</p>}
      {co !== 'mtr' ? (
        <>
          <form className="hk-route" onSubmit={findRoute}>
            <input className="input" value={route} onChange={(e) => setRoute(e.target.value.toUpperCase().slice(0, 6))} placeholder={t('hkset.routePh')} autoCapitalize="characters" inputMode="text" />
            <Button type="submit" loading={busy && !dir} disabled={!route.trim()}>{t('common.search')}</Button>
          </form>
          {dirs && !dir && dirs.map((d) => (
            <button key={`${d.dir}${d.svc}`} className="hk-pick" onClick={() => pickDir(d)}>
              <b>{zh ? d.dest_tc : d.dest_en}</b><small>{t('hkset.from', { place: zh ? d.orig_tc : d.orig_en })}{d.svc !== '1' ? ` · ${t('hkset.special')}` : ''}</small><Icon name="chevronRight" size={16} />
            </button>
          ))}
          {dir && (
            <>
              <button className="hk-back small" onClick={() => { setDir(null); setStops(null); }}>‹ {zh ? dir.dest_tc : dir.dest_en}</button>
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('hkset.stopPh')} />
              {busy && <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>}
              <div className="hk-stops">
                {shown.map((x) => (
                  <button key={`${x.id}-${x.seq}`} className="hk-pick" onClick={() => onPick({ co, route: route.trim().toUpperCase(), dir: dir.dir, svc: Number(dir.svc) || 1, stop: x.id, name: zh ? x.tc : x.en, dest: zh ? dir.dest_tc : dir.dest_en })}>
                    <span className="hk-seq">{x.seq}</span><b>{zh ? x.tc : x.en}</b>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {!mtr && !err && <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>}
          {mtr && !line && mtr.lines.map((l) => (
            <button key={l.line} className="hk-pick" onClick={() => setLine(l.line)}>
              <b>{zh ? l.tc : l.en}</b>{mtr.status?.[l.line] && mtr.status[l.line].status !== 'green' && <small className="error-text">{t('hkset.disrupted')}</small>}<Icon name="chevronRight" size={16} />
            </button>
          ))}
          {lineObj && (
            <>
              <button className="hk-back small" onClick={() => setLine('')}>‹ {zh ? lineObj.tc : lineObj.en}</button>
              <div className="hk-stops">
                {lineObj.stations.map((st) => <button key={st.code} className="hk-pick" onClick={() => onPick({ co: 'mtr', line: lineObj.line, sta: st.code, name: zh ? st.tc : st.en })}><b>{zh ? st.tc : st.en}</b></button>)}
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
