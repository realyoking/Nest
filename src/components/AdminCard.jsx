// Compact admin card on Home. Rendered only when the session's admin hint matches (verified email on VITE_ADMIN_EMAILS);
// its numbers come from GET /api/admin/summary, which re-checks the verified email server-side and 404s anyone else
// (the card then disappears). Counts only.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Reveal } from './Reveal.jsx';
import { Progress, Spinner } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';

export default function AdminCard({ delay = 0 }) {
  const { t } = useI18n();
  const s = useSession();
  const { be } = useBe();
  const [d, setD] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | err | hidden
  useEffect(() => {
    if (!s.isAdmin || !be.getIdToken) { setState('hidden'); return undefined; }
    if (be.MOCK) { setD({ mode: 'limited', users: 12, families: 5, activeToday: 3, beta: { claimed: 3, max: 10, remaining: 7 } }); setState('ok'); return undefined; }
    let live = true;
    (async () => {
      try {
        const token = await be.getIdToken();
        const r = await fetch('/api/admin/summary', { headers: { authorization: `Bearer ${token}` } });
        if (!live) return;
        if (r.status === 404 || r.status === 401) { setState('hidden'); return; }
        if (!r.ok) throw new Error(String(r.status));
        setD(await r.json()); setState('ok');
      } catch { if (live) setState('err'); }
    })();
    return () => { live = false; };
  }, [s.isAdmin, s.user?.uid]);
  if (!s.isAdmin || state === 'hidden') return null;
  return (
    <Reveal className="card adm-card" delay={delay}>
      <div className="card-head">
        <h2><Icon name="shield" size={18} />{t('admin.card')}</h2>
        <Link to="/admin" className="small muted adm-card-open">{t('admin.open')}<Icon name="chevronRight" size={14} stroke={2.5} /></Link>
      </div>
      {state === 'loading' ? <div className="adm-card-load"><Spinner small /></div>
        : state === 'err' ? <p className="error-text small" style={{ fontWeight: 700, margin: 0 }}>{t('admin.loadFail')}</p>
          : (
            <>
              <div className="adm-card-stats">
                <div><b>{d.users}</b><small>{t('admin.users')}</small></div>
                <div><b>{d.families}</b><small>{t('admin.families')}</small></div>
                <div><b>{d.beta.claimed}/{d.beta.max}</b><small>{t('admin.beta')}</small></div>
              </div>
              <Progress value={d.beta.claimed} max={d.beta.max} calm />
              <p className="small adm-card-beta" style={{ fontWeight: 800, margin: '8px 0 0' }}>{t('admin.betaClaimed', { c: d.beta.claimed, m: d.beta.max, r: d.beta.remaining ?? Math.max(0, d.beta.max - d.beta.claimed) })}</p>
              {d.mode !== 'full' && <p className="muted small adm-card-note">{t('admin.limited')}</p>}
            </>
          )}
    </Reveal>
  );
}
