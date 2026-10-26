// Settings → 推送通知: master switch, per-type opt-in (per member — prefs live on each user's own profile),
// test notification, registered devices (with remove), and the 加到主畫面 entry point. Quiet hours are the
// existing setting in the 通知 card and apply to push too.
import { useEffect, useMemo, useState } from 'react';
import { gateErrorText } from '../lib/gate-errors.js';
import Icon from './Icon.jsx';
import { Button, IconButton, useToast } from './ui.jsx';
import { Reveal } from './Reveal.jsx';
import InstallGuide, { useInstallState } from './InstallGuide.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { currentSubscription, deviceLabel, enablePushOnThisDevice, permission, removeDevice, sendTestPush, subIdOf } from '../lib/push.js';

const TYPES = ['notifyReminders', 'notifyHomework', 'notifyTests', 'notifyBirthdays', 'notifyBrief', 'notifyWarnings', 'notifyNotices', 'notifyBills'];

function Toggle({ on, onChange, label, disabled }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}
function Row({ title, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-text"><b>{title}</b>{hint && <small>{hint}</small>}</div>
      <div className="set-ctl">{children}</div>
    </div>
  );
}

export default function PushSettings({ delay = 90 }) {
  const { be, demo } = useBe();
  const mock = !!be.MOCK || demo;
  const { t, lang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const p = s.prefs;
  const { pf, installed } = useInstallState();
  const [guide, setGuide] = useState(false);
  const [busy, setBusy] = useState('');
  const [subDocs, setSubDocs] = useState([]);
  const [thisId, setThisId] = useState(mock ? 's1a2b3c4d5e6f7a8b9c0d1e2f' : null);
  const [perm, setPerm] = useState(mock ? 'granted' : permission());

  useEffect(() => (be.watchPushSubs ? be.watchPushSubs(s.user.uid, setSubDocs) : undefined), [s.user.uid]);
  const refreshThis = async () => {
    if (mock) return;
    const sub = await currentSubscription().catch(() => null);
    setThisId(sub ? await subIdOf(sub.endpoint) : null);
    setPerm(permission());
  };
  useEffect(() => { refreshThis(); }, []);

  const devices = useMemo(() => {
    const m = new Map();
    subDocs.forEach((d) => m.set(d.id, d));
    Object.entries(s.profile?.pushSubs || {}).forEach(([id, d]) => { if (!m.has(id)) m.set(id, { id, ...d }); });
    return [...m.values()].map((d) => ({ ...d, createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : d.createdAt ? new Date(d.createdAt) : null }))
      .sort((a, b) => (b.id === thisId) - (a.id === thisId) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [subDocs, s.profile?.pushSubs, thisId]);

  const status = perm === 'denied' ? 'denied' : pf.needsInstallForPush && !mock ? 'needsInstall' : !pf.pushApi && !mock ? 'unsupported' : p.pushEnabled && thisId ? 'on' : 'off';
  const errText = (e) => gateErrorText(e, t) || t(`push.errors.${e.message}`) !== `push.errors.${e.message}` ? t(`push.errors.${e.message}`) : t('push.errors.generic');

  const setPref = async (k, v) => { try { await s.savePrefs({ [k]: v }); toast(t('settings.saved')); } catch { toast(t('common.error'), 'err'); } };
  const enableHere = async () => {
    setBusy('enable');
    try {
      if (!mock) await enablePushOnThisDevice(be.getIdToken);
      await s.savePrefs({ pushEnabled: true });
      await refreshThis();
      toast(t('push.added'));
    } catch (e) {
      setPerm(permission());
      if (e.message === 'needs_install') setGuide(true);
      toast(errText(e), 'err');
    } finally { setBusy(''); }
  };
  const master = async (on) => {
    if (on) return enableHere();
    setBusy('enable');
    try { await s.savePrefs({ pushEnabled: false }); toast(t('push.turnedOff')); } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const test = async () => {
    setBusy('test');
    try {
      if (mock) { toast(t('push.testSent')); return; }
      const r = await sendTestPush(be.getIdToken, lang);
      toast(r.sent ? t('push.testSent') : t('push.testFail'), r.sent ? 'ok' : 'err');
    } catch (e) { toast(e.body?.error === 'no_subscription' ? t('push.testNone') : t('push.testFail'), 'err'); } finally { setBusy(''); }
  };
  const remove = async (id) => {
    setBusy('rm-' + id);
    try {
      if (mock) await be.deletePushSubMock(s.user.uid, id);
      else await removeDevice(be.getIdToken, id);
      if (id === thisId) setThisId(null);
      toast(t('push.removed'));
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };

  return (
    <Reveal className="card push-card" delay={delay}>
      <div className="card-head" style={{ marginBottom: 4 }}>
        <h2 className="set-h" style={{ margin: 0 }}>{t('push.title')}</h2>
        <span className={`pill ${status === 'on' ? 'dark' : status === 'denied' ? 'warn' : ''}`}>{t(`push.status.${status}`)}</span>
      </div>

      <Row title={t('install.row')} hint={pf.ios && !installed ? t('install.iosWhy') : t('install.rowHint')}>
        {installed ? <span className="pill">{t('install.installedPill')}</span> : <Button size="sm" variant="outline" icon="plusSquare" onClick={() => setGuide(true)}>{t('install.open')}</Button>}
      </Row>

      <Row title={t('push.master')} hint={t('push.masterHint')}>
        <Toggle on={!!p.pushEnabled} onChange={master} label={t('push.master')} disabled={busy === 'enable' || status === 'unsupported'} />
      </Row>
      {status === 'denied' && <div className="notice push-notice">{t('push.deniedHelp')}</div>}
      {status === 'unsupported' && <div className="notice push-notice">{t('push.unsupportedHelp')}</div>}
      {p.pushEnabled && !thisId && status === 'off' && (
        <div className="push-here"><Button size="sm" icon="bell" loading={busy === 'enable'} onClick={enableHere}>{t('push.master')}</Button></div>
      )}

      <div className={`push-types ${p.pushEnabled ? '' : 'dim'}`}>
        <h3 className="push-sub">{t('push.types')}</h3>
        {TYPES.map((k) => (
          <Row key={k} title={t(`push.keys.${k}`)} hint={t(`push.hints.${k}`)}>
            <Toggle on={!!p[k]} onChange={(v) => setPref(k, v)} label={t(`push.keys.${k}`)} />
          </Row>
        ))}
        {p.notifyBills && (
          <Row title={t('push.keys.billLead')} hint={t('push.hints.billLead')}>
            <select className="select input push-lead" value={String(p.billLead || '3')} onChange={(e) => setPref('billLead', e.target.value)} aria-label={t('push.keys.billLead')}>
              {['1', '2', '3', '5', '7'].map((n) => <option key={n} value={n}>{t('push.leadDays', { n })}</option>)}
            </select>
          </Row>
        )}
      </div>

      <div className="push-actions">
        <Button variant="secondary" icon="bell" loading={busy === 'test'} disabled={!devices.length && !thisId} onClick={test}>{t('push.test')}</Button>
      </div>
      <p className="muted small push-schedule"><Icon name="calendar" size={15} />{t('push.schedule')}</p>

      <h3 className="push-sub">{t('push.devices')}</h3>
      {devices.length ? devices.map((d) => (
        <div className="list-row push-dev" key={d.id}>
          <span className="push-dev-icon"><Icon name="phone" size={18} /></span>
          <div className="list-row-main">
            <b>{deviceLabel(d.ua)}{d.id === thisId && <span className="pill dark push-this">{t('push.thisDevice')}</span>}</b>
            <small>{d.createdAt ? fmtDate(d.createdAt, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</small>
          </div>
          <IconButton icon="trash" label={t('push.remove')} disabled={busy === 'rm-' + d.id} onClick={() => remove(d.id)} />
        </div>
      )) : <p className="muted small" style={{ fontWeight: 600, margin: '6px 0 0' }}>{t('push.noDevices')}</p>}

      <InstallGuide open={guide} onClose={() => setGuide(false)} />
    </Reveal>
  );
}

