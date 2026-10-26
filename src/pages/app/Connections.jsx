// Connections (連接) — iOS Settings-style grouped lists (redesign 2026-10-18).
//   main:   Google 帳戶 (account rows + add / check rows) → 服務 (one row per service) → 即將推出 (collapsed)
//   detail: ?svc=<id> pushed full page (choose accounts, recent data, disconnect); ?svc=applecalendar&connect=1 = Apple form page.
import { useEffect, useState } from 'react';
import { gateErrorText } from '../../lib/gate-errors.js';
import { useSearchParams } from 'react-router-dom';
import { BrandIcon, Button, Spinner, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { AppleConnectForm } from '../../components/AppleConnect.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import {
  GOOGLE_IDS, accountsOf, selectedFor, accountLive, accountStatus, addAccount, withAccount, withSelection, fetchService, oauthErrorKey,
  ensureTokens, removeAccount, legacyAccounts, missingFor, failInfo, diagnose, vaultOf,
} from '../../lib/google.js';
import { loadEvents, appleAccounts, disconnectApple, demoData, hkTime } from '../../lib/calendar.js';
import { GithubRow, GithubDetail } from '../../components/GithubConnect.jsx';

const SHORT = { gmail: 'Gmail', googlecalendar: 'Calendar', googleclassroom: 'Classroom', googledrive: 'Drive' };
const NAME = { gmail: 'Gmail', googlecalendar: 'Google Calendar', googleclassroom: 'Google Classroom', googledrive: 'Google Drive', applecalendar: 'Apple 日曆' };
const names = (ids) => ids.map((id) => SHORT[id] || id).join('、');
const SOON = ['outlook', 'teams', 'notion', 'whatsapp', 'discord', 'telegram'];
const SOON_NAME = { outlook: 'Outlook', teams: 'Microsoft Teams', notion: 'Notion', whatsapp: 'WhatsApp', discord: 'Discord', telegram: 'Telegram' };

// Re-render when any Google token is added, refreshed or cleared.
function useTokenTick() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((x) => x + 1);
    window.addEventListener('nest:gtokens', f);
    const iv = setInterval(f, 60e3);
    return () => { window.removeEventListener('nest:gtokens', f); clearInterval(iv); };
  }, []);
  return n;
}

export function AcctAvatar({ acct, size = 24 }) {
  const ch = (acct?.name || acct?.email || '?').trim()[0]?.toUpperCase() || '?';
  return acct?.photo
    ? <img className="acct-av" src={acct.photo} alt="" width={size} height={size} referrerPolicy="no-referrer" style={{ width: size, height: size }} />
    : <span className="acct-av" style={{ width: size, height: size, fontSize: size * 0.46 }}>{ch}</span>;
}

