// Creator Studio — reading the model's reply robustly (browser + tests; pure JS, no imports from the app).
// The model is asked for ONE JSON object (full plugin, or {"edits":[…]}), but real replies drift:
//   • a ```json fence with prose around it, or the JSON split over several fences;
//   • raw newlines / tabs inside JSON strings, // comments, unescaped " inside html, invalid escapes (\' \` \$), trailing commas, smart quotes as delimiters;
//   • the reply cut off mid-string (long code, dropped stream) → partial JSON;
//   • separate ```html / ```css / ```js fences instead of JSON (+ optional manifest JSON);
//   • find/replace as <<<<<<< SEARCH … ======= … >>>>>>> REPLACE blocks, or edit objects with alias keys
//     ("javascript", "style", "search"/"old", "new"/"replacement");
//   • "find" text that differs from the file only in whitespace / line endings.
// parseReply(text) → { ok:true, reply } | { ok:false, problem, detail }
//   reply = { kind:'full', bundle, notes, repaired? } | { kind:'edits', edits, manifest, notes, repaired? }
//         | { kind:'files', files:{html?,css?,js?}, manifest, notes }
//   problem = 'empty' | 'prose' | 'not_json' | 'truncated' | 'no_manifest'
export const FILES = ['html', 'css', 'js'];
const clip = (v, n) => String(v ?? '').slice(0, n);
const FILE_ALIAS = { html: 'html', htm: 'html', markup: 'html', body: 'html', 'index.html': 'html', css: 'css', style: 'css', styles: 'css', 'style.css': 'css', js: 'js', javascript: 'js', script: 'js', 'script.js': 'js', 'main.js': 'js', 'app.js': 'js', 'index.js': 'js' };
export const normFile = (f) => FILE_ALIAS[String(f || '').trim().toLowerCase()] || '';

// ---------- JSON repair ----------
// One pass over the text: escape raw control chars inside strings, drop invalid escapes, remove trailing commas,
// treat “ ” as quotes only where a string delimiter is structurally expected, and close what a cut-off reply left open.
export function repairJson(src) {
  const s = String(src || '');
  let out = ''; let inStr = false; let smart = false; let esc = false; const stack = []; let changed = false;
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
        if ('"\\/bfnrtu'.includes(c)) { out += c; continue; }
        // invalid JSON escape (\' \` \$ \< …): keep the character, drop the backslash
        out = out.slice(0, -1) + c; changed = true; continue;
      }
      if (c === '\\') { esc = true; out += c; continue; }
      if (c === '"' && !smart) {
        // An unescaped quote inside code (<div class="x">) is not the end of the string unless JSON structure follows.
        let k = i + 1; while (k < s.length && /\s/.test(s[k])) k++;
        if (k < s.length && !',}]:'.includes(s[k])) { out += '\\"'; changed = true; continue; }
        inStr = false; out += c; continue;
      }
      if (smart && c === '”') { inStr = false; smart = false; out += '"'; continue; }
      if (smart && c === '"') { out += '\\"'; changed = true; continue; }
      if (c === '\n') { out += '\\n'; changed = true; continue; }
      if (c === '\r') { out += '\\r'; changed = true; continue; }
      if (c === '\t') { out += '\\t'; changed = true; continue; }
      if (c < ' ') { out += `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`; changed = true; continue; }
      out += c; continue;
    }
    if (c === '/' && s[i + 1] === '/') { const n = s.indexOf('\n', i); i = n < 0 ? s.length : n - 1; changed = true; continue; }
    if (c === '/' && s[i + 1] === '*') { const n = s.indexOf('*/', i + 2); i = n < 0 ? s.length : n + 1; changed = true; continue; }
    if (c === '“') { inStr = true; smart = true; out += '"'; changed = true; continue; }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === '{' || c === '[') { stack.push(c === '{' ? '}' : ']'); out += c; continue; }
    if (c === '}' || c === ']') {
      const t = out.replace(/\s+$/, '');
      if (t.endsWith(',')) { out = t.slice(0, -1); changed = true; }
      if (stack.length && stack[stack.length - 1] === c) stack.pop();
      out += c;
      if (!stack.length) return { text: out, changed, truncated: false, rest: s.slice(i + 1) };
      continue;
    }
    out += c;
  }
  // Reached the end with things still open → the reply was cut off.
  let tail = out;
  const truncated = inStr || stack.length > 0;
  if (truncated) {
    if (esc) tail = tail.slice(0, -1);
    if (inStr) tail += '"';
    tail = tail.replace(/,\s*$/, '').replace(/:\s*$/, ': null').replace(/,\s*"[^"]*"\s*$/, '');
    for (let k = stack.length - 1; k >= 0; k--) { tail = tail.replace(/,\s*$/, ''); tail += stack[k]; }
  }
  return { text: tail, changed: changed || truncated, truncated, rest: '' };
}
// Parse the first JSON object starting at text[start]; repairs if needed. → { value, truncated, repaired } | null
export function parseJsonAt(text, start) {
  const raw = text.slice(start);
  const end = matchBrace(raw);
  if (end > 0) { try { return { value: JSON.parse(raw.slice(0, end)), truncated: false, repaired: false }; } catch {} }
  const r = repairJson(raw);
  try { return { value: JSON.parse(r.text), truncated: r.truncated, repaired: r.changed }; } catch { return null; }
}
// Index just after the brace that closes text[0] (string-aware), or -1.
function matchBrace(t) {
  let d = 0; let inS = false; let e = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inS) { if (e) e = false; else if (c === '\\') e = true; else if (c === '"') inS = false; continue; }
    if (c === '"') inS = true; else if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') { d--; if (!d) return i + 1; }
  }
  return -1;
}

