// /admin — Nest admin panel (English + 繁中, follows the app language; strings under `adm.*` in src/lib/strings.js). Access is enforced by the server: every /api/admin/* call verifies the
// Firebase ID token + verified email on the allowlist and answers 404 to anyone else. The client check below is
// cosmetic (it only decides whether to even try). Counts only: no chat, memory or email contents are ever loaded.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../../brand.jsx';
import { Button, Modal, Spinner, Field, useToast, LangSwitch } from '../../components/ui.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import Icon from '../../components/Icon.jsx';
import { useSession } from '../../lib/session.jsx';
import * as be from '../../lib/backend.js';
import AdminPlugins from './AdminPlugins.jsx';
import AdminAnnouncements from './AdminAnnouncements.jsx';
import AdminBlog from './AdminBlog.jsx';
import { ConfigTab, CodesTab, ModTab } from './AdminConfig.jsx';
import { post as apost } from './adminApi.js';
import { VerifiedTick } from '../../components/PluginUI.jsx';

let LOC = 'en-HK';
let TT = (k) => k;
const fmt = (ms, time) => (ms ? new Intl.DateTimeFormat(LOC, { timeZone: 'Asia/Hong_Kong', day: 'numeric', month: 'short', year: 'numeric', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(new Date(ms)) : '—');
const ago = (ms) => {
  if (!ms) return '—';
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 2) return TT('adm.justNow'); if (m < 60) return TT('adm.minAgo', { n: m });
  const h = Math.round(m / 60); if (h < 48) return TT('adm.hAgo', { n: h });
  return TT('adm.dAgo', { n: Math.round(h / 24) });
};
const planLabel = (f) => (f.planSource === 'beta' ? TT('adm.betaGift') : f.planSource === 'grant' ? TT('adm.proGranted') : ({ free: TT('adm.plan.free'), starter: TT('adm.plan.starter'), pro: TT('adm.plan.pro') })[f.plan] || f.plan || '—');
// Server-written English log detail → current language (known patterns; anything else shown as-is).
function logDetail(d = '') {
  let m;
  if ((m = /^Pro until (\S+)(?: · (.*))?$/.exec(d))) return TT('adm.log.proUntil', { date: fmt(Date.parse(m[1]), true) }) + (m[2] ? ` · ${m[2]}` : '');
  if ((m = /^Beta gift until (\S+)$/.exec(d))) return TT('adm.log.betaUntil', { date: fmt(Date.parse(m[1]), true) });
  if (/^Pro revoked \(beta gift ended now; slot stays used\)$/.test(d)) return TT('adm.log.revokedBeta');
  if (/^Pro revoked$/.test(d)) return TT('adm.log.revoked');
  if (d === 'Verified badge on') return TT('admv.log.on');
  if (d === 'Verified badge off') return TT('admv.log.off');
  if ((m = /^(Disabled|Enabled) \((.*)\)$/.exec(d))) return `${TT(m[1] === 'Disabled' ? 'adm.log.disabled' : 'adm.log.enabled')} (${/Firebase/.test(m[2]) ? TT('adm.log.authAndAi') : TT('adm.log.aiOnly')})`;
  return d;
}
const ACTION = (a) => TT(`adm.act.${a}`) !== `adm.act.${a}` ? TT(`adm.act.${a}`) : a;
const toDateInput = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const fromDateInput = (v) => Date.parse(`${v}T23:59:00+08:00`);

async function api(path, opts = {}) {
  const token = await be.getIdToken();
  const r = await fetch(`/api/admin/${path}`, { ...opts, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'error'), { status: r.status, code: d.error });
  return d;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="adm-404">
      <BrandLogo />
      <h1>404</h1>
      <p>{t('adm.nf')}</p>
      <Button to="/">{t('adm.goNest')}</Button>
    </div>
  );
}

