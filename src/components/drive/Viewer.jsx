// Run 24 step 2b: full-screen preview for a family-drive item. PDF → real pages (pdf.js, lazy chunk); image / video /
// audio → native elements; in-app documents → editor; anything else → type icon + download.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { downloadBlob, saveBlob } from '../../lib/drive-client.js';
import { fmtSize } from '../../lib/attach-core.js';
import DocEditor from './DocEditor.jsx';
import { extOf } from './FileIcon.jsx';

const PdfView = lazy(() => import('./PdfView.jsx'));

export default function Viewer({ item, canEdit, onClose, onSaved, fresh = false }) {
  const { t } = useI18n();
  const [blob, setBlob] = useState(null);
  const [p, setP] = useState(0);
  const [fail, setFail] = useState(false);
  const flush = useRef(null); const box = useRef(null);
  const needsBytes = ['image', 'pdf', 'video', 'audio'].includes(item.kind);
  useEffect(() => {
    if (!needsBytes) return undefined; let live = true;
    downloadBlob(item, { onProgress: (x) => live && setP(x) }).then((b) => live && setBlob(b)).catch(() => live && setFail(true));
    return () => { live = false; };
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const url = useUrl(blob);
  const close = async () => { try { await flush.current?.(); } catch {} onClose(); };
  useEffect(() => {
    const f = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', f); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    box.current?.focus();
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = prev; };
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const dl = async () => { try { saveBlob(blob || await downloadBlob(item), item.name); } catch { setFail(true); } };
  let body;
  if (item.kind === 'doc') body = <DocEditor item={item} fresh={fresh} canEdit={canEdit} onSaved={onSaved} registerFlush={(f) => { flush.current = f; }} />;
  else if (fail) body = <Other item={item} text={t('r24.drive.preview.fail')} onDl={dl} />;
  else if (needsBytes && (!blob || (!url && item.kind !== 'pdf'))) body = <div className="pv-loading" aria-busy="true"><span className="spinner" aria-hidden="true" />{t('r24.drive.preview.loading')}{p > 0 && p < 1 ? ` ${Math.round(p * 100)}%` : ''}</div>;
  else if (item.kind === 'pdf') body = <Suspense fallback={<div className="pv-loading" aria-busy="true"><span className="spinner" aria-hidden="true" /></div>}><PdfView blob={blob} onFail={() => setFail(true)} /></Suspense>;
  else if (item.kind === 'image') body = <div className="pv-media"><img src={url} alt={item.name} data-testid="pv-image" onError={() => setFail(true)} /></div>;
  else if (item.kind === 'video') body = <div className="pv-media"><video src={url} controls playsInline preload="metadata" data-testid="pv-video" onError={() => setFail(true)} /></div>;
  else if (item.kind === 'audio') body = <div className="pv-media pv-audio"><span className="pv-big-ic"><Icon name="play" size={34} /></span><b>{item.name}</b><audio src={url} controls preload="metadata" data-testid="pv-audio" onError={() => setFail(true)} /></div>;
  else body = <Other item={item} text={t('r24.drive.preview.none')} onDl={dl} />;
  return createPortal(
    <div className="pv-wrap" role="dialog" aria-modal="true" aria-label={item.name} data-testid="viewer" data-kind={item.kind} ref={box} tabIndex={-1}>
      <header className="pv-head">
        <button type="button" className="pv-btn" onClick={close} aria-label={t('r24.drive.close')} data-testid="viewer-close"><Icon name="x" size={20} /></button>
        <div className="pv-title"><b>{item.name}</b><small>{[t(`r24.drive.kinds.${item.kind}`), item.kind !== 'doc' && item.size ? fmtSize(item.size) : ''].filter(Boolean).join(' · ')}</small></div>
        {item.kind !== 'doc' && <button type="button" className="pv-btn" onClick={dl} aria-label={t('r24.drive.download')} data-testid="viewer-download"><Icon name="download" size={19} /></button>}
      </header>
      <div className={`pv-body pv-${item.kind}`}>{body}</div>
    </div>, document.body);
}
function Other({ item, text, onDl }) {
  const { t } = useI18n();
  return (
    <div className="pv-other" data-testid="pv-other">
      <span className="fi-ext big">{extOf(item.name) || '—'}</span>
      <b>{item.name}</b><small>{fmtSize(item.size || 0)}</small>
      <p className="muted">{text}</p>
      <button type="button" className="btn btn-primary" onClick={onDl}><Icon name="download" size={18} />{t('r24.drive.download')}</button>
    </div>
  );
}
function useUrl(blob) {
  const [u, setU] = useState('');
  useEffect(() => { if (!blob) return undefined; const x = URL.createObjectURL(blob); setU(x); return () => URL.revokeObjectURL(x); }, [blob]);
  return u;
}