// ---------- fences / search-replace blocks ----------
export function fences(text) {
  const out = []; const re = /```[ \t]*([A-Za-z0-9_.+-]*)[^\n]*\n([\s\S]*?)(?:```|$)/g; let m;
  while ((m = re.exec(text))) { out.push({ lang: m[1].toLowerCase(), body: m[2].replace(/\n$/, ''), closed: m[0].endsWith('```') && m[0].length > 6 }); if (!m[0].length) re.lastIndex++; }
  return out;
}
// <<<<<<< SEARCH … ======= … >>>>>>> REPLACE, with the file named on the marker line or on the nearest line above it.
export function searchReplaceBlocks(text) {
  const re = /(?:^|\n)([^\n]*)\n?<{5,9}\s*SEARCH[^\n]*\n([\s\S]*?)\n?={5,9}[^\n]*\n([\s\S]*?)\n?>{5,9}\s*REPLACE/g;
  const out = []; let m; let lastFile = '';
  while ((m = re.exec(text))) {
    const head = `${m[1]} ${text.slice(Math.max(0, m.index - 120), m.index)}`;
    const fm = head.match(/(?:file|檔案)?\s*[:：]?\s*`?\b(index\.html|style\.css|script\.js|html|css|js|javascript)\b`?/gi);
    const f = fm ? normFile(fm[fm.length - 1].replace(/^(?:file|檔案)?\s*[:：]?\s*`?|`$/gi, '').trim()) : '';
    const file = f || lastFile; lastFile = file;
    out.push({ file, find: m[2], replace: m[3] });
  }
  return out;
}

const looksManifest = (o) => !!o && typeof o === 'object' && !Array.isArray(o) && typeof o.id === 'string' && ('name' in o || 'capabilities' in o || 'version' in o);
function cleanEdits(list) {
  return (Array.isArray(list) ? list : []).map((e) => {
    if (!e || typeof e !== 'object') return null;
    const file = normFile(e.file ?? e.path ?? e.filename ?? e.target);
    const find = e.find ?? e.search ?? e.old ?? e.from ?? e.before;
    const replace = e.replace ?? e.replacement ?? e.new ?? e.to ?? e.after ?? e.with;
    if (!file || typeof find !== 'string' || typeof replace !== 'string') return null;
    return { file, find, replace };
  }).filter(Boolean).slice(0, 40);
}
function fromObject(j, extra = {}) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return null;
  const notes = clip(j.notes ?? j.note ?? j.summary ?? '', 600);
  const edits = j.edits ?? j.changes ?? j.patches;
  if (Array.isArray(edits)) {
    const list = cleanEdits(edits);
    if (list.length || !('manifest' in j)) return { kind: 'edits', edits: list, manifest: looksManifest(j.manifest) ? j.manifest : null, notes, ...extra };
  }
  let m = j.manifest; let src = j;
  if (!looksManifest(m) && j.plugin && typeof j.plugin === 'object') { src = j.plugin; m = j.plugin.manifest; }
  if (!looksManifest(m) && j.files && typeof j.files === 'object') { src = { ...j, ...Object.fromEntries(Object.entries(j.files).map(([k, v]) => [normFile(k), v])) }; }
  if (!looksManifest(m)) {
    // files without a manifest → keep the current manifest (the caller has it)
    const files = Object.fromEntries(FILES.filter((f) => typeof src[f] === 'string').map((f) => [f, src[f]]));
    if (Object.keys(files).length) return { kind: 'files', files, manifest: null, notes, ...extra };
    return null;
  }
  return { kind: 'full', bundle: { manifest: m, html: String(src.html ?? ''), css: String(src.css ?? ''), js: String(src.js ?? '') }, notes, ...extra };
}