export default function Admin() {
  const s = useSession();
  const { t, lang } = useI18n();
  LOC = lang === 'en' ? 'en-HK' : 'zh-HK'; TT = t;
  const [state, setState] = useState('checking'); // checking | denied | ok
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('overview');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true); setErr('');
    try { setData(await api('overview')); } catch (e) { if (e.status === 404) setState('denied'); else setErr(e.code ? `${t('adm.loadFail')} (${e.code})` : t('adm.loadFail')); } finally { setBusy(false); }
  };
  useEffect(() => { if (state !== 'ok') return; const prev = document.title; document.title = `${t('adm.title')} · Nest`; return () => { document.title = prev; }; }, [state]);
  useEffect(() => {
    if (s.status === 'loading') return;
    if (s.status === 'out' || (!be.MOCK && !s.isAdmin)) { setState('denied'); return; } // isAdmin = allowlist + the official account (server re-checks)
    api('whoami').then(() => { setState('ok'); load(); }).catch(() => setState('denied'));
  }, [s.status, s.user?.uid]);

  if (state === 'checking') return <div className="splash"><Spinner /></div>;
  if (state === 'denied') return <NotFound />;

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-top-in">
          <Link to="/app" className="adm-brand"><BrandLogo size={22} /><span className="pill dark">{t('adm.title')}</span></Link>
          <div className="adm-top-r">
            {data && <span className={`pill adm-mode ${data.mode === 'full' ? '' : 'warn'}`}>{data.mode === 'full' ? t('adm.full') : t('adm.limited')}</span>}
            <LangSwitch compact />
            <Button size="sm" variant="outline" icon="refresh" loading={busy} onClick={load} aria-label={t('adm.refresh')} className="adm-refresh">{t('adm.refresh')}</Button>
          </div>
        </div>
        <nav className="adm-tabs" role="tablist">
          {[['overview', t('adm.tabs.overview')], ['users', t('adm.tabs.users')], ['families', t('adm.tabs.families')], ['ann', t('adm2.tabs.ann')], ['blog', t('adm2.tabs.blog')], ['config', t('adm2.tabs.config')], ['codes', t('adm2.tabs.codes')], ['beta', t('adm.tabs.beta')], ['mod', t('adm2.tabs.mod')], ['plugins', t('adm.tabs.plugins')], ['log', t('adm.tabs.log')]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
      </header>
      <main className="adm-main">
        {err && <div className="notice">{err}</div>}
        {!data ? <div className="adm-loading"><Spinner /></div> : (
          <>
            {data.notes?.map((n) => <p className="adm-note" key={n}><Icon name="shield" size={16} />{/^Full mode/.test(n) ? t('adm.noteFull') : /^Limited mode/.test(n) ? t('adm.noteLimited') : n}</p>)}
            {tab === 'overview' && <><Overview d={data} />{d0Full(data) && <Cleanup reload={load} />}</>}
            {tab === 'users' && <Users d={data} reload={load} />}
            {tab === 'families' && <Families d={data} reload={load} />}
            {tab === 'beta' && <BetaTab d={data} reload={load} />}
            {tab === 'plugins' && <AdminPlugins />}
            {tab === 'ann' && <AdminAnnouncements />}
            {tab === 'blog' && <AdminBlog />}
            {tab === 'config' && <ConfigTab />}
            {tab === 'codes' && <CodesTab />}
            {tab === 'mod' && <ModTab stats={data.analytics?.plugins} goPlugins={() => setTab('plugins')} />}
            {tab === 'log' && <Log d={data} />}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, sub }) {
  return <div className="adm-stat"><small>{label}</small><b>{value ?? '—'}</b>{sub && <span>{sub}</span>}</div>;
}
function Bars({ series, label }) {
  const { t } = useI18n();
  const max = Math.max(1, ...series.map((x) => x.n));
  const total = series.reduce((a, b) => a + b.n, 0);
  return (
    <div className="card adm-chart">
      <div className="card-head"><h2>{label}</h2><span className="muted small" style={{ fontWeight: 800 }}>{t('adm.in30', { n: total })}</span></div>
      <div className="adm-bars" role="img" aria-label={`${label}: ${t('adm.in30', { n: total })}`}>
        {series.map((x) => <div key={x.day} className="adm-bar" title={`${x.day}: ${x.n}`}><span style={{ height: `${(x.n / max) * 100}%` }} /></div>)}
      </div>
      <div className="adm-bars-x"><span>{series[0]?.day.slice(5)}</span><span>{series[series.length - 1]?.day.slice(5)}</span></div>
    </div>
  );
}

function Overview({ d }) {
  const { t } = useI18n();
  const a = d.analytics; const f = a.features;
  return (
    <>
      <div className="adm-stats">
        <Stat label={t('adm.users')} value={a.totalUsers} sub={d.counts ? t('admv.countsLine', d.counts) : undefined} />
        <Stat label={t('adm.families')} value={a.totalFamilies} />
        <Stat label={t('adm.dau')} value={a.dau} sub={t('adm.todayHkt')} />
        <Stat label={t('adm.wau')} value={a.wau} sub={t('adm.last7')} />
        <Stat label={t('adm.activeFamilies')} value={a.activeFamilies7d} sub={t('adm.last7')} />
        <Stat label={t('adm.betaClaimed')} value={`${d.promo.claimed}/${d.promo.max}`} />
        <Stat label={t('adm2.stats.messages')} value={a.features?.aiMessages30d} />
        {a.plugins && <Stat label={t('adm2.stats.plugins')} value={`${a.plugins.listed}/${a.plugins.total}`} sub={`${t('adm2.stats.pending')} ${a.plugins.pending} · ${t('adm2.stats.reports')} ${a.plugins.openReports}`} />}
      </div>
      <div className="adm-grid">
        <Bars series={a.signups} label={t('adm.signups')} />
        <Bars series={a.messagesPerDay} label={t('adm.aiPerDay')} />
      </div>
      <div className="adm-grid">
        <div className="card">
          <div className="card-head"><h2>{t('adm.featureUsage')}</h2><span className="muted small" style={{ fontWeight: 800 }}>{t('adm.countsOnly')}</span></div>
          <Row k={t('adm.f.ai30')} v={f.aiMessages30d} />
          <Row k={t('adm.f.chat')} v={f.byMode.chat} />
          <Row k={t('adm.f.tutor')} v={f.byMode.tutor} />
          <Row k={t('adm.f.quiz')} v={f.byMode.quiz} />
          <Row k={t('adm.f.brief')} v={f.byMode.summary} />
          <Row k={t('adm.f.memory')} v={f.byMode.memory} />
          <Row k={t('adm.f.inbox')} v={f.byMode.inbox} />
          <Row k={t('adm.f.draft')} v={f.byMode.draft ?? 0} />
          <Row k={t('adm.f.reminders')} v={f.reminders} />
          <Row k={t('adm.f.memories')} v={f.memories} />
        </div>
        <div className="card">
          <div className="card-head"><h2>{t('adm.connections')}</h2><span className="muted small" style={{ fontWeight: 800 }}>{t('adm.usersLower')}</span></div>
          <Row k="Gmail" v={f.gmail} /><Row k="Google Calendar" v={f.gcal} /><Row k={t('adm.appleAccounts')} v={f.apple} />
          <Row k="Google Classroom" v={f.classroom} /><Row k="Google Drive" v={f.drive} />
          <div className="card-head" style={{ marginTop: 22 }}><h2>{t('adm.paidConv')}</h2><span className="pill warn">{t('adm.payNotLive')}</span></div>
          <Row k={t('adm.payingFamilies')} v="0" /><Row k={t('adm.conversion')} v="0%" />
          <Row k={t('adm.wlStarter')} v={a.paid.waitlist.starter} /><Row k={t('adm.wlPro')} v={a.paid.waitlist.pro} />
          <p className="muted small" style={{ fontWeight: 700, margin: '10px 0 0' }}>{t('adm.sinceNote', { date: a.since })}</p>
        </div>
      </div>
    </>
  );
}
const Row = ({ k, v }) => <div className="adm-row"><span>{k}</span><b>{v ?? '—'}</b></div>;

function Confirm({ open, title, body, danger, onCancel, onConfirm }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p style={{ fontWeight: 600, lineHeight: 1.6, marginTop: 0 }}>{body}</p>
      <div className="adm-actions">
        <Button variant="secondary" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{t('common.confirm')}</Button>
      </div>
    </Modal>
  );
}
function useAction(reload) {
  const { t } = useI18n();
  const toast = useToast();
  const [pending, setPending] = useState(null);
  const ask = (p) => setPending(p);
  const el = (
    <Confirm open={!!pending} title={pending?.title} body={pending?.body} danger={pending?.danger} onCancel={() => setPending(null)}
      onConfirm={async () => {
        try { if (pending.payload?.type === 'revoke-sessions') await apost('revoke', pending.payload); else await api('action', { method: 'POST', body: JSON.stringify(pending.payload) }); toast(t('adm.done')); setPending(null); pending.after?.(); await reload(); }
        catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); }
      }} />
  );
  return { ask, el };
}

