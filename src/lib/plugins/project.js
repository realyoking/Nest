// Plugin Studio projects — pure helpers (browser + server + tests).
// A project = one plugin being built, with its own AI chat thread and version history (server: api/_plugins.js prj-*,
// stored under nestStudio/{uid}/projects/{id}, owner only). Every AI turn sends the model the CURRENT files plus the
// conversation (older turns condensed into a summary), so follow-ups edit the code in place instead of starting over.
import { parseReply, locate } from './reply.js';

export const PROJECT_LIMITS = { name: 60, turns: 80, turnText: 4000, summary: 3000, versions: 60, bundleJson: 420 * 1024, projects: 50, msg: 140 };
export const FILES = ['html', 'css', 'js'];
export const AI_CODE_LIMIT = 58000; // characters of current plugin JSON the model can be sent in one turn
const RECENT_TURNS = 8;

const clip = (v, n) => String(v ?? '').slice(0, n);
export const bundleJson = (b) => JSON.stringify({ manifest: b?.manifest || {}, html: String(b?.html || ''), css: String(b?.css || ''), js: String(b?.js || '') });
export const sameBundle = (a, b) => bundleJson(a) === bundleJson(b);
export function parseBundleJson(s) {
  try { const j = JSON.parse(s); if (j && typeof j === 'object') return { manifest: j.manifest && typeof j.manifest === 'object' ? j.manifest : {}, html: String(j.html || ''), css: String(j.css || ''), js: String(j.js || '') }; } catch {}
  return null;
}
// Server-side shape check of a working copy (it may be unfinished, so this is NOT validateBundle): strings only, size cap.
export function cleanWorkingBundle(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  const out = { manifest: b.manifest && typeof b.manifest === 'object' && !Array.isArray(b.manifest) ? b.manifest : {}, html: String(b.html ?? ''), css: String(b.css ?? ''), js: String(b.js ?? '') };
  return bundleJson(out).length <= PROJECT_LIMITS.bundleJson ? out : null;
}
export function cleanTurn(t) {
  if (!t || typeof t !== 'object') return null;
  const role = ['user', 'ai', 'edit', 'system'].includes(t.role) ? t.role : null;
  if (!role) return null;
  const text = clip(String(t.text || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' '), PROJECT_LIMITS.turnText).trim();
  if (!text) return null;
  const out = { role, text, at: Number(t.at) || Date.now() };
  if (t.err) out.err = true;
  if (Number.isInteger(t.v) && t.v > 0) out.v = t.v;
  if (Array.isArray(t.errors) && t.errors.length) out.errors = t.errors.slice(0, 4).map((e) => clip(e, 160));
  return out;
}
export const projectName = (s, fallback = 'Untitled') => clip(String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim(), PROJECT_LIMITS.name) || fallback;
export const nameFromPrompt = (prompt) => projectName(String(prompt || '').split(/[\n。.!！?？]/)[0].slice(0, 28));

