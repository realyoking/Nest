// Home: "family decision request" for subscriptions renewing within 3 days, shown to the decider only.
// Keep / Discuss (family reminder tonight 20:00) / Cancel later (reminder the day before renewal + provider cancel link).
// Nest never cancels a subscription itself.
import { useState } from 'react';
import { Button, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { writeSub } from '../lib/subs-api.js';
import { useSubs } from '../pages/app/Subscriptions.jsx';
import { decisionPending, deciderOf, cancelReminderAt, discussReminderAt, fmtMoney, usageHint } from '../lib/subs.js';

export default function SubDecisionCards() {
  const { t } = useI18n();
  const { be, demo } = useBe();
  const s = useSession();
  const toast = useToast();
  const { subs } = useSubs();
  const [busy, setBusy] = useState('');
  const [after, setAfter] = useState({}); // id → { choice, url }
  const isDemo = demo || be.MOCK;
  const me = s.user?.uid;
  const list = (subs || []).map((x) => ({ x, p: decisionPending(x) })).filter(({ x, p }) => (p || after[x.id]) && (isDemo || deciderOf(x, s.family || {}, s.members || []) === me));
  if (!list.length) return null;
  const md = (d) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
  const decide = (x, p, choice) => async () => {
    setBusy(`${x.id}:${choice}`);
    try {
      await writeSub('decide', { id: x.id, choice }, { demo: isDemo });
      if (!isDemo && choice === 'discuss') await be.addReminder(s.family.id, { title: t('subd.discussTitle', { name: x.service }), dueAt: new Date(discussReminderAt()), memberId: '' });
      if (!isDemo && choice === 'cancel') await be.addReminder(s.family.id, { title: t('subd.cancelTitle', { name: x.service, date: md(p.renewal) }), dueAt: new Date(cancelReminderAt(p.renewal)), memberId: me });
      setAfter((a) => ({ ...a, [x.id]: { choice, url: x.cancelUrl } }));
      toast(t(`subd.${choice}Done`, { name: x.service }));
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  return list.map(({ x, p }) => {
    const done = after[x.id];
    const cost = x.amount ? ` (${fmtMoney(x.amount)}${t(`subs.per.${x.cycle}`)})` : '';
    const u = usageHint(x);
    return (
      <div key={x.id} className="card subd-card">
        <div className="card-head"><h2><Icon name="receipt" size={18} />{t('subd.title')}</h2></div>
        {!done && p && (
          <>
            <p className="subd-q">{t('subd.q', { name: x.service, when: p.days === 0 ? t('subd.today') : t('subd.inDays', { n: p.days }), cost })}</p>
            <div className="subd-acts">
              <Button size="sm" icon="check" loading={busy === `${x.id}:keep`} onClick={decide(x, p, 'keep')}>{t('subd.keep')}</Button>
              <Button size="sm" variant="outline" icon="users" loading={busy === `${x.id}:discuss`} onClick={decide(x, p, 'discuss')}>{t('subd.discuss')}</Button>
              <Button size="sm" variant="outline" icon="x" loading={busy === `${x.id}:cancel`} onClick={decide(x, p, 'cancel')}>{t('subd.cancel')}</Button>
            </div>
            <p className="subd-meta">{[x.purpose, u.stale ? t('subd.unused', { n: u.days }) : '', t('subd.never')].filter(Boolean).join(' · ')}</p>
          </>
        )}
        {done && (
          <>
            <p className="subd-q">{t(`subd.${done.choice}Done`, { name: x.service })}</p>
            {done.choice === 'cancel' && done.url && <Button size="sm" variant="outline" icon="link" href={done.url} target="_blank" rel="noreferrer">{t('subd.openCancel')}</Button>}
            <p className="subd-meta">{t('subd.never')}</p>
          </>
        )}
      </div>
    );
  });
}
