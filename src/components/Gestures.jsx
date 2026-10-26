// Run 22: pull-to-refresh indicator (the Nest egg settling into its nest, then wobbling while it refreshes) and the
// swipe-back edge hint. Touch only; both are decorative (aria-hidden) — a refresh also happens on its own (live data,
// polling), and every page keeps its normal back button.
import { MARK_PATHS } from '../brand.jsx';
import { pullProgress } from '../lib/gestures.js';
import { usePullToRefresh, useSwipeBack } from '../lib/use-gestures.js';
import Icon from './Icon.jsx';

export function PullToRefresh({ onRefresh, enabled = true, label }) {
  const { shown, phase } = usePullToRefresh(onRefresh, { enabled });
  if (!enabled) return null;
  const p = pullProgress(shown);
  return (
    <div className={`ptr ptr-${phase}`} aria-hidden={phase === 'refreshing' ? undefined : 'true'} role={phase === 'refreshing' ? 'status' : undefined}
      style={{ transform: `translate3d(-50%, ${Math.round(shown - 52)}px, 0)`, opacity: shown ? Math.min(1, 0.25 + p) : 0 }} data-testid="ptr">
      <svg viewBox="0 0 64 64" width="30" height="30">
        <path className="ptr-egg" d={MARK_PATHS[0]} style={{ transform: phase === 'refreshing' ? undefined : `translateY(${Math.round((1 - p) * -16)}px) rotate(${Math.round((1 - p) * -20)}deg)` }} />
        <path className="ptr-nest" d={MARK_PATHS[1]} />
      </svg>
      {phase === 'refreshing' && <span className="sr-only">{label}</span>}
    </div>
  );
}

export function SwipeBack({ onBack, enabled }) {
  const p = useSwipeBack(onBack, enabled);
  if (!enabled || !p) return null;
  return (
    <div className={`swipe-back ${p >= 1 ? 'ready' : ''}`} aria-hidden="true" style={{ transform: `translate3d(${Math.round(p * 34) - 30}px, -50%, 0)`, opacity: Math.min(1, p * 1.6) }}>
      <Icon name="chevronRight" size={20} stroke={2.6} className="icon-flip" />
    </div>
  );
}
