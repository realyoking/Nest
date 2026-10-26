// Published-plugin listing editor (creator only; server re-checks ownership): screenshots (≤6, crop + compress, alt text,
// add / replace / reorder / delete), icon, description (zh + en), 功能, category, links. No code rebuild.
// Safe / Verified plugins: the change is sent for a light admin review (server decides; the UI only explains it).
import { useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { Button, Field, useToast } from './ui.jsx';
import { PluginIcon } from './PluginUI.jsx';
import { useI18n } from '../lib/i18n.jsx';
import * as API from '../lib/plugins/api.js';
import { CATEGORIES } from '../lib/plugins/manifest.js';
import { LISTING_LIMITS } from '../lib/plugins/listing.js';
import { processShot, processIcon } from '../lib/plugins/listing-img.js';

export default function ListingEditor({ open, onClose, detail, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const p = detail.plugin;
  const [descZh, setDescZh] = useState(p.descZh || '');
  const [desc, setDesc] = useState(p.desc || '');
  const [features, setFeatures] = useState(p.features || '');
  const [category, setCategory] = useState(p.category || CATEGORIES[0]);
  const [links, setLinks] = useState((p.links || []).map((l) => ({ ...l })));
  const [icon, setIcon] = useState(p.icon || '');
  // shots: { src (for display), keep?: index, img?: new data URL, alt }
  const [shots, setShots] = useState((detail.shots || []).map((src, i) => ({ src, keep: i, alt: detail.shotAlts?.[i] || '' })));
  const [ratio, setRatio] = useState('auto');
  const [busy, setBusy] = useState(''); const [errs, setErrs] = useState([]);
  const errText = (code) => t(`listing.err.${code}`) !== `listing.err.${code}` ? t(`listing.err.${code}`) : t('common.error');

  const addFiles = async (files) => {
    const list = [...files].slice(0, LISTING_LIMITS.shots - shots.length);
    if (!list.length) { toast(t('listing.max'), 'err'); return; }
    setBusy('img');
    const out = [];
    for (const f of list) {
      try { const r = await processShot(f, ratio === 'auto' ? undefined : ratio); out.push({ src: r.img, img: r.img, alt: '', ratio: r.ratio }); }
      catch (e) { toast(e.message === 'too_large' ? t('listing.tooLarge') : t('listing.badImage'), 'err'); }
    }
    setShots((s) => [...s, ...out].slice(0, LISTING_LIMITS.shots)); setBusy('');
  };
  const replace = async (i, f) => {
    if (!f) return; setBusy('img');
    try { const r = await processShot(f, ratio === 'auto' ? undefined : ratio); setShots((s) => s.map((x, j) => (j === i ? { src: r.img, img: r.img, alt: x.alt, ratio: r.ratio } : x))); }
    catch (e) { toast(e.message === 'too_large' ? t('listing.tooLarge') : t('listing.badImage'), 'err'); }
    setBusy('');
  };
  const move = (i, d) => setShots((s) => { const j = i + d; if (j < 0 || j >= s.length) return s; const n = [...s]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const save = async () => {
    setBusy('save'); setErrs([]);
    try {
      const r = await API.saveListing({
        id: p.id, descZh, desc, features, category, ...(icon !== (p.icon || '') ? { icon } : {}),
        links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label, url: l.url.trim() })),
        shots: shots.map((x) => ('keep' in x && !x.img ? { keep: x.keep, alt: x.alt } : { img: x.img, alt: x.alt })),
      });
      toast(r.review === 'pending' ? t('listing.submitted') : t('listing.saved'));
      onSaved?.(r);
    } catch (e) {
      setErrs(e.errors?.length ? e.errors : [e.code]);
      toast(errText(e.errors?.[0] || e.code), 'err');
    } finally { setBusy(''); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('listing.title')} className="le-sheet"
      footer={<Button onClick={save} loading={busy === 'save'} disabled={!!busy} data-testid="le-save">{t('listing.save')}</Button>}>
      <div className="le stack">
        <p className="muted small" style={{ margin: 0 }}>{t('listing.sub')}</p>
        {p.needsReview && <p className="notice small le-note" data-testid="le-review-note"><Icon name="shield" size={15} />{t('listing.reviewNote')}</p>}
        {p.listingReview === 'pending' && <p className="notice small"><Icon name="alert" size={15} />{t('listing.pending')}</p>}
        {p.listingReview === 'rejected' && p.listingRejectReason && <p className="notice small">{t('listing.rejected', { r: p.listingRejectReason })}</p>}
        {errs.length > 0 && <p className="error-text small" role="alert">{errs.map(errText).join(' ')}</p>}

        <div className="le-icon">
          <PluginIcon src={icon} name={p.nameZh || p.name} size={64} />
          <label className="btn btn-secondary btn-sm"><Icon name="upload" size={16} /><span>{t('listing.changeIcon')}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="vh-file" tabIndex={-1} data-testid="le-icon-input" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { setIcon(await processIcon(f)); } catch (er) { toast(er.message === 'too_large' ? t('listing.tooLarge') : t('listing.badImage'), 'err'); } }} />
          </label>
          {icon && <Button size="sm" variant="ghost" onClick={() => setIcon('')}>{t('listing.removeIcon')}</Button>}
        </div>

        <Field label={t('listing.descZh')}><textarea className="textarea" rows={3} maxLength={LISTING_LIMITS.desc} value={descZh} onChange={(e) => setDescZh(e.target.value)} data-testid="le-desc-zh" /></Field>
        <Field label={t('listing.descEn')}><textarea className="textarea" rows={3} maxLength={LISTING_LIMITS.desc} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        <Field label={t('listing.features')}><textarea className="textarea" rows={4} maxLength={LISTING_LIMITS.features} value={features} onChange={(e) => setFeatures(e.target.value)} /></Field>
        <Field label={t('listing.category')}>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`plug.cat.${c}`)}</option>)}</select>
        </Field>

        <div className="le-links">
          <span className="field-label">{t('listing.links')}</span>
          {links.map((l, i) => (
            <div className="le-link" key={i}>
              <input className="input" placeholder={t('listing.linkLabel')} value={l.label || ''} maxLength={LISTING_LIMITS.linkLabel} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
              <input className="input" placeholder={t('listing.linkUrl')} inputMode="url" value={l.url || ''} onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, url: e.target.value } : y)))} />
              <button type="button" className="icon-btn" aria-label={t('listing.remove')} onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button>
            </div>
          ))}
          {links.length < LISTING_LIMITS.links && <Button size="sm" variant="outline" icon="plus" onClick={() => setLinks((x) => [...x, { label: '', url: 'https://' }])}>{t('listing.addLink')}</Button>}
        </div>

        <div className="le-shots-h">
          <span className="field-label">{t('listing.shots', { n: shots.length })}</span>
          <div className="segment seg-wrap le-ratio" role="radiogroup" aria-label={t('listing.ratio')}>
            {['auto', 'landscape', 'portrait'].map((r) => <button key={r} type="button" role="radio" aria-checked={ratio === r} className={ratio === r ? 'on' : ''} onClick={() => setRatio(r)}>{t(`listing.${r}`)}</button>)}
          </div>
        </div>
        {busy === 'img' && <p className="muted small" role="status">{t('listing.processing')}</p>}
        <ol className="le-shots" data-testid="le-shots">
          {shots.map((x, i) => (
            <li key={`${x.keep ?? 'n'}-${i}-${x.src.length}`} className="le-shot" data-testid="le-shot">
              <img src={x.src} alt={x.alt} />
              <div className="le-shot-ctl">
                <button type="button" className="icon-btn" aria-label={t('listing.left')} disabled={i === 0} onClick={() => move(i, -1)} data-testid="le-left"><Icon name="chevronRight" size={16} className="icon-flip" /></button>
                <span className="le-n">{i + 1}</span>
                <button type="button" className="icon-btn" aria-label={t('listing.right')} disabled={i === shots.length - 1} onClick={() => move(i, 1)} data-testid="le-right"><Icon name="chevronRight" size={16} /></button>
                <label className="icon-btn" aria-label={t('listing.replace')} title={t('listing.replace')}><Icon name="refresh" size={16} /><input type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; replace(i, f); }} /></label>
                <button type="button" className="icon-btn danger" aria-label={t('listing.remove')} onClick={() => setShots((s) => s.filter((_, j) => j !== i))} data-testid="le-del"><Icon name="trash" size={16} /></button>
              </div>
              <input className="input le-alt" placeholder={t('listing.alt')} aria-label={t('listing.alt')} maxLength={LISTING_LIMITS.alt} value={x.alt} onChange={(e) => setShots((s) => s.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)))} />
            </li>
          ))}
          {shots.length < LISTING_LIMITS.shots && (
            <li className="le-shot le-add">
              <label><Icon name="plus" size={22} /><span>{t('listing.addShots')}</span>
                <input type="file" accept="image/*" multiple className="vh-file" tabIndex={-1} data-testid="le-add-input" onChange={(e) => { const f = e.target.files; const copy = f ? [...f] : []; e.target.value = ''; if (copy.length) addFiles(copy); }} />
              </label>
            </li>
          )}
        </ol>
      </div>
    </Sheet>
  );
}
