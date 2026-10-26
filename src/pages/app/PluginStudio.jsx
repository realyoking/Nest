// Creator Studio: creator profile (handle only), my plugins, and the editor with three ways to build —
// (a) vibe-code with AI (/api/chat mode 'plugin'), (b) code editor + file / zip upload + manifest editor, (c) templates.
// Live preview runs in the same sandbox as installed plugins. Save draft → test install (only you) → submit for review.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { unzipSync, strFromU8 } from 'fflate';
import Icon from '../../components/Icon.jsx';
import { Button, Field, PageHeader, Spinner, useToast, askConfirm } from '../../components/ui.jsx';
import { PluginIcon, VerifiedTick, PermList, nameOf } from '../../components/PluginUI.jsx';
import { SettingsForm } from '../../components/PluginSettings.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { usePlugins, SandboxFrame } from '../../lib/plugins/runtime.jsx';
import * as API from '../../lib/plugins/api.js';
import { validateBundle, CATEGORIES, CAPABILITIES, PERMISSIONS, TAB_ICONS, LIMITS, themeFor, settingsValues } from '../../lib/plugins/manifest.js';
import { FONTS, backgroundCss, fontStack } from '../../lib/plugins/theme.js';
import { fromTemplate, blankBundle, TEMPLATE_DEFAULTS } from '../../lib/plugins/templates.js';
import { readAiReply, nextBundleFromReply, buildAiMessages, contextParts, retryNoteFor, RETRYABLE, aiErrorKey, sameBundle, editNote, bundleDiff, bundleJson, nameFromPrompt, versionForSubmit } from '../../lib/plugins/project.js';
import { gateErrorText } from '../../lib/gate-errors.js';
import Sheet from '../../components/Sheet.jsx';
import DiffView from '../../components/DiffView.jsx';
import { permText, RiskBadge } from '../../components/PluginUI.jsx';
import { PERMS, PERM_CATS, catLabel, permDesc, impliedFor, VERIFIED_ONLY } from '../../lib/plugins/permissions.js';

const errText = (t, e) => gateErrorText(e, t) || (t(`plug.err.${e?.code}`) !== `plug.err.${e?.code}` ? t(`plug.err.${e.code}`) : `${t('common.error')}${e?.code ? ` (${e.code})` : ''}`);

// Resize an image file to a PNG/JPEG data URL under a byte budget.
function imageToDataUrl(file, { max = 128, type = 'image/png', budget = LIMITS.icon, square = false } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width; let h = img.height; let sx = 0; let sy = 0;
      if (square) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; w = h = m; }
      let scale = Math.min(1, max / Math.max(w, h));
      for (let i = 0; i < 6; i++) {
        const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, c.width, c.height);
        const out = c.toDataURL(type, 0.82);
        if (out.length <= budget) { URL.revokeObjectURL(img.src); resolve(out); return; }
        scale *= 0.75; type = 'image/jpeg';
      }
      reject(new Error('too_big'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function CreatorForm({ creator, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [handle, setHandle] = useState(creator?.handle || '');
  const [bio, setBio] = useState(creator?.bio || '');
  const [pfp, setPfp] = useState(creator?.pfp || '');
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const save = async () => {
    setBusy(true);
    try { const r = await API.saveCreator({ handle, bio, pfp }); toast(t('studio.profileSaved')); onSaved(r.creator); }
    catch (e) { toast(e.code === 'handle_taken' ? t('studio.handleTaken') : errText(t, e), 'err'); } finally { setBusy(false); }
  };
  return (
    <div className="card st-profile">
      <h2 className="set-h">{t('studio.profile')}</h2>
      <div className="st-pf-row">
        <button type="button" className="st-pfp" onClick={() => file.current?.click()} aria-label={t('studio.pfpPick')}>
          {pfp ? <img src={pfp} alt="" /> : <span>{(handle || '?').slice(0, 1).toUpperCase()}</span>}
          <i><Icon name="camera" size={14} /></i>
        </button>
        <input ref={file} type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPfp(await imageToDataUrl(f, { max: 160, square: true }).catch(() => '')); e.target.value = ''; }} />
        <div className="st-pf-f">
          <Field label={t('studio.handle')} hint={t('studio.handleHint')}><div className="st-handle"><span>@</span><input className="input" value={handle} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} /></div></Field>
        </div>
      </div>
      <Field label={t('studio.bio')}><input className="input" maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('studio.bioPh')} /></Field>
      <Button onClick={save} loading={busy} disabled={handle.length < 3}>{t('studio.saveProfile')}</Button>
    </div>
  );
}

export default function PluginStudio() {
  const { id, prj } = useParams();
  const [sp] = useSearchParams();
  const loc = useLocation();
  const way = sp.get('way');
  // A new project moves the URL to /app/studio/p/:id without remounting the editor (state.editorKey keeps the key).
  if (prj) return <Editor key={loc.state?.editorKey || `p|${prj}`} prjId={prj} way={loc.state?.way} />;
  if (id) return <ProjectFromPlugin key={id} id={id} />;
  if (way) return <Editor key={`w|${way}`} way={way} />;
  return <StudioHome />;
}

const fmtWhen = (ms, lang) => { try { return new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms)); } catch { return ''; } };

