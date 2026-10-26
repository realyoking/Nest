// Admin API helper (every /api/admin/* call re-checks the admin allowlist server-side; others get 404).
import * as be from '../../lib/backend.js';
export async function api(path, opts = {}) {
  const token = await be.getIdToken();
  const r = await fetch(`/api/admin/${path}`, { ...opts, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'error'), { status: r.status, code: d.error });
  return d;
}
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
// HKT <input type="datetime-local"> helpers
export const toLocalInput = (ms) => (ms ? new Date(ms + 8 * 3600e3).toISOString().slice(0, 16) : '');
export const fromLocalInput = (v) => (v ? Date.parse(`${v}:00+08:00`) : null);
