// AI 助理 composer attachments: '+' menu (Take photo / Photo & video library / Files), chips with thumbnail, progress
// and remove, and the attachment grid inside a sent message bubble.
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { FILE_ACCEPT, fmtSize, docReadInfo } from '../lib/attach-core.js';

const T = {
  'zh-Hant': { add: '加入附件', camera: '拍照', library: '相片或影片', files: '檔案', remove: '移除', processing: '處理中…', video: '影片', sessionOnly: '影片只可在本次使用時播放', drop: '放開以加入附件', pages: '{n} 頁', words: '約 {n} 字', readAll: 'AI 已閱讀全文', readSome: '文件較長：AI 已使用約 {used}／{total} 字（開頭及與問題最相關的部分）', pagesCut: '只讀取了首 {n} 頁' },
  'zh-Hans': { add: '添加附件', camera: '拍照', library: '照片或视频', files: '文件', remove: '移除', processing: '处理中…', video: '视频', sessionOnly: '视频只可在本次使用时播放', drop: '松开以添加附件', pages: '{n} 页', words: '约 {n} 字', readAll: 'AI 已阅读全文', readSome: '文件较长：AI 已使用约 {used}／{total} 字（开头及与问题最相关的部分）', pagesCut: '只读取了前 {n} 页' },
  en: { add: 'Add attachment', camera: 'Take photo', library: 'Photo or video', files: 'Files', remove: 'Remove', processing: 'Processing…', video: 'Video', sessionOnly: 'Videos play only during this session', drop: 'Drop to attach', pages: '{n} pages', words: '{n} words', readAll: 'AI read the full text', readSome: 'Long document: AI used about {used} / {total} words (the start + the parts most related to your question)', pagesCut: 'Only the first {n} pages were read' },
  th: { add: 'เพิ่มไฟล์แนบ', camera: 'ถ่ายรูป', library: 'รูปภาพหรือวิดีโอ', files: 'ไฟล์', remove: 'ลบ', processing: 'กำลังประมวลผล…', video: 'วิดีโอ', sessionOnly: 'วิดีโอเล่นได้เฉพาะในรอบการใช้งานนี้', drop: 'วางเพื่อแนบไฟล์', pages: '{n} หน้า', words: 'ประมาณ {n} คำ', readAll: 'AI อ่านข้อความทั้งหมดแล้ว', readSome: 'เอกสารยาว: AI ใช้ประมาณ {used} / {total} คำ (ส่วนต้นและส่วนที่เกี่ยวข้องกับคำถามมากที่สุด)', pagesCut: 'อ่านเฉพาะ {n} หน้าแรก' },
};
const tLang = (lang) => (T[lang] ? lang : lang === 'zh-Hant' ? 'zh-Hant' : 'en');
export const useAttachT = () => { const { lang, uiLang } = useI18n(); const L = uiLang || lang; return (k, v = {}) => String((T[tLang(L)])[k] ?? T.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? ''); };
// "14 pages · about 10,808 words" — the same count everywhere (composer chip, sent bubble, Files).
export const fmtN = (n) => Number(n || 0).toLocaleString('en');
export function docMeta(a, tt) {
  return [a.size ? fmtSize(a.size) : '', a.pages ? tt('pages', { n: a.pages }) : '', a.words ? tt('words', { n: fmtN(a.words) }) : ''].filter(Boolean).join(' · ');
}

export function AttachButton({ onFiles, disabled }) {
  const tt = useAttachT();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const cam = useRef(null); const lib = useRef(null); const files = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const pick = (ref) => { setOpen(false); ref.current?.click(); };
  const take = (e) => { const l = [...(e.target.files || [])]; e.target.value = ''; if (l.length) onFiles(l); };
  return (
    <div className="att-wrap" ref={wrap}>
      <button type="button" className={`att-plus ${open ? 'on' : ''}`} aria-label={tt('add')} aria-expanded={open} aria-haspopup="menu" disabled={disabled} onClick={() => setOpen((v) => !v)}><Icon name="plus" size={20} stroke={2.4} /></button>
      {open && (
        <div className="att-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => pick(cam)}><Icon name="camera" size={18} />{tt('camera')}</button>
          <button type="button" role="menuitem" onClick={() => pick(lib)}><Icon name="image" size={18} />{tt('library')}</button>
          <button type="button" role="menuitem" onClick={() => pick(files)}><Icon name="file" size={18} />{tt('files')}</button>
        </div>
      )}
      <input ref={cam} type="file" accept="image/*" capture="environment" className="vh-file" tabIndex={-1} onChange={take} />
      <input ref={lib} type="file" accept="image/*,video/*" multiple className="vh-file" tabIndex={-1} onChange={take} />
      <input ref={files} type="file" accept={FILE_ACCEPT} multiple className="vh-file" tabIndex={-1} onChange={take} />
    </div>
  );
}

