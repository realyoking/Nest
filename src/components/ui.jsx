import { useNavigate } from 'react-router-dom';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { marked } from 'marked';
import { hasMath, extractMath, injectMath, plainMath } from '../lib/math.js';
import DOMPurify from 'dompurify';
import Icon from './Icon.jsx';
import { BlurText } from './Reveal.jsx';
import { useI18n, LANGS, langInfo } from '../lib/i18n.jsx';
import { flagParts } from '../lib/flag-svg.js';
import { LBY } from '../lib/langs.js';
import { BRAND as LOGOS } from '../lib/brand-logos.js';

export function Button({ variant = 'primary', size, to, href, icon, iconRight, loading, children, className = '', ...rest }) {
  const cls = `btn btn-${variant} ${size ? 'btn-' + size : ''} ${className}`;
  const inner = (
    <>
      {loading ? <Spinner small /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{inner}</a>;
  return <button className={cls} disabled={loading || rest.disabled} {...rest}>{inner}</button>;
}

export function IconButton({ icon, label, className = '', ...rest }) {
  return <button className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}><Icon name={icon} size={18} /></button>;
}

export const Spinner = ({ small }) => <span className={`spinner ${small ? 'sm' : ''}`} aria-hidden="true" />;

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <header className="page-head">
      <div>
        <BlurText as="h1" text={title} className="page-title" key={title} />
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Empty({ icon = 'sparkle', text, action }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <p>{text}</p>
      {action}
    </div>
  );
}