function StudioHome() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [projects, setProjects] = useState(null);
  const [err, setErr] = useState('');
  const [rename, setRename] = useState(null);
  const load = () => API.studioMe().then(setD).catch((e) => setErr(errText(t, e)));
  const loadP = () => API.projectList().then((r) => setProjects(r.projects || [])).catch(() => setProjects([]));
  useEffect(() => { load(); loadP(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const del = async (p) => {
    if (!(await askConfirm(t('prj.deleteQ', { name: p.name }), { ok: t('common.delete') }))) return;
    try { await API.projectDelete(p.id); toast(t('prj.deleted')); loadP(); } catch (e) { toast(errText(t, e), 'err'); }
  };
  return (
    <div className="st-page">
      <PageHeader title={t('studio.title')} sub={t('studio.sub')} />
      {err && <p className="error-text">{err}</p>}
      {!d && !err && <div className="ps-loading"><Spinner /></div>}
      {d && (
        <>
          {d.creator?.banned && <p className="plug-warn">{t('plug.err.banned')}</p>}
          {d.creator ? (
            <Link to={`/app/store/c/${d.creator.handle}`} className="card st-me">
              {d.creator.pfp ? <img src={d.creator.pfp} alt="" /> : <span className="ps-pfp-l">{d.creator.handle.slice(0, 1).toUpperCase()}</span>}
              <span><b>@{d.creator.handle}{d.creator.verified && <VerifiedTick size={14} />}</b><small>{d.creator.bio}</small></span>
              <Icon name="chevronRight" size={16} />
            </Link>
          ) : <CreatorForm onSaved={load} />}
          {d.creator && <details className="st-edit-pf"><summary>{t('studio.profile')}</summary><CreatorForm creator={d.creator} onSaved={load} /></details>}
          <h2 className="tr-sec-h">{t('studio.newPlugin')}</h2>
          <div className="st-ways">
            {[['ai', 'wand'], ['code', 'code'], ['template', 'grid']].map(([w, icon]) => (
              <Link key={w} to={`/app/studio?way=${w}`} className="st-way"><span className="st-way-ic"><Icon name={icon} size={22} /></span><b>{t(`studio.ways.${w}`)}</b><small>{t(`studio.ways.${w}Sub`)}</small></Link>
            ))}
          </div>
          <h2 className="tr-sec-h">{t('prj.mine')}</h2>
          {projects === null && <div className="ps-loading"><Spinner /></div>}
          {projects && !projects.length && <p className="muted">{t('prj.empty')}</p>}
          <div className="ps-rows st-prj-list">
            {(projects || []).map((p) => (
              <div key={p.id} className="ps-row st-row st-prj">
                <Link to={`/app/studio/p/${p.id}`} className="ps-row-main">
                  <PluginIcon src={p.icon} name={p.name} size={44} />
                  <span className="ps-row-t"><b>{p.name || t('prj.untitled')}</b>
                    <small>{t('prj.updated', { t: fmtWhen(p.updatedAt, lang) })} · {t('prj.versions', { n: p.vn })}{p.pid ? ` · ${p.pid}` : ''}</small></span>
                </Link>
                <span className="st-prj-acts">
                  <button type="button" className="icon-btn" aria-label={t('prj.rename')} onClick={() => setRename(p)}><Icon name="edit" size={16} /></button>
                  <button type="button" className="icon-btn" aria-label={t('prj.delete')} onClick={() => del(p)}><Icon name="trash" size={16} /></button>
                </span>
              </div>
            ))}
          </div>
          <h2 className="tr-sec-h">{t('studio.mine')}</h2>
          {!d.plugins.length && <p className="muted">{t('studio.empty')}</p>}
          <div className="ps-rows">
            {d.plugins.map((p) => (
              <Link key={p.id} to={`/app/studio/${p.id}`} className="ps-row st-row">
                <span className="ps-row-main"><PluginIcon src={p.icon} name={nameOf(p, lang)} size={48} />
                  <span className="ps-row-t"><b>{nameOf(p, lang)}</b><small>{p.id} · v{p.version}</small>{p.review === 'rejected' && p.rejectReason && <small className="error-text">{t('studio.rejectReason', { r: p.rejectReason })}</small>}</span></span>
                <span className={`st-pill ${p.review}`}>{t(`studio.status.${p.review === 'none' && p.listed ? 'approved' : p.review || 'none'}`)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
      {rename && <RenameSheet p={rename} onClose={() => setRename(null)} onDone={() => { setRename(null); loadP(); }} />}
    </div>
  );
}

function RenameSheet({ p, onClose, onDone }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(p.name || '');
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); try { await API.projectRename(p.id, name); toast(t('prj.renamed')); onDone(name); } catch (e) { toast(errText(t, e), 'err'); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title={t('prj.rename')} footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button onClick={go} loading={busy} disabled={!name.trim()}>{t('common.save')}</Button></div>}>
      <Field label={t('prj.renamePh')}><input className="input" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) go(); }} /></Field>
    </Sheet>
  );
}

// /app/studio/:id (a saved plugin) → its project; creates one from the saved draft the first time.
function ProjectFromPlugin({ id }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { projects = [] } = await API.projectList();
        const hit = projects.find((p) => p.pid === id);
        if (hit) { if (live) nav(`/app/studio/p/${hit.id}`, { replace: true }); return; }
        const d = await API.studioMe();
        const p = d.plugins.find((x) => x.id === id);
        if (!p) throw Object.assign(new Error('not_found'), { code: 'not_found' });
        const { bundles } = await API.fetchBundles([{ id, dev: true, v: p.draftV }]);
        const b = bundles[id];
        if (!b || b.removed) throw Object.assign(new Error('not_found'), { code: 'not_found' });
        const r = await API.projectCreate({ name: p.nameZh || p.name || id, bundle: { manifest: b.manifest, html: b.html, css: b.css, js: b.js }, kind: 'import', msg: t('prj.fromPlugin') });
        if (live) nav(`/app/studio/p/${r.project.id}`, { replace: true });
      } catch (e) { toast(errText(t, e), 'err'); if (live) nav('/app/studio', { replace: true }); }
    })();
    return () => { live = false; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="ps-loading"><Spinner /><p className="muted small">{t('prj.creating')}</p></div>;
}

const TPL_KINDS = ['theme', 'tab', 'widget', 'reminders'];

// The project editor. The working copy (`bundle`) is versioned on the server: every AI turn, manual "Save version",
// restore or template creates a version; the AI always gets the conversation + the current files.
function Editor({ prjId, way }) {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const plug = usePlugins();
  const [prj, setPrj] = useState(null);
  const [bundle, setBundle] = useState(() => (prjId ? null : way === 'code' ? blankBundle() : null));
  const [saved, setSaved] = useState(null); // bundle of the latest version (to detect unsaved manual edits)
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(!!prjId && !way);
  const [meta, setMeta] = useState({ shots: [], video: '', review: 'none', draftV: 0 });
  const [tab, setTab] = useState(way === 'template' ? 'template' : way === 'code' ? 'code' : 'ai');
  const [busy, setBusy] = useState('');
  const [creator, setCreator] = useState(undefined);
  const prjRef = useRef(null); prjRef.current = prj;
  const pid = bundle?.manifest?.id || prj?.pid || '';

  useEffect(() => {
    if (!prjId || prjRef.current?.id === prjId) return;
    API.projectGet(prjId).then((r) => {
      setPrj(r.project); setBundle(r.bundle); setSaved(r.bundle); setTurns(r.turns || []);
      if (!r.bundle) setTab('ai');
    }).catch((e) => { toast(errText(t, e), 'err'); nav('/app/studio', { replace: true }); }).finally(() => setLoading(false));
  }, [prjId]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMeta = () => API.studioMe().then((d) => {
    setCreator(d.creator || null);
    const p = pid && d.plugins.find((x) => x.id === pid);
    if (p) {
      setMeta((m) => ({ ...m, exists: true, review: p.review, draftV: p.draftV, pendingV: p.pendingV, live: p.live, listed: p.listed, video: p.video || '', rejectReason: p.rejectReason, liveVersion: p.live ? p.version : '', changelog: p.changelog || [], pendingNotes: p.pendingNotes || '' }));
      if (!meta.shotsLoaded) API.pluginDetail(pid).then((x) => setMeta((m) => ({ ...m, shots: x.shots || [], shotsLoaded: true }))).catch(() => {});
    } else setMeta((m) => ({ ...m, exists: false, review: 'none', draftV: 0, live: 0, pendingV: 0, listed: false }));
  }).catch(() => setCreator(null));
  useEffect(() => { loadMeta(); }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps

  const v = useMemo(() => (bundle ? validateBundle(bundle) : null), [bundle]);
  const setM = (patch) => setBundle((b) => ({ ...b, manifest: { ...b.manifest, ...patch } }));
  const dirty = !!bundle && (!saved || !sameBundle(bundle, saved));

  // Create the project on first use (AI prompt, template, manual save) and move the URL to it.
  const ensureProject = async (name, first, kind, msg) => {
    if (prjRef.current) return prjRef.current;
    const r = await API.projectCreate({ name, ...(first ? { bundle: first, kind, msg } : {}) });
    setPrj(r.project); prjRef.current = r.project;
    if (first) setSaved(first);
    nav(`/app/studio/p/${r.project.id}`, { replace: true, state: { editorKey: `w|${way}`, way } });
    return r.project;
  };
  const commit = async (body) => {
    const r = await API.projectCommit({ id: prjRef.current.id, ...body });
    setPrj(r.project); prjRef.current = r.project;
    if (body.bundle) setSaved(body.bundle);
    if (body.turns) setTurns((l) => [...l, ...body.turns.map((x) => (x.role === 'ai' && r.v && !x.err ? { ...x, v: r.v } : x))]);
    return r;
  };
  // Manual edits → a version + an "edit" turn so the AI knows the creator changed the code by hand.
  const saveManual = async (msg = '', b = bundle) => {
    if (!b) return null;
    if (!prjRef.current) { const p = await ensureProject(b.manifest?.nameZh || b.manifest?.name || t('prj.untitled'), b, 'manual', msg || t('prj.kind.manual')); return { project: p, v: p.vn }; }
    if (saved && sameBundle(b, saved)) return { v: 0 };
    const note = editNote(saved || { manifest: {}, html: '', css: '', js: '' }, b, lang) || t('prj.kind.manual');
    const r = await commit({ bundle: b, kind: 'manual', msg: (msg || note).slice(0, 140), turns: [{ role: 'edit', text: msg ? `${note} — ${msg}` : note, at: Date.now() }] });
    return r;
  };
  const saveVersionClick = async (msg) => {
    setBusy('version');
    try { const r = await saveManual(msg); toast(r?.v ? t('prj.savedVersion', { n: r.v }) : t('prj.noChange')); }
    catch (e) { toast(errText(t, e), 'err'); } finally { setBusy(''); }
  };
  const restore = async (n) => {
    try {
      const r = await API.projectVersion(prjRef.current.id, n);
      if (!r.bundle) return;
      const c = await commit({ bundle: r.bundle, kind: 'restore', msg: `v${n}`, turns: [{ role: 'edit', text: lang === 'en' ? `Restored version ${n}` : `還原至第 ${n} 版`, at: Date.now() }] });
      setBundle(r.bundle);
      toast(t('prj.restored', { n: c.v || '' }));
    } catch (e) { toast(errText(t, e), 'err'); }
  };

  // Plugin draft / test / submit (store side; unchanged flow, plus changelog + version bump for updates).
  const save = async (b0) => {
    if (!creator) { toast(t('studio.needProfile'), 'err'); return null; }
    const b = b0 && b0.manifest ? b0 : bundle;
    const vv = validateBundle(b);
    if (!vv.ok) { toast(vv.errors.slice(0, 2).join(' · '), 'err'); return null; }
    setBusy('save');
    try {
      await saveManual('', b).catch(() => {});
      const r = await API.saveDraft(vv.bundle, { shots: meta.shots, video: meta.video });
      toast(t('studio.saved', { v: r.v }));
      setMeta((m) => ({ ...m, draftV: r.v, review: m.review === 'pending' ? 'none' : m.review }));
      return r;
    } catch (e) { toast(e.errors ? e.errors.slice(0, 2).join(' · ') : errText(t, e), 'err'); return null; } finally { setBusy(''); }
  };
  const testInstall = async () => {
    const r = await save(); if (!r) return;
    setBusy('test');
    try { await plug.install(r.id, { granted: validateBundle(bundle).bundle.manifest.permissions, acceptUnverified: true, acceptHighRisk: true, dev: true, v: r.v }); toast(t('studio.testInstalled')); }
    catch (e) { toast(errText(t, e), 'err'); } finally { setBusy(''); }
  };
  const submit = async (changelog) => {
    // Updates of a published plugin need a new version string.
    let b = bundle;
    if (meta.live && meta.liveVersion && b.manifest?.version === meta.liveVersion) {
      const nv = versionForSubmit(b.manifest.version, meta.liveVersion);
      b = { ...b, manifest: { ...b.manifest, version: nv } };
      setBundle(b);
      toast(t('prj.bumped', { v: nv }));
    }
    const r = await save(b); if (!r) return;
    setBusy('submit');
    try { await API.submitPlugin(r.id, changelog); setMeta((m) => ({ ...m, review: 'pending', pendingV: r.v, pendingNotes: changelog })); toast(t('studio.submitted')); loadMeta(); }
    catch (e) { toast(errText(t, e), 'err'); } finally { setBusy(''); }
  };
  const del = async () => {
    if (!pid || !meta.exists || !(await askConfirm(t('studio.deleteQ', { name: bundle?.manifest?.name || pid }), { ok: t('common.delete') }))) return;
    try { await API.removePlugin(pid); if (plug.installed[pid]) await plug.uninstall(pid); toast(t('prj.deleted')); loadMeta(); } catch (e) { toast(errText(t, e), 'err'); }
  };

  if (loading) return <div className="ps-loading"><Spinner /></div>;
  const TABS = [...(way === 'template' && !prj && !bundle ? ['template'] : ['ai']), 'code', 'manifest', 'versions', 'publish'];
  const title = prj?.name || nameOf({ name: bundle?.manifest?.name, nameZh: bundle?.manifest?.nameZh }, lang) || t('prj.untitled');
  return (
    <div className="st-page st-editor">
      <div className="st-top">
        <Link to="/app/studio" className="ps-back">{t('studio.back')}</Link>
        {bundle && <span className={`st-pill ${meta.review}`}>{t(`studio.status.${meta.listed && meta.review !== 'pending' ? 'approved' : meta.review || 'none'}`)}</span>}
      </div>
      <div className="st-title"><PluginIcon src={bundle?.manifest?.icon} name={title} size={44} /><div><b>{title}</b><small>{pid || '—'}{prj ? ` · ${t('prj.versions', { n: prj.vn })}` : ''}{meta.live ? ` · ${t('prj.liveVersion', { v: meta.liveVersion || meta.live })}` : ''}</small></div></div>
      <div className="segment st-tabs" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} disabled={!bundle && !['ai', 'template'].includes(k)}>{k === 'versions' ? t('prj.versionsTab') : k === 'ai' ? t('prj.chat') : t(`studio.tabs.${k}`)}{k === 'code' && dirty ? ' •' : ''}</button>)}
      </div>
      {tab === 'ai' && <AiPane bundle={bundle} setBundle={setBundle} prj={prj} turns={turns} dirty={dirty} ensureProject={ensureProject} commit={commit} saveManual={saveManual} />}
      {tab === 'template' && <TemplatePane onBundle={async (b) => { setBundle(b); try { await ensureProject(b.manifest?.nameZh || b.manifest?.name || t('prj.untitled'), b, 'template', t('prj.kind.template')); } catch (e) { toast(errText(t, e), 'err'); } toast(t('studio.tpl.generated')); setTab('ai'); }} />}
      {tab === 'code' && bundle && <><CodePane bundle={bundle} setBundle={setBundle} dirty={dirty} onSaveVersion={saveVersionClick} busy={busy === 'version'} /><LiveCard bundle={bundle} /></>}
      {tab === 'manifest' && bundle && <><ManifestPane m={bundle.manifest} setM={setM} setBundle={setBundle} />{dirty && <SaveBar onSave={saveVersionClick} busy={busy === 'version'} />}</>}
      {tab === 'versions' && <VersionsPane prj={prj} bundle={bundle} onRestore={restore} />}
      {tab === 'publish' && bundle && (
        <PublishPane v={v} meta={meta} setMeta={setMeta} creator={creator} setCreator={setCreator} busy={busy} save={save} testInstall={testInstall} submit={submit} del={pid && meta.exists ? del : null} />
      )}
    </div>
  );
}

