// Per-file line diff (rows from bundleDiff in src/lib/plugins/project.js). Studio version history + admin update review.
import { useI18n } from '../lib/i18n.jsx';

export default function DiffView({ parts }) {
  const { t } = useI18n();
  if (!parts.length) return <p className="muted">{t('prj.diffEmpty')}</p>;
  return (
    <div className="st-diff">
      {parts.map((p) => (
        <div key={p.file} className="st-diff-f">
          <b>{p.file} <small className="st-add">+{p.add}</small> <small className="st-del">−{p.del}</small></b>
          <pre>{p.rows.slice(0, 600).map((r, i) => (r.t === '…' ? <div key={i} className="st-dl gap">⋯ {t('prj.more', { n: r.s })}</div> : <div key={i} className={`st-dl ${r.t === '+' ? 'add' : r.t === '-' ? 'del' : ''}`}>{r.t} {r.s}</div>))}</pre>
        </div>
      ))}
    </div>
  );
}
