// Signature motion: text slides up out of a motion blur, staggered per word (Latin) or per character (CJK).
import { createElement, useEffect, useRef, useState } from 'react';

function useInView(once = true) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); if (once) io.disconnect(); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    io.observe(el);
    // Safety net: if the observer never reports (old WebKit, odd scroll containers), show the content anyway.
    const fb = setTimeout(() => setSeen(true), 3500);
    return () => { io.disconnect(); clearTimeout(fb); };
  }, [once]);
  return [ref, seen];
}

const CJK = /[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]/;
function tokens(text) {
  const out = [];
  for (const part of String(text).split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { out.push({ space: true, t: part }); continue; }
    if (CJK.test(part)) {
      // One token per character; punctuation sticks to the character before it.
      const local = [];
      for (const c of Array.from(part)) {
        if (/[，。、！？：；」』）》,.!?]/.test(c) && local.length) local[local.length - 1] += c;
        else local.push(c);
      }
      local.forEach((t) => out.push({ t }));
    } else out.push({ t: part });
  }
  return out;
}

export function BlurText({ text, as = 'span', className = '', delay = 0, step, lines }) {
  const [ref, seen] = useInView();
  // Large CJK headlines read cleaner without the trailing full stop.
  const src = (lines || [text]).map((l) => String(l ?? '').replace(/。$/, ''));
  let i = 0;
  const content = src.map((line, li) => {
    const toks = tokens(line);
    const isCjk = CJK.test(line);
    const st = step ?? (isCjk ? 34 : 70);
    return (
      <span className="bt-line" key={li}>
        {toks.map((tk, k) => tk.space ? ' ' : (
          <span key={k} className="bt-w" style={{ transitionDelay: `${delay + (i++) * st}ms` }}>{tk.t}</span>
        ))}
      </span>
    );
  });
  return createElement(as, { ref, className: `bt ${seen ? 'in' : ''} ${className}` }, content);
}

// Block reveal for sections/cards.
export function Reveal({ children, as = 'div', className = '', delay = 0, ...rest }) {
  const [ref, seen] = useInView();
  return createElement(as, { ref, className: `rv ${seen ? 'in' : ''} ${className}`, style: { transitionDelay: `${delay}ms` }, ...rest }, children);
}
