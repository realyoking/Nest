// Run 24 (part 1 + 1b): 掃描文件 — multi-page. Camera / upload (several at once) → per page: auto edge detect +
// draggable corners → perspective crop + shadow removal → remove handwriting (auto picks colour ink or dark pen by the
// ink found; dark pen = classical handwriting-vs-print segmentation in src/lib/scan-hand.js) → Erase / Restore brush,
// before/after slider → one multi-page PDF or all images. All on-device in a module worker; no upload, no AI cost.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { FILTERS, REMOVE_MODES } from '../../lib/scan-core.js';
import { runScan } from '../../lib/scan-worker.js';
import { jpegPdf } from '../../lib/scan-pdf.js';

const MAX_IN = 2000; // input long side (keeps low-end devices responsive)
const MAX_PAGES = 30;
const CORNERS = ['tl', 'tr', 'br', 'bl'];
const STAGES = ['detect', 'warp', 'enhance', 'color', 'components', 'lines', 'shapes', 'classify', 'mask', 'compose'];

function makeRunner() {
  let w = null; try { w = new Worker(new URL('../../lib/scan-worker.js', import.meta.url), { type: 'module' }); } catch { w = null; }
  let seq = 0; const wait = new Map();
  if (w) {
    w.onmessage = (e) => { const r = wait.get(e.data.id); if (!r) return; if (e.data.stage) { r.stage?.(e.data.stage); return; } wait.delete(e.data.id); e.data.ok ? r.res(e.data) : r.rej(new Error(e.data.error)); };
    w.onerror = () => { for (const r of wait.values()) r.rej(new Error('worker')); wait.clear(); };
  }
  return {
    call(m, transfer = [], stage) {
      if (!w) return new Promise((res, rej) => setTimeout(() => { try { res(runScan(m, stage)); } catch (e) { rej(e); } }, 30));
      const id = ++seq; return new Promise((res, rej) => { wait.set(id, { res, rej, stage }); w.postMessage({ ...m, id }, transfer); });
    },
    stop() { w?.terminate(); },
  };
}
const filterPx = (f, r, g, b) => { if (f === 'color') return [r, g, b]; const l = 0.299 * r + 0.587 * g + 0.114 * b; const v = f === 'bw' ? (l < 150 ? 0 : 255) : l; return [v, v, v]; };
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function decode(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const s = Math.min(1, MAX_IN / Math.max(bmp.width, bmp.height)); const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  return { cv, w, h, data: cx.getImageData(0, 0, w, h).data };
}
const toBlob = (cv, type = 'image/jpeg', q = 0.9) => new Promise((r) => cv.toBlob(r, type, q));
let pid = 0;

