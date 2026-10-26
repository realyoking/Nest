// Unified identity UI (2026-10-18): verified badge, name + badge, @handle field with live availability,
// 3:1 banner editor, and the public profile header (banner / photo / name / @handle / bio / links).
// The public view never shows family, school or email (server: publicProfile in src/lib/profile.js).
import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { Avatar, Button } from './ui.jsx';
import { VerifiedTick } from './PluginUI.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { loadImage, cropRectAspect, clampOffsetAspect, renderBanner, BANNER_ASPECT } from '../lib/avatar.js';
import { normHandle, handleProblem } from '../lib/profile.js';
import * as API from '../lib/plugins/api.js';

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const validLink = (l) => !!l && /^https:\/\//.test(l.url || '') && !!hostOf(l.url) && hostOf(l.url).includes('.');
export function VerifiedBadge({ size = 14, on = true }) {
  if (!on) return null;
  return <span className="vbadge" data-verified="1"><VerifiedTick size={size} /></span>;
}
// A family member's name with the verified badge when their public profile is verified.
export function MemberName({ uid, name, size = 13 }) {
  const s = useSession();
  return <>{name}<VerifiedBadge size={size} on={!!s?.isVerified?.(uid)} /></>;
}

export function HandleField({ value, onChange, initial = '', onState }) {
  const { t } = useI18n();
  const [st, setSt] = useState('idle'); // idle | checking | ok | taken | bad
  useEffect(() => {
    const h = normHandle(value);
    if (!h || h === initial) { setSt('idle'); onState?.(h ? 'ok' : 'empty'); return undefined; }
    const p = handleProblem(h, { admin: true });
    if (p) { setSt('bad'); onState?.('bad'); return undefined; }
    setSt('checking'); onState?.('checking');
    let live = true;
    const tm = setTimeout(() => {
      API.profileCheck(h).then((r) => { if (!live) return; const v = r.ok ? 'ok' : r.reason === 'bad_handle' ? 'bad' : 'taken'; setSt(v); onState?.(v); })
        .catch(() => { if (live) { setSt('idle'); onState?.('ok'); } });
    }, 350);
    return () => { live = false; clearTimeout(tm); };
  }, [value, initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const msg = { checking: t('id.checking'), ok: t('id.available'), taken: t('id.taken'), bad: t('id.bad') }[st];
  return (
    <div className="id-handle">
      <div className="st-handle"><span>@</span>
        <input className="input" value={value} placeholder={t('id.handlePh')} autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))} aria-label={t('id.handle')} />
      </div>
      {msg && <small className={`id-hstate ${st}`}>{st === 'ok' && <Icon name="check" size={13} />}{msg}</small>}
    </div>
  );
}

// ---------- banner ----------
const VIEW_W = 330; const VIEW_H = Math.round(VIEW_W / BANNER_ASPECT);
function BannerCropper({ img, crop, setCrop }) {
  const cv = useRef(null);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const w = img.naturalWidth; const h = img.naturalHeight;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = VIEW_W * dpr; c.height = VIEW_H * dpr;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    const { sx, sy, sw, sh } = cropRectAspect(w, h, BANNER_ASPECT, crop);
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  }, [img, crop.zoom, crop.x, crop.y]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (zoom, x, y) => { const z = Math.max(1, Math.min(4, zoom)); setCrop({ zoom: z, ...clampOffsetAspect(w, h, BANNER_ASPECT, z, x, y) }); };
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: crop.zoom }; } };
  const move = (e) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) { const [a, b] = [...ptrs.current.values()]; set(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.current.d || 1)), crop.x, crop.y); }
    else if (ptrs.current.size === 1) set(crop.zoom, crop.x + (e.clientX - prev.x) / VIEW_W, crop.y + (e.clientY - prev.y) / VIEW_H);
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  return (
    <div className="pfp-crop">
      <div className="id-bview"><canvas ref={cv} style={{ width: '100%', aspectRatio: '3 / 1' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} /></div>
      <label className="pfp-zoom">
        <Icon name="image" size={14} />
        <input type="range" min="1" max="4" step="0.01" value={crop.zoom} onChange={(e) => set(Number(e.target.value), crop.x, crop.y)} aria-label="Zoom" />
        <Icon name="image" size={20} />
      </label>
    </div>
  );
}
export function BannerEditor({ value, onChange, toast }) {
  const { t } = useI18n();
  const pick = useRef(null);
  const [src, setSrc] = useState(null);
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 });
  const close = () => { if (src) URL.revokeObjectURL(src.url); setSrc(null); };
  const take = async (f) => {
    if (!f) return;
    try { const r = await loadImage(f); setSrc(r); setCrop({ zoom: 1, x: 0, y: 0 }); } catch { toast?.(t('pfp.badFile'), 'err'); }
  };
  const use = () => {
    const url = renderBanner(src.img, crop);
    if (!url) { toast?.(t('id.tooBig'), 'err'); return; }
    onChange(url); close();
  };
  return (
    <div className="id-banner-ed">
      <div className="id-banner" style={value ? { backgroundImage: `url(${value})` } : undefined} data-default={value ? undefined : '1'} />
      <div className="row id-banner-actions">
        <Button size="sm" variant="secondary" icon="image" onClick={() => pick.current.click()}>{value ? t('id.bannerChange') : t('id.bannerAdd')}</Button>
        {value && <Button size="sm" variant="ghost" icon="trash" onClick={() => onChange('')}>{t('id.bannerRemove')}</Button>}
      </div>
      <input ref={pick} type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <Sheet open={!!src} onClose={close} title={t('id.bannerCrop')} className="pfp-sheet"
        footer={<div className="row pfp-foot"><Button variant="ghost" onClick={close}>{t('common.cancel')}</Button><Button icon="check" onClick={use}>{t('id.useBanner')}</Button></div>}>
        {src && <><BannerCropper img={src.img} crop={crop} setCrop={setCrop} /><p className="muted small pfp-tip">{t('id.bannerTip')}</p></>}
      </Sheet>
    </div>
  );
}

// ---------- public header ----------
export function ProfileHeader({ p, actions }) {
  const { t } = useI18n();
  const title = p.name || (p.handle ? `@${p.handle}` : '');
  return (
    <header className="id-head">
      <div className="id-banner" style={p.banner ? { backgroundImage: `url(${p.banner})` } : undefined} data-default={p.banner ? undefined : '1'} />
      <div className="id-head-row">
        <span className="id-photo"><Avatar name={p.name || p.handle || '?'} src={p.photo} size={88} /></span>
        {actions && <div className="id-head-actions">{actions}</div>}
      </div>
      <div className="id-head-text">
        <h1>{title}{p.verified && <span className="vbadge" title={t('id.verified')}><VerifiedTick size={20} /></span>}</h1>
        {p.handle && p.name && <span className="id-at">@{p.handle}</span>}
        {p.bio && <p className="id-bio">{p.bio}</p>}
        {p.links?.some(validLink) && (
          <div className="id-links">
            {p.links.filter(validLink).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc"><Icon name="globe" size={13} />{l.label || hostOf(l.url)}</a>)}
          </div>
        )}
      </div>
    </header>
  );
}