function SaveBar({ onSave, busy }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState('');
  return (
    <div className="card st-savebar">
      <span className="st-unsaved"><Icon name="edit" size={14} />{t('prj.unsaved')}</span>
      <input className="input" maxLength={140} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('prj.manualMsgPh')} />
      <Button size="sm" icon="check" onClick={async () => { await onSave(msg); setMsg(''); }} loading={busy}>{t('prj.saveVersion')}</Button>
    </div>
  );
}

function PublishPane({ v, meta, setMeta, creator, setCreator, busy, save, testInstall, submit, del }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const isUpdate = meta.live > 0;
  return (
    <div className="card st-pub">
      {creator === null && <><p className="plug-warn">{t('studio.needProfile')}</p><CreatorForm onSaved={(c) => setCreator(c)} /></>}
      <h2 className="set-h">{v?.ok ? t('studio.valid') : t('studio.invalid', { n: v?.errors.length || 0 })}</h2>
      {!v?.ok && <ul className="st-errs">{v.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <p className="muted small">{t('studio.size', { kb: Math.round((v?.size || 0) / 102.4) / 10 })} · v{v?.bundle?.manifest?.version || '—'}</p>
      <Field label={t('studio.shots')}>
        <div className="st-shots">
          {meta.shots.map((s, i) => <span key={i} className="st-shot"><img src={s} alt="" /><button type="button" aria-label={t('common.delete')} onClick={() => setMeta((m) => ({ ...m, shots: m.shots.filter((_, k) => k !== i) }))}><Icon name="x" size={14} /></button></span>)}
          {meta.shots.length < LIMITS.shots && (
            <label className="st-shot add"><Icon name="plus" size={20} /><input type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { const d = await imageToDataUrl(f, { max: 900, type: 'image/jpeg', budget: LIMITS.shot }); setMeta((m) => ({ ...m, shots: [...m.shots, d].slice(0, LIMITS.shots) })); } catch { toast(t('studio.uploadFail'), 'err'); } }} /></label>
          )}
        </div>
      </Field>
      <Field label={t('studio.videoUrl')}><input className="input" value={meta.video} onChange={(e) => setMeta((m) => ({ ...m, video: e.target.value }))} placeholder="https://youtu.be/…" inputMode="url" /></Field>
      {isUpdate && (
        <>
          <p className="st-pending"><Icon name="shield" size={16} />{t('prj.updateNote')}</p>
          <Field label={t('prj.changelog')}><textarea className="textarea" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('prj.changelogPh')} /></Field>
        </>
      )}
      <div className="st-pub-acts">
        <Button variant="outline" onClick={() => save()} loading={busy === 'save'} disabled={!v?.ok || !!busy}>{t('studio.save')}</Button>
        <Button variant="outline" icon="download" onClick={testInstall} loading={busy === 'test'} disabled={!v?.ok || !!busy}>{t('studio.testInstall')}</Button>
        <Button icon="upload" onClick={() => submit(notes.trim())} loading={busy === 'submit'} disabled={!v?.ok || !!busy || meta.review === 'pending' || (isUpdate && !notes.trim())}>
          {meta.review === 'pending' ? (isUpdate ? t('prj.updatePending') : t('studio.status.pending')) : isUpdate ? t('prj.submitUpdate') : t('studio.submit')}
        </Button>
      </div>
      {meta.review === 'pending' && <p className="st-pending"><Icon name="gauge" size={16} />{t('studio.submitted')}{meta.pendingNotes ? ` — ${meta.pendingNotes}` : ''}</p>}
      {meta.review === 'rejected' && meta.rejectReason && <p className="error-text small">{t('studio.rejectReason', { r: meta.rejectReason })}</p>}
      {meta.changelog?.length > 0 && (
        <div className="st-changelog"><b>{lang === 'en' ? 'Changelog' : '更新記錄'}</b>
          <ul>{meta.changelog.map((c, i) => <li key={i}><b>v{c.version}</b> <small className="muted">{fmtWhen(c.at, lang)}</small>{c.notes && <span>{c.notes}</span>}</li>)}</ul>
        </div>
      )}
      {del && <button type="button" className="ps-report-link small danger" onClick={del}><Icon name="trash" size={14} />{t('studio.delete')}</button>}
    </div>
  );
}

