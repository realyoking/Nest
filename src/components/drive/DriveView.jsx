// Run 24 step 2b: 全家檔案 — the family drive browser: nested folders with breadcrumb, in-app documents, uploads of any
// type with per-file progress, grid / list, search, sort. Ops go through /api/app/drive (src/lib/drive-client.js);
// the server checks the caller's family membership and the limits on every op, the UI only mirrors them.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Empty, askConfirm, useToast } from '../ui.jsx';
import Icon from '../Icon.jsx';
import Sheet from '../Sheet.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { driveCall, uploadFile, forget } from '../../lib/drive-client.js';
import { LIMITS, SORTS, sortItems, searchItems, childrenOf, pathOf, descendants, canEditItem, canAdd } from '../../lib/drive.js';
import { fmtSize } from '../../lib/attach-core.js';
import FileIcon from './FileIcon.jsx';
import Viewer from './Viewer.jsx';

const VKEY = 'nest.drive.view'; const SKEY = 'nest.drive.sort';
const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const mb = (n) => `${Math.round(n / 1048576)} MB`;

export default function DriveView() {
  const { t, uiLang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const cwd = sp.get('f') || '';
  const [items, setItems] = useState(null);
  const [used, setUsed] = useState(0);
  const [loadErr, setLoadErr] = useState('');
  const [q, setQ] = useState('');
  const [view, setView] = useState(() => (readLS(VKEY, 'grid') === 'list' ? 'list' : 'grid'));
  const [sort, setSort] = useState(() => { const v = readLS(SKEY, {}); return { by: SORTS.includes(v.by) ? v.by : 'name', dir: v.dir === 'desc' ? 'desc' : 'asc' }; });
  const [ups, setUps] = useState([]);
  const [menu, setMenu] = useState(null);
  const [ask, setAsk] = useState(null); // { mode: 'mkdir' | 'rename', item?, value }
  const [mover, setMover] = useState(null);
  const [open, setOpen] = useState(null);
  const [drag, setDrag] = useState(false);
  const fileIn = useRef(null);
  const ctx = { uid: s.user?.uid, member: s.me, isOwner: !!s.isOwner };
  const errText = (e) => { const c = e?.code || e?.message || ''; const k = `r24.drive.err.${c}`; const v = t(k, { max: c === 'family_full' ? mb(LIMITS.familyMax) : mb(LIMITS.fileMax) }); return v === k ? (c === 'network' || /^http_5/.test(c) ? t('r24.drive.err.network') : t('r24.drive.err.generic')) : v; };

  const load = useCallback(async () => {
    try { const r = await driveCall('list'); setItems(r.items); setUsed(r.used); setLoadErr(''); } catch (e) { setLoadErr(errText(e)); setItems((x) => x || []); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  useEffect(() => { writeLS(VKEY, view); }, [view]);
  useEffect(() => { writeLS(SKEY, sort); }, [sort]);
  const all = items || [];
  const byId = useMemo(() => new Map(all.map((x) => [x.id, x])), [all]);
  useEffect(() => { if (items && cwd && byId.get(cwd)?.kind !== 'folder') setSp({}, { replace: true }); }, [items, cwd]); // eslint-disable-line react-hooks/exhaustive-deps
  const crumbs = cwd ? pathOf(all, cwd) : [];
  const shown = useMemo(() => sortItems(q.trim() ? searchItems(all, q) : childrenOf(all, cwd), sort.by, sort.dir, uiLang), [all, q, cwd, sort, uiLang]);
  const go = (id) => { setQ(''); setSp(id ? { f: id } : {}); };
  const count = (id) => childrenOf(all, id).length;
  const memberName = (uid) => s.memberName?.(uid) || '';
  const mayAdd = canAdd(ctx);
  const upsert = (it) => setItems((xs) => { const l = (xs || []).filter((x) => x.id !== it.id); return [...l, it]; });

  // ---------- uploads ----------
  const pending = ups.filter((u) => u.status === 'up').reduce((n, u) => n + u.size, 0);
  const startUploads = async (files) => {
    const list = [...files]; if (!list.length) return;
    const rows = list.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, size: f.size, p: 0, status: 'wait', err: '' }));
    setUps((u) => [...u.filter((x) => x.status === 'up' || x.status === 'wait'), ...rows]);
    let base = used + pending;
    for (let i = 0; i < list.length; i++) {
      const f = list[i]; const key = rows[i].key;
      const set = (patch) => setUps((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      set({ status: 'up' });
      try {
        const it = await uploadFile(f, { parent: cwd, used: base, onProgress: (p) => set({ p }) });
        base += f.size; if (it) upsert(it); setUsed((n) => n + f.size); set({ status: 'done', p: 1 });
      } catch (e) { set({ status: 'err', err: errText(e) }); }
    }
    load();
  };
  const onPick = (e) => { const fs = e.target.files; startUploads(fs); e.target.value = ''; };

  // ---------- ops ----------
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(errText(e), 'err'); return null; } };
  const submitAsk = async (e) => {
    e?.preventDefault(); const v = ask.value.trim(); if (!v) return;
    if (ask.mode === 'mkdir') { const r = await run(() => driveCall('mkdir', { name: v, parent: cwd })); if (r) upsert(r.item); }
    else { const r = await run(() => driveCall('rename', { id: ask.item.id, name: v }), t('r24.drive.renamed')); if (r) upsert(r.item); }
    setAsk(null);
  };
  const newDoc = async () => { const r = await run(() => driveCall('doc-new', { name: t('r24.drive.untitledDoc'), parent: cwd, html: '<p><br></p>' })); if (r) { upsert(r.item); setOpen({ ...r.item, fresh: true }); } };
  const del = async (it) => {
    setMenu(null);
    const n = it.kind === 'folder' ? descendants(all, it.id).size : 0;
    if (!(await askConfirm(n ? t('r24.drive.delFolderAsk', { name: it.name, n }) : t('r24.drive.delAsk', { name: it.name }), { danger: true, ok: t('r24.drive.del') }))) return;
    const r = await run(() => driveCall('delete', { id: it.id }), t('r24.drive.deleted', { name: it.name }));
    if (r) { const gone = new Set(r.deleted); gone.forEach(forget); const freed = all.filter((x) => gone.has(x.id) && x.kind !== 'folder').reduce((n, x) => n + (Number(x.size) || 0), 0); setUsed((n) => Math.max(0, n - freed)); setItems((xs) => (xs || []).filter((x) => !gone.has(x.id))); if (gone.has(cwd)) go(''); await load(); }
  };
  const moveTo = async (parent) => {
    const it = mover; setMover(null);
    const r = await run(() => driveCall('move', { id: it.id, parent }), t('r24.drive.moved', { name: parent ? byId.get(parent)?.name : t('r24.drive.root') }));
    if (r) upsert(r.item);
  };
  const openItem = (it) => (it.kind === 'folder' ? go(it.id) : setOpen(it));
  const meta = (x) => (x.kind === 'folder' ? t('r24.drive.items', { n: count(x.id) }) : [x.kind === 'doc' ? '' : fmtSize(x.size || 0), fmtDate(new Date(x.updatedAt || x.createdAt), { month: 'short', day: 'numeric' })].filter(Boolean).join(' · '));
  const pct = Math.min(100, (used / LIMITS.familyMax) * 100);

  return (
    <div className={`dv ${drag ? 'drag' : ''}`} data-testid="drive"
      onDragOver={(e) => { if (mayAdd && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { if (!mayAdd) return; e.preventDefault(); setDrag(false); startUploads(e.dataTransfer.files); }}>
      <div className="dv-top">
        <nav className="dv-crumbs" aria-label={t('r24.drive.root')} data-testid="drive-crumbs">
          {q.trim() ? <span className="dv-crumb on">{t('r24.drive.results')}</span> : <>
            <button type="button" className={`dv-crumb ${!cwd ? 'on' : ''}`} onClick={() => go('')} aria-current={!cwd ? 'page' : undefined}>{t('r24.drive.root')}</button>
            {crumbs.map((c, i) => <span key={c.id} className="dv-cwrap"><Icon name="chevronRight" size={14} /><button type="button" className={`dv-crumb ${i === crumbs.length - 1 ? 'on' : ''}`} onClick={() => go(c.id)} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c.name}</button></span>)}
          </>}
        </nav>
        {mayAdd && (
          <div className="dv-new">
            <Button size="sm" icon="upload" onClick={() => fileIn.current?.click()} data-testid="drive-upload">{t('r24.drive.upload')}</Button>
            <Button size="sm" variant="outline" icon="folder" onClick={() => setAsk({ mode: 'mkdir', value: '' })} data-testid="drive-mkdir">{t('r24.drive.newFolder')}</Button>
            <Button size="sm" variant="outline" icon="edit" onClick={newDoc} data-testid="drive-newdoc">{t('r24.drive.newDoc')}</Button>
            <input ref={fileIn} type="file" multiple hidden onChange={onPick} data-testid="drive-file-input" />
          </div>
        )}
      </div>
      <div className="dv-bar">
        <label className="fl-search"><Icon name="search" size={17} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('r24.drive.search')} aria-label={t('r24.drive.search')} data-testid="drive-search" /></label>
        <div className="dv-tools">
          <label className="dv-sort"><span className="sr-only">{t('r24.drive.sort')}</span>
            <select className="select" value={sort.by} onChange={(e) => setSort((x) => ({ ...x, by: e.target.value }))} aria-label={t('r24.drive.sort')} data-testid="drive-sort">
              {SORTS.map((k) => <option key={k} value={k}>{t(`r24.drive.sorts.${k}`)}</option>)}
            </select>
          </label>
          <button type="button" className="pv-btn dv-dir" onClick={() => setSort((x) => ({ ...x, dir: x.dir === 'asc' ? 'desc' : 'asc' }))} aria-label={t(`r24.drive.dir.${sort.dir}`)} title={t(`r24.drive.dir.${sort.dir}`)} data-testid="drive-dir"><Icon name={sort.dir === 'asc' ? 'arrowUp' : 'arrowUp'} size={17} className={sort.dir === 'desc' ? 'flip' : ''} /></button>
          <div className="segment dv-views" role="group">
            <button type="button" className={view === 'grid' ? 'on' : ''} aria-pressed={view === 'grid'} onClick={() => setView('grid')} aria-label={t('r24.drive.view.grid')} title={t('r24.drive.view.grid')} data-testid="drive-view-grid"><Icon name="grid" size={16} /></button>
            <button type="button" className={view === 'list' ? 'on' : ''} aria-pressed={view === 'list'} onClick={() => setView('list')} aria-label={t('r24.drive.view.list')} title={t('r24.drive.view.list')} data-testid="drive-view-list"><Icon name="menu" size={16} /></button>
          </div>
        </div>
      </div>
      <div className="dv-quota" data-testid="drive-quota">
        <span className="dv-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}><i style={{ width: `${pct}%` }} /></span>
        <small>{t('r24.drive.used', { used: fmtSize(used), max: mb(LIMITS.familyMax) })} · {t('r24.drive.perFile', { max: mb(LIMITS.fileMax) })}</small>
      </div>
      {ups.length > 0 && (
        <section className="dv-ups" aria-label={t('r24.drive.uploads')} data-testid="drive-uploads">
          {ups.map((u) => (
            <div key={u.key} className={`dv-up ${u.status}`} data-testid="drive-up" data-status={u.status}>
              <div className="dv-up-row"><b>{u.name}</b><small>{u.status === 'err' ? u.err : u.status === 'done' ? t('r24.drive.uploaded') : t('r24.drive.uploading', { p: Math.round(u.p * 100) })} · {fmtSize(u.size)}</small></div>
              <span className="dv-meter"><i style={{ width: `${Math.round((u.status === 'err' ? 1 : u.p) * 100)}%` }} /></span>
            </div>
          ))}
          {ups.every((u) => u.status === 'done' || u.status === 'err') && <button type="button" className="dv-link" onClick={() => setUps([])}>{t('r24.drive.dismiss')}</button>}
        </section>
      )}
      {loadErr && <p className="dv-err" role="alert">{loadErr}</p>}
      {items === null ? <p className="muted small fl-loading">{t('r24.drive.preview.loading')}</p> : shown.length ? (
        <div className={view === 'grid' ? 'dv-grid' : 'dv-list'} data-testid="drive-items" data-view={view}>
          {shown.map((x) => {
            const where = q.trim() && x.parent ? pathOf(all, x.parent).map((p) => p.name).join(' / ') : '';
            return (
              <div key={x.id} className={`dv-item k-${x.kind}`} data-testid="drive-item" data-kind={x.kind} data-name={x.name}>
                <button type="button" className="dv-hit" onClick={() => openItem(x)} aria-label={`${x.name}, ${t(`r24.drive.kinds.${x.kind}`)}`}>
                  <span className="dv-thumb">{x.kind === 'doc' && view === 'grid' && x.text ? <span className="dv-snip">{x.text.slice(0, 160)}</span> : <FileIcon item={x} size={view === 'grid' ? 30 : 20} />}</span>
                  <span className="dv-meta"><b>{x.name}</b><small>{where ? `${where} · ` : ''}{meta(x)}</small></span>
                  {view === 'list' && <span className="dv-kind">{t(`r24.drive.kinds.${x.kind}`)}</span>}
                </button>
                <button type="button" className="dv-more" onClick={() => setMenu(x)} aria-label={`${t('r24.drive.more')}: ${x.name}`} data-testid="drive-more"><Icon name="more" size={18} /></button>
              </div>
            );
          })}
        </div>
      ) : <Empty icon={q.trim() ? 'search' : 'folder'} text={q.trim() ? t('r24.drive.noMatch', { q: q.trim() }) : t('r24.drive.empty')} />}
      <p className="muted small fl-note"><Icon name="lock" size={12} />{t('r24.drive.note')}</p>

      {menu && (() => { const mayEdit = canEditItem(menu, ctx); return (
        <Sheet open onClose={() => setMenu(null)} title={menu.name}>
          <div className="dv-menu" data-testid="drive-menu">
            <small className="muted">{[t(`r24.drive.kinds.${menu.kind}`), meta(menu), memberName(menu.createdBy)].filter(Boolean).join(' · ')}</small>
            <button type="button" onClick={() => { const m = menu; setMenu(null); openItem(m); }}><Icon name={menu.kind === 'folder' ? 'folder' : 'eye'} size={18} />{t('r24.drive.open')}</button>
            {mayEdit && <button type="button" onClick={() => { setAsk({ mode: 'rename', item: menu, value: menu.name }); setMenu(null); }} data-testid="drive-rename"><Icon name="edit" size={18} />{t('r24.drive.rename')}</button>}
            {mayEdit && <button type="button" onClick={() => { setMover(menu); setMenu(null); }} data-testid="drive-move"><Icon name="swap" size={18} />{t('r24.drive.move')}</button>}
            {mayEdit && <button type="button" className="danger" onClick={() => del(menu)} data-testid="drive-delete"><Icon name="trash" size={18} />{t('r24.drive.del')}</button>}
          </div>
        </Sheet>
      ); })()}
      {ask && (
        <Sheet open onClose={() => setAsk(null)} title={ask.mode === 'mkdir' ? t('r24.drive.newFolder') : t('r24.drive.rename')}
          footer={<div className="sheet-actions"><Button variant="secondary" onClick={() => setAsk(null)}>{t('r24.drive.cancel')}</Button><Button onClick={submitAsk} disabled={!ask.value.trim()} data-testid="drive-ask-ok">{ask.mode === 'mkdir' ? t('r24.drive.create') : t('r24.drive.save')}</Button></div>}>
          <form onSubmit={submitAsk}><input className="input" autoFocus maxLength={LIMITS.nameMax} value={ask.value} placeholder={ask.mode === 'mkdir' ? t('r24.drive.newFolderDefault') : ''} onChange={(e) => setAsk((a) => ({ ...a, value: e.target.value }))} aria-label={ask.mode === 'mkdir' ? t('r24.drive.folderName') : t('r24.drive.rename')} data-testid="drive-ask-input" /></form>
        </Sheet>
      )}
      {mover && <MoveSheet item={mover} all={all} onPick={moveTo} onClose={() => setMover(null)} />}
      {open && <Viewer item={open} fresh={!!open.fresh} canEdit={canEditItem(open, ctx)} onClose={() => { setOpen(null); load(); }} onSaved={(it) => { upsert(it); setOpen((o) => (o && o.id === it.id ? { ...it, fresh: o.fresh } : o)); }} />}
    </div>
  );
}

function MoveSheet({ item, all, onPick, onClose }) {
  const { t } = useI18n();
  const banned = item.kind === 'folder' ? new Set([item.id, ...descendants(all, item.id)]) : new Set();
  const rows = []; const walk = (p, d) => { for (const f of sortItems(all.filter((x) => x.kind === 'folder' && (x.parent || '') === p), 'name')) { if (banned.has(f.id)) continue; rows.push({ f, d }); walk(f.id, d + 1); } };
  walk('', 1);
  const opt = (id, name, d) => <button type="button" key={id || 'root'} disabled={(item.parent || '') === id} style={{ paddingInlineStart: 12 + d * 18 }} onClick={() => onPick(id)} data-testid="move-target"><Icon name="folder" size={17} />{name}</button>;
  return (
    <Sheet open onClose={onClose} title={t('r24.drive.moveTitle', { name: item.name })}>
      <div className="dv-menu dv-tree">{opt('', t('r24.drive.root'), 0)}{rows.map(({ f, d }) => opt(f.id, f.name, d))}</div>
    </Sheet>
  );
}
