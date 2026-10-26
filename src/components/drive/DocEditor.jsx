// Run 24 step 2b: in-app rich-text document (bold / italic / headings / lists / checklist). Saved to the family drive
// (server sanitises with an allow-list; the client runs DOMPurify before it renders anything). Autosaves.
import { useEffect, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import { useI18n } from '../../lib/i18n.jsx';
import { driveCall } from '../../lib/drive-client.js';

const TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'hr'];
export const cleanHtml = (h) => DOMPurify.sanitize(String(h || ''), { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ['data-check'] });

export default function DocEditor({ item, canEdit, onSaved, registerFlush, fresh = false }) {
  const { t } = useI18n();
  const ed = useRef(null); const title = useRef(null);
  const [name, setName] = useState(item.name);
  const [state, setState] = useState('loading'); // loading | saved | dirty | saving | error
  const timer = useRef(0); const nameRef = useRef(item.name); const dirty = useRef(false);
  useEffect(() => {
    let live = true;
    driveCall('get-doc', { id: item.id }).then((r) => { if (!live || !ed.current) return; ed.current.innerHTML = cleanHtml(r.html) || '<p><br></p>'; try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch {} setState('saved'); if (fresh && canEdit) setTimeout(() => { title.current?.focus(); title.current?.select(); }, 0); }).catch(() => live && setState('error'));
    return () => { live = false; };
  }, [item.id]);
  const save = async () => {
    clearTimeout(timer.current); if (!dirty.current || !ed.current) return;
    dirty.current = false; setState('saving');
    try { const r = await driveCall('doc-save', { id: item.id, html: cleanHtml(ed.current.innerHTML), name: nameRef.current }, { retries: 2 }); onSaved?.(r.item); setState(dirty.current ? 'dirty' : 'saved'); }
    catch { dirty.current = true; setState('error'); }
  };
  const touch = () => { dirty.current = true; setState('dirty'); clearTimeout(timer.current); timer.current = setTimeout(save, 1200); };
  useEffect(() => { registerFlush?.(save); return () => clearTimeout(timer.current); }); // eslint-disable-line react-hooks/exhaustive-deps
  const cmd = (c, v) => { ed.current?.focus(); document.execCommand(c, false, v); touch(); };
  const checklist = () => { // the current line becomes a checklist item (or a checklist turns back into a bulleted list)
    const root = ed.current; if (!root) return; root.focus();
    const sel = window.getSelection(); let n = sel?.anchorNode; if (!n || !root.contains(n)) return;
    let ul = null; for (let x = n; x && x !== root; x = x.parentNode) if (x.nodeName === 'UL') { ul = x; break; }
    if (ul) { const on = [...ul.children].some((li) => !li.hasAttribute('data-check')); [...ul.children].forEach((li) => (on ? li.getAttribute('data-check') || li.setAttribute('data-check', '0') : li.removeAttribute('data-check'))); touch(); return; }
    while (n.parentNode && n.parentNode !== root) n = n.parentNode; // top-level block holding the caret
    const list = document.createElement('ul'); const li = document.createElement('li'); li.setAttribute('data-check', '0');
    if (n.nodeType === 1 && /^(P|DIV|H1|H2|H3|BLOCKQUOTE)$/.test(n.nodeName)) { while (n.firstChild) li.appendChild(n.firstChild); n.replaceWith(list); }
    else if (n.nodeType === 3) { li.appendChild(n.cloneNode()); n.replaceWith(list); }
    else root.appendChild(list);
    if (!li.textContent) li.innerHTML = '<br>';
    list.appendChild(li);
    const r = document.createRange(); r.selectNodeContents(li); r.collapse(false); sel.removeAllRanges(); sel.addRange(r);
    touch();
  };
  const onClick = (e) => { // tick a checklist item by tapping its box
    const li = e.target.closest?.('li[data-check]'); if (!li || !canEdit) return;
    const r = li.getBoundingClientRect(); const x = getComputedStyle(li).direction === 'rtl' ? r.right - e.clientX : e.clientX - r.left;
    if (x < 30) { e.preventDefault(); li.setAttribute('data-check', li.getAttribute('data-check') === '1' ? '0' : '1'); touch(); }
  };
  const tools = [['bold', 'B', () => cmd('bold')], ['italic', 'I', () => cmd('italic')], ['h1', 'H1', () => cmd('formatBlock', '<h1>')], ['h2', 'H2', () => cmd('formatBlock', '<h2>')], ['p', '¶', () => cmd('formatBlock', '<p>')], ['ul', '•', () => cmd('insertUnorderedList')], ['ol', '1.', () => cmd('insertOrderedList')], ['check', '☑', checklist]];
  return (
    <div className="doc-ed" data-testid="doc-editor">
      <div className="doc-head">
        <input ref={title} className="doc-title" value={name} disabled={!canEdit} onChange={(e) => { setName(e.target.value); nameRef.current = e.target.value; touch(); }} aria-label={t('r24.drive.docName')} data-testid="doc-title" />
        <span className={`doc-state ${state}`} data-testid="doc-state" aria-live="polite">{state === 'saving' ? t('r24.drive.saving') : state === 'dirty' ? t('r24.drive.unsaved') : state === 'error' ? t('r24.drive.err.network') : state === 'saved' ? t('r24.drive.saved') : ''}</span>
      </div>
      {canEdit && (
        <div className="doc-tools" role="toolbar" aria-label={t('r24.drive.doc.tools')}>
          {tools.map(([k, label, fn]) => <button type="button" key={k} className={`doc-tool dt-${k}`} onMouseDown={(e) => e.preventDefault()} onClick={fn} aria-label={t(`r24.drive.doc.${k}`)} title={t(`r24.drive.doc.${k}`)} data-testid={`doc-tool-${k}`}>{label}</button>)}
        </div>
      )}
      <div ref={ed} className="doc-body" contentEditable={canEdit && state !== 'loading'} suppressContentEditableWarning onInput={touch} onClick={onClick} onBlur={save}
        role="textbox" aria-multiline="true" aria-label={name} data-placeholder={t('r24.drive.doc.placeholder')} data-testid="doc-body" />
    </div>
  );
}
