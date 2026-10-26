// 简体中文 safety net (loaded only when the UI language is zh-Hans): converts any remaining zh-Hant UI text in the
// DOM (inline strings that do not go through t(), toasts, attributes) to Simplified with opencc t2cn + wording fixes.
// Skips what the user typed or owns: inputs, textareas, contenteditable, the user's own chat bubbles, code, plugin
// frames, and anything inside [data-noconv]. React keeps working: it rewrites text nodes by value on its next render
// and the observer converts them again.
import { toHans } from './hans.js';

const SKIP = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], code, pre, script, style, iframe, .msg.user, [data-noconv]';
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const HAN = /[\u3400-\u9fff]/;

function skip(el) { return !el || (el.closest && el.closest(SKIP)); }
function convText(n) {
  const v = n.nodeValue;
  if (!v || !HAN.test(v) || skip(n.parentElement)) return;
  const h = toHans(v);
  if (h !== v) n.nodeValue = h;
}
function convAttrs(el) {
  if (skip(el)) return;
  for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v && HAN.test(v)) { const h = toHans(v); if (h !== v) el.setAttribute(a, h); } }
}
function walk(root) {
  if (root.nodeType === 3) return convText(root);
  if (root.nodeType !== 1 || skip(root)) return;
  convAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (n.nodeType === 3) convText(n); else convAttrs(n); }
}

export function startHansDom(root = document.body) {
  walk(root);
  if (HAN.test(document.title)) document.title = toHans(document.title);
  const mo = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') convText(m.target);
      else if (m.type === 'attributes') convAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  return () => mo.disconnect();
}
