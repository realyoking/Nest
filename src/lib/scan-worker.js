// Run 24: runs the scanner pipeline off the main thread (module worker, bundled by Vite). Stateless per message:
// { type:'detect', width, height, buffer } → quad;  { type:'process', width, height, buffer, quad?, mode } → page.
// Progress: { id, stage } messages while a page is processed.
import { detectQuad, warp, enhance, removal, compose } from './scan-core.js';
export function runScan(m, post = () => {}) {
  const src = { width: m.width, height: m.height, data: new Uint8ClampedArray(m.buffer) };
  if (m.type === 'detect') return detectQuad(src);
  if (m.type === 'process') {
    post('detect'); const d = m.quad ? { quad: m.quad, found: true } : detectQuad(src);
    post('warp'); const flat = warp(src, d.quad);
    post('enhance'); const enh = enhance(flat, 'color');
    const r = removal(enh, m.mode || 'auto', { onStage: post });
    post('compose'); const out = compose(enh, r.mask);
    return { quad: d.quad, found: d.found, width: flat.width, height: flat.height, flat: flat.data.buffer, enh: enh.data.buffer, out: out.data.buffer, stats: r.stats, mode: r.mode, detected: r.detected };
  }
  return null;
}
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.onmessage = (e) => {
    const m = e.data;
    try {
      const r = runScan(m, (stage) => self.postMessage({ id: m.id, stage }));
      const tr = r && r.flat ? [r.flat, r.enh, r.out] : [];
      self.postMessage({ id: m.id, ok: true, ...r }, tr);
    } catch (err) { self.postMessage({ id: m.id, ok: false, error: String(err?.message || err) }); }
  };
}
