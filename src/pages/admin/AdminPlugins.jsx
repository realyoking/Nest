// /admin → Plugins: pending queue (view code / manifest / screenshots, approve, reject with reason), all plugins
// (unpublish / republish, Verified, Safe, Featured), reports queue, creators (verify, ban). Every action is checked
// server-side (api/_plugins.js admin ops: allowlist + verified Firebase ID token, 404 for anyone else) and logged in the
// existing admin log.
import { useEffect, useState } from 'react';
import { Button, Modal, Spinner, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { PluginIcon, SafeBadge, VerifiedTick, PermList, RiskBadge, nameOf } from '../../components/PluginUI.jsx';
import { maxRisk, PERMS, VERIFIED_ONLY } from '../../lib/plugins/permissions.js';
import { bundleDiff } from '../../lib/plugins/project.js';
import DiffView from '../../components/DiffView.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import * as API from '../../lib/plugins/api.js';

export default function AdminPlugins() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [sub, setSub] = useState('pending');
  const [view, setView] = useState(null);
  const [reject, setReject] = useState(null);
  const load = () => API.adminPlugins().then(setD).catch((e) => setErr(e.code || 'error'));
  useEffect(() => { load(); }, []);
  const act = async (body, after) => {
    try { await API.adminPluginAction(body); toast(t('adm.done')); after?.(); await load(); }
    catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); }
  };
  if (err) return <div className="notice">{t('adm.loadFail')} ({err})</div>;
  if (!d) return <div className="adm-loading"><Spinner /></div>;
  const pending = d.plugins.filter((p) => p.pendingV || p.listingPending);
  const creatorOf = (uid) => d.creators.find((c) => c.uid === uid);
  const riskOf = (p) => maxRisk((p.perms || []).filter((x) => !PERMS[x]?.implied));
  const Card = ({ p }) => (
    <div className={`card adp-card ${riskOf(p) === 'high' ? 'adp-high' : ''}`}>
      <div className="adp-head">
        <PluginIcon src={p.icon} name={nameOf(p, lang)} size={48} />
        <div className="adp-t">
          <b>{nameOf(p, lang)} {p.safe && <SafeBadge small />}{p.verified && <VerifiedTick size={13} />}{riskOf(p) && <RiskBadge risk={riskOf(p)} small />}</b>
          <small><code>{p.id}</code> · @{creatorOf(p.creatorUid)?.handle || '?'} · v{p.version} · {p.installs} · ★ {p.rating || '—'}</small>
          {p.listingPending && <ListingDiff p={p} lang={lang} />}
          {p.isUpdate && <small className="adp-upd"><b>{lang === 'en' ? 'Update' : '更新'}</b> v{p.live} → v{p.pendingV}{p.pendingNotes ? ` · ${p.pendingNotes}` : ''}</small>}
          {(p.perms || []).some((x) => VERIFIED_ONLY.includes(x)) && !p.safe && !p.verified && <small className="adp-upd">{lang === 'en' ? 'Requests Gmail: refused until you label it Safe or Verified.' : '要求讀取 Gmail：須標示為安全或已驗證才會開放。'}</small>}
          <small>{p.listed ? t('adp.listed') : t('adp.unlisted')}{p.pendingV ? ` · ${t('adp.version', { v: p.pendingV })} ${t('studio.status.pending')}` : ''}{p.creatorBanned ? ` · ${t('adp.banned')}` : ''}{p.review === 'rejected' && p.rejectReason ? ` · ${p.rejectReason}` : ''}</small>
        </div>
      </div>
      <div className="adp-acts">
        <Button size="sm" variant="outline" icon="code" onClick={() => setView({ p, v: p.pendingV || p.live || p.draftV })}>{t('adp.viewCode')}</Button>
        {p.listingPending && <Button size="sm" onClick={() => act({ type: 'approve-listing', id: p.id })} data-testid="adp-approve-listing">{lang === 'en' ? 'Approve listing' : '批准商店資料'}</Button>}
        {p.listingPending && <Button size="sm" variant="danger" onClick={() => setReject({ ...p, listingOnly: true })}>{lang === 'en' ? 'Reject listing' : '拒絕商店資料'}</Button>}
        {p.pendingV > 0 && <Button size="sm" onClick={() => act({ type: 'approve', id: p.id, v: p.pendingV, keepSafe: false })}>{t('adp.approve')}</Button>}
        {p.pendingV > 0 && <Button size="sm" variant="danger" onClick={() => setReject(p)}>{t('adp.reject')}</Button>}
        {p.live > 0 && (p.rawListed ? <Button size="sm" variant="outline" onClick={() => act({ type: 'unpublish', id: p.id })}>{t('adp.unpublish')}</Button> : <Button size="sm" variant="outline" onClick={() => act({ type: 'republish', id: p.id })}>{t('adp.republish')}</Button>)}
        {p.live > 0 && <Button size="sm" variant={p.safe ? 'secondary' : 'outline'} icon="shield" onClick={() => act({ type: 'safe', id: p.id, on: !p.safe })}>{p.safe ? t('adp.unsafe') : t('adp.safe')}</Button>}
        <Button size="sm" variant="outline" onClick={() => act({ type: 'verify', id: p.id, on: !p.verified })}>{p.verified ? t('adp.unverify') : t('adp.verify')}</Button>
        <Button size="sm" variant="outline" onClick={() => act({ type: 'feature', id: p.id, on: !p.featured })}>{p.featured ? t('adp.unfeature') : t('adp.feature')}</Button>
      </div>
    </div>
  );
  return (
    <div className="adp">
      <div className="segment adp-sub" role="tablist">
        {[['pending', `${t('adp.pending')} (${pending.length})`], ['all', t('adp.all')], ['reports', `${t('adp.reports')} (${d.reports.length})`], ['creators', t('adp.creators')]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>
      <p className="adm-note"><Icon name="shield" size={16} />{t('adp.safeHint')}</p>
      {sub === 'pending' && (pending.length ? pending.map((p) => <Card key={p.id} p={p} />) : <p className="muted">{t('adp.none')}</p>)}
      {sub === 'all' && d.plugins.map((p) => <Card key={p.id} p={p} />)}
      {sub === 'reports' && (d.reports.length ? d.reports.map((r) => (
        <div key={r.id} className="card adp-card">
          <b>{t('adp.reportOn', { k: t(`adp.kind.${r.kind}`) })} · <code>{r.pid}</code></b>
          <p style={{ margin: '6px 0' }}>{r.reason}</p>
          <small className="muted">{new Date(r.at).toLocaleString(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong' })} · {t('adp.byUser', { u: String(r.by).slice(0, 6) + '…' })}</small>
          <div className="adp-acts">
            <Button size="sm" variant="outline" onClick={() => setView({ p: d.plugins.find((x) => x.id === r.pid) || { id: r.pid }, v: 0 })}>{t('adp.viewCode')}</Button>
            {r.kind === 'review' && r.reviewUid && <Button size="sm" variant="danger" onClick={() => act({ type: 'delete-review', id: r.pid, uid: r.reviewUid }, () => act({ type: 'resolve-report', rid: r.id, reason: 'review deleted' }))}>{t('adp.deleteReview')}</Button>}
            <Button size="sm" variant="outline" onClick={() => act({ type: 'unpublish', id: r.pid, reason: r.reason.slice(0, 120) })}>{t('adp.unpublish')}</Button>
            <Button size="sm" onClick={() => act({ type: 'resolve-report', rid: r.id })}>{t('adp.resolve')}</Button>
          </div>
        </div>
      )) : <p className="muted">{t('adp.none')}</p>)}
      {sub === 'creators' && d.creators.map((c) => (
        <div key={c.uid} className="card adp-card adp-cr">
          <div className="adp-head">{c.pfp ? <img src={c.pfp} alt="" className="adp-pfp" /> : <span className="adp-pfp ps-pfp-l">{(c.handle || '?').slice(0, 1).toUpperCase()}</span>}
            <div className="adp-t"><b>@{c.handle}{c.verified && <VerifiedTick size={13} />}{c.banned && <span className="pill warn">{t('adp.banned')}</span>}</b><small>{c.bio}</small><small>{c.plugins} · <code>{c.uid.slice(0, 8)}…</code></small></div></div>
          <div className="adp-acts">
            <Button size="sm" variant="outline" onClick={() => act({ type: 'verify-creator', uid: c.uid, on: !c.verified })}>{c.verified ? t('adp.unverifyCreator') : t('adp.verifyCreator')}</Button>
            {c.uid !== 'nest-official' && <Button size="sm" variant={c.banned ? 'outline' : 'danger'} onClick={() => act({ type: 'ban', uid: c.uid, on: !c.banned })}>{c.banned ? t('adp.unban') : t('adp.ban')}</Button>}
          </div>
        </div>
      ))}
      {view && <CodeView p={view.p} v={view.v} onClose={() => setView(null)} />}
      {reject && <RejectModal p={reject} onClose={() => setReject(null)} onSubmit={(reason) => act({ type: reject.listingOnly ? 'reject-listing' : 'reject', id: reject.id, reason }, () => setReject(null))} />}
    </div>
  );
}

function CodeView({ p, v, onClose }) {
  const { t, lang } = useI18n();
  const [d, setD] = useState(null);
  const [f, setF] = useState('manifest');
  const [err, setErr] = useState('');
  const [diff, setDiff] = useState(null);
  useEffect(() => { API.adminVersion(p.id, v || undefined).then(setD).catch((e) => setErr(e.code || 'error')); }, [p.id, v]);
  // Update review: what changed since the live version.
  const showDiff = async () => {
    try { const live = await API.adminVersion(p.id, d.live); setDiff(bundleDiff(live.version, d.version)); } catch (e) { setErr(e.code || 'error'); }
  };
  return (
    <Modal open onClose={onClose} title={`${nameOf(p, lang) || p.id} · ${d ? t('adp.version', { v: d.v }) : ''}`}>
      {err && <p className="error-text">{err}</p>}
      {!d && !err && <Spinner />}
      {d && (
        <div className="adp-code">
          {d.version.notes && <p className="adp-upd"><b>{lang === 'en' ? 'What’s new: ' : '更新內容：'}</b>{d.version.notes}</p>}
          {d.live > 0 && d.live !== d.v && <Button size="sm" variant="outline" onClick={showDiff}>{lang === 'en' ? `Changes since live v${d.live}` : `與已上架第 ${d.live} 版比較`}</Button>}
          {diff && <DiffView parts={diff} />}
          <PermList highlight perms={d.version.manifest?.permissions || []} caps={d.version.manifest?.capabilities || []} reasons={d.version.manifest?.permissionReasons || {}} domains={d.version.manifest?.network?.domains || []} />
          {d.version.manifest?.features && <div className="adp-features"><b>{lang === 'en' ? 'Features (creator’s text)' : '功能（創作者填寫）'}</b><ul className="ps-features">{String(d.version.manifest.features).split('\n').map((l, i) => <li key={i}>{l}</li>)}</ul></div>}
          <div className="segment" role="tablist">{['manifest', 'html', 'css', 'js'].map((k) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k}</button>)}</div>
          <pre className="adp-pre">{f === 'manifest' ? JSON.stringify(d.version.manifest, null, 2) : d.version[f] || '—'}</pre>
          <small className="muted">{Math.round((d.version.size || 0) / 1024)} KB</small>
          {d.shots.length > 0 && <div className="ps-shots">{d.shots.map((s, i) => <img key={i} src={s} className="ps-shot" alt="" />)}</div>}
          {d.video && <p className="small"><a href={d.video} target="_blank" rel="noopener noreferrer">{d.video}</a></p>}
        </div>
      )}
    </Modal>
  );
}
function RejectModal({ p, onClose, onSubmit }) {
  const { t, lang } = useI18n();
  const [r, setR] = useState('');
  return (
    <Modal open onClose={onClose} title={`${t('adp.rejectQ')} · ${nameOf(p, lang)}`}>
      <textarea className="textarea" maxLength={300} value={r} onChange={(e) => setR(e.target.value)} placeholder={t('adp.reason')} />
      <div className="adm-actions"><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button variant="danger" disabled={!r.trim()} onClick={() => onSubmit(r.trim())}>{t('adp.reject')}</Button></div>
    </Modal>
  );
}

// Pending listing change (Safe / Verified plugins): what changes, plus the new screenshots.
function ListingDiff({ p, lang }) {
  const L = p.listingPending || {};
  const [shots, setShots] = useState(null);
  const en = lang === 'en';
  const rows = [['descZh', en ? 'Description (zh)' : '簡介（中文）'], ['desc', en ? 'Description (en)' : '簡介（英文）'], ['features', en ? 'Features' : '功能'], ['category', en ? 'Category' : '分類']]
    .filter(([k]) => k in L).map(([k, l]) => <small key={k} className="adp-upd"><b>{l}</b> {String(L[k]).slice(0, 200)}</small>);
  return (
    <div className="adp-listing">
      <small className="adp-upd"><b>{en ? 'Listing change waiting for review' : '商店資料修改等候審核'}</b></small>
      {rows}
      {'links' in L && <small className="adp-upd"><b>{en ? 'Links' : '連結'}</b> {(L.links || []).map((x) => x.url).join(' · ') || '—'}</small>}
      {'icon' in L && <small className="adp-upd"><b>{en ? 'Icon' : '圖示'}</b> {L.icon ? <img src={L.icon} alt="" width={28} height={28} style={{ verticalAlign: 'middle', borderRadius: 8 }} /> : '—'}</small>}
      {L.shotsN != null && (shots ? <div className="adp-lshots">{shots.map((s, i) => <img key={i} src={s} alt="" />)}</div>
        : <button type="button" className="nui-link" onClick={() => API.adminVersion(p.id, p.live).then((r) => setShots(r.pendingShots || [])).catch(() => setShots([]))}>{en ? `Show ${L.shotsN} screenshots` : `顯示 ${L.shotsN} 張截圖`}</button>)}
    </div>
  );
}