export default function Scanner() {
  const { t } = useI18n();
  const toast = useToast();
  const runner = useRef(null);
  const [pages, setPages] = useState([]); // { id, file, w, h, url, quad, auto, found, status, mode, stats, detected, thumb, result }
  const pagesRef = useRef(pages); pagesRef.current = pages;
  const [cur, setCur] = useState(0);
  const [step, setStep] = useState('pick'); // pick | crop | edit
  const [mode, setMode] = useState('auto');
  const [filter, setFilter] = useState('color');
  const [tool, setTool] = useState('compare');
  const [size, setSize] = useState(22);
  const [pos, setPos] = useState(50);
  const [prog, setProg] = useState(null); // { n, total, stage }
  const [undoN, setUndoN] = useState(0);
  const [busy, setBusy] = useState(false);
  const edit = useRef(null); // current page buffers { id, w, h, flat, enh, out, disp }
  const afterCv = useRef(null), beforeCv = useRef(null);
  const undo = useRef([]);
  const editedBufs = useRef(new Map()); // brushed pages keep their buffers so edits survive switching pages
  const retakeFor = useRef(null);
  useEffect(() => { runner.current = makeRunner(); return () => runner.current?.stop(); }, []);
  useEffect(() => () => { pagesRef.current.forEach((p) => { URL.revokeObjectURL(p.url); if (p.thumb) URL.revokeObjectURL(p.thumb); }); }, []);
  const patch = (id, v) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof v === 'function' ? v(p) : v) } : p)));
  const page = pages[cur] || null;

  // ---------- paint the current page ----------
  const paint = useCallback((f = filter) => {
    const pg = edit.current; const a = afterCv.current, b = beforeCv.current; if (!pg || !a || !b) return;
    a.width = b.width = pg.w; a.height = b.height = pg.h;
    const disp = new ImageData(pg.w, pg.h); const o = pg.out, d = disp.data;
    for (let i = 0; i < o.length; i += 4) { const [r, g, bb] = filterPx(f, o[i], o[i + 1], o[i + 2]); d[i] = r; d[i + 1] = g; d[i + 2] = bb; d[i + 3] = 255; }
    a.getContext('2d').putImageData(disp, 0, 0); pg.disp = disp;
    b.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pg.flat), pg.w, pg.h), 0, 0);
  }, [filter]);
  // final image of a processed buffer set (filter applied) → JPEG blob + thumb
  const render = async (pg, f = filter) => {
    const cv = document.createElement('canvas'); cv.width = pg.w; cv.height = pg.h; const im = new ImageData(pg.w, pg.h); const o = pg.out, d = im.data;
    for (let i = 0; i < o.length; i += 4) { const [r, g, b] = filterPx(f, o[i], o[i + 1], o[i + 2]); d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
    cv.getContext('2d').putImageData(im, 0, 0);
    const result = await toBlob(cv, 'image/jpeg', 0.9);
    const tc = document.createElement('canvas'); const s = 160 / Math.max(pg.w, pg.h); tc.width = Math.round(pg.w * s); tc.height = Math.round(pg.h * s); tc.getContext('2d').drawImage(cv, 0, 0, tc.width, tc.height);
    return { result, thumb: URL.createObjectURL(await toBlob(tc, 'image/jpeg', 0.8)) };
  };
  // process one page (optionally keep its buffers as the page being edited)
  const processPage = async (p, { m = mode, keep = false, n = 1, total = 1 } = {}) => {
    patch(p.id, { status: 'processing' });
    setProg({ n, total, stage: 'detect' });
    const { w, h, data } = await decode(p.file);
    const r = await runner.current.call({ type: 'process', width: w, height: h, buffer: data.buffer, quad: p.quad || null, mode: m }, [data.buffer], (stage) => setProg({ n, total, stage }));
    const buf = { id: p.id, w: r.width, h: r.height, flat: new Uint8ClampedArray(r.flat), enh: new Uint8ClampedArray(r.enh), out: new Uint8ClampedArray(r.out) };
    const { result, thumb } = await render(buf);
    setPages((ps) => ps.map((x) => { if (x.id !== p.id) return x; if (x.thumb) URL.revokeObjectURL(x.thumb); return { ...x, quad: r.quad, found: r.found, status: 'ready', mode: r.mode, req: m, stats: r.stats, detected: r.detected, result, thumb }; }));
    editedBufs.current.delete(p.id);
    if (keep) { edit.current = buf; undo.current = []; setUndoN(0); }
    return buf;
  };
  // sequential queue so low-end devices only hold one page in memory at a time
  const queue = useRef(Promise.resolve());
  const enqueue = (fn) => { queue.current = queue.current.then(fn).catch(() => toast(t('r24.scan.badFile'), 'err')); return queue.current; };

  // ---------- add pages ----------
  const addFiles = async (list) => {
    const files = [...(list || [])].filter((f) => f && (f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)));
    if (!files.length) return;
    const room = MAX_PAGES - pagesRef.current.length; if (room <= 0) { toast(t('r24.scan.maxPages', { n: MAX_PAGES }), 'err'); return; }
    if (retakeFor.current) { // replace one page
      const id = retakeFor.current; retakeFor.current = null; const f = files[0];
      const old = pagesRef.current.find((p) => p.id === id); if (old) URL.revokeObjectURL(old.url);
      patch(id, { file: f, url: URL.createObjectURL(f), quad: null, status: 'new', result: null });
      const p = { ...pagesRef.current.find((x) => x.id === id), file: f, quad: null };
      setBusy(true); await enqueue(async () => { await processPage(p, { keep: true }); }); setBusy(false); paint(); setStep('edit'); return;
    }
    const fresh = files.slice(0, room).map((file) => ({ id: `p${++pid}`, file, url: URL.createObjectURL(file), quad: null, status: 'new' }));
    const first = pagesRef.current.length;
    setPages((ps) => [...ps, ...fresh]);
    setBusy(true);
    await enqueue(async () => {
      for (let k = 0; k < fresh.length; k++) {
        const isFirst = k === 0;
        await processPage(fresh[k], { keep: isFirst, n: k + 1, total: fresh.length });
        if (isFirst) { setCur(first); setStep('edit'); await new Promise((r) => requestAnimationFrame(r)); paint(); }
      }
    });
    setProg(null); setBusy(false);
  };

  // ---------- switch / reorder / delete ----------
  const commitCurrent = async () => {
    const pg = edit.current; if (!pg || !undo.current.length) return; // only re-render when brushed
    editedBufs.current.set(pg.id, pg);
    const { result, thumb } = await render(pg); setPages((ps) => ps.map((x) => { if (x.id !== pg.id) return x; if (x.thumb) URL.revokeObjectURL(x.thumb); return { ...x, result, thumb, edited: true }; }));
  };
  const openPage = async (i) => {
    if (i === cur && edit.current?.id === pages[i]?.id) return;
    await commitCurrent(); setCur(i); const p = pagesRef.current[i]; if (!p) return;
    const kept = editedBufs.current.get(p.id);
    if (kept) { edit.current = kept; undo.current = []; setUndoN(0); await new Promise((r) => requestAnimationFrame(r)); paint(); return; }
    setBusy(true); await enqueue(async () => { await processPage(p, { m: p.req || mode, keep: true }); }); setBusy(false); paint();
  };
  const move = (from, to) => { if (to < 0 || to >= pages.length || from === to) return; setPages((ps) => { const a = [...ps]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }); if (cur === from) setCur(to); else if (from < cur && to >= cur) setCur(cur - 1); else if (from > cur && to <= cur) setCur(cur + 1); };
  const delPage = async () => {
    const p = pages[cur]; if (!p) return; URL.revokeObjectURL(p.url); if (p.thumb) URL.revokeObjectURL(p.thumb);
    const rest = pages.filter((x) => x.id !== p.id); setPages(rest); toast(t('r24.scan.deleted', { n: cur + 1 }));
    edit.current = null;
    if (!rest.length) { setStep('pick'); setCur(0); return; }
    const ni = Math.min(cur, rest.length - 1); setCur(ni); setBusy(true); await enqueue(async () => { await processPage(rest[ni], { m: rest[ni].req || mode, keep: true }); }); setBusy(false); paint();
  };
  useEffect(() => { if (step === 'edit') paint(filter); }, [filter, step, cur]); // eslint-disable-line react-hooks/exhaustive-deps
  // filter is a look applied to every page's saved result
  const changeFilter = async (f) => {
    setFilter(f);
    const pg = edit.current; if (pg) { const { result, thumb } = await render(pg, f); patch(pg.id, (x) => { if (x.thumb) URL.revokeObjectURL(x.thumb); return { result, thumb }; }); }
  };
  const changeMode = async (m) => {
    setMode(m); const p = pages[cur]; if (!p) return;
    setBusy(true); await enqueue(async () => { await processPage(p, { m, keep: true }); }); setProg(null); setBusy(false); paint();
  };
  const applyAll = async () => {
    const others = pages.filter((_, i) => i !== cur); if (!others.length) return;
    setBusy(true);
    await enqueue(async () => { let k = 0; for (const p of others) { k++; await processPage(p, { m: mode, n: k, total: others.length }); } });
    setProg(null); setBusy(false); toast(t('r24.scan.applied', { n: pages.length }));
  };

  // ---------- crop ----------
  const [cropQuad, setCropQuad] = useState(null);
  const openCrop = async () => { await commitCurrent(); const p = pages[cur]; if (!p) return; const { w, h } = await decode(p.file); setCropQuad({ w, h, quad: p.quad || [[0, 0], [w, 0], [w, h], [0, h]] }); setStep('crop'); };
  const applyCrop = async () => {
    const p = pages[cur]; if (!p || !cropQuad) return; const np = { ...p, quad: cropQuad.quad }; patch(p.id, { quad: cropQuad.quad });
    setStep('edit'); setBusy(true); await new Promise((r) => requestAnimationFrame(r));
    await enqueue(async () => { await processPage(np, { m: p.req || mode, keep: true }); }); setProg(null); setBusy(false); paint();
  };
  const autoCrop = async () => {
    const p = pages[cur]; const { w, h, data } = await decode(p.file);
    const q = await runner.current.call({ type: 'detect', width: w, height: h, buffer: data.buffer }, [data.buffer]); setCropQuad({ w, h, quad: q.quad });
  };

  // ---------- brush ----------
  const stroke = useRef(null);
  const brushAt = (e) => {
    const pg = edit.current, cv = afterCv.current; if (!pg || !cv || !pg.disp) return;
    const rc = cv.getBoundingClientRect(); const k = pg.w / rc.width;
    const cx = (e.clientX - rc.left) * k, cy = (e.clientY - rc.top) * k, r = (size / 2) * k, r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(pg.w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(pg.h - 1, Math.ceil(cy + r));
    if (x1 < x0 || y1 < y0) return;
    const rec = stroke.current; const o = pg.out, en = pg.enh, d = pg.disp.data;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue; const p = y * pg.w + x, i = p * 4;
      if (!rec.seen.has(p)) { rec.seen.add(p); rec.idx.push(p); rec.prev.push(o[i], o[i + 1], o[i + 2]); }
      if (tool === 'erase') { o[i] = o[i + 1] = o[i + 2] = 255; } else { o[i] = en[i]; o[i + 1] = en[i + 1]; o[i + 2] = en[i + 2]; }
      const [rr, gg, bb] = filterPx(filter, o[i], o[i + 1], o[i + 2]); d[i] = rr; d[i + 1] = gg; d[i + 2] = bb;
    }
    cv.getContext('2d').putImageData(pg.disp, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  };
  const onDown = (e) => { if (tool === 'compare' || busy) return; e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); stroke.current = { seen: new Set(), idx: [], prev: [] }; brushAt(e); };
  const onMove = (e) => { if (stroke.current) brushAt(e); };
  const onUp = () => { const s = stroke.current; stroke.current = null; if (s?.idx.length) { undo.current.push({ idx: s.idx, prev: s.prev }); if (undo.current.length > 20) undo.current.shift(); setUndoN(undo.current.length); } };
  const doUndo = () => {
    const u = undo.current.pop(); const pg = edit.current; if (!u || !pg) return;
    u.idx.forEach((p, j) => { const i = p * 4; pg.out[i] = u.prev[j * 3]; pg.out[i + 1] = u.prev[j * 3 + 1]; pg.out[i + 2] = u.prev[j * 3 + 2]; });
    setUndoN(undo.current.length); paint();
  };

  // ---------- save ----------
  const buildPdf = async () => {
    await commitCurrent(); await queue.current; const ps = pagesRef.current.filter((p) => p.result);
    const out = []; for (const p of ps) { const bmp = await createImageBitmap(p.result); out.push({ jpeg: new Uint8Array(await p.result.arrayBuffer()), width: bmp.width, height: bmp.height }); bmp.close?.(); }
    const name = `${t('r24.scan.fileName')}-${stamp()}.pdf`; return { name, blob: new Blob([jpegPdf(out, { title: name })], { type: 'application/pdf' }) };
  };
  const savePdf = async () => { const { name, blob } = await buildPdf(); download(blob, name); toast(t('r24.scan.saved', { name })); };
  // Run 24 step 2b: save the scan straight into 全家檔案 (family drive root) — the only time a scan leaves the device
  const [toFiles, setToFiles] = useState(false);
  const saveToFiles = async () => {
    setToFiles(true);
    try {
      const { name, blob } = await buildPdf(); const { uploadFile } = await import('../../lib/drive-client.js');
      await uploadFile(new File([blob], name, { type: 'application/pdf' }), { parent: '' });
      toast(t('r24.drive.scanSaved', { name }));
    } catch (e) { const k = `r24.drive.err.${e?.code}`; const v = t(k, { max: e?.code === 'family_full' ? '50 MB' : '8 MB' }); toast(v === k ? t('r24.drive.err.generic') : v, 'err'); }
    finally { setToFiles(false); }
  };
  const saveImages = async () => {
    await commitCurrent(); await queue.current; const ps = pagesRef.current.filter((p) => p.result); const base = `${t('r24.scan.fileName')}-${stamp()}`;
    for (let i = 0; i < ps.length; i++) { download(ps[i].result, ps.length > 1 ? `${base}-${i + 1}.jpg` : `${base}.jpg`); await new Promise((r) => setTimeout(r, 350)); }
    toast(t('r24.scan.saved', { name: ps.length > 1 ? `${base}-1…${ps.length}.jpg` : `${base}.jpg` }));
  };

  // ---------- strip drag reorder (pointer: mouse + touch; buttons as the alternative) ----------
  const stripRef = useRef(null); const drag = useRef(null); const [dragI, setDragI] = useState(-1);
  const stripDown = (i, e) => { drag.current = { i, x: e.clientX, y: e.clientY, on: false, pid: e.pointerId }; };
  const stripMove = (e) => {
    const d = drag.current; if (!d) return;
    if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { d.on = true; setDragI(d.i); e.currentTarget.setPointerCapture?.(d.pid); }
    if (!d.on) return; e.preventDefault();
    const items = [...stripRef.current.querySelectorAll('[data-thumb]')]; const at = items.findIndex((el) => { const r = el.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
    const to = at < 0 ? items.length - 1 : at > d.i ? at - 1 : at;
    if (to !== d.i) { move(d.i, to); d.i = to; setDragI(to); }
  };
  const stripUp = (i) => { const d = drag.current; drag.current = null; setDragI(-1); if (d && !d.on) openPage(i); };

  const st = page?.stats; const pct = st ? Math.round(((st.colorPx + (st.handPx || 0) + (st.pencilPx || 0)) / st.total) * 1000) / 10 : 0;
  const stepN = step === 'pick' ? 1 : step === 'crop' ? 2 : 3;
  const stageIdx = prog ? Math.max(0, STAGES.indexOf(prog.stage)) : 0;
  const progPct = prog ? Math.round((((prog.n - 1) + (stageIdx + 1) / STAGES.length) / prog.total) * 100) : 0;
  const filesInput = (testid, capture) => <input type="file" accept="image/*" multiple={!capture} {...(capture ? { capture: 'environment' } : {})} onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} hidden data-testid={testid} />;
  return (
    <div className="sc-page" data-testid="scan-page" data-step={step}>
      <PageHeader title={t('r24.scan.title')} sub={t('r24.scan.sub')} actions={<Button variant="ghost" icon="folder" to="/app/files">{t('app.nav.files')}</Button>} />
      <p className="sc-step muted small" aria-live="polite">{t('r24.scan.step', { n: stepN })}</p>
      {step === 'pick' && (
        <div className="card sc-pick">
          <div className="sc-pick-btns">
            <label className="sc-big" data-testid="scan-camera"><Icon name="camera" size={28} /><b>{t('r24.scan.camera')}</b>{filesInput('scan-cam', true)}</label>
            <label className="sc-big" data-testid="scan-upload"><Icon name="upload" size={28} /><b>{t('r24.scan.upload')}</b>{filesInput('scan-file', false)}</label>
          </div>
          <p className="muted small">{t('r24.scan.pickHint')} {t('r24.scan.pickMany')}</p>
          <p className="muted small sc-lock"><Icon name="lock" size={12} />{t('r24.scan.onDevice')}</p>
          {prog && <Progress t={t} prog={prog} pct={progPct} />}
        </div>
      )}
      {step === 'crop' && cropQuad && page && (
        <div className="sc-crop">
          <h3 className="sc-h">{t('r24.scan.cropTitle')} · {t('r24.scan.pageOf', { n: cur + 1, total: pages.length })}</h3>
          <p className="muted small">{page.found === false ? t('r24.scan.notFound') : t('r24.scan.cropHint')}</p>
          <CropStage src={{ width: cropQuad.w, height: cropQuad.h, url: page.url }} quad={cropQuad.quad} setQuad={(f) => setCropQuad((c) => ({ ...c, quad: typeof f === 'function' ? f(c.quad) : f }))} t={t} />
          <div className="sc-actions">
            <Button variant="ghost" icon="undo" onClick={() => setStep('edit')}>{t('r24.scan.retake')}</Button>
            <Button variant="outline" icon="wand" onClick={autoCrop}>{t('r24.scan.auto')}</Button>
            <Button variant="outline" icon="image" onClick={() => setCropQuad((c) => ({ ...c, quad: [[0, 0], [c.w, 0], [c.w, c.h], [0, c.h]] }))}>{t('r24.scan.full')}</Button>
            <Button icon="check" onClick={applyCrop} data-testid="scan-next">{t('r24.scan.next')}</Button>
          </div>
        </div>
      )}
      {step === 'edit' && (
        <>
          <div className="sc-strip-wrap">
            <div className="sc-strip" ref={stripRef} role="listbox" aria-label={t('r24.scan.pages')} data-testid="scan-strip" onPointerMove={stripMove}>
              {pages.map((p, i) => (
                <button key={p.id} type="button" role="option" aria-selected={i === cur} data-thumb data-pid={p.id} className={`sc-thumb${i === cur ? ' on' : ''}${dragI === i ? ' drag' : ''}`}
                  onPointerDown={(e) => stripDown(i, e)} onPointerUp={() => stripUp(i)} onKeyDown={(e) => { if (e.key === 'ArrowLeft' && e.altKey) move(i, i - 1); if (e.key === 'ArrowRight' && e.altKey) move(i, i + 1); }}
                  aria-label={t('r24.scan.pageOf', { n: i + 1, total: pages.length })}>
                  {p.thumb ? <img src={p.thumb} alt="" draggable="false" /> : <span className="sc-thumb-wait" aria-hidden="true" />}
                  <span className="sc-thumb-n">{i + 1}</span>
                  {p.status === 'processing' && <span className="sc-thumb-busy" aria-hidden="true" />}
                </button>
              ))}
              <label className="sc-thumb sc-add" data-testid="scan-add"><Icon name="plus" size={20} /><span>{t('r24.scan.addUpload')}</span>{filesInput('scan-add-file', false)}</label>
              <label className="sc-thumb sc-add"><Icon name="camera" size={20} /><span>{t('r24.scan.addCamera')}</span>{filesInput('scan-add-cam', true)}</label>
            </div>
            <div className="sc-strip-tools">
              <span className="muted small">{t('r24.scan.pageOf', { n: cur + 1, total: pages.length })} · {t('r24.scan.reorderHint')}</span>
              <span className="sc-row">
                <Button size="sm" variant="ghost" disabled={cur === 0} onClick={() => move(cur, cur - 1)} data-testid="scan-move-left">‹ {t('r24.scan.moveLeft')}</Button>
                <Button size="sm" variant="ghost" disabled={cur >= pages.length - 1} onClick={() => move(cur, cur + 1)} data-testid="scan-move-right">{t('r24.scan.moveRight')} ›</Button>
                <label className="btn btn-ghost btn-sm sc-retake" data-testid="scan-retake"><Icon name="camera" size={16} />{t('r24.scan.retakePage')}<input type="file" accept="image/*" capture="environment" hidden data-testid="scan-retake-file" onChange={(e) => { retakeFor.current = page?.id; addFiles(e.target.files); e.target.value = ''; }} /></label>
                <Button size="sm" variant="ghost" icon="trash" onClick={delPage} data-testid="scan-del">{t('r24.scan.delPage')}</Button>
              </span>
            </div>
          </div>
          <div className="sc-edit">
            <div className={`sc-view tool-${tool}`} style={{ '--pos': `${pos}%`, width: edit.current ? `min(100%, calc(82vh * ${(edit.current.w / edit.current.h).toFixed(4)}))` : undefined }}>
              <canvas ref={afterCv} className="sc-after" data-testid="scan-after" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-label={t('r24.scan.after')} />
              <canvas ref={beforeCv} className="sc-before" aria-hidden="true" style={{ display: tool === 'compare' ? undefined : 'none' }} />
              {tool === 'compare' && <>
                <span className="sc-divider" aria-hidden="true"><span className="sc-knob"><Icon name="swap" size={14} /></span></span>
                <span className="sc-tag l">{t('r24.scan.before')}</span><span className="sc-tag r">{t('r24.scan.after')}</span>
                <input type="range" className="sc-range" min="0" max="100" value={pos} onChange={(e) => setPos(+e.target.value)} aria-label={t('r24.scan.compareHint')} data-testid="scan-compare" />
              </>}
              {busy && prog && <div className="sc-veil"><Progress t={t} prog={prog} pct={progPct} /></div>}
            </div>
            <div className="card sc-panel">
              <div className="sc-group">
                <small className="hp-label">{t('r24.scan.remove')}</small>
                <div className="segment sc-seg" role="radiogroup" aria-label={t('r24.scan.remove')}>
                  {REMOVE_MODES.map((m) => <button key={m} type="button" role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} disabled={busy} data-testid={`scan-mode-${m}`} onClick={() => changeMode(m)}>{t(`r24.scan.removeModes.${m}`)}</button>)}
                </div>
                <p className="muted small">{t(`r24.scan.removeHint.${mode}`)}{(mode === 'dark' || (mode === 'auto' && page?.mode === 'dark')) && <span className="sc-badge">{t('r24.scan.lower')}</span>}</p>
                {page?.stats && mode !== 'off' && (
                  <p className="small sc-found" data-testid="scan-stats">
                    {mode === 'auto' && page.mode && <b>{t('r24.scan.autoPicked', { mode: t(`r24.scan.removeModes.${page.mode}`) })}</b>}
                    <span>{page.detected?.length ? t('r24.scan.detected', { list: page.detected.map((k) => t(`r24.scan.kinds.${k}`)).join('、') }) : t('r24.scan.nothing')}</span>
                    <span className="muted">{t('r24.scan.removed', { n: pct })}</span>
                  </p>
                )}
                {pages.length > 1 && <Button size="sm" variant="outline" icon="check" disabled={busy} onClick={applyAll} data-testid="scan-apply-all">{t('r24.scan.applyAll')}</Button>}
              </div>
              <div className="sc-group">
                <small className="hp-label">{t('r24.scan.filter')}</small>
                <div className="segment sc-seg" role="radiogroup" aria-label={t('r24.scan.filter')}>
                  {FILTERS.map((f) => <button key={f} type="button" role="radio" aria-checked={filter === f} className={filter === f ? 'on' : ''} onClick={() => changeFilter(f)}>{t(`r24.scan.filters.${f}`)}</button>)}
                </div>
              </div>
              <div className="sc-group">
                <small className="hp-label">{t('r24.scan.tools')}</small>
                <div className="segment sc-seg" role="radiogroup" aria-label={t('r24.scan.tools')}>
                  {['compare', 'erase', 'restore'].map((k) => <button key={k} type="button" role="radio" aria-checked={tool === k} className={tool === k ? 'on' : ''} data-testid={`scan-tool-${k}`} onClick={() => setTool(k)}>{t(`r24.scan.tool.${k}`)}</button>)}
                </div>
                <p className="muted small">{tool === 'compare' ? t('r24.scan.compareHint') : t('r24.scan.brushHint')}</p>
                {tool !== 'compare' && <label className="sc-size"><span>{t('r24.scan.size')}</span><input type="range" min="6" max="80" value={size} onChange={(e) => setSize(+e.target.value)} /><i style={{ width: Math.min(size, 40), height: Math.min(size, 40) }} aria-hidden="true" /></label>}
                <div className="sc-row">
                  <Button size="sm" variant="ghost" icon="undo" disabled={!undoN} onClick={doUndo} data-testid="scan-undo">{t('r24.scan.undo')}</Button>
                  <Button size="sm" variant="ghost" icon="edit" disabled={busy} onClick={openCrop} data-testid="scan-recrop">{t('r24.scan.recrop')}</Button>
                </div>
              </div>
              <div className="sc-save">
                <Button icon="file" onClick={savePdf} disabled={busy} data-testid="scan-save-pdf">{t('r24.scan.savePdfAll', { n: pages.length })}</Button>
                <Button variant="outline" icon="folder" onClick={saveToFiles} loading={toFiles} disabled={busy || toFiles} data-testid="scan-save-files">{t('r24.drive.scanSave')}</Button>
                <Button variant="outline" icon="download" onClick={saveImages} disabled={busy} data-testid="scan-save-png">{pages.length > 1 ? t('r24.scan.saveImgs', { n: pages.length }) : t('r24.scan.saveImg')}</Button>
              </div>
              <p className="muted small sc-lock"><Icon name="lock" size={12} />{t('r24.scan.onDevice')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Progress({ t, prog, pct }) {
  return (
    <div className="sc-prog" role="status" data-testid="scan-progress">
      <span className="sc-prog-l">{prog.total > 1 ? `${t('r24.scan.processingN', { n: prog.n, total: prog.total })} · ` : ''}{t(`r24.scan.stages.${prog.stage}`)}</span>
      <span className="sc-prog-bar"><i style={{ width: `${pct}%` }} /></span>
    </div>
  );
}

function CropStage({ src, quad, setQuad, t }) {
  const box = useRef(null); const drag = useRef(null);
  const toPct = ([x, y]) => [(x / src.width) * 100, (y / src.height) * 100];
  const move = (i, e) => {
    const r = box.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(src.width, ((e.clientX - r.left) / r.width) * src.width)), y = Math.max(0, Math.min(src.height, ((e.clientY - r.top) / r.height) * src.height));
    setQuad((q) => q.map((p, j) => (j === i ? [x, y] : p)));
  };
  const key = (i, e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return; e.preventDefault();
    const st = (e.shiftKey ? 0.04 : 0.01) * Math.max(src.width, src.height);
    setQuad((q) => q.map((p, j) => (j === i ? [Math.max(0, Math.min(src.width, p[0] + d[0] * st)), Math.max(0, Math.min(src.height, p[1] + d[1] * st))] : p)));
  };
  const pts = quad.map(toPct);
  return (
    <div className="sc-stage" ref={box} style={{ aspectRatio: `${src.width} / ${src.height}`, width: `min(100%, calc(68vh * ${(src.width / src.height).toFixed(4)}))` }} data-testid="scan-crop">
      <img src={src.url} alt="" draggable="false" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path d={`M0 0H100V100H0Z M${pts.map((p) => p.join(' ')).join(' L')} Z`} fillRule="evenodd" className="sc-shade" />
        <polygon points={pts.map((p) => p.join(',')).join(' ')} className="sc-poly" vectorEffect="non-scaling-stroke" />
      </svg>
      {pts.map(([x, y], i) => (
        <button key={i} type="button" className="sc-handle" style={{ left: `${x}%`, top: `${y}%` }} aria-label={t(`r24.scan.corner.${CORNERS[i]}`)}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = i; }}
          onPointerMove={(e) => { if (drag.current === i) move(i, e); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => key(i, e)} />
      ))}
    </div>
  );
}