// Last unreadable model reply, kept on this device only (sessionStorage) so a failure can be captured for a test fixture.
function keepBad(out, why) {
  try { const v = JSON.stringify({ why, at: Date.now(), out: String(out || '').slice(0, 20000) }); sessionStorage.setItem('nest.studio.lastBad', v); window.__nestStudioLastBad = v; } catch {}
}

function AiPane({ bundle, setBundle, prj, turns, dirty, ensureProject, commit, saveManual }) {
  const { t, lang } = useI18n();
  const { ai } = useBe();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [chars, setChars] = useState(0);
  const [pending, setPending] = useState(null); // optimistic user turn while the model works
  const [showPrev, setShowPrev] = useState(true);
  const logRef = useRef(null);
  useEffect(() => { logRef.current?.scrollTo?.({ top: 1e6, behavior: 'smooth' }); }, [turns.length, pending, busy]);
  const send = async (text) => {
    const prompt = String(text || q).trim(); if (!prompt || busy) return;
    setQ(''); setBusy(true); setChars(0); setPhase('');
    const userTurn = { role: 'user', text: prompt, at: Date.now() };
    setPending(userTurn);
    try {
      let p = prj;
      if (!p) p = await ensureProject(nameFromPrompt(prompt) || t('prj.untitled'));
      else if (dirty) await saveManual();
      const cp = contextParts(turns, p.summary || '', p.sumN || 0);
      const run = async (retryNote) => {
        const { messages, tooBig } = buildAiMessages({ bundle, summary: cp.summary, recent: cp.recent, prompt, retryNote });
        if (tooBig && !retryNote) toast(t('prj.tooBig'));
        let out = '';
        try { out = await ai.streamChat({ mode: 'plugin', lang, messages, onDelta: (acc) => setChars(acc.length) }); }
        catch (e) { if (e?.code === 'stalled' || e?.code === 'stream_failed') return { out: e.partial || '', r: null, nb: { ok: false, error: e.code } }; throw e; }
        const rr = readAiReply(out);
        return { out, r: rr.reply, detail: rr.detail, nb: nextBundleFromReply(bundle, rr.reply, rr.problem) };
      };
      let a = await run('');
      // One silent retry with a stricter format instruction chosen by what went wrong.
      if (!a.nb.ok && RETRYABLE.includes(a.nb.error)) {
        keepBad(a.out, a.nb.error);
        setPhase(a.nb.error === 'edit_failed' ? 'retry' : 'retry2'); setChars(0);
        a = await run(retryNoteFor(a.nb, { hasCode: !!bundle }));
      }
      const { r, nb } = a;
      if (!nb.ok) { keepBad(a.out, nb.error); throw Object.assign(new Error('bad'), { code: 'bad_reply', why: nb.error, failed: nb.failed, detail: a.detail }); }
      const vb = validateBundle(nb.bundle);
      const next = { manifest: vb.bundle?.manifest || nb.bundle.manifest, html: nb.bundle.html, css: nb.bundle.css, js: nb.bundle.js };
      const aiTurn = { role: 'ai', text: r.notes || '✓', at: Date.now(), ...(vb.ok ? {} : { errors: vb.errors.slice(0, 3) }) };
      setBundle(next);
      await commit({ bundle: next, kind: 'ai', msg: (r.notes || prompt).slice(0, 140), turns: [userTurn, aiTurn], summary: cp.summary, sumN: cp.summarizedUpTo });
    } catch (e) {
      // AI / reply problems get a specific line; project / plugin API errors keep their own text.
      const ek = aiErrorKey(e); const msg = gateErrorText(e, t) || (e?.name === 'PluginError' || e instanceof API.PluginError ? errText(t, e) : t(ek.key, ek.params));
      try { if (prj || e?.code !== 'too_many_projects') await commit({ turns: [userTurn, { role: 'ai', text: msg, at: Date.now(), err: true }] }); } catch { toast(errText(t, e), 'err'); }
    } finally { setBusy(false); setPending(null); setPhase(''); }
  };
  const m = bundle ? (validateBundle(bundle).bundle?.manifest || bundle.manifest) : null;
  const surfaces = (m?.capabilities || []).filter((c) => ['tab', 'widget', 'automation'].includes(c));
  const shown = [...turns.filter((x) => x.role !== 'system'), ...(pending ? [pending] : [])];
  return (
    <div className="st-ai-grid">
      <div className="card st-ai">
        <p className="fine st-ctx"><Icon name="sparkle" size={13} /> {t('prj.context')}{prj?.summary ? ` · ${t('prj.summary')}` : ''}</p>
        <div className="st-ai-log" ref={logRef}>
          {!shown.length && <div className="st-ai-start">{t('studio.aiStart').map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}</div>}
          {shown.map((x, i) => (
            <div key={i} className={`st-msg ${x.role} ${x.err ? 'err' : ''}`}>
              {x.role === 'ai' && <Icon name="sparkle" size={15} />}
              {x.role === 'edit' && <Icon name="edit" size={14} />}
              <span>{x.text}{x.v ? <small className="muted">{t('prj.applied', { n: x.v })}</small> : null}{x.errors?.length > 0 && <small className="error-text">{x.errors.slice(0, 3).join(' · ')}</small>}</span>
            </div>
          ))}
          {busy && <div className="st-msg ai"><span className="spinner sm" /><span>{phase === 'retry' ? t('prj.editRetry') : phase === 'retry2' ? t('prj.aiRetry') : t('prj.thinking')}{chars ? ` · ${Math.round(chars / 100) / 10}k` : ''}</span></div>}
        </div>
        <div className="st-ai-in">
          <textarea className="textarea" rows={2} value={q} onChange={(e) => setQ(e.target.value)} placeholder={bundle ? t('prj.aiPh') : t('prj.aiFirstPh')} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          <Button icon="wand" onClick={() => send()} loading={busy} disabled={!q.trim()}>{t('studio.aiSend')}</Button>
        </div>
      </div>
      {bundle && m && (
        <div className="card st-live">
          <button type="button" className="st-live-h" onClick={() => setShowPrev((x) => !x)} aria-expanded={showPrev}><Icon name="eye" size={15} /><b>{t('prj.live')}</b><small className="muted">v{m.version}</small><Icon name={showPrev ? 'chevronDown' : 'chevronRight'} size={14} /></button>
          {showPrev && <LivePreview bundle={bundle} m={m} surfaces={surfaces} />}
        </div>
      )}
    </div>
  );
}

