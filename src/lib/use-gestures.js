// Run 22: touch gesture hooks (maths in src/lib/gestures.js). Touch only — mouse / pen never start a gesture.
import { useEffect, useRef, useState } from 'react';
import { lockAxis, swipeDecision, swipeOffset, pullDistance, pullReady, edgeStart, backDecision, swipeBackAllowed } from './gestures.js';

const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// Swipe a row left to act. Returns { ref, bind, dx, phase }: put `ref` and `bind` on the row's foreground element.
// Touch events (not pointer events): they keep flowing after the browser starts its own pan, and a non-passive
// touchmove can stop the page from scrolling once the drag is locked horizontal.
export function useSwipeRow({ onCommit, enabled = true, dir = -1 } = {}) {
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | drag | back | out
  const ref = useRef(null);
  const moved = useRef(false);
  const cb = useRef(onCommit); cb.current = onCommit;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return undefined;
    let s = null; let out = false;
    const start = (e) => {
      if (out || e.touches.length !== 1) { s = null; return; }
      const t = e.touches[0];
      s = { x: t.clientX, y: t.clientY, t: e.timeStamp, w: el.offsetWidth || 320, axis: null, lx: t.clientX };
      moved.current = false;
    };
    const move = (e) => {
      if (!s) return;
      const t = e.touches[0]; const ddx = t.clientX - s.x; const ddy = t.clientY - s.y;
      if (!s.axis) { s.axis = lockAxis(ddx, ddy); if (s.axis === 'y') { s = null; return; } if (s.axis === 'x') setPhase('drag'); }
      if (s.axis !== 'x') return;
      if (e.cancelable) e.preventDefault();
      moved.current = true; s.lx = t.clientX;
      setDx(swipeOffset(ddx, s.w, dir));
    };
    const end = (e, cancelled) => {
      const c = s; s = null;
      if (!c || c.axis !== 'x') return;
      const x = e.changedTouches?.[0]?.clientX ?? c.lx;
      const d = cancelled ? 'cancel' : swipeDecision({ dx: x - c.x, dt: e.timeStamp - c.t, width: c.w, dir });
      if (d === 'commit') {
        out = true; setPhase('out'); setDx(dir * (c.w + 24));
        setTimeout(() => { out = false; cb.current?.(); setPhase('idle'); setDx(0); }, reduced() ? 0 : 230);
      } else { setPhase('back'); setDx(0); setTimeout(() => setPhase((p) => (p === 'back' ? 'idle' : p)), 380); }
    };
    const onEnd = (e) => end(e, false); const onCancel = (e) => end(e, true);
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => { el.removeEventListener('touchstart', start); el.removeEventListener('touchmove', move); el.removeEventListener('touchend', onEnd); el.removeEventListener('touchcancel', onCancel); };
  }, [enabled, dir]);
  // A swipe must not also count as a tap on the row's buttons.
  const onClickCapture = (e) => { if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; } };
  return { ref, dx, phase, bind: { onClickCapture } };
}

// Pull down at the top of the page to refresh. Listens on window; `enabled` false = inert.
// Returns { shown (px), phase: idle | pull | ready | refreshing }.
export function usePullToRefresh(onRefresh, { enabled = true, minMs = 900 } = {}) {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState('idle');
  const fnRef = useRef(onRefresh); fnRef.current = onRefresh;
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let s = null;
    const skip = (t) => !!t?.closest?.('[data-no-ptr], .chat-scroll, .sheet, .sheet-wrap, .modal, textarea, input, select, .cd-panel');
    const start = (e) => {
      if (busy.current || e.touches.length !== 1 || (window.scrollY || document.documentElement.scrollTop) > 0 || skip(e.target)) { s = null; return; }
      s = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
    };
    const move = (e) => {
      if (!s) return;
      const dx = e.touches[0].clientX - s.x; const dy = e.touches[0].clientY - s.y;
      if (!s.axis) { s.axis = lockAxis(dx, dy); if (s.axis === 'x' || (s.axis === 'y' && dy < 0)) { s = null; return; } }
      if (s.axis !== 'y') return;
      if ((window.scrollY || 0) > 0) { s = null; setShown(0); setPhase('idle'); return; }
      if (e.cancelable) e.preventDefault(); // stop the page bounce while the indicator follows the finger
      const v = pullDistance(dy);
      s.v = v; setShown(v); setPhase(pullReady(v) ? 'ready' : 'pull');
    };
    const end = async () => {
      const v = s?.v || 0; s = null;
      if (!pullReady(v)) { setShown(0); setPhase('idle'); return; }
      busy.current = true; setPhase('refreshing'); setShown(56);
      const t0 = Date.now();
      try { await fnRef.current?.(); } catch {}
      const wait = minMs - (Date.now() - t0); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setShown(0); setPhase('idle'); busy.current = false;
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end); };
  }, [enabled, minMs]);
  return { shown, phase };
}

// Swipe from the left edge to go back (only where the platform has no back swipe — see swipeBackAllowed).
// Returns the drag progress 0..1 for a small edge indicator.
export function useSwipeBack(onBack, enabled) {
  const [p, setP] = useState(0);
  const cb = useRef(onBack); cb.current = onBack;
  useEffect(() => {
    if (!enabled) return undefined;
    let s = null;
    const start = (e) => { const t = e.touches[0]; s = e.touches.length === 1 && edgeStart(t.clientX) ? { x: t.clientX, y: t.clientY, t: e.timeStamp, axis: null } : null; };
    const move = (e) => {
      if (!s) return; const t = e.touches[0]; const dx = t.clientX - s.x; const dy = t.clientY - s.y;
      if (!s.axis) { s.axis = lockAxis(dx, dy); if (s.axis === 'y') { s = null; setP(0); return; } }
      if (s.axis === 'x') { if (e.cancelable) e.preventDefault(); setP(Math.max(0, Math.min(1, dx / (innerWidth * 0.33)))); }
    };
    const end = (e) => {
      if (!s) return; const t = e.changedTouches[0];
      const d = s.axis === 'x' ? backDecision({ dx: t.clientX - s.x, dy: t.clientY - s.y, dt: e.timeStamp - s.t, width: innerWidth }) : 'cancel';
      s = null; setP(0);
      if (d === 'commit') cb.current?.();
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end); };
  }, [enabled]);
  return p;
}
export const isIosStandalone = () => {
  try {
    const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return swipeBackAllowed({ standalone, ios });
  } catch { return false; }
};