const fileIcon = (a) => ({ pdf: 'PDF', docx: 'DOC', xlsx: 'XLS', pptx: 'PPT', csv: 'CSV', txt: 'TXT' }[a.ftype] || (a.name.split('.').pop() || '').slice(0, 4).toUpperCase());

export function AttachChips({ atts, onRemove }) {
  const tt = useAttachT();
  if (!atts.length) return null;
  return (
    <div className="att-chips" role="list">
      {atts.map((a) => (
        <div key={a.id} role="listitem" className={`att-chip ${a.kind === 'file' ? 'file' : 'media'} ${a.status}`} title={a.error || a.name}>
          {a.thumb ? <img src={a.thumb} alt="" /> : a.kind === 'file' || a.kind === 'pending-file' ? <span className="att-badge">{fileIcon(a)}</span> : <span className="att-badge"><Icon name="image" size={18} /></span>}
          {a.kind === 'video' && a.status === 'ready' && <span className="att-dur">{Math.round(a.dur)}s</span>}
          {(a.kind === 'file' || a.kind === 'pending-file') && <span className="att-meta"><b>{a.name}</b><small data-testid="att-chip-meta">{a.status === 'error' ? a.error : a.status === 'loading' ? tt('processing') : docMeta(a, tt)}</small></span>}
          {a.status === 'loading' && <span className="att-prog" style={{ '--p': `${Math.round((a.progress || 0.08) * 100)}%` }} aria-label={tt('processing')} />}
          {a.status === 'error' && a.kind !== 'file' && a.kind !== 'pending-file' && <span className="att-err" aria-hidden="true">!</span>}
          <button type="button" className="att-x" aria-label={`${tt('remove')} ${a.name}`} onClick={() => onRemove(a.id)}><Icon name="x" size={12} stroke={3} /></button>
        </div>
      ))}
    </div>
  );
}

// In-bubble attachments. `live` = this session's blob URLs (video playback) by attachment id.
export function MsgAttachments({ atts = [], live = {} }) {
  const tt = useAttachT();
  const [play, setPlay] = useState(null);
  if (!atts.length) return null;
  const media = atts.filter((a) => a.kind !== 'file');
  const files = atts.filter((a) => a.kind === 'file');
  return (
    <div className="msg-atts">
      {media.length > 0 && (
        <div className={`msg-media n${Math.min(media.length, 4)}`}>
          {media.map((a) => (a.kind === 'video' && play === a.id && live[a.id]
            ? <video key={a.id} src={live[a.id]} controls autoPlay playsInline className="msg-vid" />
            : (
              <button key={a.id} type="button" className="msg-thumb" onClick={() => a.kind === 'video' && live[a.id] && setPlay(a.id)} title={a.kind === 'video' && !live[a.id] ? tt('sessionOnly') : a.name} aria-label={a.name}>
                {a.thumb ? <img src={a.thumb} alt="" loading="lazy" /> : <span className="att-badge"><Icon name="image" size={18} /></span>}
                {a.kind === 'video' && <span className="msg-play"><Icon name="play" size={16} /></span>}
                {a.kind === 'video' && <span className="att-dur">{a.dur}s</span>}
              </button>
            )))}
        </div>
      )}
      {files.map((a) => (
        <div key={a.id} className="msg-file-wrap">
          <div className="msg-file"><span className="att-badge">{fileIcon(a)}</span><span className="att-meta"><b>{a.name}</b><small data-testid="msg-file-meta">{docMeta(a, tt)}</small></span></div>
          <ReadNote a={a} tt={tt} />
        </div>
      ))}
    </div>
  );
}

// Under a sent document: honest note of how much the AI read (never a silent trim).
function ReadNote({ a, tt }) {
  const r = docReadInfo(a);
  if (!r) return null;
  const cut = a.pagesRead && a.pages > a.pagesRead ? ` · ${tt('pagesCut', { n: a.pagesRead })}` : '';
  return <small className={`msg-read ${r.trimmed ? 'trim' : ''}`} data-testid="msg-read-note">{r.trimmed ? tt('readSome', { used: fmtN(r.sent), total: fmtN(r.words) }) : tt('readAll')}{cut}</small>;
}