function LiveCard({ bundle }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const vb = validateBundle(bundle);
  const m = vb.bundle?.manifest || bundle.manifest;
  if (!m) return null;
  const surfaces = (m.capabilities || []).filter((c) => ['tab', 'widget', 'automation'].includes(c));
  return (
    <div className="card st-live">
      <button type="button" className="st-live-h" onClick={() => setOpen((x) => !x)} aria-expanded={open}><Icon name="eye" size={15} /><b>{t('prj.live')}</b><small className="muted">v{m.version}</small><Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} /></button>
      {open && <LivePreview bundle={bundle} m={m} surfaces={surfaces} />}
      {open && <div style={{ marginTop: 10 }}><PermList perms={m.permissions} caps={m.capabilities} /></div>}
    </div>
  );
}

// Re-renders in the sandbox whenever the working copy changes (AI turn, manual edit, restore).
function LivePreview({ bundle, m, surfaces }) {
  const { t, lang } = useI18n();
  const [surface, setSurface] = useState(surfaces[0] || 'widget');
  const [log, setLog] = useState([]);
  const sig = useMemo(() => bundleJson(bundle).length + ':' + hashStr(bundleJson(bundle)), [bundle]);
  const p = { id: m.id, manifest: m, settings: settingsValues(m, {}), granted: m.permissions || [] };
  const pb = { manifest: m, html: bundle.html, css: bundle.css, js: bundle.js, v: 0 };
  const cur = surfaces.includes(surface) ? surface : surfaces[0];
  return (
    <div className="st-live-b">
      {m.theme && <ThemePreview manifest={m} values={{}} />}
      {surfaces.length > 1 && <div className="segment" role="tablist">{surfaces.map((s) => <button key={s} className={cur === s ? 'on' : ''} onClick={() => setSurface(s)}>{t(`plug.capName.${s}`)}</button>)}</div>}
      {cur && (
        <div className={`st-frame ${cur}`}>
          <SandboxFrame key={`${sig}:${cur}:${lang}`} p={p} previewBundle={pb} preview surface={cur === 'automation' ? 'background' : cur} fill={cur === 'tab'} hidden={cur === 'automation'}
            onEvent={(k, d) => setLog((l) => [`${k}: ${JSON.stringify(d)}`, ...l].slice(0, 4))} />
          {cur === 'automation' && <p className="muted small">{t('plug.capName.automation')}</p>}
        </div>
      )}
      {log.length > 0 && <ul className="st-log">{log.map((x, i) => <li key={i}><code>{x}</code></li>)}</ul>}
    </div>
  );
}
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