const d0Full = (d) => d?.mode === 'full';
// Test-data cleanup (dry-run first; each step confirmed and logged server-side). Never touches real users,
// the official / system accounts or the two vault test accounts.
function Cleanup({ reload }) {
  const { t } = useI18n();
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState('');
  const [last, setLast] = useState(null);
  const preview = async () => { setBusy('plan'); try { setPlan((await api('cleanup')).plan); } catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } finally { setBusy(''); } };
  const [arm, setArm] = useState('');
  const run = async (step) => {
    if (arm !== step) { setArm(step); return; } // two-step confirm (no native dialog)
    setArm('');
    setBusy(step);
    try { const r = await api('cleanup', { method: 'POST', body: JSON.stringify({ step }) }); setLast(r); toast(t('adm.done')); await preview(); reload?.(); }
    catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } finally { setBusy(''); }
  };
  return (
    <div className="card adm-clean" style={{ marginTop: 16 }}>
      <div className="card-head"><h2>{t('cln.title')}</h2><Button size="sm" variant="outline" loading={busy === 'plan'} onClick={preview}>{t('cln.preview')}</Button></div>
      <p className="muted small" style={{ fontWeight: 600 }}>{t('cln.hint')}</p>
      {plan && (
        <div className="adm-clean-plan">
          <Row k={t('cln.accounts')} v={plan.accounts.map((a) => a.email).join(', ') || '—'} />
          <Row k={t('cln.families')} v={plan.families.join(', ') || '—'} />
          {plan.skippedFamilies?.length > 0 && <Row k={t('cln.skipped')} v={plan.skippedFamilies.join(', ')} />}
          <Row k={t('cln.plugins')} v={plan.plugins.map((p) => `${p.id}${p.exists ? ` (${p.review}${p.pendingV ? `, v${p.pendingV} pending` : ''}${p.listed ? ', listed' : ''})` : ' ✓ gone'}`).join(' · ')} />
          <Row k={t('cln.counts')} v={plan.installCounts.map((x) => `${x.id} ${x.installs}→${x.real}`).join(', ') || '—'} />
          <Row k={t('cln.testFamily')} v={`${plan.testFamily.fid}: ${plan.testFamily.ledgerClaim || plan.testFamily.ledgerGrant || plan.testFamily.ledgerUids.length || plan.testFamily.betaProUntil ? t('cln.hasPromo') : t('cln.noPromo')}`} />
          <Row k={t('cln.kept')} v={plan.keptTest.map((k) => k.email).join(', ')} />
          <Row k={t('cln.promo')} v={`${plan.promo.claimed}/${plan.promo.max}`} />
          {plan.demo && <Row k={t('cln.demo')} v={[...(plan.demo.profiles || []).map((x) => `${x.email || x.uid} (${x.kind}) @${x.handle} "${x.name}"${x.profileName ? ` → "${x.profileName}"` : ''}`), ...(plan.demo.families || []).map((f) => `${f.fid} "${f.name}" (${f.owner})`)].join(' · ') || '—'} />}
          {plan.waitlist && <Row k={t('cln.wl')} v={`test ${plan.waitlist.test.length} · empty ${plan.waitlist.empty.length} · real kept ${plan.waitlist.realKept}`} />}
          <div className="adm-actions wrap">
            {['plugins', 'accounts', 'demofix', 'waitlist', 'counts', 'testreset'].map((st) => <Button key={st} size="sm" variant={st === 'accounts' ? 'danger' : 'secondary'} loading={busy === st} onClick={() => run(st)}>{arm === st ? t('cln.confirm', { step: t(`cln.steps.${st}`) }) : t(`cln.steps.${st}`)}</Button>)}
          </div>
          {last && <p className="muted small" style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{t('cln.result')}: {JSON.stringify(last)}</p>}
        </div>
      )}
    </div>
  );
}

