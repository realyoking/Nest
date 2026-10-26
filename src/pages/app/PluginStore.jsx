// Plugin Store (App Store style): Featured / New / Top, categories, search, icon grid → detail page → creator profile.
import { ProfileHeader } from '../../components/Identity.jsx';
import { gateErrorText } from '../../lib/gate-errors.js';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { Button, PageHeader, Spinner, useToast, askConfirm } from '../../components/ui.jsx';
import { PluginIcon, SafeBadge, VerifiedTick, Stars, StarPicker, PermList, InstallSheet, nameOf, descOf } from '../../components/PluginUI.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { usePlugins } from '../../lib/plugins/runtime.jsx';
import * as API from '../../lib/plugins/api.js';
import { CATEGORIES } from '../../lib/plugins/manifest.js';
import Gallery from '../../components/Gallery.jsx';
import ListingEditor from '../../components/ListingEditor.jsx';

const fmtN = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : String(n || 0));

function Tile({ p }) {
  const { lang } = useI18n();
  return (
    <Link to={`/app/store/p/${p.id}`} className="ps-tile">
      <span className="ps-tile-ic"><PluginIcon src={p.icon} name={nameOf(p, lang)} size={68} />{p.safe && <span className="ps-safe-dot" aria-hidden="true"><Icon name="shield" size={11} stroke={2.6} /></span>}</span>
      <b>{nameOf(p, lang)}</b>
      <small>{p.rating ? <><Icon name="star" size={11} stroke={2.4} />{p.rating.toFixed(1)}</> : null}{p.creator?.handle && <span className="ps-by">@{p.creator.handle}{p.creator.verified && <VerifiedTick size={11} />}</span>}</small>
    </Link>
  );
}
function Row({ p, onGet }) {
  const { t, lang } = useI18n();
  const plug = usePlugins();
  const inst = !!plug.installed[p.id];
  return (
    <div className="ps-row">
      <Link to={`/app/store/p/${p.id}`} className="ps-row-main">
        <PluginIcon src={p.icon} name={nameOf(p, lang)} size={56} />
        <span className="ps-row-t"><b>{nameOf(p, lang)}{p.safe && <SafeBadge small />}</b><small>{descOf(p, lang)}</small></span>
      </Link>
      <Button size="sm" variant={inst ? 'secondary' : 'primary'} onClick={() => onGet(p)}>{inst ? t('plug.open') : t('plug.install')}</Button>
    </div>
  );
}

export function useOpenPlugin() {
  const nav = useNavigate();
  const plug = usePlugins();
  return (p) => {
    const b = plug.bundles[p.id];
    const caps = b?.manifest?.capabilities || p.caps || [];
    if (caps.includes('tab')) nav(`/app/p/${p.id}`);
    else if (caps.includes('widget')) nav('/app');
    else nav('/app/settings#plugins');
  };
}

