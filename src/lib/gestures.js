// Run 22: touch gesture maths (pure, unit-tested in test/run22-gestures.test.mjs). The React hooks live in
// src/lib/use-gestures.js. Gestures are touch-only extras: every action keeps a normal button.

export const AXIS_SLOP = 10; // px before a drag is locked to one axis

// Lock a drag to 'x' or 'y' once it has moved AXIS_SLOP px; null while undecided. Horizontal needs to clearly win
// (1.2×) so a slightly diagonal scroll never turns into a swipe.
export function lockAxis(dx, dy, slop = AXIS_SLOP) {
  const ax = Math.abs(dx); const ay = Math.abs(dy);
  if (Math.max(ax, ay) < slop) return null;
  return ax > ay * 1.2 ? 'x' : 'y';
}

// Swipe-to-act on a row (left = negative dx). Past `ratio` of the row width (at most maxPx), or a quick flick (≥ `flick` px/ms over at
// least 40 px), commits; anything else springs back.
export function swipeDecision({ dx, dt, width, dir = -1, ratio = 0.35, flick = 0.55, maxPx = 160 }) {
  const d = dx * dir; // distance in the action direction
  if (d <= 0 || !width) return 'cancel';
  if (d >= Math.min(width * ratio, maxPx)) return 'commit'; // wide rows (tablet / desktop) never need more than maxPx
  if (dt > 0 && d >= 40 && d / dt >= flick) return 'commit';
  return 'cancel';
}

// Rubber band past the commit distance and against the wrong direction (iOS-like resistance).
export function swipeOffset(dx, width, dir = -1) {
  const d = dx * dir;
  if (d <= 0) return d === 0 ? 0 : -Math.min(18, -d * 0.15) * dir;
  const lim = width * 0.6;
  const v = d <= lim ? d : lim + (d - lim) * 0.3;
  return v * dir;
}

// Pull-to-refresh: the finger distance becomes a damped indicator distance; release past `trigger` refreshes.
export const PULL_TRIGGER = 70;
export function pullDistance(dy, max = 130) {
  if (dy <= 0) return 0;
  const v = dy * 0.55;
  return v <= PULL_TRIGGER ? v : Math.min(max, PULL_TRIGGER + (v - PULL_TRIGGER) * 0.4);
}
export const pullReady = (shown) => shown >= PULL_TRIGGER;
export const pullProgress = (shown) => Math.max(0, Math.min(1, shown / PULL_TRIGGER));

// Swipe-back from the left edge. Only where the platform has no back gesture of its own: an iOS home-screen app
// (standalone) — Safari tabs and Android already have a system back swipe, and fighting it feels broken.
export const EDGE = 24;
export function swipeBackAllowed({ standalone, ios }) { return !!(standalone && ios); }
export function edgeStart(x, edge = EDGE) { return x >= 0 && x <= edge; }
export function backDecision({ dx, dy, dt, width }) {
  if (Math.abs(dy) > Math.abs(dx)) return 'cancel';
  return swipeDecision({ dx, dt, width, dir: 1, ratio: 0.33, flick: 0.5 });
}
