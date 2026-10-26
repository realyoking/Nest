// Family AI usage as percentages (today + this ISO week, Hong Kong time). Never raw counts.
import { Progress } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';

export function useResetLabels() {
  const { t, fmtDate } = useI18n();
  const s = useSession();
  return {
    day: t('usage.resetDay'),
    week: t('usage.resetWeek', { when: fmtDate(s.usage.weekReset, { month: 'short', day: 'numeric', weekday: 'short' }) }),
  };
}

// compact: sidebar size. big: Usage page.
export default function UsageMeter({ compact, big }) {
  const { t } = useI18n();
  const s = useSession();
  const r = useResetLabels();
  const rows = [['today', s.usage.dayPct, r.day], ['week', s.usage.weekPct, r.week]];
  return (
    <div className={`umeter ${compact ? 'compact' : ''} ${big ? 'big' : ''}`}>
      {compact && s.planLabel && <span className="umeter-plan" data-testid="side-plan">{s.planLabel(t).full}</span>}
      {rows.map(([k, p, reset]) => (
        <div className="umeter-row" key={k}>
          <div className="umeter-top">
            {big ? (
              <><span className="umeter-k">{t(`usage.${k}Short`)}</span><b className="umeter-pct">{p}<small>%</small></b></>
            ) : (
              <span className="umeter-label">{t(`usage.${k}`, { p })}</span>
            )}
            {p >= 100 && <span className="pill dark">{t('usage.full')}</span>}
          </div>
          <Progress value={p} max={100} />
          {!compact && <span className="umeter-reset">{reset}</span>}
        </div>
      ))}
    </div>
  );
}