// ---------- line diff (LCS; falls back to a coarse diff for very large inputs) ----------
export function diffLines(a = '', b = '') {
  const A = String(a).split('\n'); const B = String(b).split('\n');
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let ea = A.length; let eb = B.length;
  while (ea > s && eb > s && A[ea - 1] === B[eb - 1]) { ea--; eb--; }
  const head = A.slice(0, s).map((t) => ({ t: ' ', s: t }));
  const tail = A.slice(ea).map((t) => ({ t: ' ', s: t }));
  const a2 = A.slice(s, ea); const b2 = B.slice(s, eb);
  let mid = [];
  if (a2.length * b2.length > 4e6) mid = [...a2.map((x) => ({ t: '-', s: x })), ...b2.map((x) => ({ t: '+', s: x }))];
  else {
    const n = a2.length; const m = b2.length;
    const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a2[i] === b2[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0; let j = 0;
    while (i < n && j < m) {
      if (a2[i] === b2[j]) { mid.push({ t: ' ', s: a2[i] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { mid.push({ t: '-', s: a2[i] }); i++; }
      else { mid.push({ t: '+', s: b2[j] }); j++; }
    }
    while (i < n) mid.push({ t: '-', s: a2[i++] });
    while (j < m) mid.push({ t: '+', s: b2[j++] });
  }
  return [...head, ...mid, ...tail];
}
export const diffStats = (d) => ({ add: d.filter((x) => x.t === '+').length, del: d.filter((x) => x.t === '-').length });
// Collapse unchanged runs to `ctx` lines of context around changes: rows {t:' '|'+'|'-'|'…', s}.
export function compactDiff(d, ctx = 2) {
  const keep = d.map((x) => x.t !== ' ');
  const show = d.map((_, i) => { for (let k = Math.max(0, i - ctx); k <= Math.min(d.length - 1, i + ctx); k++) if (keep[k]) return true; return false; });
  const out = []; let gap = 0;
  d.forEach((x, i) => { if (show[i]) { if (gap) out.push({ t: '…', s: `${gap}` }); gap = 0; out.push(x); } else gap++; });
  if (gap) out.push({ t: '…', s: `${gap}` });
  return out;
}
const manifestText = (b) => JSON.stringify(b?.manifest || {}, null, 2);
// Per-file diff between two bundles: [{file, rows, add, del}] for files that changed.
export function bundleDiff(a, b) {
  const out = [];
  for (const f of ['manifest', ...FILES]) {
    const x = f === 'manifest' ? manifestText(a) : String(a?.[f] || ''); const y = f === 'manifest' ? manifestText(b) : String(b?.[f] || '');
    if (x === y) continue;
    const d = diffLines(x, y);
    out.push({ file: f, rows: compactDiff(d), ...diffStats(d) });
  }
  return out;
}
// One-line description of a manual edit (goes into the AI thread so the model knows the creator changed things by hand).
export function editNote(prev, next, lang = 'zh-Hant') {
  const parts = bundleDiff(prev, next).map((x) => `${x.file} +${x.add}/−${x.del}`);
  if (!parts.length) return '';
  return lang === 'en' ? `Edited by hand: ${parts.join(', ')}` : `手動修改：${parts.join('、')}`;
}

// ---------- model replies: full JSON, edits, or separate code fences (robust reader in reply.js) ----------
// Full: {"manifest","html","css","js","notes"}   Edits: {"edits":[{"file":"html|css|js","find","replace"}], "manifest"?: {...}, "notes"}
// readAiReply(text) → { reply, problem, detail }; parseAiReply(text) → reply | null (kept for older callers/tests).
export function readAiReply(text) {
  const r = parseReply(text);
  return r.ok ? { reply: r.reply, problem: '' } : { reply: null, problem: r.problem, detail: r.detail || '' };
}
export const parseAiReply = (text) => readAiReply(text).reply;
// Apply find/replace edits (exact first, then tolerant of line endings / whitespace). An empty `find` appends.
// → { ok, bundle } | { ok:false, failed:[{file, find}] }
export function applyEdits(bundle, edits = [], manifest = null) {
  const next = { manifest: manifest || bundle.manifest, html: String(bundle.html || ''), css: String(bundle.css || ''), js: String(bundle.js || '') };
  const failed = [];
  for (const e of edits) {
    if (!FILES.includes(e.file)) continue;
    if (!e.find) { next[e.file] += (next[e.file] && !next[e.file].endsWith('\n') ? '\n' : '') + e.replace; continue; }
    const at = locate(next[e.file], e.find);
    if (!at) { failed.push({ file: e.file, find: e.find.slice(0, 80) }); continue; }
    next[e.file] = next[e.file].slice(0, at.i) + e.replace + next[e.file].slice(at.i + at.len);
  }
  return failed.length ? { ok: false, failed } : { ok: true, bundle: next };
}
// Turn a model reply into the next bundle. `problem` (from readAiReply) is passed through when there is no reply.
export function nextBundleFromReply(cur, r, problem = '') {
  if (!r) return { ok: false, error: problem || 'unparsable' };
  if (r.kind === 'full') return { ok: true, bundle: repairBundle(r.bundle) };
  if (r.kind === 'files') {
    const manifest = r.manifest || cur?.manifest;
    if (!manifest) return { ok: false, error: 'no_manifest' };
    return { ok: true, bundle: repairBundle({ manifest, html: r.files.html ?? String(cur?.html || ''), css: r.files.css ?? String(cur?.css || ''), js: r.files.js ?? String(cur?.js || '') }) };
  }
  if (!cur) return { ok: false, error: 'edits_without_code' };
  if (!r.edits.length && !r.manifest) return { ok: false, error: 'no_change' };
  const a = applyEdits(cur, r.edits, r.manifest);
  return a.ok ? { ok: true, bundle: repairBundle(a.bundle) } : { ok: false, error: 'edit_failed', failed: a.failed };
}
// One silent retry per AI turn, with a stricter instruction chosen by what went wrong.
export function retryNoteFor(nb, { hasCode = true } = {}) {
  const e = nb?.error || '';
  if (e === 'edit_failed') {
    const miss = (nb.failed || []).slice(0, 3).map((f) => `${f.file}: "${f.find.replace(/\s+/g, ' ').slice(0, 60)}"`).join('; ');
    return `${RETRY_FULL}${miss ? ` (Not found: ${miss}.)` : ''}`;
  }
  if (e === 'truncated') return hasCode
    ? 'Your previous reply was cut off before the JSON ended. Reply again, SHORTER: prefer {"edits":[...]} with small exact find/replace edits (copy each "find" exactly from the current files), keep "notes" to one sentence. Output ONLY the JSON object.'
    : 'Your previous reply was cut off before the JSON ended. Reply again with a SMALLER plugin (compact code, under 15 KB, no comments, no repeated CSS), notes one sentence. Output ONLY the JSON object.';
  if (e === 'no_change') return 'Your previous reply contained no usable edits. Make the change the creator asked for: reply {"edits":[{"file":"html"|"css"|"js","find":"exact current text","replace":"new text"}],"notes":"..."} or the COMPLETE plugin JSON.';
  return 'Your previous reply could not be read. Reply with ONLY one JSON object: the first character must be { and the last }, no markdown fence, no text before or after. Escape strings properly (\\n for new lines, \\" for quotes inside html/js). Use either the COMPLETE plugin {"manifest","html","css","js","notes"} or {"edits":[{"file","find","replace"}],"notes"}.';
}
// Error → string key + params for the Studio chat (specific text instead of one generic failure line).
const ERR_KEYS = ['truncated', 'not_json', 'unparsable', 'prose', 'empty', 'no_manifest', 'edit_failed', 'no_change', 'edits_without_code', 'stalled', 'stream_failed', 'network'];
export function aiErrorKey(e = {}) {
  if (e.code === 'limit_reached') return { key: 'chat.limit', params: {} };
  const why = e.code === 'bad_reply' ? e.why : e.code;
  if (why === 'edit_failed') { const f = (e.failed || [])[0] || {}; return { key: 'prj.aiErr.edit_failed', params: { file: f.file || 'js', find: String(f.find || '').replace(/\s+/g, ' ').trim().slice(0, 40) + (String(f.find || '').length > 40 ? '…' : '') } }; }
  if (why === 'prose') return { key: 'prj.aiErr.prose', params: { d: String(e.detail || '').slice(0, 80) } };
  if (ERR_KEYS.includes(why)) return { key: `prj.aiErr.${why}`, params: {} };
  return { key: 'prj.aiErr.server', params: { code: String(why || e.status || 'error').slice(0, 30) } };
}
// Problems worth that one retry (network / limit errors are not retried here).
export const RETRYABLE = ['unparsable', 'empty', 'prose', 'not_json', 'truncated', 'no_manifest', 'edit_failed', 'no_change', 'stalled', 'stream_failed'];
// The model sometimes forgets `capabilities` (or writes a string / an alias) for a plugin that clearly has UI code, which made
// the preview stay blank ("declare at least one capability"). Repair only that: a coded plugin with no usable capability becomes a
// tab (widget when only a widget block is given); a string becomes a one-item list; aliases map to the real names.
const CAP_ALIAS = { page: 'tab', tabs: 'tab', app: 'tab', ui: 'tab', screen: 'tab', home: 'widget', card: 'widget', widgets: 'widget', themes: 'theme', fonts: 'font' };
const CAP_OK = ['theme', 'font', 'background', 'tab', 'widget', 'automation'];
export function repairBundle(b) {
  if (!b || !b.manifest || typeof b.manifest !== 'object') return b;
  const m = { ...b.manifest };
  let caps = m.capabilities;
  if (typeof caps === 'string') caps = caps.split(/[\s,]+/);
  caps = (Array.isArray(caps) ? caps : []).map((c) => String(c || '').trim().toLowerCase()).map((c) => CAP_ALIAS[c] || c).filter(Boolean);
  const hasCode = !!(String(b.html || '').trim() || String(b.js || '').trim());
  if (!caps.some((c) => CAP_OK.includes(c))) {
    if (m.widget && !m.tab && hasCode) caps.push('widget');
    else if (hasCode || m.tab) caps.push('tab');
  }
  caps = [...new Set(caps)];
  if (caps.includes('tab') && (!m.tab || typeof m.tab !== 'object')) m.tab = { title: String(m.name || 'Plugin').slice(0, 20), titleZh: m.nameZh ? String(m.nameZh).slice(0, 12) : undefined, icon: 'sparkle' };
  if (JSON.stringify(caps) === JSON.stringify(b.manifest.capabilities) && m.tab === b.manifest.tab) return b;
  return { ...b, manifest: { ...m, capabilities: caps } };
}

// ---------- context ----------
// Condense turns into a short summary (deterministic, no model call): every creator request + the result notes, newest last.
export function summarizeTurns(turns = [], prev = '', max = PROJECT_LIMITS.summary) {
  const lines = turns.map((t) => (t.role === 'user' ? `- Asked: ${t.text.replace(/\s+/g, ' ').slice(0, 160)}` : t.role === 'edit' ? `- ${t.text.slice(0, 120)}` : t.role === 'ai' && !t.err ? `  → ${t.text.replace(/\s+/g, ' ').slice(0, 120)}` : '')).filter(Boolean);
  let out = [prev, ...lines].filter(Boolean).join('\n');
  if (out.length > max) out = `…\n${out.slice(out.length - max + 2)}`;
  return out;
}
// Split the thread: older turns go into the summary, the last RECENT_TURNS stay verbatim.
export function contextParts(turns = [], summary = '', summarizedUpTo = 0) {
  const real = turns.filter((t) => t.role !== 'system');
  const cut = Math.max(0, real.length - RECENT_TURNS);
  const older = real.slice(Math.min(summarizedUpTo, cut), cut);
  return { summary: older.length ? summarizeTurns(older, summary) : summary, summarizedUpTo: Math.max(summarizedUpTo, cut), recent: real.slice(cut) };
}
// Messages for /api/chat mode 'plugin'. One context message (summary + recent conversation + current files), an ack, the request.
// summary / recent come from contextParts(turns, project.summary, project.sumN).
export function buildAiMessages({ bundle, summary: sum = '', recent = [], prompt, retryNote = '' }) {
  const conv = recent.map((t) => (t.role === 'user' ? `Creator: ${t.text}` : t.role === 'edit' ? `(${t.text})` : `You: ${t.err ? '(failed)' : t.text}`)).join('\n').slice(-6000);
  const code = bundle ? bundleJson(bundle) : '';
  const tooBig = code.length > AI_CODE_LIMIT;
  const ctx = [
    'PROJECT CONTEXT — you are continuing work on this plugin. Edit the CURRENT files; keep everything the creator did not ask to change (same id, keep their manual edits).',
    sum && `Summary of earlier conversation:\n${sum}`,
    conv && `Recent conversation:\n${conv}`,
    bundle ? (tooBig ? `CURRENT PLUGIN is too large to send in full (${Math.round(code.length / 1024)} KB). Manifest:\n${JSON.stringify(bundle.manifest)}\nFirst part of the files:\n${code.slice(0, AI_CODE_LIMIT - 4000)}` : `CURRENT PLUGIN (JSON):\n${code}`) : 'There is no code yet: create the first version.',
  ].filter(Boolean).join('\n\n');
  return {
    tooBig,
    messages: [
      { role: 'user', content: ctx },
      { role: 'assistant', content: bundle ? 'OK. I have the current files and will change only what is asked.' : 'OK.' },
      { role: 'user', content: retryNote ? `${prompt}\n\n${retryNote}` : prompt },
    ],
  };
}
export const RETRY_FULL = 'Your previous reply used "edits" that could not be applied (the "find" text was not found exactly). Reply with the COMPLETE plugin JSON (manifest, html, css, js, notes) this time.';

// ---------- versions ----------
export function bumpPatch(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)\.(\d+)$/);
  return m ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : '1.0.1';
}
// Before 提交更新: the submitted version string must differ from the live one (bumped automatically).
export const versionForSubmit = (draftVersion, liveVersion) => (liveVersion && draftVersion === liveVersion ? bumpPatch(liveVersion) : draftVersion || '1.0.0');
export const cleanChangelog = (s) => clip(String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim(), 500);
