// Apple / iCloud Calendar connect flow (used by Calendar and Connections). The Apple ID + app-specific password go
// straight to /api/apple/connect, which verifies them with CalDAV discovery and stores them encrypted server-side.
import { useState } from 'react';
import { Button, Field, useToast } from './ui.jsx';
import Sheet from './Sheet.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useBe } from '../lib/be-context.jsx';
import { connectApple, disconnectApple, appleAccounts } from '../lib/calendar.js';

export const appleErrKey = (code) => (['apple_auth', 'apple_bad_id', 'apple_bad_password', 'apple_discovery', 'apple_timeout', 'apple_network', 'store_failed'].includes(code) ? code : 'generic');

// The form itself: used full-page in Connections (?svc=applecalendar&connect=1) and inside a bottom sheet elsewhere.
// Inputs scroll into view on focus so the iOS keyboard never covers them.
export function AppleConnectForm({ onDone, onCancel, id: formId = 'apple-form', hideActions }) {
  const { t } = useI18n();
  const { demo } = useBe();
  const toast = useToast();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const reveal = (e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280); };
  const submit = async (e) => {
    e.preventDefault();
    if (demo) { toast(t('lp.demoOnly')); return; }
    setErr(''); setBusy(true);
    try {
      const r = await connectApple(id.trim(), pw);
      setPw('');
      toast(t('apple.connected', { email: r.appleId, n: r.calendars?.length || 0 }));
      onDone?.(r);
    } catch (x) {
      const k = appleErrKey(x.code);
      setErr(t(`apple.errors.${k}`) + (k === 'generic' && x.code ? ` (${x.code})` : ''));
    } finally { setBusy(false); }
  };
  const how = t('apple.how');
  return (
    <form id={formId} className="stack apple-form" onSubmit={submit} autoComplete="off">
      <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{t('apple.sub')}</p>
      <Field label={t('apple.appleId')}>
        <input className="input" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" required value={id} onFocus={reveal} onChange={(e) => setId(e.target.value)} placeholder={t('apple.appleIdPh')} enterKeyHint="next" />
      </Field>
      <Field label={t('apple.password')}>
        <input className="input" type="password" autoComplete="new-password" autoCapitalize="none" required value={pw} onFocus={reveal} onChange={(e) => setPw(e.target.value)} placeholder={t('apple.passwordPh')} spellCheck={false} enterKeyHint="go" />
      </Field>
      <details className="cal-how">
        <summary>{t('apple.howTitle')}</summary>
        <ol>{Array.isArray(how) && how.map((x, i) => <li key={i}>{i === 0 ? <>{x.split('appleid.apple.com')[0]}<a href="https://appleid.apple.com/account/manage" target="_blank" rel="noreferrer">appleid.apple.com</a>{x.split('appleid.apple.com')[1]}</> : x}</li>)}</ol>
      </details>
      {err && <p className="error-text small" role="alert" style={{ margin: 0, fontWeight: 700 }}>{err}</p>}
      <p className="fine" style={{ margin: 0 }}>{t('apple.privacy')}</p>
      {!hideActions && (
        <div className="sheet-actions">
          {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{t('common.cancel')}</Button>}
          <Button type="submit" loading={busy} disabled={!id || !pw}>{busy ? t('apple.connecting') : t('apple.connect')}</Button>
        </div>
      )}
    </form>
  );
}

// Bottom sheet on phones / dialog on desktop (Calendar page).
export function AppleConnectModal({ open, onClose, onDone }) {
  const { t } = useI18n();
  return (
    <Sheet open={open} onClose={onClose} title={t('apple.title')}>
      {open && <AppleConnectForm onCancel={onClose} onDone={(r) => { onDone?.(r); onClose(); }} />}
    </Sheet>
  );
}

// Connected Apple IDs with a disconnect button.
export function AppleAccounts({ profile }) {
  const { t } = useI18n();
  const { demo } = useBe();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const list = appleAccounts(profile);
  if (!list.length) return <p className="muted small" style={{ margin: 0, fontWeight: 700 }}>{t('apple.none')}</p>;
  const off = async (appleId) => {
    if (demo) { toast(t('lp.demoOnly')); return; }
    setBusy(appleId);
    try { await disconnectApple(appleId); toast(t('apple.disconnected')); } catch { toast(t('calendar.errors.generic'), 'err'); } finally { setBusy(''); }
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {list.map((a) => (
        <div className="acct-row" key={a.appleId}>
          <span className="acct-av" style={{ width: 36, height: 36, fontSize: 16 }}>{a.appleId[0].toUpperCase()}</span>
          <div className="acct-main"><b title={a.appleId}>{a.appleId}</b><small>{t('apple.calCount', { n: a.calendars.length })}{a.calendars.length ? ` · ${a.calendars.map((c) => c.name).join('、')}` : ''}</small></div>
          <span className="pill dark">{t('connections.active')}</span>
          <div className="row conn-btns"><Button size="sm" variant="ghost" loading={busy === a.appleId} onClick={() => off(a.appleId)}>{t('apple.disconnect')}</Button></div>
        </div>
      ))}
    </div>
  );
}