// Recent data for Gmail / Classroom / Drive (per selected account).
function Preview({ profile, id, tick }) {
  const { t } = useI18n();
  const [res, setRes] = useState(null);
  const key = `${id}:${selectedFor(profile, id).join('+')}:${tick}`;
  useEffect(() => {
    let live = true;
    setRes(null);
    fetchService(profile, id).then((r) => live && setRes(r)).catch(() => live && setRes({ items: [], expired: [], errors: [{ status: 0 }], emails: [] }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!res) return <div className="ios-list"><div className="ios-row"><Spinner small /></div></div>;
  const many = res.emails.length > 1;
  return (
    <div className="ios-list">
      {res.items.slice(0, 5).map((i, k) => (
        <div className="ios-row tall" key={k}>
          <span className="ios-label">
            <b className="pv-title" title={i.title}>{i.href ? <a href={i.href} target="_blank" rel="noreferrer">{i.title}</a> : i.title}</b>
            <small className="pv-sub">{many && <em className="acct-tag">{i.account}</em>}{i.sub}</small>
          </span>
        </div>
      ))}
      {!res.items.length && !res.errors.length && <div className="ios-row"><span className="ios-label muted small">{t('connections.noItems')}</span></div>}
      {res.errors.map((e) => <div className="ios-row tall" key={e.email || 'x'}><span className="ios-label error-text small">{e.email}: {e.status === 403 ? t('connections.err403') : t('common.error')}{e.message ? ` (Google: ${e.message})` : ''}</span></div>)}
    </div>
  );
}

// Upcoming 7 days from EVERY Google calendar (+ Apple) — the same fetch as the Calendar tab, so holidays and
// subscribed calendars show too. Empty only when the server returned no events at all.
function CalPreview({ profile, google = true, apple = false, demo, lang }) {
  const { t } = useI18n();
  const [res, setRes] = useState(null);
  const sig = `${(profile.serviceAccounts?.googlecalendar || []).join(',')}|${appleAccounts(profile).map((a) => a.appleId).join(',')}`;
  useEffect(() => {
    let live = true;
    const from = Date.now() - 3600e3; const to = Date.now() + 7 * 864e5;
    setRes(null);
    (demo ? Promise.resolve(demoData(lang, from, to)) : loadEvents(profile, from, to))
      .then((r) => live && setRes(r)).catch(() => live && setRes({ events: [], errors: [{ source: 'google' }], calendars: [] }));
    return () => { live = false; };
  }, [sig, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!res) return <div className="ios-list"><div className="ios-row"><Spinner small /></div></div>;
  const calName = Object.fromEntries((res.calendars || []).map((c) => [c.key, c.name]));
  const list = (res.events || []).filter((e) => (google && e.source === 'google') || (apple && e.source === 'apple'))
    .filter((e) => e.endMs > Date.now()).sort((a, b) => a.startMs - b.startMs).slice(0, 6);
  const fmt = (ms) => new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(ms));
  const errs = (res.errors || []).filter((e) => (google && e.source === 'google') || (apple && e.source === 'apple'));
  const bad = (res.accounts || []).filter((a) => !a.ok && ((google && a.source === 'google') || (apple && a.source === 'apple')));
  return (
    <div className="ios-list">
      {list.map((e) => (
        <div className="ios-row tall" key={e.id}>
          <span className="ios-label">
            <b className="pv-title" title={e.title}>{e.title || '—'}</b>
            <small className="pv-sub">{fmt(e.startMs)}{e.allDay ? ` · ${t('calendar.allDay')}` : ` · ${hkTime(e.startMs)}`}{calName[e.calKey] ? ` · ${calName[e.calKey]}` : ''}</small>
          </span>
        </div>
      ))}
      {!list.length && !errs.length && !bad.length && <div className="ios-row"><span className="ios-label muted small">{t('conn2.noEvents7')}</span></div>}
      {errs.map((e, i) => <div className="ios-row tall" key={`e${i}`}><span className="ios-label error-text small">{t('common.error')}{e.detail || e.code ? ` (${e.detail || e.code})` : ''}</span></div>)}
      {bad.map((a) => <div className="ios-row tall" key={a.account}><span className="ios-label error-text small">{a.account}: {t('connections.expired')}</span></div>)}
    </div>
  );
}

export default function Connections() {
  const { be, demo } = useBe();
  const { t, lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const tick = useTokenTick();
  const [params, setParams] = useSearchParams();
  const svc0 = params.get('svc');
  const svc = svc0 && (svc0 === 'applecalendar' || GOOGLE_IDS.includes(svc0)) ? svc0 : null;
  const connecting = params.get('connect') === '1';
  const [busy, setBusy] = useState('');
  const [removing, setRemoving] = useState(null);
  const [soonOpen, setSoonOpen] = useState(false);
  const profile = s.profile || {};
  const accounts = accountsOf(profile);
  const enabled = profile.connections || {};
  const apple = appleAccounts(profile);
  const vaultSig = vaultOf(profile).map((v) => `${v.email}@${v.at || ''}`).join(',');
  const [diag, setDiag] = useState(null);
  const runDiag = async () => {
    setDiag('busy');
    try { setDiag(await diagnose()); } catch (e) { setDiag({ error: e.message || 'error' }); }
  };
  useEffect(() => {
    const f = () => { if (document.visibilityState === 'visible' && s.profile) ensureTokens(s.profile); };
    document.addEventListener('visibilitychange', f); window.addEventListener('focus', f);
    return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('focus', f); };
  }, [s.profile]);
  useEffect(() => { if (!demo && s.profile) ensureTokens(s.profile); }, [vaultSig, accounts.length, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); }, [svc, connecting]);
  const legacy = demo ? [] : legacyAccounts(profile);

  const go = (id, extra = {}) => setParams(id ? { svc: id, ...extra } : {}, { state: { fromMore: false } });
  const back = () => (window.history.state?.idx > 0 ? window.history.back() : go(connecting ? svc : null));

  const fail = (e) => {
    const g = gateErrorText(e, t); if (g) { toast(g, 'err'); return; }
    const k = oauthErrorKey(e);
    if (k === 'cancelled') return;
    const raw = String(e?.code || e?.message || '').replace(/^oauth\//, '');
    toast(`${t(`connections.oauthErr.${k}`)}${raw ? ` (Google: ${raw}${e?.detail ? ` — ${e.detail}` : ''})` : ''}`, 'err');
  };
  const link = async ({ ids, select = [], hint, tag }) => {
    if (demo) { toast(t('lp.demoOnly')); return; }
    setBusy(tag);
    try {
      const r = await addAccount({ ids, select, hint, ret: `/app/connections${svc ? `?svc=${svc}` : ''}` });
      if (!r.saved) await be.saveProfile(s.user.uid, withAccount(profile, r.acct, r.select || select));
      const miss = r.missing || missingFor(r.acct.email);
      if (miss.length) toast(t('connections.stillMissing', { email: r.acct.email, list: names(miss) }), 'err');
      else toast(t('connections.accountAdded', { email: r.acct.email }));
      setDiag(null);
    } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const reauth = (email) => link({ ids: GOOGLE_IDS, hint: email, tag: `re:${email}` });
  const toggle = async (id, email) => {
    const cur = selectedFor(profile, id);
    const next = cur.includes(email) ? cur.filter((e) => e !== email) : [...cur, email];
    if (demo) { toast(t('lp.demoOnly')); return; }
    if (!cur.includes(email) && ['reauth', 'missing'].includes(accountStatus(profile, email, id))) { await link({ ids: GOOGLE_IDS, select: [id], hint: email, tag: `${id}:${email}` }); return; }
    await be.saveProfile(s.user.uid, withSelection(profile, id, next));
  };
  const remove = async (email) => {
    setRemoving(null);
    if (demo) { toast(t('lp.demoOnly')); return; }
    await removeAccount(profile, s.user.uid, email);
    toast(t('connections.accountRemoved'));
  };
  const appleOff = async (appleId) => {
    if (demo) { toast(t('lp.demoOnly')); return; }
    setBusy(`ap:${appleId}`);
    try { await disconnectApple(appleId); toast(t('apple.disconnected')); } catch { toast(t('calendar.errors.generic'), 'err'); } finally { setBusy(''); }
  };

  // Per-service status for the main list.
  const svcState = (id) => {
    if (id === 'applecalendar') return apple.length ? { on: true, label: t('connections.connected'), n: apple.length } : { on: false, label: t('conn2.off') };
    const sel = selectedFor(profile, id);
    const on = enabled[id] && sel.length > 0;
    if (!on) return { on: false, label: t('conn2.off'), sel };
    const bad = sel.filter((e) => ['reauth', 'missing'].includes(accountStatus(profile, e, id)));
    const loading = sel.some((e) => accountStatus(profile, e, id) === 'loading') && !sel.some((e) => accountLive(e, id));
    return { on: true, sel, warn: bad.length > 0, label: loading ? t('connections.restoring') : bad.length ? t('conn2.needsAuth') : t('connections.connected') };
  };

  // ---------------- detail pages ----------------
  if (svc0 === 'github') return <GithubDetail demo={demo} onBack={back} backLabel={t('connections.title')} flash={params.get('github') || ''} />;
  if (svc) {
    const isApple = svc === 'applecalendar';
    if (isApple && connecting) {
      return (
        <div className="cx-page push-in">
          <button type="button" className="cx-back" onClick={back}><Icon name="chevronRight" size={18} stroke={2.5} className="icon-flip" />{NAME.applecalendar}</button>
          <h1 className="cx-title">{t('apple.title')}</h1>
          <div className="cx-form-card"><AppleConnectForm onCancel={back} onDone={() => go('applecalendar')} /></div>
        </div>
      );
    }
    const st = svcState(svc);
    const sel = isApple ? [] : selectedFor(profile, svc);
    return (
      <div className="cx-page push-in">
        <button type="button" className="cx-back" onClick={back}><Icon name="chevronRight" size={18} stroke={2.5} className="icon-flip" />{t('connections.title')}</button>
        <div className="cx-hero">
          <span className="cx-logo"><BrandIcon id={svc} size={30} /></span>
          <div className="cx-hero-t"><h1 className="cx-title">{isApple ? (lang === 'en' ? 'Apple Calendar' : NAME.applecalendar) : NAME[svc]}</h1><p>{t(`connections.desc.${svc}`)}</p></div>
          <span className={`cx-status ${st.on ? (st.warn ? 'warn' : 'on') : ''}`}>{st.label}</span>
        </div>

        {isApple ? (
          <>
            <section className="ios-group">
              <h2 className="ios-group-h">{t('apple.accounts')}</h2>
              <div className="ios-list">
                {apple.map((a) => (
                  <div className="ios-row tall" key={a.appleId}>
                    <span className="acct-av" style={{ width: 32, height: 32, fontSize: 15 }}>{a.appleId[0].toUpperCase()}</span>
                    <span className="ios-label"><b className="cx-ellipsis">{a.appleId}</b><small className="cx-sub">{t('apple.calCount', { n: a.calendars.length })}{a.calendars.length ? ` · ${a.calendars.map((c) => c.name).join('、')}` : ''}</small></span>
                    <button type="button" className="cx-trail danger" disabled={busy === `ap:${a.appleId}`} onClick={() => appleOff(a.appleId)}>{busy === `ap:${a.appleId}` ? <Spinner small /> : t('apple.disconnect')}</button>
                  </div>
                ))}
                <button type="button" className="ios-row cx-action" onClick={() => go('applecalendar', { connect: '1' })}>
                  <span className="cx-plus"><Icon name="plus" size={16} stroke={2.5} /></span><span className="ios-label">{apple.length ? t('conn2.appleAnother') : t('calendar.connectApple')}</span><Icon name="chevronRight" size={16} className="ios-chev" />
                </button>
              </div>
              <p className="ios-foot">{t('apple.sub')}</p>
            </section>
            {apple.length > 0 && (
              <section className="ios-group">
                <h2 className="ios-group-h">{t('conn2.next7')}</h2>
                <CalPreview profile={profile} google={false} apple demo={demo || be.MOCK} lang={lang} />
              </section>
            )}
          </>
        ) : (
          <>
            <section className="ios-group">
              <h2 className="ios-group-h">{t('connections.using')}</h2>
              <div className="ios-list">
                {accounts.map((a) => {
                  const picked = sel.includes(a.email);
                  const as = accountStatus(profile, a.email, svc);
                  const stale = ['reauth', 'missing'].includes(as);
                  return (
                    <button type="button" key={a.email} className="ios-row tall" aria-pressed={picked} disabled={!!busy} onClick={() => toggle(svc, a.email)}>
                      <AcctAvatar acct={a} size={32} />
                      <span className="ios-label"><b className="cx-ellipsis">{a.email}</b>{stale && <small className="cx-sub warn">{as === 'missing' ? t('conn2.missingScope') : t('connections.expired')}</small>}</span>
                      {busy === `${svc}:${a.email}` ? <Spinner small /> : <span className={`cx-check ${picked ? 'on' : ''}`} aria-hidden="true">{picked && <Icon name="check" size={16} stroke={3} />}</span>}
                    </button>
                  );
                })}
                <button type="button" className="ios-row cx-action" disabled={busy === 'add'} onClick={() => link({ ids: GOOGLE_IDS, select: [svc], tag: 'add' })}>
                  <span className="cx-plus">{busy === 'add' ? <Spinner small /> : <Icon name="plus" size={16} stroke={2.5} />}</span><span className="ios-label">{accounts.length ? t('connections.addAnother') : t('connections.addFirst')}</span>
                </button>
              </div>
              <p className="ios-foot">{accounts.length ? t('conn2.pickHint') : t('connections.noAccounts')}</p>
            </section>
            {sel.filter((e) => ['reauth', 'missing'].includes(accountStatus(profile, e, svc))).map((e) => (
              <div className="cal-chipnote soft cx-note" key={e} role="status">
                <Icon name="lock" size={14} /><span className="cal-chipnote-t">{accountStatus(profile, e, svc) === 'missing' ? t('connections.missingNote', { email: e, list: SHORT[svc] }) : `${e}：${t('connections.sessionNote')}`}</span>
                <button className="cal-chipnote-a" disabled={busy === `re:${e}`} onClick={() => reauth(e)}>{busy === `re:${e}` ? <Spinner small /> : accountStatus(profile, e, svc) === 'missing' ? t('connections.grantMissing') : t('connections.reconnect')}</button>
              </div>
            ))}
            {st.on && sel.some((e) => accountLive(e, svc)) && (
              <section className="ios-group">
                <h2 className="ios-group-h">{svc === 'googlecalendar' ? t('conn2.next7') : t('connections.preview')}</h2>
                {svc === 'googlecalendar' ? <CalPreview profile={profile} demo={demo || be.MOCK} lang={lang} /> : <Preview profile={profile} id={svc} tick={tick} />}
              </section>
            )}
            {st.on && (
              <section className="ios-group">
                <div className="ios-list">
                  <button type="button" className="ios-row danger" onClick={() => (demo ? toast(t('lp.demoOnly')) : be.saveProfile(s.user.uid, withSelection(profile, svc, [])))}><span className="ios-label">{t('connections.disconnect')}</span></button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------------- main list ----------------
  const services = [...GOOGLE_IDS, 'applecalendar'];
  return (
    <div className="cx-page">
      <h1 className="cx-title big">{t('connections.title')}</h1>
      <p className="cx-lead">{t('conn2.lead')}</p>
      {legacy.length > 0 && <p className="note-upgrade small" role="status">{t('connections.upgradeNote')}</p>}

      <section className="ios-group">
        <h2 className="ios-group-h">{t('connections.accountsTitle')}</h2>
        <div className="ios-list">
          {accounts.map((a) => {
            const st = accountStatus(profile, a.email);
            const live = st === 'live';
            const miss = live ? missingFor(a.email) : [];
            const fi = failInfo(profile, a.email);
            const uses = GOOGLE_IDS.filter((id) => selectedFor(profile, id).includes(a.email));
            const needs = st === 'reauth' || miss.length > 0;
            return (
              <div className="ios-row tall cx-acct" key={a.email}>
                <AcctAvatar acct={a} size={36} />
                <span className="ios-label">
                  <b className="cx-ellipsis" title={a.email}>{a.email}</b>
                  <small className="cx-sub">{uses.length ? uses.map((id) => t(`connections.short.${id}`)).join('、') : t('connections.unused')}</small>
                  {miss.length > 0 && <small className="cx-sub warn">{t('connections.missing', { list: names(miss) })}</small>}
                  {st === 'reauth' && fi?.detail && <small className="cx-sub warn">Google: {fi.detail}</small>}
                </span>
                {needs
                  ? <button type="button" className="cx-chip warn" disabled={busy === `re:${a.email}`} onClick={() => reauth(a.email)}>{busy === `re:${a.email}` ? <Spinner small /> : st === 'reauth' ? t('connections.reconnect') : t('connections.grantMissing')}</button>
                  : <span className={`cx-chip ${live ? 'on' : ''}`}>{live ? t('connections.active') : st === 'loading' ? t('connections.restoring') : t('connections.expired')}</span>}
                <button type="button" className="cx-trail danger" onClick={() => setRemoving(a)} aria-label={`${t('conn2.remove')} ${a.email}`}>{t('conn2.remove')}</button>
              </div>
            );
          })}
          <button type="button" className="ios-row cx-action" disabled={busy === 'add'} onClick={() => link({ ids: GOOGLE_IDS, tag: 'add' })}>
            <span className="cx-plus">{busy === 'add' ? <Spinner small /> : <Icon name="plus" size={16} stroke={2.5} />}</span><span className="ios-label">{accounts.length ? t('connections.addAnother') : t('connections.addFirst')}</span>
          </button>
          {accounts.length > 0 && (
            <button type="button" className="ios-row cx-action" disabled={diag === 'busy'} onClick={runDiag}>
              <span className="cx-plus">{diag === 'busy' ? <Spinner small /> : <Icon name="refresh" size={16} stroke={2.2} />}</span><span className="ios-label">{t('connections.diagnose')}</span>
            </button>
          )}
        </div>
        {diag && diag !== 'busy' && (
          <div className="ios-list cx-diag">
            {diag.error && <div className="ios-row"><span className="ios-label error-text small">{diag.error}</span></div>}
            {(diag.accounts || []).map((d) => (
              <div className="ios-row tall" key={d.email}>
                <span className="ios-label">
                  <b className="cx-ellipsis">{d.email}</b>
                  {d.ok ? <small className="cx-sub">{GOOGLE_IDS.map((id) => `${d.services?.[id]?.ok ? '✓' : '✗'} ${SHORT[id]}`).join('  ')}</small>
                    : <small className="cx-sub warn">✗ {t('connections.expired')} — Google: {d.detail || d.error}</small>}
                  {d.ok && GOOGLE_IDS.filter((id) => !d.services?.[id]?.ok).map((id) => <small key={id} className="cx-sub warn">{SHORT[id]}: {d.services?.[id]?.reason === 'scope_not_granted' ? t('connections.notGranted') : `${d.services?.[id]?.status || ''} ${d.services?.[id]?.message || d.services?.[id]?.reason || ''}`}</small>)}
                </span>
              </div>
            ))}
            {(diag.noVault || []).map((e) => <div className="ios-row" key={e}><span className="ios-label"><b className="cx-ellipsis">{e}</b><small className="cx-sub warn">✗ {t('connections.expired')}</small></span></div>)}
          </div>
        )}
        <p className="ios-foot">{t('connections.accountsSub')}</p>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-h">{t('conn2.services')}</h2>
        <div className="ios-list">
          {services.map((id) => {
            const st = svcState(id);
            const accts = id === 'applecalendar' ? apple.map((a) => ({ email: a.appleId })) : accounts.filter((a) => (st.sel || []).includes(a.email));
            return (
              <button type="button" key={id} data-svc={id} className="ios-row tall" onClick={() => go(id)}>
                <span className="cx-svc-ic"><BrandIcon id={id} size={22} /></span>
                <span className="ios-label">
                  <b>{id === 'applecalendar' ? (lang === 'en' ? 'Apple Calendar' : NAME.applecalendar) : NAME[id]}</b>
                  {st.on && accts.length > 0
                    ? <span className="cx-accts">{accts.slice(0, 2).map((a) => <span className="cx-acct-chip" key={a.email}><AcctAvatar acct={a} size={14} /><span>{a.email}</span></span>)}{accts.length > 2 && <span className="cx-acct-more">+{accts.length - 2}</span>}</span>
                    : <small className="cx-sub">{t(`connections.desc.${id}`)}</small>}
                </span>
                <span className={`cx-state ${st.on ? (st.warn ? 'warn' : 'on') : ''}`}>{st.label}</span>
                <Icon name="chevronRight" size={16} className="ios-chev" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="ios-group">
        <h2 className="ios-group-h">{lang === 'en' ? 'Developer' : lang === 'zh-Hans' ? '开发者' : '開發者'}</h2>
        <div className="ios-list"><GithubRow demo={demo} onOpen={() => go('github')} /></div>
      </section>

      <section className="ios-group">
        <div className="ios-list">
          <button type="button" className="ios-row" aria-expanded={soonOpen} onClick={() => setSoonOpen((x) => !x)}>
            <span className="ios-label"><b>{t('common.comingSoon')}</b><small className="cx-sub">{SOON.map((k) => SOON_NAME[k]).join('、')}</small></span>
            <Icon name="chevronDown" size={16} className={`ios-chev ${soonOpen ? 'rot' : ''}`} />
          </button>
          {soonOpen && SOON.map((k) => (
            <div className="ios-row cx-soon" key={k}>
              <span className="cx-svc-ic dim"><BrandIcon id={k} size={20} /></span>
              <span className="ios-label"><b>{SOON_NAME[k]}</b><small className="cx-sub">{t(`connections.desc.${k}`)}</small></span>
            </div>
          ))}
        </div>
        <p className="ios-foot">{t('connections.unverified')} {t('connections.schoolNote')}</p>
      </section>

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title={t('connections.removeTitle')}
        footer={<div className="sheet-actions"><Button variant="ghost" onClick={() => setRemoving(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={() => remove(removing.email)}>{t('connections.removeAccount')}</Button></div>}>
        <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.6 }}>{t('connections.removeBody', { email: removing?.email || '' })}</p>
      </Sheet>
    </div>
  );
}
