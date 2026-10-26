// Run 23: "working on it" card with steps (replaces the three loading dots for longer AI tasks).
// steps: [{ key, label, state: 'done' | 'active' | 'todo' }]. Motion is CSS-only and off under prefers-reduced-motion.
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { familySettings } from '../lib/nestie.js';

export function useNestie() {
  const s = useSession();
  return familySettings(s?.family);
}

export default function ProgressCard({ steps = [], hint = '', compact = false, testid = 'progress-card' }) {
  const { t } = useI18n();
  const n = useNestie();
  const done = steps.filter((x) => x.state === 'done').length;
  return (
    <div className={`pcard${compact ? ' compact' : ''}`} role="status" aria-live="polite" data-testid={testid}>
      <div className="pcard-head">
        <span className="pcard-orb" aria-hidden="true"><i /></span>
        <b>{t(`r23.progress.title.${n.personality}`, { name: n.nestieName })}</b>
        <small className="pcard-count">{done}/{steps.length}</small>
      </div>
      <ol className="pcard-steps">
        {steps.map((x) => (
          <li key={x.key} className={`pcard-step ${x.state}`} data-state={x.state}>
            <span className="pcard-dot" aria-hidden="true">{x.state === 'done' ? <Icon name="check" size={12} stroke={2.6} /> : null}</span>
            <span className="pcard-label">{x.label}</span>
          </li>
        ))}
      </ol>
      {hint && <p className="pcard-hint">{hint}</p>}
    </div>
  );
}

// Chat turn → steps. seen = server status keys in order (lookup / sources / lookupFailed / state / action / diagram / thinking).
export function chatSteps(t, { seen = [], attach = false, writing = false } = {}) {
  const extra = [];
  if (attach) extra.push('attach');
  if (seen.some((k) => k === 'lookup' || k === 'sources' || k === 'lookupFailed')) extra.push('lookup');
  if (seen.includes('state')) extra.push('account');
  const keys = ['understand', ...extra, 'write'];
  const started = seen.length > 0 || writing;
  const last = seen[seen.length - 1];
  const activeExtra = last === 'lookup' ? 'lookup' : last === 'state' ? 'account' : attach && !seen.length ? 'attach' : null;
  return keys.map((k, i) => {
    let state = 'todo';
    if (k === 'understand') state = started || attach ? 'done' : 'active';
    else if (k === 'write') state = writing ? 'active' : started && !activeExtra ? 'active' : 'todo';
    else state = activeExtra === k ? 'active' : started ? 'done' : 'todo';
    return { key: k, label: t(`r23.progress.${k}`), state, i };
  });
}