function Users({ d, reload }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const list = useMemo(() => {
    const k = q.trim().toLowerCase();
    return d.users.filter((u) => !k || `${u.name} ${u.email} ${u.familyName} ${u.uid}`.toLowerCase().includes(k));
  }, [q, d.users]);
  const u = sel && d.users.find((x) => x.uid === sel);
  const [reason, setReason] = useState('');
  const [repH, setRepH] = useState(''); const [repN, setRepN] = useState(''); // Run 10: repair a demo-polluted public profile
  const { ask, el } = useAction(reload);
  return (
    <div className="card">
      <div className="card-head"><h2>{t('adm.users')} <span className="muted small">({list.length})</span></h2>{d.counts && <span className="muted small" style={{ fontWeight: 800 }}>{t('admv.countsLine', d.counts)}</span>}</div>
      <input className="input" placeholder={t('adm.searchPh')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>{t('adm.th.user')}</th><th>{t('adm.th.signedUp')}</th><th>{t('adm.th.lastActive')}</th><th>{t('adm.th.family')}</th><th>{t('adm.th.plan')}</th><th>{t('adm.th.signIn')}</th></tr></thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.uid} onClick={() => setSel(x.uid)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(x.uid)}>
                <td><b>{x.name || '—'}{x.verified && <VerifiedTick size={13} />}</b><small>{x.email}{x.handle ? ` · @${x.handle}` : ''}</small>{x.kind && x.kind !== 'real' ? <span className="pill">{t(`admv.kinds.${x.kind}`)}</span> : x.test && <span className="pill">{t('adm.testPill')}</span>}{x.disabled && <span className="pill warn">{t('adm.disabledPill')}</span>}</td>
                <td>{fmt(x.createdAt)}</td><td>{ago(x.lastActive)}</td><td>{x.familyName || '—'}</td>
                <td>{planLabel(x)}</td><td>{x.provider || '—'}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="muted">{t('adm.noUsers')}</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={!!u} onClose={() => setSel(null)} title={u?.name || u?.email || t('adm.th.user')}>
        {u && (
          <>
            <Row k={t('adm.email')} v={u.email} /><Row k={t('adm.userId')} v={<code>{u.uid}</code>} /><Row k={t('adm.provider')} v={u.provider || '—'} />
            <Row k={t('adm.th.signedUp')} v={fmt(u.createdAt, true)} /><Row k={t('adm.lastSignIn')} v={fmt(u.lastLogin, true)} /><Row k={t('adm.th.lastActive')} v={fmt(u.lastActive, true)} />
            <Row k={t('adm.th.family')} v={u.familyName || '—'} /><Row k={t('adm.effectivePlan')} v={u.planSource === 'beta' ? t('adm.proBeta') : u.planSource === 'grant' ? t('adm.proGranted') : planLabel({ plan: u.plan })} />
            <Row k={t('adm.connections')} v={['gmail', 'gcal', 'classroom', 'drive'].filter((k) => u.cx?.[k]).map((k) => ({ gmail: 'Gmail', gcal: 'Calendar', classroom: 'Classroom', drive: 'Drive' })[k]).concat(u.cx?.apple ? [`Apple ×${u.cx.apple}`] : []).join(', ') || t('adm.none')} />
            <Row k={t('adm.waitlist')} v={(u.wl || []).join(', ') || '—'} /><Row k={t('adm.status')} v={u.disabled ? t('adm.statusDisabled') : t('adm.statusActive')} />
            <Row k={t('admv.verifiedPill')} v={<>{u.verified ? <VerifiedTick size={14} /> : '—'}{u.handle ? ` @${u.handle}` : ''}{u.kind ? ` · ${t(`admv.kinds.${u.kind}`)}` : ''}</>} />
            <div className="adm-actions">
              {u.verified
                ? <Button variant="secondary" onClick={() => ask({ title: t('admv.unverifyQ', { email: u.email }), body: t('admv.verifyBody'), payload: { type: 'unverify-user', uid: u.uid } })}>{t('admv.unverify')}</Button>
                : <Button variant="secondary" onClick={() => ask({ title: t('admv.verifyQ', { email: u.email }), body: t('admv.verifyBody'), payload: { type: 'verify-user', uid: u.uid } })}>{t('admv.verify')}</Button>}
              {u.disabled
                ? <Button onClick={() => ask({ title: t('adm.enableQ'), body: t(d.mode === 'full' ? 'adm.enableBodyFull' : 'adm.enableBodyLimited', { email: u.email }), payload: { type: 'enable', uid: u.uid } })}>{t('adm.enable')}</Button>
                : <Button variant="danger" onClick={() => ask({ danger: true, title: t('adm.disableQ'), body: t(d.mode === 'full' ? 'adm.disableBodyFull' : 'adm.disableBodyLimited', { email: u.email }), payload: { type: 'disable', uid: u.uid, note: reason } })}>{t('adm.disable')}</Button>}
            </div>
            <div className="adm-actions wrap" style={{ marginTop: 8 }}>
              <input className="input" style={{ flex: '1 1 180px' }} placeholder={t('adm2.user.reason')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} aria-label={t('adm2.user.reason')} />
              <Button variant="secondary" data-testid="revoke-sessions" onClick={() => ask({ danger: true, title: t('adm2.user.revokeQ'), body: t('adm2.user.revokeBody', { email: u.email }), payload: { type: 'revoke-sessions', uid: u.uid, note: reason } })}>{t('adm2.user.revoke')}</Button>
            </div>
            <div className="adm-actions wrap" style={{ marginTop: 8 }} data-testid="repair-profile">
              <input className="input" style={{ flex: '1 1 120px' }} placeholder="@handle" value={repH} onChange={(e) => setRepH(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} aria-label="handle" />
              <input className="input" style={{ flex: '1 1 140px' }} placeholder={lang === 'en' ? 'Display name' : '顯示名稱'} value={repN} onChange={(e) => setRepN(e.target.value.slice(0, 40))} aria-label="name" />
              <Button variant="secondary" disabled={!repH && !repN.trim()} onClick={() => ask({ title: lang === 'en' ? `Repair public profile of ${u.email}?` : `修復 ${u.email} 的公開個人頁？`, body: `${repH ? `@${repH}` : ''} ${repN.trim() || (lang === 'en' ? '(name from the account profile)' : '（名稱取自帳戶資料）')}`.trim(), payload: { type: 'repair-profile', uid: u.uid, handle: repH || undefined, name: repN.trim() || undefined, nameFromProfile: !repN.trim() || undefined, note: reason } })}>{lang === 'en' ? 'Repair profile' : '修復個人頁'}</Button>
            </div>
            {u.fid && (d.families || []).find((x) => x.fid === u.fid) && (
              <div style={{ marginTop: 12 }} data-testid="user-plan-controls">
                <b className="small">{t('adm.effectivePlan')} · {u.familyName || u.fid}</b>
                <GrantControls f={(d.families || []).find((x) => x.fid === u.fid)} ask={ask} onClose={() => setSel(null)} />
              </div>
            )}
            <PlanAudit email={u.email} />
          </>
        )}
      </Modal>
      {el}
    </div>
  );
}

function Families({ d, reload }) {
  const { t } = useI18n();
  const [sel, setSel] = useState(null);
  const f = sel && d.families.find((x) => x.fid === sel);
  return (
    <div className="card">
      <div className="card-head"><h2>{t('adm.families')} <span className="muted small">({d.families.length})</span></h2></div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>{t('adm.th.family')}</th><th>{t('adm.th.members')}</th><th>{t('adm.th.plan')}</th><th>{t('adm.th.expiry')}</th><th>{t('adm.th.lastActive')}</th></tr></thead>
          <tbody>
            {d.families.map((x) => (
              <tr key={x.fid} onClick={() => setSel(x.fid)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(x.fid)}>
                <td><b>{x.name || <span className="muted">{t('adm.notSeen')}</span>}</b><small>{x.owner || x.fid}</small>{x.test && <span className="pill">{t('adm.testPill')}</span>}</td>
                <td>{x.members ?? '—'}</td><td>{planLabel(x)}</td>
                <td>{x.planUntil ? fmt(x.planUntil) : x.betaUntil ? t('adm.ended', { date: fmt(x.betaUntil) }) : '—'}</td><td>{ago(x.lastActive)}</td>
              </tr>
            ))}
            {!d.families.length && <tr><td colSpan={5} className="muted">{t('adm.noFamilies')}</td></tr>}
          </tbody>
        </table>
      </div>
      <FamilyModal f={f} d={d} onClose={() => setSel(null)} reload={reload} />
    </div>
  );
}

// Set plan for a family: grant Pro for a duration (1 month / 3 months / 1 year / a date; 10 minutes for test families)
// or revoke. Every action is logged server-side (ledger log). Plans belong to the family — a user's plan is their family's.
function GrantControls({ f, ask, onClose }) {
  const { t, lang } = useI18n();
  const en = lang === 'en';
  const [until, setUntil] = useState('');
  const [exact, setExact] = useState(0);
  useEffect(() => { if (f) { setUntil(toDateInput(Math.max(Date.now(), f.planUntil || 0) + 30 * 864e5)); setExact(0); } }, [f?.fid]);
  if (!f) return null;
  const target = exact || (until ? fromDateInput(until) : 0);
  const valid = target > Date.now();
  const dur = (label, ms, isExact) => <Button key={label} size="sm" variant="outline" onClick={() => { if (isExact) { setExact(Date.now() + ms); } else { setExact(0); setUntil(toDateInput(Date.now() + ms)); } }}>{label}</Button>;
  const when = exact ? new Date(exact).toLocaleString(en ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong' }) : until;
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', margin: '8px 0' }} data-testid="grant-durations">
        {dur(en ? '1 month' : '1 個月', 30 * 864e5)}{dur(en ? '3 months' : '3 個月', 91 * 864e5)}{dur(en ? '1 year' : '1 年', 365 * 864e5)}
        {f.test && dur(en ? '10 min (test)' : '10 分鐘（測試）', 10 * 60e3, true)}
      </div>
      <Field label={t('adm.untilLabel')}><input className="input" type="date" value={exact ? toDateInput(exact) : until} min={toDateInput(Date.now())} onChange={(e) => { setExact(0); setUntil(e.target.value); }} /></Field>
      {exact > 0 && <p className="muted small">{en ? `Ends ${when} (HKT)` : `於 ${when}（香港時間）結束`}</p>}
      <div className="adm-actions wrap">
        <Button disabled={!valid} onClick={() => ask({ title: t('adm.grantQ'), body: exact ? (en ? `Pro for ${f.name || f.fid} until ${when} (HKT).` : `讓 ${f.name || f.fid} 使用 Pro，直至 ${when}（香港時間）。`) : t('adm.grantBody', { name: f.name || f.fid, date: until }), payload: { type: 'grant', fid: f.fid, until: target }, after: onClose })}>{t('adm.grant')}</Button>
        {f.betaUntil != null && <Button variant="outline" disabled={!valid} onClick={() => ask({ title: t('adm.extendQ'), body: t('adm.extendBody', { name: f.name || f.fid, date: until }), payload: { type: 'extend', fid: f.fid, until: target }, after: onClose })}>{t('adm.extend')}</Button>}
        {f.plan === 'pro' && f.planSource !== 'plan' && <Button variant="danger" onClick={() => ask({ danger: true, title: t('adm.revokeQ'), body: t(f.betaUntil && f.betaUntil > Date.now() ? 'adm.revokeBodyBeta' : 'adm.revokeBody', { name: f.name || f.fid, plan: planLabel({ plan: f.basePlan }) }), payload: { type: 'revoke', fid: f.fid }, after: onClose })}>{t('adm.revoke')}</Button>}
      </div>
      <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 10 }} data-testid="set-plan">
        <span className="muted small" style={{ fontWeight: 700 }}>{en ? 'Family’s own plan:' : '家庭自身方案：'}</span>
        {['free', 'starter', 'pro'].map((p) => <Button key={p} size="sm" variant={f.basePlan === p ? 'primary' : 'outline'} disabled={f.basePlan === p}
          onClick={() => ask({ title: en ? `Set ${f.name || f.fid} to ${p}?` : `把 ${f.name || f.fid} 的自身方案設為 ${planLabel({ plan: p })}？`, body: en ? 'Changes the family’s base plan (member limit + AI limits). Logged.' : '更改家庭的基本方案（成員上限及 AI 用量）。此操作會記錄。', payload: { type: 'set-plan', fid: f.fid, plan: p }, after: onClose })}>{planLabel({ plan: p })}</Button>)}
      </div>
    </>
  );
}