export function parseReply(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) return { ok: false, problem: 'empty' };
  const fs = fences(t);
  let sawTruncated = false; let sawJson = false; let sawObj = false;
  // 1. JSON candidates: json-ish fences first, then the raw text from its first "{".
  const cands = [];
  for (const f of fs) if (['json', 'json5', ''].includes(f.lang) && /^\s*\{/.test(f.body)) cands.push({ s: f.body.trim(), fence: f });
  const a = t.indexOf('{'); if (a >= 0) cands.push({ s: t.slice(a) });
  for (const c of cands) {
    const p = parseJsonAt(c.s, 0);
    if (!p) continue;
    sawJson = true;
    const truncated = p.truncated || (c.fence && !c.fence.closed && !p.value);
    const r = fromObject(p.value, p.repaired ? { repaired: true } : {});
    if (!r) { if (p.value && typeof p.value === 'object') sawObj = true; if (truncated) sawTruncated = true; continue; }
    if (p.truncated) { sawTruncated = true; continue; } // never apply code from a reply that was cut off
    // A manifest-only JSON fence next to ```html/```css/```js fences.
    if (r.kind === 'files' || (r.kind === 'full' && !r.bundle.html && !r.bundle.css && !r.bundle.js)) {
      const ff = codeFences(fs);
      if (Object.keys(ff.files).length) {
        if (ff.truncated) { sawTruncated = true; continue; }
        return { ok: true, reply: { kind: 'files', files: { ...(r.kind === 'files' ? r.files : {}), ...ff.files }, manifest: r.kind === 'full' ? r.bundle.manifest : null, notes: r.notes || prose(t) } };
      }
    }
    return { ok: true, reply: r };
  }
  // 2. Search/replace blocks.
  const sr = searchReplaceBlocks(t).filter((e) => e.file);
  if (sr.length) return { ok: true, reply: { kind: 'edits', edits: sr.slice(0, 40), manifest: null, notes: clip(prose(t), 600) } };
  // 3. Separate code fences.
  const ff = codeFences(fs);
  if (Object.keys(ff.files).length) {
    if (ff.truncated) return { ok: false, problem: 'truncated' };
    return { ok: true, reply: { kind: 'files', files: ff.files, manifest: null, notes: clip(prose(t), 600) } };
  }
  if (sawTruncated) return { ok: false, problem: 'truncated' };
  if (sawObj) return { ok: false, problem: 'no_manifest' };
  if (sawJson || a >= 0) return { ok: false, problem: 'not_json' };
  return { ok: false, problem: 'prose', detail: clip(t.replace(/\s+/g, ' '), 120) };
}
function codeFences(fs) {
  const files = {}; let truncated = false;
  for (const f of fs) { const k = normFile(f.lang); if (!k) continue; files[k] = files[k] ? `${files[k]}\n${f.body}` : f.body; if (!f.closed) truncated = true; }
  return { files, truncated };
}
// Text outside fences (used as notes for fence / search-replace replies).
const prose = (t) => t.replace(/```[\s\S]*?(```|$)/g, ' ').replace(/<{5,}[\s\S]*?>{5,}\s*REPLACE/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

// ---------- applying edits ----------
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Find `find` in `src`: exact → line endings normalised → trimmed → whitespace-insensitive. → { i, len } | null
export function locate(src, find) {
  let i = src.indexOf(find); if (i >= 0) return { i, len: find.length };
  const f2 = find.replace(/\r\n?/g, '\n'); i = src.indexOf(f2); if (i >= 0) return { i, len: f2.length };
  const f3 = f2.trim(); if (f3 && f3 !== f2) { i = src.indexOf(f3); if (i >= 0) return { i, len: f3.length }; }
  if (!f3 || f3.length < 4) return null;
  const parts = f3.split(/\s+/).map(escRe);
  try {
    const re = new RegExp(parts.join('\\s+'));
    const m = re.exec(src);
    if (m) return { i: m.index, len: m[0].length };
    const re2 = new RegExp(f3.split(/(\s+|\b)/).filter((x) => x && x.trim()).map(escRe).join('\\s*'));
    const m2 = re2.exec(src);
    if (m2) return { i: m2.index, len: m2[0].length };
  } catch {}
  return null;
}