marked.setOptions({ breaks: true, gfm: true });
// KaTeX is loaded on demand (first message with math); fonts + CSS are bundled (self-hosted) with it.
let katexMod = null; let katexP = null;
const loadKatex = () => (katexP ||= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => { katexMod = m.default || m; return katexMod; }));
export function Markdown({ text, className = '' }) {
  const math = hasMath(text);
  const [, bump] = useState(0);
  useEffect(() => { if (math && !katexMod) loadKatex().then(() => bump((n) => n + 1)).catch(() => {}); }, [math]);
  const html = useMemo(() => {
    if (!math) return DOMPurify.sanitize(marked.parse(text || ''));
    const { text: md, items } = extractMath(text);
    const safe = DOMPurify.sanitize(marked.parse(md));
    return katexMod ? injectMath(safe, items, katexMod) : plainMath(safe, items);
  }, [text, math, katexMod]);
  const out = useMemo(() => (html.includes('<table') ? html.replace(/<table>/g, '<div class="md-table"><table>').replace(/<\/table>/g, '</table></div>') : html), [html]);
  // In-app links (/app/…) from the assistant navigate inside the app; web links open in a new tab.
  const nav = useNavSafe();
  const onClick = (e) => {
    const el = e.target.closest?.('a[href]'); if (!el) return;
    const href = el.getAttribute('href') || '';
    if (/^\/(app|beta|pricing)(\/|$|\?|#)/.test(href)) { e.preventDefault(); nav ? nav(href) : (location.href = href); }
    else if (/^https?:\/\//.test(href)) { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }
  };
  return <div className={`md ${className}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: out }} />;
}
// One line of model text inside nest-ui components: inline markdown (bold/italic/code) + KaTeX, sanitized, no links/blocks.
export function InlineMd({ text }) {
  const src = String(text ?? '');
  const math = hasMath(src);
  const [, bump] = useState(0);
  useEffect(() => { if (math && !katexMod) loadKatex().then(() => bump((n) => n + 1)).catch(() => {}); }, [math]);
  const html = useMemo(() => {
    const opts = { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'code', 'sub', 'sup', 'br', 'del'], ALLOWED_ATTR: [] };
    if (!math) return DOMPurify.sanitize(marked.parseInline(src), opts);
    const { text: md, items } = extractMath(src);
    const safe = DOMPurify.sanitize(marked.parseInline(md), opts);
    return katexMod ? injectMath(safe, items, katexMod) : plainMath(safe, items);
  }, [src, math, katexMod]);
  return <span className="md-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
function useNavSafe() { try { return useNavigate(); } catch { return null; } }

// Flags as SVG (emoji flags do not render on Windows). Run 14: one source for app + static pages (src/lib/flag-svg.js).
export function Flag({ code, size = 18 }) {
  const { viewBox, inner } = flagParts(code);
  return <svg className="flag" width={size * 1.5} height={size} viewBox={viewBox} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: inner }} />;
}

// Run 14: THE language picker (app, auth, onboarding, admin, settings). Flag + native name; menu lists every language in
// src/lib/langs.js. `hrefFor(id)` (public pages) turns options into links to the localized URL (saved on click too).
export function LangSwitch({ compact, short, responsive, hrefFor, align = 'right', className = '', onPick }) {
  const { uiLang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const ci = langInfo(uiLang);
  const pick = (l) => { setLang(l); setOpen(false); onPick?.(l); };
  return (
    <div className={`lang ${className}`} ref={ref} data-testid="lang-switch">
      <button type="button" className="lang-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open} aria-label={`${t('lang.label')}: ${ci.label}`} data-noconv>
        <Flag code={ci.flag} size={13} />{!compact && (responsive ? <><span className="lang-cur lang-long">{ci.label}</span><span className="lang-cur lang-short">{ci.short}</span></> : <span className="lang-cur">{short ? ci.short : ci.label}</span>)}<Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <div className={`lang-menu lang-${align}`} role="menu" data-noconv>
          {LANGS.map(({ id: l, flag: c, label, html }) => (hrefFor
            ? <a key={l} role="menuitemradio" aria-checked={uiLang === l} className={uiLang === l ? 'on' : ''} href={hrefFor(l)} hrefLang={LBY[l].hreflang} lang={html} onClick={() => pick(l)}>
                <Flag code={c} size={13} /><span>{label}</span>{uiLang === l && <Icon name="check" size={16} />}
              </a>
            : <button key={l} type="button" role="menuitemradio" aria-checked={uiLang === l} className={uiLang === l ? 'on' : ''} lang={html} onClick={() => pick(l)}>
                <Flag code={c} size={13} /><span>{label}</span>{uiLang === l && <Icon name="check" size={16} />}
              </button>))}
        </div>
      )}
    </div>
  );
}
// Kept for old imports: the segmented control became the same dropdown (12 languages do not fit a segment).
export function LangSegment() { return <LangSwitch />; }

export function BrandIcon({ id, size = 28, mono }) {
  const b = LOGOS[id];
  if (!b) return null;
  const color = mono ? 'currentColor' : `#${b.hex === '000000' ? '0a0a0a' : b.hex}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} role="img" aria-label={b.title}>
      <path d={b.path} />
    </svg>
  );
}

export function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const f = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3>{title}</h3><IconButton icon="x" label="Close" onClick={onClose} /></div>
        {children}
      </div>
    </div>
  );
}


// In-app confirm (replaces window.confirm, which iOS standalone PWAs and automation handle badly).
// Usage: if (!(await askConfirm(text, { danger: true }))) return;
let confirmPush = null;
export function askConfirm(message, opts = {}) {
  if (!confirmPush) return Promise.resolve(window.confirm(message)); // eslint-disable-line no-alert
  return new Promise((resolve) => confirmPush({ message: String(message || ''), ...opts, resolve }));
}
function ConfirmHost() {
  const { t } = useI18n();
  const [q, setQ] = useState(null);
  useEffect(() => { confirmPush = (x) => setQ((old) => { old?.resolve(false); return x; }); return () => { confirmPush = null; }; }, []);
  const done = (v) => { q?.resolve(v); setQ(null); };
  return (
    <Modal open={!!q} onClose={() => done(false)} title={q?.title || t('common.confirm')}>
      <p className="confirm-msg" style={{ whiteSpace: 'pre-line', margin: '4px 0 16px' }}>{q?.message}</p>
      <div className="confirm-acts" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={() => done(false)}>{t('common.cancel')}</Button>
        <Button variant={q?.danger === false ? 'primary' : 'danger'} onClick={() => done(true)} autoFocus>{q?.ok || t('common.confirm')}</Button>
      </div>
    </Modal>
  );
}

const ToastCtx = createContext(() => {});
// Toasts: identical messages are de-duplicated (a repeat just restarts the timer), at most 2 visible (oldest dropped),
// auto-dismiss after ~4 s (errors 5 s), compact rounded rectangle with a real close button. Never stacks into a wall.
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef({});
  const close = useCallback((id) => { clearTimeout(timers.current[id]); delete timers.current[id]; setItems((l) => l.filter((x) => x.id !== id)); }, []);
  // push(text, kind?, { action: { label, onClick }, duration, onExpire }) — action toasts (e.g. 復原 / Undo) stay ~6 s.
  const push = useCallback((text, kind = 'ok', opts = {}) => {
    const msg = String(text ?? '').trim();
    if (!msg) return;
    const id = `${kind}|${msg}${opts.action ? `|${Date.now()}` : ''}`;
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => { close(id); opts.onExpire?.(); }, opts.duration || (opts.action ? 6000 : kind === 'err' ? 5000 : 4000));
    setItems((l) => {
      const rest = l.filter((x) => x.id !== id);
      const next = [...rest, { id, text: msg, kind, action: opts.action || null, onExpire: opts.onExpire || null }];
      next.slice(0, Math.max(0, next.length - 2)).forEach((x) => { clearTimeout(timers.current[x.id]); delete timers.current[x.id]; if (x.onExpire && !x.fired) { x.fired = true; setTimeout(x.onExpire, 0); } }); // Run 22: an evicted undo toast still commits
      return next.slice(-2);
    });
  }, [close]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <ConfirmHost />
      <div className="toasts" aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={`toast ${i.kind}`} role={i.kind === 'err' ? 'alert' : 'status'}>
            <Icon name={i.kind === 'err' ? 'alert' : 'check'} size={16} className="toast-ic" />
            <span className="toast-text">{i.text}</span>
            {i.action && <button type="button" className="toast-act" onClick={() => { close(i.id); i.action.onClick?.(); }}>{i.action.label}</button>}
            <button type="button" className="toast-x" aria-label="Close" onClick={() => { close(i.id); i.onExpire?.(); }}><Icon name="x" size={16} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// Initial letter by default; a custom profile picture (data URL, see src/lib/avatar.js) when the person set one.
export function Avatar({ name = '', size = 36, src = '', className = '' }) {
  const ch = Array.from(name.trim())[0] || '?';
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (src && !broken) return <span className={`avatar has-img ${className}`} style={style}><img src={src} alt="" draggable="false" onError={() => setBroken(true)} /></span>;
  return <span className={`avatar ${className}`} style={style}>{ch.toUpperCase()}</span>;
}

export function Progress({ value, max, calm }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max}><span style={{ width: `${pct}%` }} className={pct >= 90 && !calm ? 'hot' : ''} /></div>;
}