// Read-only: every place a plan can come from for this user (GET /api/admin/plan-audit).
function PlanAudit({ email }) {
  const { lang } = useI18n();
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { setRes(await api(`plan-audit?email=${encodeURIComponent(email)}`)); } catch (e) { setRes({ error: e.code || e.message }); } finally { setBusy(false); } };
  return (
    <div style={{ marginTop: 10 }}>
      <Button size="sm" variant="ghost" loading={busy} onClick={run}>{lang === 'en' ? 'Plan audit (read-only)' : '計劃來源核查（只讀）'}</Button>
      {res && <pre className="adm-audit" data-testid="plan-audit" style={{ whiteSpace: 'pre-wrap', fontSize: 11, maxHeight: 260, overflow: 'auto', background: 'var(--soft)', padding: 8, borderRadius: 10 }}>{JSON.stringify(res, null, 2)}</pre>}
    </div>
  );
}

function FamilyModal({ f, d, onClose, reload }) {
  const { t } = useI18n();
  const [until, setUntil] = useState('');
  const { ask, el } = useAction(reload);
  useEffect(() => { if (f) setUntil(toDateInput(Math.max(Date.now(), f.planUntil || 0) + 30 * 864e5)); }, [f?.fid]);
  if (!f) return el;
  const valid = until && fromDateInput(until) > Date.now();
  return (
    <>
      <Modal open onClose={onClose} title={f.name || t('adm.th.family')}>
        <Row k={t('adm.familyId')} v={<code>{f.fid}</code>} /><Row k={t('adm.owner')} v={f.owner || '—'} /><Row k={t('adm.th.members')} v={f.members ?? '—'} />
        <Row k={t('adm.ownPlan')} v={planLabel({ plan: f.basePlan })} /><Row k={t('adm.effectivePlan')} v={planLabel(f)} /><Row k={t('adm.proUntil')} v={fmt(f.planUntil, true)} />
        <Row k={t('adm.betaGift')} v={f.betaUntil ? `${fmt(f.betaAt)} → ${fmt(f.betaUntil)}` : t('adm.notClaimed')} /><Row k={t('adm.grantUntil')} v={fmt(f.grantUntil, true)} />
        <Row k={t('adm.reminders')} v={f.reminders ?? '—'} /><Row k={t('adm.memoryItems')} v={f.memories ?? '—'} />
        <GrantControls f={f} ask={ask} onClose={onClose} />
      </Modal>
      {el}
    </>
  );
}

