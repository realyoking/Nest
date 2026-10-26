// Store detail screenshot gallery: swipeable strip (scroll-snap, touch momentum) + tap to enlarge (lightbox with
// swipe / arrow keys / buttons, Esc or backdrop closes). Alt text from the listing editor is used for every image.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';

export default function Gallery({ shots = [], alts = [], video = null }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(-1);
  return (
    <>
      <div className="ps-shots gal-strip" data-testid="gallery">
        {video}
        {shots.map((s, i) => (
          <button key={i} type="button" className="gal-item" onClick={() => setOpen(i)} aria-label={t('gallery.open', { n: i + 1 })}>
            <img className="gal-img" src={s} alt={alts[i] || ''} loading="lazy" />
          </button>
        ))}
      </div>
      {open >= 0 && <Lightbox shots={shots} alts={alts} start={open} onClose={() => setOpen(-1)} />}
    </>
  );
}

function Lightbox({ shots, alts, start, onClose }) {
  const { t } = useI18n();
  const [i, setI] = useState(start);
  const track = useRef(null);
  const go = (n) => { const k = Math.max(0, Math.min(shots.length - 1, n)); const el = track.current; if (el) el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' }); setI(k); };
  useEffect(() => {
    const el = track.current; if (el) el.scrollLeft = start * el.clientWidth;
    const key = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowRight') go(iRef.current + 1); else if (e.key === 'ArrowLeft') go(iRef.current - 1); };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const iRef = useRef(i); iRef.current = i;
  const onScroll = () => { const el = track.current; if (el) { const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (k !== iRef.current) setI(k); } };
  return createPortal(
    <div className="gal-lb" role="dialog" aria-modal="true" aria-label={t('gallery.count', { a: i + 1, b: shots.length })} data-testid="lightbox" onClick={(e) => { if (e.target === e.currentTarget || e.target.classList.contains('gal-slide')) onClose(); }}>
      <div className="gal-track" ref={track} onScroll={onScroll}>
        {shots.map((s, k) => <div key={k} className="gal-slide"><img src={s} alt={alts[k] || ''} /></div>)}
      </div>
      <div className="gal-bar">
        <button type="button" className="gal-btn" onClick={() => go(i - 1)} disabled={i === 0} aria-label={t('gallery.prev')}><Icon name="chevronRight" size={20} className="icon-flip" /></button>
        <span className="gal-count">{t('gallery.count', { a: i + 1, b: shots.length })}{alts[i] ? <small>{alts[i]}</small> : null}</span>
        <button type="button" className="gal-btn" onClick={() => go(i + 1)} disabled={i === shots.length - 1} aria-label={t('gallery.next')}><Icon name="chevronRight" size={20} /></button>
      </div>
      <button type="button" className="gal-close" onClick={onClose} aria-label={t('gallery.close')}><Icon name="x" size={20} /></button>
    </div>,
    document.body,
  );
}
