// Profile picture: take / choose a photo → square pan & zoom cropper → 256 px WebP/JPEG data URL (≤ ~60 KB).
// Saved to the member doc (photoURL, what the family sees) and the owner-only profile (avatar). See src/lib/avatar.js.
import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { Avatar, Button, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { clampOffset, cropRect, loadImage, renderAvatar } from '../lib/avatar.js';
import { profileSave } from '../lib/plugins/api.js';

const VIEW = 264; // css px of the crop square (fits a 390 px phone inside the sheet padding)

function Cropper({ img, crop, setCrop }) {
  const cv = useRef(null);
  const ptrs = useRef(new Map());
  const pinch = useRef(null);
  const w = img.naturalWidth; const h = img.naturalHeight;
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    c.width = VIEW * dpr; c.height = VIEW * dpr;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    const { sx, sy, side } = cropRect(w, h, crop);
    g.drawImage(img, sx, sy, side, side, 0, 0, c.width, c.height);
  }, [img, crop.zoom, crop.x, crop.y]);
  const set = (zoom, x, y) => { const z = Math.max(1, Math.min(4, zoom)); setCrop({ zoom: z, ...clampOffset(w, h, z, x, y) }); };
  const down = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z: crop.zoom }; } };
  const move = (e) => {
    const prev = ptrs.current.get(e.pointerId); if (!prev) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.current.size >= 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()];
      set(pinch.current.z * (Math.hypot(a.x - b.x, a.y - b.y) / (pinch.current.d || 1)), crop.x, crop.y);
    } else if (ptrs.current.size === 1) {
      set(crop.zoom, crop.x + (e.clientX - prev.x) / VIEW, crop.y + (e.clientY - prev.y) / VIEW);
    }
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  const wheel = (e) => { e.preventDefault(); set(crop.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), crop.x, crop.y); };
  useEffect(() => {
    const c = cv.current; if (!c) return undefined;
    c.addEventListener('wheel', wheel, { passive: false });
    return () => c.removeEventListener('wheel', wheel);
  });
  return (
    <div className="pfp-crop">
      <div className="pfp-view" style={{ width: VIEW, height: VIEW }}>
        <canvas ref={cv} style={{ width: VIEW, height: VIEW }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
        <span className="pfp-mask" aria-hidden="true" />
      </div>
      <label className="pfp-zoom">
        <Icon name="image" size={14} />
        <input type="range" min="1" max="4" step="0.01" value={crop.zoom} onChange={(e) => set(Number(e.target.value), crop.x, crop.y)} aria-label="Zoom" />
        <Icon name="image" size={20} />
      </label>
    </div>
  );
}

export default function ProfilePhoto() {
  const { t } = useI18n();
  const { be } = useBe();
  const s = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState(null); // { img, url }
  const [crop, setCrop] = useState({ zoom: 1, x: 0, y: 0 });
  const [busy, setBusy] = useState('');
  const pick = useRef(null);
  const cam = useRef(null);
  const name = s.me?.displayName || s.user?.displayName || '';
  const close = () => { setOpen(false); if (src) URL.revokeObjectURL(src.url); setSrc(null); };
  const take = async (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) { toast(t('pfp.badFile'), 'err'); return; }
    try { const r = await loadImage(f); setSrc(r); setCrop({ zoom: 1, x: 0, y: 0 }); setOpen(true); } catch { toast(t('pfp.badFile'), 'err'); }
  };
  // Owner-only copy first (always allowed), then the member doc the family reads.
  const write = async (value) => {
    await be.saveProfile(s.user.uid, { avatar: value });
    // Unified identity: the same photo on the public profile (only once the user has one).
    if (s.pubProfile) profileSave({ photo: value }).then((r) => s.refreshProfile?.(r.profile)).catch(() => {});
    try { await be.updateMyMember(s.family.id, s.user.uid, { photoURL: value }); return true; } catch { return false; }
  };
  const save = async () => {
    setBusy('save');
    try {
      const url = renderAvatar(src.img, crop);
      if (!url) throw new Error('encode');
      const shared = await write(url);
      toast(shared ? t('pfp.saved') : t('pfp.savedOnlyMe'), shared ? 'ok' : 'err');
      close();
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const remove = async () => {
    setBusy('rm');
    try { await write(''); toast(t('pfp.removed')); setOpen(false); } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  return (
    <div className="pfp">
      <button type="button" className="pfp-big" onClick={() => setOpen(true)} aria-label={t('pfp.change')}>
        <Avatar name={name} src={s.myPhoto} size={76} />
        <span className="pfp-badge"><Icon name="camera" size={14} /></span>
      </button>
      <div className="pfp-text">
        <b>{t('pfp.title')}</b>
        <small>{s.myPhoto ? t('pfp.hintSet') : t('pfp.hint')}</small>
        <div className="row pfp-actions">
          <Button size="sm" variant="secondary" icon="camera" onClick={() => setOpen(true)}>{s.myPhoto ? t('pfp.change') : t('pfp.add')}</Button>
          {s.myPhoto && <Button size="sm" variant="ghost" icon="trash" loading={busy === 'rm'} onClick={remove}>{t('pfp.remove')}</Button>}
        </div>
      </div>
      <input ref={pick} type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cam} type="file" accept="image/*" capture="user" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <Sheet open={open} onClose={close} title={src ? t('pfp.cropTitle') : t('pfp.title')} className="pfp-sheet"
        footer={src ? (
          <div className="row pfp-foot">
            <Button variant="ghost" onClick={() => { URL.revokeObjectURL(src.url); setSrc(null); }}>{t('pfp.another')}</Button>
            <Button loading={busy === 'save'} icon="check" onClick={save}>{t('pfp.use')}</Button>
          </div>
        ) : null}>
        {src ? (
          <>
            <Cropper img={src.img} crop={crop} setCrop={setCrop} />
            <p className="muted small pfp-tip">{t('pfp.cropHint')}</p>
          </>
        ) : (
          <div className="ios-list pfp-menu">
            <button type="button" className="ios-row" onClick={() => cam.current.click()}><span className="ios-ic"><Icon name="camera" size={17} /></span><span className="ios-label">{t('pfp.takePhoto')}</span></button>
            <button type="button" className="ios-row" onClick={() => pick.current.click()}><span className="ios-ic"><Icon name="image" size={17} /></span><span className="ios-label">{t('pfp.choose')}</span></button>
            {s.myPhoto && <button type="button" className="ios-row danger-left" disabled={busy === 'rm'} onClick={remove}><span className="ios-ic"><Icon name="trash" size={17} /></span><span className="ios-label">{t('pfp.remove')}</span></button>}
          </div>
        )}
      </Sheet>
    </div>
  );
}