function BetaTab({ d }) {
  const { t } = useI18n();
  const p = d.promo;
  return (
    <div className="card">
      <div className="card-head"><h2>{t('adm.tabs.beta')}</h2><span className="pill dark">{t('adm.claimedLeft', { c: p.claimed, m: p.max, r: p.remaining })}</span></div>
      <p className="muted small" style={{ fontWeight: 700, marginTop: -6 }}>{t('adm.link')}<a href="https://nesty.cyou/beta" target="_blank" rel="noreferrer">nesty.cyou/beta</a> · {t('adm.betaDesc')}</p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>{t('adm.th.family')}</th><th>{t('adm.th.claimedBy')}</th><th>{t('adm.th.claimed')}</th><th>{t('adm.th.expires')}</th><th>{t('adm.status')}</th></tr></thead>
          <tbody>
            {p.claims.map((c) => (
              <tr key={c.fid}><td><b>{c.family || '—'}</b><small>{c.fid}</small></td><td>{c.by}</td><td>{fmt(c.at, true)}</td><td>{fmt(c.until, true)}</td><td>{c.active ? <span className="pill">{t('adm.activePill')}</span> : <span className="pill warn">{t('adm.endedPill')}</span>}</td></tr>
            ))}
            {!p.claims.length && <tr><td colSpan={5} className="muted">{t('adm.noClaims')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Log({ d }) {
  const { t } = useI18n();
  const [q, setQ] = useState('');
  const rows = d.log.filter((l) => { const k = q.trim().toLowerCase(); return !k || `${l.action} ${l.target} ${l.by} ${l.detail}`.toLowerCase().includes(k); });
  return (
    <div className="card" data-testid="adm-audit">
      <div className="card-head"><h2>{t('adm2.audit.title')}</h2><span className="muted small" style={{ fontWeight: 800 }}>{t('adm.latest300')}</span></div>
      <input className="input" placeholder={t('adm2.audit.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>{t('adm.th.time')}</th><th>{t('adm.th.who')}</th><th>{t('adm.th.action')}</th><th>{t('adm.th.target')}</th><th>{t('adm.th.detail')}</th></tr></thead>
          <tbody>
            {rows.map((l, i) => <tr key={i}><td>{fmt(l.at, true)}</td><td>{l.by}</td><td><b>{ACTION(l.action)}</b></td><td><code>{l.target}</code></td><td>{logDetail(l.detail)}</td></tr>)}
            {!rows.length && <tr><td colSpan={5} className="muted">{t('adm.noLog')}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
