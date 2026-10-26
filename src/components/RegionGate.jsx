// Run 11: one-time Country / Region prompt for signed-in users whose profile has no region yet, plus the Settings
// → Country / Region modal and the pack's "local info" card. All three use the same lazy RegionPicker.
import { lazy, Suspense, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, useToast } from './ui.jsx';
import { BrandLogo } from '../brand.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { normRegion, regionName, flagOf, packFor, staticHolidays, setActiveRegion } from '../lib/regions/index.js';

const RegionPicker = lazy(() => import('./RegionPicker.jsx'));
const Fallback = () => <div className="globe" style={{ height: 300 }} />;

async function save(be, uid, region) {
  await be.saveProfile(uid, { region, regionAt: Date.now() });
  setActiveRegion(region);
}

export function RegionGate() {
  const { t, lang } = useI18n();
  const s = useSession();
  const { be } = useBe();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (!v) return; setBusy(true); setErr('');
    try { await save(be, s.user.uid, v); } catch (e) { setErr(`${t('region.saveFailed')}${e?.code ? ` (${e.code})` : ''}`); } finally { setBusy(false); }
  };
  return (
    <div className="region-gate" role="dialog" aria-modal="true" aria-labelledby="rg-title" data-testid="region-gate">
      <div className="region-gate-in">
        <BrandLogo lang={lang} />
        <h1 id="rg-title">{t('region.promptTitle')}</h1>
        <p className="lead">{t('region.promptSub')}</p>
        <Suspense fallback={<Fallback />}><RegionPicker value={v} onChange={setV} /></Suspense>
        {err && <div className="error-text">{err}</div>}
        <Button size="lg" disabled={!v} loading={busy} onClick={go} data-testid="region-continue">{v ? t('region.continue') : t('region.choose')}</Button>
      </div>
    </div>
  );
}

// Settings → Country / Region: the same picker with Save. Gated features read s.profile.region, so they update as soon
// as the profile snapshot arrives (no reload).
export function RegionSettings({ open, onClose }) {
  const { t, uiLang } = useI18n();
  const s = useSession();
  const { be } = useBe();
  const toast = useToast();
  const cur = normRegion(s.profile?.region);
  const [v, setV] = useState(cur);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV(cur); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    if (!v) return; setBusy(true);
    try { await save(be, s.user.uid, v); toast(t('region.saved', { name: regionName(v, uiLang) })); onClose?.(); }
    catch { toast(t('region.saveFailed'), 'err'); } finally { setBusy(false); }
  };
  if (!open) return null;
  // Portal: the Settings cards animate with transforms, which would trap a position:fixed modal inside the card.
  return createPortal(
    <Modal open={open} onClose={onClose} title={t('region.settingsLabel')}>
      <div className="region-sheet" data-testid="region-settings">
        {open && <Suspense fallback={<Fallback />}><RegionPicker value={v} onChange={setV} compact /></Suspense>}
        <Button disabled={!v || v === cur} loading={busy} onClick={go} data-testid="region-save">{t('common.save')}</Button>
      </div>
    </Modal>,
    document.body,
  );
}

export const regionLabel = (code, uiLang) => (normRegion(code) ? `${flagOf(code)} ${regionName(code, uiLang)}` : '');

// Compact local-info card for the chosen region (links only; nothing invented).
export function LocalInfo({ region }) {
  const { t, lang } = useI18n();
  const c = normRegion(region); if (!c) return null;
  const p = packFor(c);
  const zh = lang !== 'en';
  const lk = (x) => <a key={x.url} href={x.url} target="_blank" rel="noreferrer">{zh && x.zh ? x.zh : x.label}</a>;
  const hol = p.holidays?.source === 'static' ? staticHolidays(c, Date.now(), 120).slice(0, 3) : [];
  const em = p.emergency?.all || [p.emergency?.police, p.emergency?.ambulance].filter(Boolean).join(' / ');
  return (
    <div className="local-info" data-testid="local-info">
      {em && <div className="li-row"><b>{t('region.local.emergency')}</b><span>{em}</span></div>}
      {p.transport?.length > 0 && <div className="li-row"><b>{t('region.local.transport')}</b><span>{p.transport.map(lk).reduce((a, x, i) => (i ? [...a, ' · ', x] : [x]), [])}</span></div>}
      {p.weather && <div className="li-row"><b>{t('region.local.weather')}</b><span>{lk(p.weather)}</span></div>}
      {(hol.length > 0 || p.holidays?.url) && <div className="li-row"><b>{t('region.local.holidays')}</b><span>{hol.map((h) => `${h.date.slice(5)} ${zh && c === 'CN' ? h.localName : h.name}`).join(' · ')}{hol.length && p.holidays?.url ? ' · ' : ''}{p.holidays?.url && <a href={p.holidays.url} target="_blank" rel="noreferrer">{t('region.local.official')}</a>}</span></div>}
      {p.school?.url && <div className="li-row"><b>{t('region.local.school')}</b><span><a href={p.school.url} target="_blank" rel="noreferrer">{t('region.local.official')}</a></span></div>}
    </div>
  );
}

// Settings card: Country / Region row (opens the picker modal) + local info; HK keeps the Transport shortcut.
export function RegionCard({ delay = 95, onTransport, Reveal, Icon, transportLabel, transportHint }) {
  const { t, uiLang } = useI18n();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const c = normRegion(s.profile?.region);
  return (
    <Reveal className="card" delay={delay} id="region">
      <h2 className="set-h">{t('region.settingsLabel')}</h2>
      <button type="button" className="set-row set-link" onClick={() => setOpen(true)} data-testid="region-row">
        <span className="set-text"><b>{c ? regionLabel(c, uiLang) : t('region.notSet')}</b><small>{t('region.settingsHint')}</small></span>
        <span className="set-ctl"><Icon name="chevronRight" size={18} /></span>
      </button>
      {c && <div style={{ padding: '4px 2px 2px' }}><LocalInfo region={c} /></div>}
      {c === 'HK' && (
        <button type="button" className="set-row set-link" onClick={onTransport}>
          <span className="set-text"><b>{transportLabel}</b><small>{transportHint}</small></span>
          <span className="set-ctl"><Icon name="chevronRight" size={18} /></span>
        </button>
      )}
      <RegionSettings open={open} onClose={() => setOpen(false)} />
    </Reveal>
  );
}