function VersionsPane({ prj, bundle, onRestore }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [view, setView] = useState(null); // { a: n|'cur', b: n|'cur', parts }
  const cache = useRef({});
  const list = [...(prj?.vlist || [])].reverse();
  if (!prj || !list.length) return <div className="card"><p className="muted">{t('prj.noVersions')}</p></div>;
  const get = async (n) => (n === 'cur' ? bundle : (cache.current[n] ||= (await API.projectVersion(prj.id, n)).bundle));
  const show = async (a, b) => {
    try { const [x, y] = await Promise.all([a ? get(a) : { manifest: {}, html: '', css: '', js: '' }, get(b)]); setView({ a, b, parts: bundleDiff(x, y) }); }
    catch (e) { toast(errText(t, e), 'err'); }
  };
  return (
    <div className="card st-versions">
      <ul className="st-vlist">
        {list.map((x, i) => {
          const prev = list[i + 1]?.n || 0;
          return (
            <li key={x.n}>
              <div className="st-v-main"><b>v{x.n}</b><span className={`st-kind ${x.kind}`}>{t(`prj.kind.${x.kind}`) || x.kind}</span>{i === 0 && <span className="st-kind cur">{t('prj.current')}</span>}
                <small>{fmtWhen(x.at, lang)}</small>{x.msg && <span className="st-v-msg">{x.msg}</span>}</div>
              <div className="st-v-acts">
                <Button size="sm" variant="outline" onClick={() => show(prev, x.n)}>{t('prj.compare')}</Button>
                {i > 0 && <Button size="sm" variant="outline" onClick={() => show(x.n, 'cur')}>{t('prj.compareCur')}</Button>}
                {i > 0 && <Button size="sm" variant="secondary" icon="refresh" onClick={() => onRestore(x.n)}>{t('prj.restore')}</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      {view && (
        <Sheet open onClose={() => setView(null)} title={`${view.a ? `v${view.a}` : '∅'} → ${view.b === 'cur' ? t('prj.current') : `v${view.b}`}`}>
          <DiffView parts={view.parts} />
        </Sheet>
      )}
    </div>
  );
}

function CodePane({ bundle, setBundle, dirty, onSaveVersion, busy }) {
  const { t } = useI18n();
  const toast = useToast();
  const [f, setF] = useState('html');
  // manifest.json is editable as text too (paste a whole manifest); it is applied whenever it parses.
  const [mText, setMText] = useState('');
  const [mErr, setMErr] = useState(false);
  const showManifest = () => { setMText(JSON.stringify(bundle.manifest || {}, null, 2)); setMErr(false); setF('manifest'); };
  const onFiles = async (files) => {
    const got = {};
    try {
      for (const file of files) {
        if (/\.zip$/i.test(file.name)) {
          const z = unzipSync(new Uint8Array(await file.arrayBuffer()));
          for (const [n, data] of Object.entries(z)) { if (data.length > LIMITS.code) continue; got[n.split('/').pop().toLowerCase()] = strFromU8(data); }
        } else if (file.size <= LIMITS.code) got[file.name.toLowerCase()] = await file.text();
      }
      const pick = (re) => Object.entries(got).find(([n]) => re.test(n))?.[1];
      const next = { ...bundle };
      const m = pick(/^(manifest|nest)\.json$/); if (m) next.manifest = JSON.parse(m);
      const h = pick(/\.html?$/); if (h != null) next.html = h.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '');
      const c = pick(/\.css$/); if (c != null) next.css = c;
      const j = pick(/\.(m?js)$/); if (j != null) next.js = j;
      setBundle(next);
      toast(t('studio.uploaded', { n: Object.keys(got).length }));
    } catch { toast(t('studio.uploadFail'), 'err'); }
  };
  return (
    <div className="card st-code">
      <div className="st-code-top">
        <div className="segment" role="tablist">{['html', 'css', 'js', 'manifest'].map((k) => <button key={k} role="tab" aria-selected={f === k} className={f === k ? 'on' : ''} onClick={() => (k === 'manifest' ? showManifest() : setF(k))}>{k === 'manifest' ? 'manifest.json' : k.toUpperCase()}</button>)}</div>
        <label className="btn btn-outline btn-sm file-btn"><Icon name="upload" size={16} /><span>{t('studio.upload')}</span><input type="file" multiple accept=".html,.htm,.css,.js,.mjs,.json,.zip" className="file-overlay" aria-label={t('studio.upload')} onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} /></label>
      </div>
      {f === 'manifest' ? (
        <>
          <textarea className="st-editor-ta" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={mText} aria-label="manifest.json"
            onChange={(e) => { const v = e.target.value; setMText(v); try { const j = JSON.parse(v); if (j && typeof j === 'object' && !Array.isArray(j)) { setBundle((b) => ({ ...b, manifest: j })); setMErr(false); } else setMErr(true); } catch { setMErr(true); } }} />
          {mErr && <p className="error-text small">{t('studio.manifestJsonErr')}</p>}
        </>
      ) : (
        <textarea className="st-editor-ta" spellCheck={false} autoCapitalize="off" autoCorrect="off" value={bundle[f] || ''} onChange={(e) => setBundle((b) => ({ ...b, [f]: e.target.value }))} aria-label={f} />
      )}
      <p className="fine">{t('studio.uploadHint')}</p>
      {dirty && <SaveBar onSave={onSaveVersion} busy={busy} />}
    </div>
  );
}

function ManifestPane({ m, setM, setBundle }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [schema, setSchema] = useState(JSON.stringify(m.settings || [], null, 2));
  const [theme, setTheme] = useState(m.theme ? JSON.stringify(m.theme, null, 2) : '');
  const toggle = (k, x) => setM({ [k]: (m[k] || []).includes(x) ? m[k].filter((y) => y !== x) : [...(m[k] || []), x] });
  return (
    <div className="card st-man">
      <div className="st-icon-row">
        <PluginIcon src={m.icon} name={m.name} size={64} />
        <label className="btn btn-outline btn-sm"><Icon name="image" size={16} /><span>{t('studio.iconPick')}</span><input type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) try { setM({ icon: await imageToDataUrl(f, { max: 160, square: true }) }); } catch { toast(t('studio.uploadFail'), 'err'); } }} /></label>
      </div>
      <div className="cal-form-2">
        <Field label={t('studio.name')}><input className="input" maxLength={40} value={m.name || ''} onChange={(e) => setM({ name: e.target.value })} /></Field>
        <Field label={t('studio.nameZh')}><input className="input" maxLength={40} value={m.nameZh || ''} onChange={(e) => setM({ nameZh: e.target.value })} /></Field>
      </div>
      <Field label={t('studio.id')}><input className="input" value={m.id || ''} onChange={(e) => setM({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) })} /></Field>
      <Field label={t('studio.desc')}><textarea className="textarea" rows={2} maxLength={400} value={m.description || ''} onChange={(e) => setM({ description: e.target.value })} /></Field>
      <Field label={t('studio.descZh')}><textarea className="textarea" rows={2} maxLength={400} value={m.descriptionZh || ''} onChange={(e) => setM({ descriptionZh: e.target.value })} /></Field>
      <Field label={t('studio.category')}><select className="select" value={m.category} onChange={(e) => setM({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(`plug.cat.${c}`)}</option>)}</select></Field>
      <div className="field"><span className="field-label">{t('studio.caps')}</span><div className="st-chips">{CAPABILITIES.map((c) => <button key={c} type="button" className={(m.capabilities || []).includes(c) ? 'on' : ''} onClick={() => toggle('capabilities', c)}>{t(`plug.capName.${c}`)}</button>)}</div></div>
      <PermPicker m={m} setM={setM} />
      <Field label={lang === 'en' ? 'Features (one per line, shown on the store page)' : '功能（每行一項，會在商店頁顯示）'}><textarea className="textarea" rows={3} maxLength={1000} value={m.features || ''} onChange={(e) => setM({ features: e.target.value })} /></Field>
      {(m.capabilities || []).includes('tab') && (
        <div className="cal-form-2">
          <Field label={t('studio.tabTitle')}><input className="input" maxLength={20} value={m.tab?.title || ''} onChange={(e) => setM({ tab: { ...(m.tab || {}), title: e.target.value } })} /></Field>
          <Field label="Icon"><select className="select" value={m.tab?.icon || 'sparkle'} onChange={(e) => setM({ tab: { ...(m.tab || {}), icon: e.target.value } })}>{TAB_ICONS.map((i) => <option key={i}>{i}</option>)}</select></Field>
        </div>
      )}
      {(m.capabilities || []).includes('widget') && <Field label={t('studio.widgetTitle')}><input className="input" maxLength={30} value={m.widget?.title || ''} onChange={(e) => setM({ widget: { ...(m.widget || {}), title: e.target.value } })} /></Field>}
      <Field label={t('studio.settingsSchema')}><textarea className="textarea st-mono" rows={5} value={schema} onChange={(e) => { setSchema(e.target.value); try { const v = JSON.parse(e.target.value); if (Array.isArray(v)) setM({ settings: v }); } catch {} }} /></Field>
      {(m.capabilities || []).some((c) => ['theme', 'font', 'background'].includes(c)) && (
        <Field label="Theme (JSON)"><textarea className="textarea st-mono" rows={6} value={theme} onChange={(e) => { setTheme(e.target.value); try { setM({ theme: JSON.parse(e.target.value || 'null') || undefined }); } catch {} }} /></Field>
      )}
      {setBundle && null}
    </div>
  );
}

