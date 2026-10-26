// AI 助理 chat history — ChatGPT-style. Phones (≤900px): left slide-in drawer (menu button or swipe right from the left
// edge; spring animation; dimmed backdrop; swipe left / tap backdrop / Esc to close; safe-area aware; own momentum
// scroll; body scroll locked). Desktop (>900px): persistent, collapsible left sidebar.
// Top: 新對話 + search (titles and message content). Groups 已釘選 / 今日 / 尋日 / 過去 7 日 / 過去 30 日 / 更早 (HKT).
// Rows: no trash icon — swipe left reveals 刪除; long-press or the … button opens 重新命名 / 釘選 / 刪除.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Button } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useBe } from '../lib/be-context.jsx';

import { groupChats } from '../lib/chat-history.js';
export { groupChats };

function Row({ c, on, onOpen, onMenu, onDelete, openKey, setOpenKey }) {
  const { t } = useI18n();
  const [dx, setDx] = useState(0);
  const st = useRef(null);
  const press = useRef(null);
  const revealed = openKey === c.id;
  useEffect(() => { if (!revealed) setDx(0); }, [revealed]);
  const REVEAL = 92;
  const onStart = (e) => {
    const p = e.touches[0];
    st.current = { x: p.clientX, y: p.clientY, base: revealed ? -REVEAL : 0, lock: null, moved: false };
    clearTimeout(press.current);
    press.current = setTimeout(() => { if (st.current && !st.current.moved) { st.current = null; navigator.vibrate?.(8); onMenu(c); } }, 520);
  };
  const onMove = (e) => {
    const s = st.current; if (!s) return;
    const p = e.touches[0]; const ddx = p.clientX - s.x; const ddy = p.clientY - s.y;
    if (Math.abs(ddx) > 6 || Math.abs(ddy) > 6) { s.moved = true; clearTimeout(press.current); }
    if (s.lock == null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) s.lock = Math.abs(ddx) > Math.abs(ddy) ? 'x' : 'y';
    if (s.lock !== 'x') return;
    e.stopPropagation();
    setDx(Math.max(-REVEAL - 30, Math.min(0, s.base + ddx)));
  };
  const onEnd = (e) => {
    clearTimeout(press.current);
    const s = st.current; st.current = null;
    if (!s || s.lock !== 'x') return;
    e.stopPropagation();
    if (dx < -REVEAL / 2) { setDx(-REVEAL); setOpenKey(c.id); } else { setDx(0); if (revealed) setOpenKey(null); }
  };
  return (
    <div className={`cd-row ${on ? 'on' : ''}`} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
      onContextMenu={(e) => { e.preventDefault(); onMenu(c); }}>
      <button type="button" className="cd-del" style={{ opacity: dx < 0 || revealed ? 1 : 0 }} tabIndex={revealed ? 0 : -1} onClick={() => onDelete(c)} aria-hidden={!revealed}><Icon name="trash" size={16} />{t('agent.del')}</button>
      <div className="cd-row-in" style={{ transform: `translateX(${dx}px)`, transition: st.current ? 'none' : undefined }}>
        <button type="button" className="cd-open" onClick={() => { if (revealed) { setOpenKey(null); return; } onOpen(c); }} aria-current={on ? 'page' : undefined}>
          {c.pinned && <Icon name="star" size={13} className="cd-pin" />}
          <span>{c.title || t('agent.untitled')}</span>
        </button>
        <button type="button" className="cd-more" aria-label={t('agent.more')} onClick={() => onMenu(c)}><Icon name="more" size={18} stroke={3} /></button>
      </div>
    </div>
  );
}

