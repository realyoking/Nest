// Country / Region picker (Run 11): the SAME component in onboarding, the one-time prompt for existing users and
// Settings → Country / Region. Globe + searchable list of all 249 ISO 3166-1 countries / regions; picking in either one
// rotates / zooms the globe to it. The parent owns the value and the Continue / Save button.
import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from './Globe.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { regionSearch, regionName, flagOf, suggestRegion, packFor } from '../lib/regions/index.js';

export default function RegionPicker({ value, onChange, autoFocusSearch = false, compact = false }) {
  const { t, uiLang } = useI18n();
  const L = uiLang || 'zh-Hant';
  const [q, setQ] = useState('');
  const [suggest] = useState(() => suggestRegion());
  const globe = useRef(null);
  const listRef = useRef(null);
  const list = useMemo(() => regionSearch(q, L), [q, L]);
  const pick = (code) => { onChange?.(code); };
  // Keep the chosen row visible in the list.
  useEffect(() => {
    if (!value || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-code="${value}"]`);
    if (el && el.scrollIntoView) { const r = el.getBoundingClientRect(); const b = listRef.current.getBoundingClientRect(); if (r.top < b.top || r.bottom > b.bottom) el.scrollIntoView({ block: 'nearest' }); }
  }, [value]);
  const [h, setH] = useState(() => (typeof window !== 'undefined' ? Math.round(Math.max(240, Math.min(compact ? 300 : 380, window.innerHeight * (compact ? 0.34 : 0.42)))) : 320));
  useEffect(() => { const f = () => setH(Math.round(Math.max(240, Math.min(compact ? 300 : 380, window.innerHeight * (compact ? 0.34 : 0.42))))); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, [compact]);
  const p = value ? packFor(value) : null;

  return (
    <div className="rp">
      <Globe ref={globe} selected={value} label={value ? regionName(value, L) : ''} flag={value ? flagOf(value) : ''} onPick={pick} height={h} ariaLabel={t('region.globeAria')} />
      <p className="rp-hint muted small">{t('region.globeHint')}</p>
      {suggest && suggest !== value && (
        <button type="button" className="rp-suggest" onClick={() => pick(suggest)} data-testid="region-suggest">
          <span className="rp-flag">{flagOf(suggest)}</span>{t('region.useSuggested', { name: regionName(suggest, L) })}
        </button>
      )}
      <input className="input rp-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('region.search')} aria-label={t('region.search')} autoFocus={autoFocusSearch} data-testid="region-search" />
      <div className="rp-list" ref={listRef} role="listbox" aria-label={t('region.listAria')}>
        {list.map((x) => (
          <button type="button" key={x.code} data-code={x.code} role="option" aria-selected={value === x.code} className={`rp-row ${value === x.code ? 'on' : ''}`} onClick={() => pick(x.code)}>
            <span className="rp-flag">{flagOf(x.code)}</span><span className="rp-name">{x.name}</span><span className="rp-code">{x.code}</span>
          </button>
        ))}
        {!list.length && <p className="muted small" style={{ padding: 12 }}>{t('region.none')}</p>}
      </div>
      {p && <p className="rp-pack muted small" data-testid="region-pack">{p.hasPack ? t('region.hasPack', { name: regionName(value, L) }) : t('region.noPack')}</p>}
    </div>
  );
}
