// Math in chat markdown (AI 助理 / 功課導師): $…$, $$…$$, \(…\), \[…\] → KaTeX. Pure string pass, no DOM.
// - Code fences / inline code are left alone.
// - Currency is not math: "$50", "HK$1,280", "$5 and $10" (an opening $ must not follow a letter/digit, must be
//   followed by a non-space, the closing $ must follow a non-space and not be followed by a digit, and pure numbers are skipped).
// - Streaming-safe: an unclosed delimiter is simply left as text until its closing half arrives.
// extractMath(md) → { text, items }: text has placeholders KXMATH<n>KX (survive marked), items = [{ tex, display }].
const FENCE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g;
const PATTERNS = [
  [/\$\$([\s\S]+?)\$\$/g, true],
  [/\\\[([\s\S]+?)\\\]/g, true],
  [/\\\(([\s\S]+?)\\\)/g, false],
  [/(^|[^\\\w$])\$(?!\s)((?:\\\$|[^$\n])+?)(?<!\s)\$(?!\d)/g, false],
];
const NUMERIC = /^[\d\s.,]+$/;

export const hasMath = (s) => /\$[^$\n]+\$|\\\(|\\\[|\$\$/.test(String(s || ''));

export function extractMath(md) {
  const items = [];
  const parts = String(md || '').split(FENCE);
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return part; // code
    let s = part;
    for (const [re, display] of PATTERNS) {
      const two = re.source.startsWith('(^|');
      s = s.replace(re, (m, a, b) => {
        const lead = two ? a : '';
        const tex = String(two ? b : a).trim();
        if (!tex || (!display && NUMERIC.test(tex))) return m;
        items.push({ tex, display });
        return `${lead}KXMATH${items.length - 1}KX`;
      });
    }
    return s;
  });
  return { text: out.join(''), items };
}

// html (already sanitized) + items + katex → final html.
export function injectMath(html, items, katex) {
  return html.replace(/KXMATH(\d+)KX/g, (m, n) => {
    const it = items[+n];
    if (!it) return m;
    try {
      const r = katex.renderToString(it.tex, { displayMode: it.display, throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml', maxSize: 20, maxExpand: 200 });
      return it.display ? `<div class="math-block">${r}</div>` : `<span class="math-inline">${r}</span>`;
    } catch {
      return escapeHtml(it.display ? `$$${it.tex}$$` : `$${it.tex}$`);
    }
  });
}
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Without KaTeX loaded yet: show the source text (no flash of placeholders).
export const plainMath = (html, items) => html.replace(/KXMATH(\d+)KX/g, (m, n) => (items[+n] ? escapeHtml(items[+n].display ? `$$${items[+n].tex}$$` : `$${items[+n].tex}$`) : m));
