// ASCII-art drawing guard (Run 8b wrap-up, 2026-10-19). Pure + unit-tested (test/ascii-guard.test.mjs).
// api/chat.js: when the user asked to DRAW and the finished reply has no nest-ui / nest-svg block but draws with
// text characters inside a code block, the server re-asks the model ONCE (non-stream, ≤ 15 s) for a nest-ui block and,
// only if that answer really contains a visual block and no ASCII art, replaces the reply (`{"nest":"reset"}`).
export const DRAW_ASK_RE = /畫|繪|画|绘|示意圖|示意图|圖解|图解|\bdraw|\bsketch|\bdiagram|\billustrat/i;

// Fences whose language says "this is real code" are never treated as drawings.
const CODE_LANGS = /^(js|javascript|jsx|ts|typescript|tsx|py|python|java|c|cpp|c\+\+|cs|csharp|go|rust|rb|ruby|php|swift|kotlin|sql|sh|bash|zsh|shell|ps1|powershell|html|css|scss|json|yaml|yml|xml|toml|md|markdown|latex|tex|lua|r|dart|scala|vb|matlab|nest-ui|nest-svg|nest-actions|svg|mermaid)$/i;
const ART = /[\\/|_\-+*=<>^~#.·:'`()[\]{}oOxX─│┌┐└┘├┤┬┴┼═║╔╗╚╝→←↑↓↗↘↙↖▲▼◀▶●○■□]/;
const SLASHY = /[\\/|─│┌┐└┘├┤┬┴┼═║╔╗╚╝→←↑↓↗↘↙↖]/;

// Is this fenced block (language + body) a drawing made of text characters?
export function isAsciiArt(lang, body) {
  if (CODE_LANGS.test(String(lang || '').trim())) return false;
  const lines = String(body || '').split('\n').filter((l) => l.trim());
  if (lines.length < 3) return false;
  let art = 0, other = 0, slashLines = 0, leading = 0;
  for (const l of lines) {
    for (const ch of l.replace(/\s/g, '')) { if (ART.test(ch)) art++; else other++; }
    if (SLASHY.test(l) || /-{6,}|_{6,}|={6,}/.test(l)) slashLines++;
    if (/^\s{4,}\S/.test(l)) leading++;
  }
  // Real code has keywords / semicolons / assignments in most lines; a drawing is mostly symbols, slanted lines and indents.
  const codey = lines.filter((l) => /;\s*$|\b(function|return|const|let|var|def|class|import|print|if|for|while)\b|=>|\w+\(.*\)\s*[{:]?\s*$/.test(l)).length;
  if (codey >= Math.ceil(lines.length / 2)) return false;
  const ratio = art / Math.max(1, art + other);
  return slashLines >= 2 && (ratio >= 0.35 || (ratio >= 0.2 && leading >= Math.ceil(lines.length / 2)));
}

const FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;
// Reply draws with ASCII art (and has no real visual block)?
export function hasAsciiDrawing(text) {
  const s = String(text || '');
  if (/```nest-(ui|svg)/.test(s)) return false;
  for (const m of s.matchAll(FENCE_RE)) if (isAsciiArt(m[1], m[2])) return true;
  return false;
}
export const hasVisualBlock = (text) => /```nest-(ui|svg)\s*\n[\s\S]*?```/.test(String(text || ''));

// Should the server re-ask? (user asked to draw, visuals allowed, reply drew in ASCII.)
export const needsRedraw = ({ mode, lastUser, content, visualsOn = true }) =>
  !!visualsOn && (mode === 'chat' || mode === 'tutor') && DRAW_ASK_RE.test(String(lastUser || '')) && hasAsciiDrawing(content);

export const REDRAW_NOTE = 'SYSTEM CHECK: your reply above drew the picture with ASCII art / text characters inside a code block. The Nest app cannot show that as a drawing. Reply again with the same explanation, but draw it with ONE ```nest-ui``` block (strict JSON, as in the visual rules above) — or ```nest-svg``` for a simple illustration — and NO ASCII art or code block for the drawing. Keep the same language as before.';

// Run 10: flash sometimes continues a reply with a hallucinated "<system> [system] 以下是…" block (prompt-shaped text the
// user must never see). Cut the reply at the first such line (outside code fences is not checked: the marker is never code).
export const LEAK_RE = /\n[ \t]*(<\/?system>|\[system\]|<\|im_start\|>|<\|system\|>)/i;
export function cutLeak(text) {
  if (typeof text !== 'string') return text;
  const m = LEAK_RE.exec(text);
  return m ? text.slice(0, m.index).replace(/\s+$/, '') : text;
}
