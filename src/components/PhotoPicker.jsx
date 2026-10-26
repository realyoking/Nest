import { useRef, useState } from 'react';
import { Button, IconButton } from './ui.jsx';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { fileToDataUrl } from '../lib/ai.js';

// Photos stay client-side: downscaled to a JPEG data URL and sent inline to /api/chat.
export default function PhotoPicker({ value, onChange }) {
  const { t } = useI18n();
  const file = useRef(null);
  const cam = useRef(null);
  const [drag, setDrag] = useState(false);
  const take = async (f) => { if (f && f.type.startsWith('image/')) onChange(await fileToDataUrl(f)); };
  if (value) {
    return (
      <div className="preview-img">
        <img src={value} alt="" />
        <IconButton icon="x" label={t('tutor.removeImage')} onClick={() => onChange(null)} />
      </div>
    );
  }
  return (
    <div className={`dropzone ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}>
      <span className="empty-icon"><Icon name="image" size={22} /></span>
      <div className="row" style={{ justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" size="sm" icon="image" onClick={() => file.current.click()}>{t('tutor.upload')}</Button>
        <Button variant="secondary" size="sm" icon="camera" onClick={() => cam.current.click()}>{t('tutor.camera')}</Button>
      </div>
      <input ref={file} type="file" accept="image/*" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={cam} type="file" accept="image/*" capture="environment" className="vh-file" tabIndex={-1} onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