export default function ChatDrawer({ open, onClose, desktop, collapsed, convs, cid, onSelect, onNew, onDelete, onRename, onPin, searchContent }) {
  const { t } = useI18n();
  const { demo } = useBe();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState(null);
  const [menu, setMenu] = useState(null);
  const [rename, setRename] = useState(null);
  const [openKey, setOpenKey] = useState(null);
  const [drag, setDrag] = useState(null); // px offset while swiping the panel closed
  const ds = useRef(null);
  const panel = useRef(null);
  // Search: titles instantly; message content (lazy, recent chats) when 2+ characters.
  useEffect(() => {
    const ql = q.trim().toLowerCase();
    if (ql.length < 2 || !searchContent) { setHits(null); return undefined; }
    let live = true;
    const h = setTimeout(() => searchContent(ql).then((ids) => live && setHits(ids)).catch(() => {}), 220);
    return () => { live = false; clearTimeout(h); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => (ql ? convs.filter((c) => String(c.title || '').toLowerCase().includes(ql) || hits?.has(c.id)) : convs), [convs, ql, hits]);
  const groups = useMemo(() => groupChats(shown), [shown]);

  const overlay = !desktop;
  useEffect(() => {
    if (!overlay || !open || demo) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const f = (e) => { if (e.key === 'Escape' && !document.querySelector('.sheet-wrap')) onClose(); };
    window.addEventListener('keydown', f);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', f); };
  }, [overlay, open, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) { setDrag(null); setOpenKey(null); } }, [open]);

  const pick = (c) => { onSelect(c); if (overlay) onClose(); };
  // Swipe the panel left to close.
  const pStart = (e) => { const p = e.touches[0]; ds.current = { x: p.clientX, y: p.clientY, lock: null }; };
  const pMove = (e) => {
    const s = ds.current; if (!s) return;
    const p = e.touches[0]; const dx = p.clientX - s.x; const dy = p.clientY - s.y;
    if (s.lock == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) s.lock = Math.abs(dx) > Math.abs(dy) && dx < 0 ? 'x' : 'y';
    if (s.lock === 'x') setDrag(Math.min(0, dx));
  };
  const pEnd = () => {
    const s = ds.current; ds.current = null;
    if (s?.lock === 'x' && drag != null) { const w = panel.current?.offsetWidth || 320; if (drag < -w * 0.3) onClose(); }
    setDrag(null);
  };

  const body = (
    <>
      <div className="cd-top">
        <Button className="btn-block" icon="plus" onClick={() => { onNew(); if (overlay) onClose(); }}>{t('agent.newChat')}</Button>
        <div className="cd-search"><Icon name="search" size={16} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('agent.searchPh')} aria-label={t('agent.searchPh')} />{q && <button type="button" className="cd-clear" aria-label="×" onClick={() => setQ('')}><Icon name="x" size={14} /></button>}</div>
      </div>
      <div className="cd-list">
        {groups.map(([g, list]) => (
          <section key={g} className="cd-group">
            <h3>{t(`agent.groups.${g}`)}</h3>
            {list.map((c) => <Row key={c.id} c={c} on={c.id === cid} onOpen={pick} onMenu={setMenu} onDelete={(x) => { setOpenKey(null); onDelete(x); }} openKey={openKey} setOpenKey={setOpenKey} />)}
          </section>
        ))}
        {!groups.length && <p className="muted small cd-empty">{ql ? t('agent.noResults') : t('agent.noHistory')}</p>}
      </div>
      {menu && (
        <Sheet open onClose={() => setMenu(null)} title={menu.title || t('agent.untitled')}>
          <div className="ios-list cd-menu">
            <button type="button" className="ios-row" onClick={() => { setRename({ c: menu, v: menu.title || '' }); setMenu(null); }}><span className="ios-ic"><Icon name="edit" size={17} /></span><span className="ios-label">{t('agent.rename')}</span></button>
            <button type="button" className="ios-row" onClick={() => { onPin(menu, !menu.pinned); setMenu(null); }}><span className="ios-ic"><Icon name="star" size={17} /></span><span className="ios-label">{menu.pinned ? t('agent.unpin') : t('agent.pin')}</span></button>
            <button type="button" className="ios-row danger" onClick={() => { onDelete(menu); setMenu(null); }}><span className="ios-ic"><Icon name="trash" size={17} /></span><span className="ios-label">{t('agent.del')}</span></button>
          </div>
        </Sheet>
      )}
      {rename && (
        <Sheet open onClose={() => setRename(null)} title={t('agent.rename')}
          footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={() => setRename(null)}>{t('common.cancel')}</Button><Button disabled={!rename.v.trim()} onClick={() => { onRename(rename.c, rename.v.trim().slice(0, 60)); setRename(null); }}>{t('common.save')}</Button></div>}>
          <form onSubmit={(e) => { e.preventDefault(); if (rename.v.trim()) { onRename(rename.c, rename.v.trim().slice(0, 60)); setRename(null); } }}>
            <input className="input" autoFocus maxLength={60} value={rename.v} onChange={(e) => setRename({ ...rename, v: e.target.value })} aria-label={t('agent.rename')} />
          </form>
        </Sheet>
      )}
    </>
  );

  if (desktop) return <aside className={`cd-side ${collapsed ? 'collapsed' : ''}`} aria-label={t('agent.history')} aria-hidden={collapsed || undefined}>{!collapsed && body}</aside>;
  const tx = drag != null ? `translateX(${drag}px)` : undefined;
  const node = (
    <div className={`cd-wrap ${open ? 'open' : ''} ${demo ? 'in-demo' : ''}`} aria-hidden={!open}>
      <div className="cd-backdrop" onClick={onClose} style={drag != null ? { opacity: Math.max(0, 1 + drag / 320), transition: 'none' } : undefined} />
      <nav ref={panel} className="cd-panel" aria-label={t('agent.history')} onTouchStart={pStart} onTouchMove={pMove} onTouchEnd={pEnd} onTouchCancel={pEnd}
        style={tx ? { transform: tx, transition: 'none' } : undefined}>
        <div className="cd-head"><b>{t('agent.history')}</b><button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}><Icon name="x" size={18} /></button></div>
        {body}
      </nav>
    </div>
  );
  return demo ? node : createPortal(node, document.body);
}

// Swipe right from the left screen edge to open (phones). Calls onOpen once the gesture passes ~60px.
export function useEdgeSwipe(enabled, onOpen) {
  useEffect(() => {
    if (!enabled) return undefined;
    let s = null;
    const start = (e) => { const p = e.touches[0]; s = p.clientX <= 24 ? { x: p.clientX, y: p.clientY } : null; };
    const move = (e) => {
      if (!s) return;
      const p = e.touches[0]; const dx = p.clientX - s.x; const dy = Math.abs(p.clientY - s.y);
      if (dy > 40 && dy > dx) { s = null; return; }
      if (dx > 60) { s = null; onOpen(); }
    };
    const end = () => { s = null; };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    return () => { window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end); };
  }, [enabled, onOpen]);
}
