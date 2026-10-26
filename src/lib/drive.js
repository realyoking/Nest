// Run 24: 全家檔案 (family drive) — folders, in-app documents and uploaded files of any type.
// Storage (no new Vercel function, no paid service): Firestore through the service account, routed by api/ops.js
// (/api/app/drive). Item metadata in families/{fid}/drive/{id}; file bytes split into ≤512 KB Firestore Bytes chunks in
// families/{fid}/driveChunks/{id}_{n}. Neither collection has a client rule, so only the server (after a membership
// check) can read or write them. Firestore's free tier (1 GiB stored) is shared by every family, hence the limits below.
// The op logic here is pure and store-agnostic: the server wires a Firestore REST store, the mock build an in-memory one.
export const LIMITS = { fileMax: 8 * 1024 * 1024, familyMax: 50 * 1024 * 1024, chunk: 512 * 1024, docMax: 200 * 1024, items: 500, nameMax: 120, depth: 8 };
export const KINDS = ['folder', 'doc', 'image', 'pdf', 'video', 'audio', 'office', 'archive', 'other'];
const ADULT = new Set(['parent', 'grandparent']);

export function kindOf(name = '', mime = '') {
  const m = String(mime).toLowerCase(), ext = String(name).toLowerCase().split('.').pop();
  if (m.startsWith('image/') || /^(png|jpe?g|gif|webp|heic|heif|bmp|svg|avif)$/.test(ext)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('video/') || /^(mp4|mov|webm|m4v|avi|mkv)$/.test(ext)) return 'video';
  if (m.startsWith('audio/') || /^(mp3|m4a|wav|aac|ogg|flac|opus)$/.test(ext)) return 'audio';
  if (/^(docx?|xlsx?|pptx?|odt|ods|odp|rtf|csv|key|pages|numbers)$/.test(ext) || /officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(m)) return 'office';
  if (/^(zip|rar|7z|tar|gz|tgz)$/.test(ext) || /zip|compressed|x-tar|gzip/.test(m)) return 'archive';
  return 'other';
}
export const cleanName = (s, max = LIMITS.nameMax) => String(s || '').replace(/[\u0000-\u001f\u007f/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const chunkCount = (size, chunk = LIMITS.chunk) => Math.max(1, Math.ceil(size / chunk));
export const usedBytes = (items) => items.filter((x) => x.kind !== 'folder').reduce((n, x) => n + (Number(x.size) || 0), 0);
export const childrenOf = (items, parent = '') => items.filter((x) => (x.parent || '') === (parent || ''));
export function descendants(items, id) {
  const out = new Set(); const q = [id];
  while (q.length) { const p = q.shift(); for (const x of items) if (x.parent === p && !out.has(x.id)) { out.add(x.id); q.push(x.id); } }
  return out;
}
export function pathOf(items, id) {
  const by = new Map(items.map((x) => [x.id, x])); const out = []; let cur = by.get(id); let n = 0;
  while (cur && n++ < 50) { out.unshift(cur); cur = cur.parent ? by.get(cur.parent) : null; }
  return out;
}
export const depthOf = (items, id) => (id ? pathOf(items, id).length : 0);
export const canEditItem = (item, { uid, member, isOwner }) => !!isOwner || ADULT.has(member?.role) || (!!item && item.createdBy === uid);
export const canAdd = ({ member, isOwner }) => !!isOwner || (member?.role || '') !== 'guest';
export const SORTS = ['name', 'date', 'size', 'type'];
export function sortItems(items, by = 'name', dir = 'asc', locale = 'zh-Hant') {
  const coll = new Intl.Collator(locale === 'en' ? 'en' : locale === 'th' ? 'th' : 'zh-Hant-HK', { numeric: true, sensitivity: 'base' });
  const k = (x) => (by === 'date' ? Number(x.updatedAt || x.createdAt || 0) : by === 'size' ? Number(x.size || 0) : 0);
  const s = [...items].sort((a, b) => {
    if ((a.kind === 'folder') !== (b.kind === 'folder')) return a.kind === 'folder' ? -1 : 1; // folders first, always
    let r = by === 'name' ? coll.compare(a.name, b.name) : by === 'type' ? coll.compare(a.kind, b.kind) || coll.compare(a.name, b.name) : k(a) - k(b);
    if (!r) r = coll.compare(a.name, b.name);
    return dir === 'desc' ? -r : r;
  });
  return s;
}
export function searchItems(items, q) {
  const ql = String(q || '').trim().toLowerCase(); if (!ql) return items;
  return items.filter((x) => `${x.name} ${x.text || ''}`.toLowerCase().includes(ql));
}
// plain-text extract of an in-app document (for search + previews)
export const docText = (html) => String(html || '').replace(/<(br|\/p|\/li|\/h\d|\/div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
// server-side allow-list sanitiser for in-app documents (the client also runs DOMPurify before rendering)
export function sanitizeDoc(html) {
  let s = String(html || '').slice(0, LIMITS.docMax);
  s = s.replace(/<(script|style|iframe|object|embed|link|meta|svg|math|form|input|textarea|button|select)[\s\S]*?(<\/\1>|$)/gi, '');
  s = s.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag, attrs) => {
    const t = tag.toLowerCase(); const ok = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'div', 'span', 'hr'];
    if (!ok.includes(t)) return '';
    if (m.startsWith('</')) return `</${t}>`;
    const cls = /data-check="(0|1)"/.exec(attrs); // checklist items keep their state
    return t === 'li' && cls ? `<li data-check="${cls[1]}">` : `<${t}>`;
  });
  return s;
}

// ---------- ops (store-agnostic) ----------
// store: { list(fid) → items[], get(fid,id), put(fid,id,data), del(fid,id), putChunk/getChunk/delChunk(fid,id,n[,b64]), putHtml/getHtml/delHtml(fid,id[,html]) }
// (document HTML lives beside the chunks so listing the drive stays small)
// ctx: { fid, uid, member, isOwner, now }
const err = (status, error, extra = {}) => ({ status, body: { error, ...extra } });
const ok = (body) => ({ status: 200, body: { ok: true, ...body } });
const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const pub = (x) => { const { html, recv, ...rest } = x; return rest; };
const STALE = 30 * 60e3;
// removes one item with every stored piece (all chunks, document HTML, metadata)
async function removeItem(store, fid, y) {
  const ns = Array.from({ length: Number(y.chunks) || 0 }, (_, n) => n);
  for (let i = 0; i < ns.length; i += 8) await Promise.all(ns.slice(i, i + 8).map((n) => store.delChunk(fid, y.id, n))); // 8 at a time
  if (y.kind === 'doc') await store.delHtml(fid, y.id);
  await store.del(fid, y.id);
}
export const b64Bytes = (data) => Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
export async function driveOp(store, ctx, body = {}) {
  const a = String(body.action || ''); const now = ctx.now ? ctx.now() : Date.now();
  // chunk reads / later chunks of an upload touch one doc only (keeps Firestore reads low); everything else lists
  if (a === 'get-chunk') {
    const x = await store.get(ctx.fid, String(body.id || '')); const n = Number(body.n) || 0;
    if (!x || x.kind === 'folder' || x.kind === 'doc' || x.status !== 'ready') return err(404, 'not_found');
    if (n < 0 || n >= x.chunks) return err(400, 'bad_chunk');
    const b = await store.getChunk(ctx.fid, x.id, n); if (b == null) return err(404, 'chunk_missing');
    return ok({ n, of: x.chunks, data: b });
  }
  if (a === 'get-doc') { const x = await store.get(ctx.fid, String(body.id || '')); if (!x || x.kind !== 'doc') return err(404, 'not_found'); return ok({ item: pub(x), html: (await store.getHtml(ctx.fid, x.id)) || '' }); }
  const lazy = a === 'put' && Number(body.n) > 0;
  const items = lazy ? [] : await store.list(ctx.fid);
  const find = (id) => items.find((x) => x.id === id);
  const parentOk = (p) => !p || (find(p)?.kind === 'folder');
  if (a === 'list') {
    // abandoned uploads (no chunk for 30 min) are removed with their chunks, so they never hold quota
    const stale = items.filter((x) => x.status === 'uploading' && now - (x.updatedAt || 0) >= STALE);
    for (const y of stale) await removeItem(store, ctx.fid, y);
    const live = items.filter((x) => !stale.includes(x));
    return ok({ items: live.filter((x) => x.status === 'ready').map(pub), used: usedBytes(live), limits: LIMITS, ...(stale.length ? { cleaned: stale.length } : {}) });
  }
  if (!canAdd(ctx)) return err(403, 'forbidden');
  if (a === 'mkdir' || a === 'doc-new') {
    const name = cleanName(body.name); if (!name) return err(400, 'name');
    const parent = String(body.parent || ''); if (!parentOk(parent)) return err(400, 'parent');
    if (depthOf(items, parent) >= LIMITS.depth) return err(400, 'too_deep');
    if (items.length >= LIMITS.items) return err(400, 'too_many');
    const id = newId();
    const html = a === 'doc-new' ? sanitizeDoc(body.html || '') : undefined;
    const item = { id, kind: a === 'mkdir' ? 'folder' : 'doc', name, parent, createdBy: ctx.uid, createdAt: now, updatedAt: now, status: 'ready', size: html ? html.length : 0, ...(html !== undefined ? { text: docText(html).slice(0, 600) } : {}) };
    if (html !== undefined) await store.putHtml(ctx.fid, id, html);
    await store.put(ctx.fid, id, item); return ok({ item: pub(item) });
  }
  if (a === 'put') { // one chunk of an upload; chunk 0 creates the item
    const n = Number(body.n) || 0; const data = String(body.data || '');
    const raw = b64Bytes(data);
    if (!data || data.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || raw > LIMITS.chunk) return err(400, 'bad_chunk');
    let x;
    if (n === 0) {
      const name = cleanName(body.name); const size = Number(body.size) || 0; const parent = String(body.parent || '');
      if (!name) return err(400, 'name');
      if (!parentOk(parent)) return err(400, 'parent');
      if (size <= 0) return err(400, 'empty');
      if (size > LIMITS.fileMax) return err(413, 'file_too_large', { max: LIMITS.fileMax });
      if (usedBytes(items.filter((y) => y.status !== 'uploading' || now - (y.updatedAt || 0) < STALE)) + size > LIMITS.familyMax) return err(413, 'family_full', { max: LIMITS.familyMax });
      if (items.length >= LIMITS.items) return err(400, 'too_many');
      const mime = String(body.mime || '').slice(0, 100);
      x = { id: newId(), kind: kindOf(name, mime), name, parent, mime, size, chunks: chunkCount(size), got: 0, recv: 0, status: 'uploading', createdBy: ctx.uid, createdAt: now, updatedAt: now, ...(typeof body.thumb === 'string' && body.thumb.startsWith('data:image/') && body.thumb.length < 40000 ? { thumb: body.thumb } : {}) };
    } else {
      x = await store.get(ctx.fid, String(body.id || ''));
      if (!x || x.status !== 'uploading' || x.createdBy !== ctx.uid) return err(404, 'not_found');
      if (n !== x.got) return err(409, 'out_of_order', { expect: x.got });
    }
    // the bytes really received must add up to the declared size (it is what the quota counts)
    const recv = (Number(x.recv) || 0) + raw; const last = n + 1 >= x.chunks;
    if (recv > x.size || (!last && raw !== LIMITS.chunk) || (last && recv !== x.size)) {
      if (n > 0) await removeItem(store, ctx.fid, { ...x, chunks: n });
      return err(400, 'size_mismatch');
    }
    await store.putChunk(ctx.fid, x.id, n, data);
    x = { ...x, got: n + 1, recv, updatedAt: now, status: last ? 'ready' : 'uploading' };
    await store.put(ctx.fid, x.id, x);
    return ok({ id: x.id, got: x.got, of: x.chunks, item: x.status === 'ready' ? pub(x) : null });
  }
  const x = find(body.id); if (!x) return err(404, 'not_found');
  if (!canEditItem(x, ctx)) return err(403, 'forbidden');
  if (a === 'rename') { const name = cleanName(body.name); if (!name) return err(400, 'name'); const y = { ...x, name, updatedAt: now }; await store.put(ctx.fid, x.id, y); return ok({ item: pub(y) }); }
  if (a === 'move') {
    const parent = String(body.parent || '');
    if (!parentOk(parent) || parent === x.id || (x.kind === 'folder' && descendants(items, x.id).has(parent))) return err(400, 'parent');
    if (x.kind === 'folder' && depthOf(items, parent) + 1 + maxSubDepth(items, x.id) > LIMITS.depth) return err(400, 'too_deep');
    const y = { ...x, parent, updatedAt: now }; await store.put(ctx.fid, x.id, y); return ok({ item: pub(y) });
  }
  if (a === 'doc-save') {
    if (x.kind !== 'doc') return err(400, 'not_doc');
    const html = sanitizeDoc(body.html || ''); const y = { ...x, text: docText(html).slice(0, 600), size: html.length, updatedAt: now, ...(body.name ? { name: cleanName(body.name) || x.name } : {}) };
    await store.putHtml(ctx.fid, x.id, html); await store.put(ctx.fid, x.id, y); return ok({ item: pub(y) });
  }
  if (a === 'delete') {
    const ids = [x.id, ...descendants(items, x.id)]; const byId = new Map(items.map((y) => [y.id, y]));
    for (const id of ids) { const y = byId.get(id); if (y && y.kind !== 'folder' && !canEditItem(y, ctx)) return err(403, 'forbidden_inside'); }
    for (const id of ids) await removeItem(store, ctx.fid, byId.get(id));
    return ok({ deleted: ids });
  }
  return err(400, 'bad_action');
}
function maxSubDepth(items, id) { let m = 0; for (const x of items) if (x.parent === id && x.kind === 'folder') m = Math.max(m, 1 + maxSubDepth(items, x.id)); return m; }

// in-memory store (mock build + tests)
export function memoryStore(seed = {}) {
  const meta = new Map(); const chunks = new Map();
  for (const [fid, list] of Object.entries(seed)) for (const it of list) meta.set(`${fid}/${it.id}`, { ...it });
  return {
    async list(fid) { return [...meta.entries()].filter(([k]) => k.startsWith(`${fid}/`)).map(([, v]) => ({ ...v })); },
    async get(fid, id) { return meta.get(`${fid}/${id}`) || null; },
    async put(fid, id, data) { meta.set(`${fid}/${id}`, { ...data }); },
    async del(fid, id) { meta.delete(`${fid}/${id}`); },
    async putChunk(fid, id, n, b64) { chunks.set(`${fid}/${id}_${n}`, b64); },
    async getChunk(fid, id, n) { return chunks.get(`${fid}/${id}_${n}`) ?? null; },
    async delChunk(fid, id, n) { chunks.delete(`${fid}/${id}_${n}`); },
    async putHtml(fid, id, html) { chunks.set(`${fid}/${id}_html`, html); },
    async getHtml(fid, id) { return chunks.get(`${fid}/${id}_html`) ?? null; },
    async delHtml(fid, id) { chunks.delete(`${fid}/${id}_html`); },
    _chunks: chunks, _meta: meta,
  };
}
