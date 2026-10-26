// Run 24 step 2b: real PDF preview — pdf.js (lazy chunk) renders the actual pages onto canvases: a thumbnail rail,
// page navigation (buttons, keyboard ← →, page number field) and zoom (− / + / fit width). Never extracted text.
import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';

let libP = null;
export function loadPdfjs() {
  libP ||= (async () => {
    const lib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    lib.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    return lib;
  })();
  return libP;
}
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_THUMBS = 200;

export default function PdfView({ blob, onFail }) {
  const { t } = useI18n();
  const [doc, setDoc] = useState(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState('fit'); // 'fit' | number (1 = 100 %)
  const [thumbs, setThumbs] = useState([]);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(0); // effective scale shown, for the % label
  const stage = useRef(null); const canvas = useRef(null); const task = useRef(null); const rail = useRef(null);

  useEffect(() => { // open the document
    let live = true; let d = null;
    (async () => {
      try {
        const lib = await loadPdfjs();
        d = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/' }).promise; // CJK + standard fonts (copied at build)
        if (live) setDoc(d); else d.destroy();
      } catch (e) { if (live) onFail?.(e); }
    })();
    return () => { live = false; d?.destroy?.(); };
  }, [blob]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // stage width (fit-to-width follows rotation / resizing)
    const el = stage.current; if (!el) return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth)); ro.observe(el); setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [doc]);

  useEffect(() => { // render the current page
    if (!doc || !width || !canvas.current) return undefined;
    let live = true;
    (async () => {
      const p = await doc.getPage(page); if (!live) return;
      const base = p.getViewport({ scale: 1 });
      const scale = zoom === 'fit' ? Math.min(1.6, Math.max(0.2, (width - 24) / base.width)) : zoom; // fit width, capped so a desktop page stays readable
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = p.getViewport({ scale: scale * dpr });
      const c = canvas.current; if (!c) return;
      task.current?.cancel?.();
      const off = document.createElement('canvas'); off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
      const rt = p.render({ canvasContext: off.getContext('2d'), viewport: vp }); task.current = rt;
      try { await rt.promise; } catch { return; }
      if (!live) return;
      c.width = off.width; c.height = off.height; c.style.width = `${Math.floor(vp.width / dpr)}px`; c.style.height = `${Math.floor(vp.height / dpr)}px`;
      c.getContext('2d').drawImage(off, 0, 0); c.dataset.page = String(page); setShown(scale);
    })();
    return () => { live = false; };
  }, [doc, page, zoom, width]);

  useEffect(() => { // thumbnails, one after another
    if (!doc) return undefined;
    let live = true; setThumbs([]);
    (async () => {
      const out = [];
      for (let i = 1; i <= Math.min(doc.numPages, MAX_THUMBS) && live; i++) {
        try {
          const p = await doc.getPage(i); const base = p.getViewport({ scale: 1 }); const vp = p.getViewport({ scale: 150 / base.width });
          const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
          await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
          out.push(c.toDataURL('image/jpeg', 0.7));
        } catch { out.push(''); }
        if (live && (i <= 4 || i % 4 === 0 || i === doc.numPages)) setThumbs([...out]);
      }
    })();
    return () => { live = false; };
  }, [doc]);

  const total = doc?.numPages || 0;
  const go = (n) => setPage((p) => Math.min(Math.max(1, typeof n === 'function' ? n(p) : n), total || 1));
  const zoomBy = (dir) => setZoom(() => { const cur = shown || 1; const next = dir > 0 ? ZOOMS.find((z) => z > cur + 0.01) : [...ZOOMS].reverse().find((z) => z < cur - 0.01); return next || (dir > 0 ? ZOOMS[ZOOMS.length - 1] : ZOOMS[0]); });
  useEffect(() => {
    const f = (e) => {
      if (/input|textarea/i.test(e.target?.tagName || '')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go((p) => p + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go((p) => p - 1); }
      else if (e.key === '+' || e.key === '=') zoomBy(1);
      else if (e.key === '-') zoomBy(-1);
    };
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { rail.current?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [page]);
  useEffect(() => { stage.current?.scrollTo?.(0, 0); }, [page]);

  if (!doc) return <div className="pv-loading" aria-busy="true"><span className="spinner" aria-hidden="true" />{t('r24.drive.preview.loading')}</div>;
  return (
    <div className="pdf-view" data-testid="pdf-view" data-pages={total}>
      <nav className="pdf-rail" ref={rail} aria-label={t('r24.drive.preview.pages')}>
        {Array.from({ length: Math.min(total, MAX_THUMBS) }, (_, i) => (
          <button type="button" key={i} className="pdf-thumb" aria-current={page === i + 1 ? 'page' : undefined} onClick={() => go(i + 1)} data-testid="pdf-thumb" aria-label={t('r24.drive.preview.page', { n: i + 1, total })}>
            {thumbs[i] ? <img src={thumbs[i]} alt="" /> : <span className="pdf-thumb-ph" />}
            <small>{i + 1}</small>
          </button>
        ))}
      </nav>
      <div className="pdf-main">
        <div className="pdf-stage" ref={stage}><canvas ref={canvas} className="pdf-canvas" data-testid="pdf-canvas" /></div>
        <div className="pdf-bar" role="toolbar">
          <button type="button" className="pv-btn" onClick={() => go((p) => p - 1)} disabled={page <= 1} aria-label={t('r24.drive.preview.prev')} data-testid="pdf-prev"><Icon name="arrowLeft" size={18} /></button>
          <label className="pdf-pn"><input className="input" inputMode="numeric" value={page} onChange={(e) => { const n = parseInt(e.target.value, 10); if (n) go(n); }} aria-label={t('r24.drive.preview.page', { n: page, total })} /><span data-testid="pdf-page-label">/ {total}</span></label>
          <button type="button" className="pv-btn" onClick={() => go((p) => p + 1)} disabled={page >= total} aria-label={t('r24.drive.preview.next')} data-testid="pdf-next"><Icon name="arrowRight" size={18} /></button>
          <span className="pdf-sep" />
          <button type="button" className="pv-btn" onClick={() => zoomBy(-1)} aria-label={t('r24.drive.preview.zoomOut')} data-testid="pdf-zoom-out"><b aria-hidden="true">−</b></button>
          <button type="button" className={`pv-btn pdf-zoom ${zoom === 'fit' ? 'on' : ''}`} onClick={() => setZoom('fit')} aria-label={t('r24.drive.preview.fit')} data-testid="pdf-fit">{Math.round((shown || 1) * 100)}%</button>
          <button type="button" className="pv-btn" onClick={() => zoomBy(1)} aria-label={t('r24.drive.preview.zoomIn')} data-testid="pdf-zoom-in"><b aria-hidden="true">+</b></button>
        </div>
      </div>
    </div>
  );
}
