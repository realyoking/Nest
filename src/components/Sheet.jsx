// iOS-style bottom sheet on phones (drag handle, swipe down to close, safe-area + keyboard aware, scrollable body,
// sticky footer for actions); a centred dialog on wide screens. Portalled to <body> so it always sits above the tab
// bar (the routed page uses transforms for its push/pop animation, which would otherwise trap position:fixed).
// In the landing demo (useBe().demo) it renders inline so it stays inside the demo frame.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './ui.jsx';
import { useBe } from '../lib/be-context.jsx';

function useKeyboardInset(active) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' && window.visualViewport;
    if (!active || !vv) return undefined;
    const f = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    f(); vv.addEventListener('resize', f); vv.addEventListener('scroll', f);
    return () => { vv.removeEventListener('resize', f); vv.removeEventListener('scroll', f); };
  }, [active]);
  return inset;
}

export default function Sheet({ open, onClose, title, children, footer, className = '', label }) {
  const { demo } = useBe();
  const [dy, setDy] = useState(0);
  const start = useRef(null);
  const kb = useKeyboardInset(open);
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', f);
    const prev = document.body.style.overflow;
    if (!demo) document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = prev; };
  }, [open, onClose, demo]);
  useEffect(() => { if (!open) setDy(0); }, [open]);
  if (!open) return null;
  const onStart = (e) => { start.current = e.touches[0].clientY; };
  const onMove = (e) => { if (start.current == null) return; setDy(Math.max(0, e.touches[0].clientY - start.current)); };
  const onEnd = () => { if (dy > 90) onClose?.(); setDy(0); start.current = null; };
  const node = (
    <div className={`sheet-wrap ${demo ? 'in-demo' : ''}`} onClick={onClose} style={{ '--kb': `${kb}px` }}>
      <div className={`sheet ${footer ? 'has-foot' : 'no-foot'} ${className}`} role="dialog" aria-modal="true" aria-label={label || (typeof title === 'string' ? title : undefined)} onClick={(e) => e.stopPropagation()}
        style={dy ? { transform: `translateY(${dy}px)`, transition: 'none' } : undefined}>
        <div className="sheet-grab" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} aria-hidden="true"><span /></div>
        <div className="sheet-head" onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}>
          <h3>{title}</h3>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
  return demo ? node : createPortal(node, document.body);
}
