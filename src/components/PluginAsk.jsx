// Sheets Nest shows on behalf of a plugin (outside the sandbox, so the plugin cannot fake or click them):
//  - confirm: calendar.create / calendar.delete / memory.add — what exactly will be written, by which plugin.
//  - photo:   native camera / library picker; the plugin only receives a resized JPEG of the chosen photo.
import { useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';
import { PluginIcon } from './PluginUI.jsx';
import { useI18n } from '../lib/i18n.jsx';

const TXT = {
  en: {
    'calendar.create': ['Add to the family calendar?', 'Add event'], 'calendar.delete': ['Delete this event?', 'Delete'], 'memory.add': ['Save to family memory?', 'Save'],
    by: (n) => `${n} wants to:`, title: 'Title', when: 'When', place: 'Where', note: 'Note', logged: 'Everyone in the family can see it. It is marked as added by this plugin and logged in Settings → Plugins.',
    delNote: 'The plugin can only delete events it created.', cancel: 'Don’t allow', photo: (n) => `${n} wants a photo`, photoBody: 'Only the photo you choose is shared with the plugin, resized. It cannot see your other photos.',
    take: 'Take photo', pick: 'Choose from library', fail: 'Could not read that photo.',
  },
  zh: {
    'calendar.create': ['加入家庭日曆？', '加入活動'], 'calendar.delete': ['刪除這個活動？', '刪除'], 'memory.add': ['儲存到家庭記憶？', '儲存'],
    by: (n) => `「${n}」想：`, title: '標題', when: '時間', place: '地點', note: '內容', logged: '全家都會看到。會標明由此插件加入，並記錄在「設定 → 插件」。',
    delNote: '插件只可刪除它自己新增的活動。', cancel: '不允許', photo: (n) => `「${n}」想要一張相片`, photoBody: '插件只會收到你選擇的那一張相片（已縮小），不能看到你其他相片。',
    take: '拍照', pick: '從相簿選擇', fail: '未能讀取這張相片。',
  },
};

export function resizePhoto(file, maxSize = 1024, budget = 700 * 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      let q = 0.85;
      for (let i = 0; i < 8; i++) {
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', q);
        if (out.length <= budget) { URL.revokeObjectURL(img.src); resolve({ dataUrl: out, width: c.width, height: c.height, type: 'image/jpeg' }); return; }
        if (q > 0.6) q -= 0.1; else scale *= 0.8;
      }
      reject(new Error('too_big'));
    };
    img.onerror = () => reject(new Error('bad_image'));
    img.src = URL.createObjectURL(file);
  });
}

export function PluginAskHost({ spec, onDone, onCancel }) {
  const { lang } = useI18n();
  const T = TXT[lang === 'en' ? 'en' : 'zh'];
  const lib = useRef(null); const cam = useRef(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (spec.kind === 'photo') {
    const take = async (f) => {
      if (!f) return;
      setBusy(true); setErr('');
      try { onDone(await resizePhoto(f, spec.maxSize || 1024)); } catch { setErr(T.fail); } finally { setBusy(false); }
    };
    return (
      <Sheet open onClose={onCancel} title={T.photo(spec.name)}
        footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={onCancel}>{T.cancel}</Button></div>}>
        <div className="plug-ask">
          <div className="plug-prompt-top"><PluginIcon src={spec.icon} name={spec.name} size={48} /><div><b>{spec.name}</b></div></div>
          <p className="muted small">{T.photoBody}</p>
          <div className="plug-ask-photo">
            <Button icon="camera" onClick={() => cam.current?.click()} loading={busy}>{T.take}</Button>
            <label className={`btn btn-outline file-btn ${busy ? 'disabled' : ''}`}><Icon name="image" size={18} /><span>{T.pick}</span>
              <input ref={lib} type="file" accept="image/*" className="file-overlay" aria-label={T.pick} disabled={busy} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} /></label>
          </div>
          {err && <p className="error-text small">{err}</p>}
          <input ref={cam} type="file" accept="image/*" capture="environment" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
      </Sheet>
    );
  }
  const [title, ok] = T[spec.kind] || ['?', 'OK'];
  const info = spec.info || {};
  const rows = [[T.title, info.title], [T.when, info.when], [T.place, info.place], [T.note, info.text]].filter(([, v]) => v);
  const danger = spec.kind === 'calendar.delete';
  return (
    <Sheet open onClose={onCancel} title={title}
      footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={onCancel}>{T.cancel}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => onDone(true)}>{ok}</Button></div>}>
      <div className="plug-ask">
        <div className="plug-prompt-top"><PluginIcon src={spec.icon} name={spec.name} size={48} /><div><b>{T.by(spec.name)}</b><small>{title}</small></div></div>
        {rows.length > 0 && <dl className="plug-ask-rows">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{String(v).slice(0, 300)}</dd></div>)}</dl>}
        <p className="fine"><Icon name="shield" size={13} /> {danger ? T.delNote : T.logged}</p>
      </div>
    </Sheet>
  );
}
