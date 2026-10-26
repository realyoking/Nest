// Dotted interactive globe (Run 11) — Canvas 2D orthographic projection, no WebGL / 3D library (lazy-loaded with RegionPicker).
// Light dotted continents, soft rim glow, selected region = flag pin + name chip (DOM overlay). Drag to rotate (with inertia),
// pinch / wheel / buttons to zoom, tap a spot to pick the nearest country or region. prefers-reduced-motion: no spin, no inertia,
// no tweens (jumps straight to the target).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { LAND } from '../lib/regions/land.js';
import { COUNTRIES } from '../lib/regions/countries.js';
import { project, unproject, nearestRegion } from '../lib/regions/geo.js';
export { project, unproject, nearestRegion };

const RAD = Math.PI / 180;
// Decode the land mask into unit-sphere points (once per page).
let DOTS = null;
function dots() {
  if (DOTS) return DOTS;
  const out = [];
  LAND.rings.forEach((hex, i) => {
    const lat = LAND.lat0 + i * LAND.step;
    const n = Math.max(1, Math.round(360 * Math.cos(lat * RAD) / LAND.step));
    for (let h = 0; h < hex.length; h++) {
      const v = parseInt(hex[h], 16);
      for (let b = 0; b < 4; b++) if (v & (8 >> b)) { const j = h * 4 + b; if (j < n) out.push(lat, -180 + (j + 0.5) * 360 / n); }
    }
  });
  const N = out.length / 2; const a = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) { const la = out[2 * k] * RAD; const lo = out[2 * k + 1] * RAD; a[3 * k] = Math.cos(la) * Math.cos(lo); a[3 * k + 1] = Math.cos(la) * Math.sin(lo); a[3 * k + 2] = Math.sin(la); }
  DOTS = a; return a;
}
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const isDarkBg = () => {
  try { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g); if (!c) return false; const [r, g, b] = c.map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) < 100; } catch { return false; }
};
const ease = (t) => 1 - Math.pow(1 - t, 3);
const wrap = (x) => ((x + 540) % 360) - 180;

