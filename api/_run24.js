// Run 24 server op (no new Vercel function: api/ops.js routes /api/app/drive → op=app-drive).
//   POST /api/app/drive {action, …} → src/lib/drive.js driveOp with a Firestore REST store (service account).
// Collections families/{fid}/drive (metadata) and families/{fid}/driveChunks ({id}_{n} = Bytes ≤512 KB, {id}_html =
// document HTML) have no client rule: only this op, after a membership check, reads or writes them.
import { json, fsGet, docName, enc, dec, hasServiceAccount, serviceToken } from './_ops-lib.js';
import { driveOp } from '../src/lib/drive.js';

const FS = 'https://firestore.googleapis.com/v1';
const H = (t) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const fieldsOf = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
const decDoc = (d) => ({ ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, dec(v)])), id: d.name.split('/').pop() });

export function restStore(token, fetchImpl = fetch) {
  const url = (p) => `${FS}/${docName(p)}`;
  const req = async (p, opt = {}) => { const r = await fetchImpl(url(p), { ...opt, headers: H(token) }); if (r.status === 404) return null; if (!r.ok) throw Object.assign(new Error(`firestore ${r.status}`), { status: r.status }); return r.status === 204 ? {} : r.json(); };
  const put = (p, fields) => req(p, { method: 'PATCH', body: JSON.stringify({ fields }) });
  return {
    async list(fid) {
      const out = []; let page = '';
      for (let i = 0; i < 5; i++) {
        const j = await req(`families/${fid}/drive?pageSize=300${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`); if (!j) break;
        (j.documents || []).forEach((d) => out.push(decDoc(d))); if (!j.nextPageToken) break; page = j.nextPageToken;
      }
      return out;
    },
    async get(fid, id) { if (!/^[A-Za-z0-9_-]{1,60}$/.test(id)) return null; const d = await req(`families/${fid}/drive/${id}`); return d ? decDoc(d) : null; },
    async put(fid, id, data) { const { id: _i, ...rest } = data; void _i; await put(`families/${fid}/drive/${id}`, fieldsOf(rest)); },
    async del(fid, id) { await req(`families/${fid}/drive/${id}`, { method: 'DELETE' }); },
    async putChunk(fid, id, n, b64) { await put(`families/${fid}/driveChunks/${id}_${n}`, { b: { bytesValue: b64 } }); },
    async getChunk(fid, id, n) { const d = await req(`families/${fid}/driveChunks/${id}_${n}`); return d?.fields?.b?.bytesValue ?? null; },
    async delChunk(fid, id, n) { await req(`families/${fid}/driveChunks/${id}_${n}`, { method: 'DELETE' }); },
    async putHtml(fid, id, html) { await put(`families/${fid}/driveChunks/${id}_html`, { h: { stringValue: html } }); },
    async getHtml(fid, id) { const d = await req(`families/${fid}/driveChunks/${id}_html`); return d?.fields?.h?.stringValue ?? null; },
    async delHtml(fid, id) { await req(`families/${fid}/driveChunks/${id}_html`, { method: 'DELETE' }); },
  };
}

export async function driveRoute(c, body, deps = {}) {
  const { get = fsGet, saToken = serviceToken, hasSa = hasServiceAccount, store = null } = deps;
  if (!hasSa()) return json(503, { error: 'not_configured' });
  const prof = (await get(`users/${c.uid}`, c.token).catch(() => null))?.data || {};
  const fid = prof.familyId || ''; if (!fid) return json(403, { error: 'no_family' });
  const fam = (await get(`families/${fid}`, c.token).catch(() => null))?.data || null;
  if (!fam || !(fam.memberIds || []).includes(c.uid)) return json(403, { error: 'not_member' });
  const me = (await get(`families/${fid}/members/${c.uid}`, c.token).catch(() => null))?.data || null;
  const st = store || restStore(await saToken());
  try {
    const r = await driveOp(st, { fid, uid: c.uid, member: me, isOwner: fam.ownerId === c.uid }, body || {});
    return json(r.status, r.body);
  } catch (e) { return json(502, { error: 'storage', detail: String(e?.status || e?.message || e).slice(0, 80) }); }
}
