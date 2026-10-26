// Globe maths (Run 11): orthographic projection, inverse, nearest region. Pure, unit-tested.
import { COUNTRIES } from './countries.js';
const RAD = Math.PI / 180;
// Orthographic projection of (lat, lon) for a view centred on (lat0, lon0). Returns [x, y, depth] in unit radii (depth > 0 = front).
export function project(lat, lon, lat0, lon0) {
  const la = lat * RAD; const dl = (lon - lon0) * RAD; const l0 = lat0 * RAD;
  const cosc = Math.sin(l0) * Math.sin(la) + Math.cos(l0) * Math.cos(la) * Math.cos(dl);
  return [Math.cos(la) * Math.sin(dl), Math.cos(l0) * Math.sin(la) - Math.sin(l0) * Math.cos(la) * Math.cos(dl), cosc];
}
// Inverse (unit radii, y up) → [lat, lon] or null outside the disc.
export function unproject(x, y, lat0, lon0) {
  const rho = Math.hypot(x, y); if (rho > 1) return null; if (rho < 1e-9) return [lat0, lon0];
  const c = Math.asin(rho); const l0 = lat0 * RAD;
  const lat = Math.asin(Math.cos(c) * Math.sin(l0) + (y * Math.sin(c) * Math.cos(l0)) / rho);
  const lon = lon0 * RAD + Math.atan2(x * Math.sin(c), rho * Math.cos(l0) * Math.cos(c) - y * Math.sin(l0) * Math.sin(c));
  return [lat / RAD, ((lon / RAD + 540) % 360) - 180];
}
// Nearest country / region centroid to a point (great-circle degrees).
export function nearestRegion(lat, lon, maxDeg = 14) {
  let best = null; let bd = Infinity;
  for (const r of COUNTRIES) {
    const d = Math.acos(Math.min(1, Math.sin(lat * RAD) * Math.sin(r[1] * RAD) + Math.cos(lat * RAD) * Math.cos(r[1] * RAD) * Math.cos((lon - r[2]) * RAD))) / RAD;
    if (d < bd) { bd = d; best = r[0]; }
  }
  return bd <= maxDeg ? best : null;
}
