// In-app announcements (Run 8b), ChatGPT-style: a centred "What's new" modal over a blurred backdrop, a top banner, or a
// toast. Text is markdown (marked + DOMPurify via <Markdown>), the image comes from /api/app/img (or a data URL in the
// admin preview). Counts: seen (once per device) / clicked / dismissed / "don't show again" → POST /api/app/ann.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Markdown } from './ui.jsx';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { annText } from '../lib/admin-config.js';
import { useAppConfig } from '../lib/appconfig.jsx';

const imgSrc = (a, preview) => (preview && a.imgData) || (a.img ? `/api/app/img?id=${encodeURIComponent(a.img)}` : '');

// Presentational: used by the live shell and by the admin preview (preview = no network, no navigation).
export function AnnouncementView({ a, lang, onClose, onCta, onNever, preview = false, inline = false }) {
  const { t } = useI18n();
  const tx = annText(a, lang);
  const [never, setNever] = useState(false);
  const src = imgSrc(a, preview);
  const close = () => (never && onNever ? onNever() : onClose?.());
  const cta = tx.cta && a.link ? <button type="button" className="btn btn-primary ann-cta" onClick={onCta}>{tx.cta}</button> : null;
  if (a.style === 'banner') {
    return (
      <div className={`ann-banner ${inline ? 'inline' : ''}`} role="status" data-testid="ann-banner">
        <Icon name="sparkle" size={16} />
        <div className="ann-banner-txt"><b>{tx.title}</b>{tx.body && <span className="ann-banner-body"><Markdown text={tx.body.split('\n')[0]} /></span>}</div>
        {cta && <button type="button" className="ann-banner-cta" onClick={onCta}>{tx.cta}</button>}
        {a.dismissible && <button type="button" className="ann-x" aria-label={t('ann.close')} onClick={onClose}><Icon name="x" size={15} /></button>}
      </div>
    );
  }
  if (a.style === 'toast') {
    return (
      <div className={`ann-toast ${inline ? 'inline' : ''}`} role="status" data-testid="ann-toast">
        {src && <img src={src} alt="" className="ann-toast-img" />}
        <div className="ann-toast-txt"><b>{tx.title}</b>{tx.body && <Markdown text={tx.body} />}{cta}</div>
        {a.dismissible && <button type="button" className="ann-x" aria-label={t('ann.close')} onClick={onClose}><Icon name="x" size={15} /></button>}
      </div>
    );
  }
  return (
    <div className={`ann-wrap ${inline ? 'inline' : ''}`} onClick={a.dismissible ? close : undefined}>
      <div className="ann-modal" role="dialog" aria-modal={!inline} aria-labelledby={`ann-t-${a.id || 'pv'}`} onClick={(e) => e.stopPropagation()} data-testid="ann-modal">
        {a.dismissible && <button type="button" className="ann-x ann-x-modal" aria-label={t('ann.close')} onClick={close}><Icon name="x" size={18} /></button>}
        {src ? <img src={src} alt="" className="ann-img" /> : <div className="ann-badge"><Icon name="sparkle" size={22} /></div>}
        <div className="ann-body">
          <p className="ann-kicker">{t('ann.kicker')}</p>
          <h2 id={`ann-t-${a.id || 'pv'}`}>{tx.title}</h2>
          {tx.body && <Markdown text={tx.body} className="ann-md" />}
        </div>
        <div className="ann-actions">
          {cta || (a.dismissible && <button type="button" className="btn btn-primary ann-cta" onClick={close}>{t('ann.ok')}</button>)}
          {a.dismissible && a.neverAgain && onNever && (
            <label className="ann-never"><input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />{t('ann.never')}</label>
          )}
        </div>
      </div>
    </div>
  );
}

// Live: shows the highest-priority announcement (one modal at a time; banners/toasts can stack under it).
export default function Announcements() {
  const ac = useAppConfig();
  const { uiLang } = useI18n();
  const nav = useNavigate();
  const [hidden, setHidden] = useState(() => new Set());
  const list = (ac.announcements || []).filter((a) => !hidden.has(a.id));
  const modal = list.find((a) => a.style === 'modal');
  const banner = list.find((a) => a.style === 'banner');
  const toast = modal ? null : list.find((a) => a.style === 'toast'); // one floating card at a time
  const shown = [modal, banner, toast].filter(Boolean);
  useEffect(() => { shown.forEach((a) => ac.event(a.id, 'seen')); }, [shown.map((a) => a.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const hide = (a, ev) => { setHidden((h) => new Set([...h, a.id])); ac.event(a.id, ev); };
  const open = (a) => {
    ac.event(a.id, 'click'); setHidden((h) => new Set([...h, a.id])); if (a.dismissible) ac.event(a.id, 'dismiss');
    if (/^\/(app|beta|pricing)/.test(a.link)) nav(a.link); else if (/^https:\/\//.test(a.link)) window.open(a.link, '_blank', 'noopener,noreferrer');
  };
  if (!shown.length) return null;
  return (
    <>
      {banner && <AnnouncementView a={banner} lang={uiLang} onClose={() => hide(banner, 'dismiss')} onCta={() => open(banner)} />}
      {toast && <AnnouncementView a={toast} lang={uiLang} onClose={() => hide(toast, 'dismiss')} onCta={() => open(toast)} />}
      {modal && <AnnouncementView a={modal} lang={uiLang} onClose={() => hide(modal, 'dismiss')} onNever={() => hide(modal, 'never')} onCta={() => open(modal)} />}
    </>
  );
}

// Full-screen states from the config: maintenance (non-admins), suspended account, sign-ups closed, feature switched off.
export function BlockScreen({ kind, message }) {
  const { t } = useI18n();
  return (
    <div className="blockscreen" data-testid={`block-${kind}`}>
      <div className="blockscreen-in">
        <span className="blockscreen-icon"><Icon name={kind === 'maintenance' ? 'gear' : kind === 'feature' ? 'puzzle' : 'shield'} size={26} /></span>
        <h1>{t(`acfg.${kind}.title`)}</h1>
        <p>{message || t(`acfg.${kind}.body`)}</p>
      </div>
    </div>
  );
}