const Globe = forwardRef(function Globe({ selected, label, flag, onPick, height = 340, ariaLabel }, ref) {
  const wrapRef = useRef(null); const cvs = useRef(null); const pinRef = useRef(null);
  const view = useRef({ lat: 22, lon: 100, k: 1, vlon: 0, vlat: 0, spin: true });
  const anim = useRef(null); const dirty = useRef(true); const size = useRef({ w: 300, h: height, dpr: 1 });
  const [rm] = useState(reducedMotion);
  const sel = useRef(null);
  sel.current = selected ? COUNTRIES.find((r) => r[0] === selected) || null : null;

  const animateTo = useCallback((lat, lon, k) => {
    const v = view.current; v.spin = false; v.vlon = 0; v.vlat = 0;
    const tk = k ?? Math.max(v.k, 1.35);
    const tlat = Math.max(-60, Math.min(60, lat));
    if (rm) { v.lat = tlat; v.lon = lon; v.k = tk; anim.current = null; dirty.current = true; return; }
    anim.current = { t0: performance.now(), dur: 950, from: { lat: v.lat, lon: v.lon, k: v.k }, to: { lat: tlat, lon: v.lon + wrap(lon - v.lon), k: tk } };
    dirty.current = true;
  }, [rm]);
  useImperativeHandle(ref, () => ({ animateTo, zoom: (f) => { const v = view.current; v.k = Math.max(0.9, Math.min(4, v.k * f)); dirty.current = true; } }), [animateTo]);

  // Selected region → rotate / zoom to it.
  useEffect(() => { const r = sel.current; if (r) animateTo(r[1], r[2]); else dirty.current = true; }, [selected, animateTo]);

  useEffect(() => {
    const el = cvs.current; const box = wrapRef.current; if (!el || !box) return undefined;
    const ctx = el.getContext('2d'); if (!ctx) return undefined;
    const pts = dots();
    let raf = 0; let live = true; let dark = isDarkBg(); let lastTheme = 0;
    const resize = () => {
      const w = box.clientWidth || 300; const h = height; const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w, h, dpr }; el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); el.style.width = `${w}px`; el.style.height = `${h}px`; dirty.current = true;
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null; ro?.observe(box);
    const draw = (now) => {
      if (!live) return;
      raf = requestAnimationFrame(draw);
      const v = view.current;
      if (now - lastTheme > 800) { lastTheme = now; const d = isDarkBg(); if (d !== dark) { dark = d; dirty.current = true; } }
      if (anim.current) {
        const a = anim.current; const t = Math.min(1, (now - a.t0) / a.dur); const e = ease(t);
        v.lat = a.from.lat + (a.to.lat - a.from.lat) * e; v.lon = a.from.lon + (a.to.lon - a.from.lon) * e; v.k = a.from.k + (a.to.k - a.from.k) * e;
        if (t >= 1) anim.current = null; dirty.current = true;
      } else if (!drag.current && (Math.abs(v.vlon) > 0.01 || Math.abs(v.vlat) > 0.01)) {
        v.lon += v.vlon; v.lat = Math.max(-75, Math.min(75, v.lat + v.vlat)); v.vlon *= 0.93; v.vlat *= 0.93; dirty.current = true;
      } else if (v.spin && !rm && !drag.current) { v.lon += 0.06; dirty.current = true; }
      if (!dirty.current) return;
      dirty.current = false;
      const { w, h, dpr } = size.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.44 * v.k; const cx = w / 2; const cy = h / 2;
      // Rim glow + sphere.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.12);
      glow.addColorStop(0, dark ? 'rgba(120,140,255,.22)' : 'rgba(120,140,255,.16)'); glow.addColorStop(1, 'rgba(120,140,255,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      if (dark) { body.addColorStop(0, '#24262d'); body.addColorStop(1, '#121318'); } else { body.addColorStop(0, '#ffffff'); body.addColorStop(0.75, '#f7f8fb'); body.addColorStop(1, '#eceef4'); }
      ctx.fillStyle = body; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(10,10,30,.06)'; ctx.lineWidth = 1; ctx.stroke();
      // Selected halo.
      const s = sel.current; let sp = null;
      if (s) {
        sp = project(s[1], s[2], v.lat, v.lon);
        if (sp[2] > 0) {
          const hx = cx + sp[0] * R; const hy = cy - sp[1] * R; const hr = R * 0.22;
          const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr); g.addColorStop(0, dark ? 'rgba(130,150,255,.35)' : 'rgba(110,130,255,.22)'); g.addColorStop(1, 'rgba(110,130,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Dots (front hemisphere, fading towards the rim).
      const l0 = v.lat * RAD; const o0 = v.lon * RAD;
      const sl = Math.sin(l0); const cl = Math.cos(l0); const so = Math.sin(o0); const co = Math.cos(o0);
      const dr = Math.max(1, Math.min(2.8, R / 125));
      ctx.fillStyle = dark ? '#b9c0cf' : '#4b505c';
      for (let i = 0; i < pts.length; i += 3) {
        const X = pts[i]; const Y = pts[i + 1]; const Z = pts[i + 2];
        // rotate by -lon0 around z, then by lat0 around y
        const x1 = X * co + Y * so; const y1 = -X * so + Y * co;
        const depth = x1 * cl + Z * sl; if (depth <= 0.02) continue;
        const py = -x1 * sl + Z * cl; const px = y1;
        const sx = cx + px * R; const sy = cy - py * R;
        if (sx < -4 || sy < -4 || sx > w + 4 || sy > h + 4) continue;
        ctx.globalAlpha = (dark ? 0.3 : 0.25) + (dark ? 0.6 : 0.6) * depth;
        ctx.fillRect(sx - dr / 2, sy - dr / 2, dr, dr);
      }
      ctx.globalAlpha = 1;
      // Pin position (DOM overlay).
      const pin = pinRef.current;
      if (pin) {
        if (s && sp && sp[2] > 0.05) { pin.style.opacity = '1'; pin.style.transform = `translate(${cx + sp[0] * R}px, ${cy - sp[1] * R}px)`; }
        else pin.style.opacity = '0';
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { live = false; cancelAnimationFrame(raf); ro?.disconnect(); };
  }, [height, rm]);

  // Pointer: drag rotate, pinch zoom, tap pick.
  const drag = useRef(null); const pointers = useRef(new Map());
  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view.current; v.spin = false; anim.current = null;
    if (pointers.current.size === 2) { const [a, b] = [...pointers.current.values()]; drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), k: v.k, moved: true }; return; }
    drag.current = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, lat: v.lat, lon: v.lon };
  };
  const onMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current; if (!d) return; const v = view.current;
    if (d.pinch) { const [a, b] = [...pointers.current.values()]; if (a && b) { v.k = Math.max(0.9, Math.min(4, d.k * Math.hypot(a.x - b.x, a.y - b.y) / d.pinch)); dirty.current = true; } return; }
    const { w, h } = size.current; const R = Math.min(w, h) * 0.44 * v.k;
    const dx = e.clientX - d.x; const dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    const f = 57.3 / R;
    v.lon -= dx * f; v.lat = Math.max(-75, Math.min(75, v.lat + dy * f));
    v.vlon = rm ? 0 : -dx * f; v.vlat = rm ? 0 : dy * f; dirty.current = true;
  };
  const onUp = (e) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (pointers.current.size === 0) drag.current = null;
    else if (d?.pinch) { const [p] = [...pointers.current.values()]; drag.current = { x: p.x, y: p.y, x0: p.x, y0: p.y, t0: 0, moved: true }; }
    if (!d || d.moved || d.pinch || e.type === 'pointercancel') return;
    view.current.vlon = 0; view.current.vlat = 0;
    const rect = cvs.current.getBoundingClientRect(); const v = view.current; const { w, h } = size.current;
    const R = Math.min(w, h) * 0.44 * v.k;
    const p = unproject((e.clientX - rect.left - w / 2) / R, -(e.clientY - rect.top - h / 2) / R, v.lat, v.lon);
    if (!p) return;
    const code = nearestRegion(p[0], p[1], 14 / Math.sqrt(v.k));
    if (code) onPick?.(code);
  };
  const onWheel = (e) => { e.preventDefault(); const v = view.current; v.spin = false; v.k = Math.max(0.9, Math.min(4, v.k * Math.exp(-e.deltaY * 0.0015))); dirty.current = true; };
  useEffect(() => { const el = cvs.current; if (!el) return undefined; el.addEventListener('wheel', onWheel, { passive: false }); return () => el.removeEventListener('wheel', onWheel); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="globe" ref={wrapRef} style={{ height }}>
      <canvas ref={cvs} role="img" aria-label={ariaLabel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      <div className="globe-pin" ref={pinRef} aria-hidden="true">
        <span className="globe-flag">{flag}</span>
        <span className="globe-chip"><span>{flag}</span>{label}</span>
      </div>
      <div className="globe-zoom">
        <button type="button" aria-label="+" onClick={() => { const v = view.current; v.spin = false; v.k = Math.min(4, v.k * 1.3); dirty.current = true; }}>+</button>
        <button type="button" aria-label="−" onClick={() => { const v = view.current; v.k = Math.max(0.9, v.k / 1.3); dirty.current = true; }}>−</button>
      </div>
    </div>
  );
});
export default Globe;