export default function PluginStore() {
  const { t, lang } = useI18n();
  const plug = usePlugins();
  const open = useOpenPlugin();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [get, setGet] = useState(null);
  useEffect(() => { API.storeList().then(setData).catch(() => setErr(t('plug.loadFail'))); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const list = data?.plugins || [];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => list.filter((p) => (cat === 'all' || p.category === cat) && (!ql || `${p.name} ${p.nameZh} ${p.desc} ${p.descZh} ${p.creator?.handle || ''}`.toLowerCase().includes(ql))), [list, cat, ql]);
  const featured = list.filter((p) => p.featured);
  const newest = [...list].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 8);
  const top = [...list].sort((a, b) => (b.installs + b.rating * 50) - (a.installs + a.rating * 50)).slice(0, 8);
  const onGet = (p) => (plug.installed[p.id] ? open(p) : setGet(p));
  const browsing = !!ql || cat !== 'all';
  return (
    <div className="ps-page">
      <PageHeader title={t('plug.store')} sub={t('plug.storeSub')} actions={<Button size="sm" variant="outline" icon="code" to="/app/studio">{t('plug.studioLink')}</Button>} />
      <div className="ps-search"><Icon name="search" size={18} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('plug.search')} aria-label={t('plug.search')} /></div>
      <div className="ps-cats" role="tablist">
        {['all', ...CATEGORIES].map((c) => <button key={c} role="tab" aria-selected={cat === c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c === 'all' ? t('plug.all') : t(`plug.cat.${c}`)}</button>)}
      </div>
      {err && <p className="error-text">{err}</p>}
      {!data && !err && <div className="ps-loading"><Spinner /></div>}
      {data && !browsing && (
        <>
          {featured.length > 0 && (
            <section className="ps-sec">
              <h2>{t('plug.featured')}</h2>
              <div className="ps-feat">
                {featured.slice(0, 6).map((p) => (
                  <Link key={p.id} to={`/app/store/p/${p.id}`} className="ps-feat-card">
                    <PluginIcon src={p.icon} name={nameOf(p, lang)} size={52} />
                    <span><small>{t(`plug.cat.${p.category}`)}</small><b>{nameOf(p, lang)}</b><em>{descOf(p, lang)}</em></span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="ps-sec"><h2>{t('plug.new')}</h2><div className="ps-grid">{newest.map((p) => <Tile key={p.id} p={p} />)}</div></section>
          <section className="ps-sec"><h2>{t('plug.top')}</h2><div className="ps-rows">{top.map((p) => <Row key={p.id} p={p} onGet={onGet} />)}</div></section>
        </>
      )}
      {data && browsing && (
        <section className="ps-sec">
          {shown.length ? <div className="ps-grid">{shown.map((p) => <Tile key={p.id} p={p} />)}</div> : <p className="muted">{t('plug.empty')}</p>}
        </section>
      )}
      <InstallSheet open={!!get} plugin={get} onClose={() => setGet(null)} />
    </div>
  );
}

export function PluginDetail() {
  const { id } = useParams();
  const { t, lang, fmtDate } = useI18n();
  const plug = usePlugins();
  const toast = useToast();
  const open = useOpenPlugin();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [get, setGet] = useState(false);
  const [rev, setRev] = useState(null);
  const [report, setReport] = useState(null);
  const [edit, setEdit] = useState(false);
  const load = () => API.pluginDetail(id).then(setD).catch((e) => setErr(t(`plug.err.${e.code}`) !== `plug.err.${e.code}` ? t(`plug.err.${e.code}`) : t('plug.loadFail')));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="ps-page"><Link to="/app/store" className="ps-back">{t('plug.back')}</Link><p className="error-text">{err}</p></div>;
  if (!d) return <div className="ps-loading"><Spinner /></div>;
  const p = d.plugin;
  const inst = !!plug.installed[p.id];
  const name = nameOf(p, lang);
  const isVideo = p.video && /\.(mp4|webm)(\?|$)/i.test(p.video);
  return (
    <div className="ps-page ps-detail">
      <button type="button" className="ps-back" onClick={() => nav(-1)}>{t('plug.back')}</button>
      <header className="ps-d-head">
        <PluginIcon src={p.icon} name={name} size={104} />
        <div className="ps-d-t">
          <h1>{name}</h1>
          {d.creator && <Link to={`/app/store/c/${d.creator.handle}`} className="ps-d-by">@{d.creator.handle}{d.creator.verified && <VerifiedTick size={14} />}</Link>}
          <div className="ps-d-badges">{p.safe && <SafeBadge />}{p.verified && <span className="plug-badge ver"><VerifiedTick size={12} />{t('plug.verified')}</span>}</div>
          <div className="ps-d-act">
            <Button onClick={() => (inst ? open(p) : setGet(true))} variant={inst ? 'secondary' : 'primary'}>{inst ? t('plug.open') : t('plug.install')}</Button>
            {inst && <Button variant="ghost" size="sm" onClick={async () => {
              if (!(await askConfirm(t('plug.uninstallQ', { name })))) return;
              try { await plug.uninstall(p.id); toast(t('plug.uninstalled')); load(); } catch (e) { toast(gateErrorText(e, t) || t('common.error'), 'err'); }
            }}>{t('plug.uninstall')}</Button>}
            {p.mine && <Button variant="outline" size="sm" icon="edit" onClick={() => setEdit(true)} data-testid="listing-edit">{t('listing.edit')}</Button>}
          </div>
          {p.mine && p.listingReview === 'pending' && <p className="muted small" style={{ margin: '6px 0 0' }}>{t('listing.pending')}</p>}
        </div>
      </header>
      <div className="ps-d-stats">
        <span><b>{p.rating ? p.rating.toFixed(1) : '—'}</b><Stars value={p.rating} /><small>{p.ratingCount ? t('plug.ratings', { n: p.ratingCount }) : t('plug.noRatings')}</small></span>
        <span><b>{fmtN(p.installs)}</b><small>{t('plug.installs', { n: '' }).trim()}</small></span>
        <span><b>{t(`plug.cat.${p.category}`)}</b><small>{t('plug.category')}</small></span>
        <span><b>v{p.version}</b><small>{t('plug.version')}</small></span>
      </div>
      {(d.shots.length > 0 || p.video) && (
        <section className="ps-sec">
          <h2>{t('plug.screenshots')}</h2>
          <Gallery shots={d.shots} alts={d.shotAlts || []} video={isVideo ? <video className="ps-shot" src={p.video} controls playsInline preload="metadata" /> : null} />
          {p.video && !isVideo && <a className="ps-video" href={p.video} target="_blank" rel="noopener noreferrer"><Icon name="play" size={16} />{t('plug.watch')}</a>}
        </section>
      )}
      <section className="ps-sec"><h2>{t('plug.about')}</h2><p className="ps-desc">{descOf(p, lang)}</p></section>
      {p.features && <section className="ps-sec"><h2>{lang === 'en' ? 'Features' : '功能'}</h2><ul className="ps-features">{String(p.features).split('\n').filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul></section>}
      {p.links?.length > 0 && <section className="ps-sec"><h2>{t('listing.links')}</h2><ul className="ps-links">{p.links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer nofollow"><Icon name="link" size={14} />{l.label || l.url}</a></li>)}</ul></section>}
      {p.changelog?.length > 0 && (
        <section className="ps-sec"><h2>{lang === 'en' ? 'What’s new' : '更新內容'}</h2>
          <ul className="ps-changelog">{p.changelog.map((c, i) => <li key={i}><b>v{c.version}</b><small>{fmtDate(new Date(c.at))}</small>{c.notes && <p>{c.notes}</p>}</li>)}</ul>
        </section>
      )}
      <section className="ps-sec"><h2>{t('plug.permissions')}</h2><PermList perms={p.perms} caps={p.caps} reasons={p.reasons} domains={p.domains} /></section>
      <section className="ps-sec">
        <div className="ps-sec-h"><h2>{t('plug.reviews')}</h2>{d.canReview && <Button size="sm" variant="outline" icon="edit" onClick={() => setRev({ stars: d.myReview?.stars || 0, text: d.myReview?.text || '' })}>{d.myReview ? t('plug.editReview') : t('plug.writeReview')}</Button>}</div>
        {!d.canReview && !inst && <p className="muted small">{t('plug.installToReview')}</p>}
        <div className="ps-reviews">
          {d.reviews.map((r) => (
            <div key={r.key} className="ps-review">
              <div className="ps-review-h"><Stars value={r.stars} size={12} /><b>{r.by}{r.verified && <VerifiedTick size={12} />}</b><small>{fmtDate(new Date(r.at))}</small>
                {!r.mine && <button className="ps-rep" aria-label={t('plug.report')} onClick={() => setReport({ reviewKey: r.key })}><Icon name="flag" size={13} /></button>}</div>
              {r.text && <p>{r.text}</p>}
            </div>
          ))}
        </div>
      </section>
      <button type="button" className="ps-report-link small" onClick={() => setReport({})}><Icon name="flag" size={14} />{t('plug.report')}</button>
      {edit && <ListingEditor open={edit} detail={d} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
      <InstallSheet open={get} plugin={{ ...p, creator: d.creator }} onClose={() => setGet(false)} onDone={load} />
      {rev && <ReviewSheet id={p.id} init={rev} has={!!d.myReview} onClose={() => setRev(null)} onDone={() => { setRev(null); load(); toast(t('plug.reviewSaved')); }} />}
      {report && <ReportSheet id={p.id} reviewKey={report.reviewKey} onClose={() => setReport(null)} />}
    </div>
  );
}

function ReviewSheet({ id, init, has, onClose, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [stars, setStars] = useState(init.stars);
  const [text, setText] = useState(init.text);
  const [busy, setBusy] = useState(false);
  const save = async (remove) => {
    setBusy(true);
    try { if (remove) await API.deleteReview(id); else await API.saveReview(id, stars, text); onDone(); }
    catch (e) { toast(gateErrorText(e, t) || (t(`plug.err.${e.code}`) !== `plug.err.${e.code}` ? t(`plug.err.${e.code}`) : t('common.error')), 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={has ? t('plug.editReview') : t('plug.writeReview')}
      footer={<div className="plug-sheet-foot">{has && <Button variant="danger" onClick={() => save(true)} disabled={busy}>{t('plug.deleteReview')}</Button>}<Button onClick={() => save(false)} loading={busy} disabled={!stars}>{t('plug.submitReview')}</Button></div>}>
      <div className="ps-revform"><StarPicker value={stars} onChange={setStars} /><textarea className="textarea" maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('plug.reviewPh')} /></div>
    </Sheet>
  );
}
function ReportSheet({ id, reviewKey, onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try { await API.reportPlugin(id, reason, reviewKey); toast(t('plug.reportSent')); onClose(); }
    catch (e) { toast(gateErrorText(e, t) || (t(`plug.err.${e.code}`) !== `plug.err.${e.code}` ? t(`plug.err.${e.code}`) : t('common.error')), 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={reviewKey ? t('plug.reportReviewQ') : t('plug.reportQ')} footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={onClose}>{t('plug.prompt.cancel')}</Button><Button onClick={send} loading={busy} disabled={!reason.trim()}>{t('plug.report')}</Button></div>}>
      <textarea className="textarea" maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('plug.reportPh')} />
    </Sheet>
  );
}

// Unified public profile (/app/u/:handle and /app/store/c/:handle): banner, photo, name, @handle, bio, links,
// verified badge and listed plugins — nothing else (never family / school / email).
export function CreatorPage() {
  const { handle } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); setErr(''); API.profileView({ handle }).then(setD).catch(() => setErr(t('id.notFound'))); }, [handle]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="ps-page"><button className="ps-back" onClick={() => nav(-1)}>{t('plug.back')}</button><p className="error-text">{err}</p></div>;
  if (!d) return <div className="ps-loading"><Spinner /></div>;
  const c = d.profile || d.creator;
  return (
    <div className="ps-page id-page">
      <button type="button" className="ps-back" onClick={() => nav(-1)}>{t('plug.back')}</button>
      <ProfileHeader p={c} actions={d.mine ? <Button size="sm" variant="secondary" icon="edit" to="/app/profile">{t('id.edit')}</Button> : null} />
      <div className="ps-sec-h"><h2>{t('id.plugins')}</h2><small className="muted">{t('plug.creatorPlugins', { n: d.plugins.length })}</small></div>
      {d.plugins.length ? <div className="ps-grid">{d.plugins.map((p) => <Tile key={p.id} p={p} />)}</div> : <p className="muted">{t('id.noPlugins')}</p>}
    </div>
  );
}