// Permission checkboxes grouped by category, with risk, what each allows, and the creator's reason (shown at install).
// Implied permissions come with the chosen capabilities (listed, not toggled). 「即將推出」 ones cannot be selected yet.
function PermPicker({ m, setM }) {
  const { t, lang } = useI18n();
  const en = lang === 'en';
  const sel = m.permissions || [];
  const implied = impliedFor(m.capabilities || []);
  const reasons = m.permissionReasons || {};
  const toggle = (p) => setM({ permissions: sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p] });
  return (
    <div className="field">
      <span className="field-label">{t('studio.perms')}</span>
      <p className="fine" style={{ margin: '0 0 4px' }}>{en ? 'Ask only for what the plugin needs. Private chats, secrets and sign-in tokens are never available to plugins.' : '只申請插件真正需要的權限。私人對話、密碼及登入憑證永遠不會開放給插件。'}</p>
      {PERM_CATS.map((c) => {
        const ids = Object.keys(PERMS).filter((p) => PERMS[p].cat === c);
        if (!ids.length) return null;
        return (
          <div key={c} className="st-perm-group">
            <b>{catLabel(c, lang)}</b>
            {ids.map((p) => {
              const P = PERMS[p];
              const isImplied = P.implied;
              const on = isImplied ? implied.includes(p) : sel.includes(p);
              return (
                <label key={p} className="st-perm">
                  <input type="checkbox" checked={on} disabled={isImplied} onChange={() => toggle(p)} />
                  <span className="st-perm-t">{permText(lang, p)}{VERIFIED_ONLY.includes(p) && <em className="muted"> · {en ? 'needs Nest review (Safe / verified)' : '須經 Nest 審查（安全／已認證）'}</em>}{isImplied && <em className="muted"> · {en ? 'comes with the capability' : '隨功能自動包括'}</em>}<small>{permDesc(p, lang)}</small></span>
                  <RiskBadge risk={P.risk} small />
                  {on && !isImplied && (
                    <span className="st-why"><input className="input" maxLength={140} placeholder={en ? 'Why it is needed (shown to users)' : '用途（會顯示給用戶）'} value={reasons[p] || ''} onChange={(e) => setM({ permissionReasons: { ...reasons, [p]: e.target.value } })} /></span>
                  )}
                  {on && p === 'network' && (
                    <span className="st-why"><input className="input" placeholder={en ? 'Websites, e.g. api.example.com' : '網站，例如 api.example.com'} value={(m.network?.domains || []).join(', ')} onChange={(e) => setM({ network: { domains: e.target.value.split(/[,\s]+/).filter(Boolean) } })} /></span>
                  )}
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function TemplatePane({ onBundle }) {
  const { t } = useI18n();
  const [kind, setKind] = useState('theme');
  const [f, setF] = useState(() => JSON.parse(JSON.stringify(TEMPLATE_DEFAULTS)));
  const v = f[kind];
  const set = (patch) => setF((x) => ({ ...x, [kind]: { ...x[kind], ...patch } }));
  return (
    <div className="card st-tpl">
      <div className="st-chips">{TPL_KINDS.map((k) => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{t(`studio.tpl.${k}`)}</button>)}</div>
      <div className="cal-form-2">
        <Field label={t('studio.name')}><input className="input" maxLength={40} value={v.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label={t('studio.nameZh')}><input className="input" maxLength={40} value={v.nameZh} onChange={(e) => set({ nameZh: e.target.value })} /></Field>
      </div>
      {kind === 'theme' && (
        <>
          <div className="st-colors">
            {[['bg', 'bg'], ['bg2', 'bg2'], ['surface', 'surface'], ['ink', 'ink']].map(([k, l]) => <label key={k} className="st-color"><input type="color" value={v[k]} onChange={(e) => set({ [k]: e.target.value })} /><span>{t(`studio.tpl.${l}`)}</span></label>)}
          </div>
          <Field label={t('studio.tpl.font')}><select className="select" value={v.font} onChange={(e) => set({ font: e.target.value })}>{Object.keys(FONTS).map((x) => <option key={x}>{x}</option>)}</select></Field>
          <label className="plug-ack"><input type="checkbox" checked={!!v.dark} onChange={(e) => set({ dark: e.target.checked })} /><span>{t('studio.tpl.dark')}</span></label>
        </>
      )}
      {kind === 'tab' && (
        <>
          <Field label="Icon"><select className="select" value={v.icon} onChange={(e) => set({ icon: e.target.value })}>{TAB_ICONS.map((i) => <option key={i}>{i}</option>)}</select></Field>
          <Field label={t('studio.tpl.tabContent')}><textarea className="textarea" rows={5} value={v.content} onChange={(e) => set({ content: e.target.value })} placeholder={t('studio.tpl.tabContentPh')} /></Field>
          <label className="plug-ack"><input type="checkbox" checked={!!v.checklist} onChange={(e) => set({ checklist: e.target.checked })} /><span>{t('studio.tpl.checklist')}</span></label>
        </>
      )}
      {kind === 'widget' && (
        <>
          <Field label={t('studio.tpl.wType')}><select className="select" value={v.type} onChange={(e) => set({ type: e.target.value })}><option value="countdown">{t('studio.tpl.wCountdown')}</option><option value="note">{t('studio.tpl.wNote')}</option><option value="clock">{t('studio.tpl.wClock')}</option></select></Field>
          {v.type === 'countdown' && <Field label={t('studio.tpl.wDate')}><input className="input" type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} /></Field>}
          <Field label={t('studio.tpl.wText')}><input className="input" maxLength={200} value={v.text} onChange={(e) => set({ text: e.target.value })} /></Field>
        </>
      )}
      {kind === 'reminders' && (
        <>
          {v.items.map((it, i) => (
            <div key={i} className="st-rem">
              <input className="input" maxLength={100} value={it.title} placeholder={t('studio.tpl.rTitle')} onChange={(e) => set({ items: v.items.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
              <input className="input" type="time" value={it.time} onChange={(e) => set({ items: v.items.map((x, k) => (k === i ? { ...x, time: e.target.value } : x)) })} />
              <select className="select" value={it.days} onChange={(e) => set({ items: v.items.map((x, k) => (k === i ? { ...x, days: e.target.value } : x)) })}>{['daily', 'weekdays', 'weekends'].map((d) => <option key={d} value={d}>{t(`studio.tpl.${d}`)}</option>)}</select>
              <button type="button" className="icon-btn" aria-label={t('common.delete')} onClick={() => set({ items: v.items.filter((_, k) => k !== i) })}><Icon name="x" size={16} /></button>
            </div>
          ))}
          {v.items.length < 8 && <Button size="sm" variant="outline" icon="plus" onClick={() => set({ items: [...v.items, { title: '', time: '19:00', days: 'daily' }] })}>{t('studio.tpl.rAdd')}</Button>}
        </>
      )}
      <Button icon="sparkle" onClick={() => onBundle(fromTemplate(kind, v))}>{t('studio.tpl.generate')}</Button>
    </div>
  );
}

// Theme preview box: sanitized vars on a local container only (never on the main document).
function ThemePreview({ manifest, values }) {
  const { t } = useI18n();
  const th = themeFor(manifest, values);
  if (!th) return null;
  const style = { ...(th.vars || {}) };
  if (th.font) style['--font'] = fontStack(th.font);
  const bg = backgroundCss(th.background);
  return (
    <div className="st-themebox" style={{ ...style, background: bg || 'var(--bg)', fontFamily: th.font ? fontStack(th.font) : undefined }}>
      <div className="st-tb-card"><b>{t('app.greetingMorning')}</b><small>{t('home.summary')}</small><span className="st-tb-btn">{t('plug.install')}</span></div>
      <div className="st-tb-card"><small>{t('studio.previewTheme')}</small><b>Aa 字體 123</b></div>
    </div>
  );
}
