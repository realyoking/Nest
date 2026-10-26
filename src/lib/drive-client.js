// Run 24: browser side of 全家檔案 — calls /api/app/drive (or, in the mock build, the same op logic on an in-memory
// store), uploads in 512 KB chunks with progress, downloads + caches blobs for previews.
import { MOCK, getIdToken } from './backend.js';
import { driveOp, memoryStore, LIMITS, kindOf } from './drive.js';

let mock = null;
async function mockCall(body) {
  if (!mock) {
    const now = Date.now(); const d = (days) => now - days * 864e5;
    const en = (localStorage.getItem('nest.lang') || '') === 'en';
    const store = memoryStore({ f1: [
      { id: 'mf1', kind: 'folder', name: en ? 'School' : '學校', parent: '', createdBy: 'u1', createdAt: d(9), updatedAt: d(2), status: 'ready', size: 0 },
      { id: 'mf2', kind: 'folder', name: en ? 'Form 3 worksheets' : '中三工作紙', parent: 'mf1', createdBy: 'u1', createdAt: d(8), updatedAt: d(1), status: 'ready', size: 0 },
      { id: 'mf3', kind: 'folder', name: en ? 'Home & bills' : '家居及帳單', parent: '', createdBy: 'u2', createdAt: d(20), updatedAt: d(5), status: 'ready', size: 0 },
      { id: 'md1', kind: 'doc', name: en ? 'Autumn trip packing list' : '秋季旅行執拾清單', parent: '', createdBy: 'u1', createdAt: d(3), updatedAt: d(0.2), status: 'ready', size: 420, text: en ? 'Passports, chargers, raincoats…' : '護照、充電器、雨衣……' },
    ] });
    await store.putHtml('f1', 'md1', en ? '<h2>Autumn trip</h2><ul><li data-check="1">Passports</li><li data-check="0">Chargers</li><li data-check="0">Raincoats</li></ul><p>Leave home at <b>8 am</b>.</p>' : '<h2>秋季旅行</h2><ul><li data-check="1">護照</li><li data-check="0">充電器</li><li data-check="0">雨衣</li></ul><p>早上 <b>八時</b> 出發。</p>');
    mock = { store, ctx: { fid: 'f1', uid: 'u1', member: { role: 'parent' }, isOwner: true } };
    if (typeof document !== 'undefined') await seedMockPdf(store, en).catch(() => {});
  }
  const r = await driveOp(mock.store, mock.ctx, structuredClone(body));
  if (r.status !== 200) throw Object.assign(new Error(r.body.error), { code: r.body.error, status: r.status, info: r.body });
  return r.body;
}
// mock only: a real 3-page PDF (JPEG pages drawn on a canvas) so the pdf.js preview renders actual pages
async function seedMockPdf(store, en) {
  const { jpegPdf } = await import('./scan-pdf.js');
  const pages = [];
  for (let i = 1; i <= 3; i++) {
    const c = document.createElement('canvas'); c.width = 620; c.height = 877; const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 620, 877); x.fillStyle = '#111'; x.font = '900 30px sans-serif'; x.fillText(en ? `School notice — page ${i}` : `學校通告 — 第 ${i} 頁`, 48, 80);
    x.font = '18px sans-serif'; for (let l = 0; l < 22; l++) { x.fillStyle = l % 5 === 4 ? '#fff' : '#555'; x.fillRect(48, 130 + l * 30, 520 - ((l * 37) % 140), 9); }
    x.strokeStyle = '#111'; x.lineWidth = 2; x.strokeRect(48, 790, 524, 50);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8)); pages.push({ jpeg: new Uint8Array(await b.arrayBuffer()), width: 620, height: 877 });
  }
  const pdf = jpegPdf(pages); const id = 'mp1'; const n = Math.ceil(pdf.length / LIMITS.chunk);
  for (let k = 0; k < n; k++) await store.putChunk('f1', id, k, b64(pdf.subarray(k * LIMITS.chunk, (k + 1) * LIMITS.chunk)));
  await store.put('f1', id, { id, kind: 'pdf', name: en ? 'School notice.pdf' : '學校通告.pdf', parent: 'mf1', mime: 'application/pdf', size: pdf.length, chunks: n, got: n, status: 'ready', createdBy: 'u2', createdAt: Date.now() - 864e5, updatedAt: Date.now() - 864e5 });
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

export async function driveCall(action, body = {}, { retries = 1 } = {}) {
  if (MOCK) return mockCall({ ...body, action });
  for (let t = 0; ; t++) {
    const r = await fetch('/api/app/drive', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await getIdToken()}` }, body: JSON.stringify({ ...body, action }) }).catch(() => null);
    if (r && r.ok) return r.json();
    const j = r ? await r.json().catch(() => ({})) : {};
    const code = j.error || (r ? `http_${r.status}` : 'network');
    if (t < retries && (!r || r.status >= 500)) { await new Promise((res) => setTimeout(res, 600 * (t + 1))); continue; }
    throw Object.assign(new Error(code), { code, status: r?.status || 0, info: j });
  }
}

async function imageThumb(file) {
  try {
    const bmp = await createImageBitmap(file); const s = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * s)); c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); const u = c.toDataURL('image/jpeg', 0.7); return u.length < 40000 ? u : '';
  } catch { return ''; }
}
// upload: validates the limits first, then sends chunk 0 (creates the item) and the rest in order; onProgress(0–1)
export async function uploadFile(file, { parent = '', used = 0, onProgress = () => {}, signal } = {}) {
  if (!file.size) throw Object.assign(new Error('empty'), { code: 'empty' });
  if (file.size > LIMITS.fileMax) throw Object.assign(new Error('file_too_large'), { code: 'file_too_large' });
  if (used + file.size > LIMITS.familyMax) throw Object.assign(new Error('family_full'), { code: 'family_full' });
  const thumb = kindOf(file.name, file.type) === 'image' ? await imageThumb(file) : '';
  const n = Math.ceil(file.size / LIMITS.chunk); let id = ''; let item = null;
  onProgress(0);
  for (let k = 0; k < n; k++) {
    if (signal?.aborted) throw Object.assign(new Error('aborted'), { code: 'aborted' });
    const data = b64(new Uint8Array(await file.slice(k * LIMITS.chunk, (k + 1) * LIMITS.chunk).arrayBuffer()));
    const r = await driveCall('put', k === 0 ? { n: 0, name: file.name, size: file.size, mime: file.type, parent, data, ...(thumb ? { thumb } : {}) } : { n: k, id, data }, { retries: 2 });
    id = r.id; item = r.item; onProgress((k + 1) / n);
  }
  return item;
}
const cache = new Map();
export async function downloadBlob(item, { onProgress = () => {} } = {}) {
  if (cache.has(item.id)) return cache.get(item.id);
  const parts = [];
  for (let k = 0; k < item.chunks; k++) { const r = await driveCall('get-chunk', { id: item.id, n: k }, { retries: 2 }); parts.push(unb64(r.data)); onProgress((k + 1) / item.chunks); }
  const blob = new Blob(parts, { type: item.mime || 'application/octet-stream' }); cache.set(item.id, blob); return blob;
}
export const forget = (id) => cache.delete(id);
export function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); }
