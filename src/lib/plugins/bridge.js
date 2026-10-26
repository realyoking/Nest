// postMessage plugin API — message schema, permission gating and rate limits. Pure JS (unit-tested).
// Every call from a sandbox is { nest: 1, ch, id, method, params }. The host (runtime.jsx) checks event.source is
// that iframe's window and event.origin is 'null' (opaque sandbox), then validateMessage → gate → limiter → handler.

// method → { perm: permission the manifest must declare AND the user approved, cap: capability required,
//            surfaces: where it may be called, params: validator returning cleaned params or throwing }
import { PERMS, impliedFor } from './permissions.js';
const s = (v, max) => { if (typeof v !== 'string') throw new Error('expected string'); return v.slice(0, max); };
const KEY = /^[a-zA-Z0-9_.:-]{1,64}$/;
const ID = (v) => { const x = String(v ?? ''); if (!/^[A-Za-z0-9_-]{1,64}$/.test(x)) throw new Error('id'); return x; };
const when = (v, name) => {
  const ms = typeof v === 'number' ? v : Date.parse(String(v));
  if (!Number.isFinite(ms) || ms < Date.parse('2020-01-01') || ms > Date.now() + 400 * 864e5) throw new Error(name);
  return ms;
};
const reminderFields = (p, partial) => {
  const out = {};
  if (!partial || p?.title !== undefined) { const title = s(p?.title, 120).trim(); if (!title) throw new Error('title'); out.title = title; }
  if (p?.dueAt != null && p.dueAt !== '') out.dueAt = when(p.dueAt, 'dueAt'); else if (!partial) out.dueAt = null;
  if (p?.done !== undefined) { if (typeof p.done !== 'boolean') throw new Error('done'); out.done = p.done; }
  return out;
};
const eventFields = (p, partial) => {
  const out = {};
  if (!partial || p?.title !== undefined) { const t = s(p?.title, 120).trim(); if (!t) throw new Error('title'); out.title = t; }
  if (!partial || p?.start !== undefined) out.start = when(p?.start, 'start');
  if (!partial || p?.end !== undefined) out.end = p?.end != null ? when(p.end, 'end') : (out.start ? out.start + 3600e3 : undefined);
  if (out.start && out.end && out.end < out.start) throw new Error('end');
  if (p?.allDay !== undefined) out.allDay = !!p.allDay;
  if (p?.location !== undefined) out.location = s(p.location, 120);
  return out;
};
const lim = (v, max, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? Math.min(max, n) : d; };
export const METHODS = {
  'context.get': { params: () => ({}) },
  'settings.get': { params: () => ({}) },
  'ui.resize': { surfaces: ['widget', 'tab'], params: (p) => { const h = Number(p?.height); if (!Number.isFinite(h)) throw new Error('height'); return { height: Math.max(40, Math.min(2000, Math.round(h))) }; } },
  'ui.toast': { params: (p) => ({ text: s(p?.text, 120).replace(/[<>]/g, '') }) },
  'ui.addTab': { cap: 'tab', perm: 'ui.tab', params: (p) => ({ title: s(p?.title ?? '', 20) }) },
  'theme.set': { cap: 'theme', perm: 'appearance.theme', params: (p) => { if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('theme'); if (JSON.stringify(p).length > 4000) throw new Error('too_big'); return p; } },
  'theme.reset': { cap: 'theme', perm: 'appearance.theme', params: () => ({}) },
  'storage.get': { perm: 'storage', params: (p) => { if (!KEY.test(p?.key || '')) throw new Error('key'); return { key: p.key }; } },
  'storage.set': { perm: 'storage', params: (p) => { if (!KEY.test(p?.key || '')) throw new Error('key'); const v = JSON.stringify(p.value ?? null); if (v.length > 16 * 1024) throw new Error('value_too_big'); return { key: p.key, value: JSON.parse(v) }; } },
  'storage.remove': { perm: 'storage', params: (p) => { if (!KEY.test(p?.key || '')) throw new Error('key'); return { key: p.key }; } },
  'storage.keys': { perm: 'storage', params: () => ({}) },
  'reminders.list': { perm: 'reminders.read', params: () => ({}) },
  'reminders.create': {
    perm: 'reminders.write',
    params: (p) => {
      const title = s(p?.title, 120).trim();
      if (!title) throw new Error('title');
      let dueAt = null;
      if (p?.dueAt != null && p.dueAt !== '') {
        const ms = typeof p.dueAt === 'number' ? p.dueAt : Date.parse(String(p.dueAt));
        if (!Number.isFinite(ms) || ms < Date.parse('2020-01-01') || ms > Date.now() + 400 * 864e5) throw new Error('dueAt');
        dueAt = ms;
      }
      return { title, dueAt };
    },
  },
  'reminders.update': { perm: 'reminders.write', params: (p) => ({ id: ID(p?.id), fields: reminderFields(p?.fields || {}, true) }) },
  'reminders.delete': { perm: 'reminders.write', params: (p) => ({ id: ID(p?.id) }) },
  'calendar.create': { perm: 'calendar.write', params: (p) => eventFields(p, false) },
  'calendar.update': { perm: 'calendar.write', params: (p) => ({ id: ID(p?.id), fields: eventFields(p?.fields || {}, true) }) },
  'calendar.delete': { perm: 'calendar.write', params: (p) => ({ id: ID(p?.id) }) },
  'memory.list': { perm: 'memory.read', params: (p) => ({ limit: lim(p?.limit, 50, 20) }) },
  'memory.add': { perm: 'memory.write', params: (p) => { const text = s(p?.text, 300).trim(); if (!text) throw new Error('text'); return { text, tag: p?.tag ? s(p.tag, 24).replace(/[^\p{L}\p{N}_-]/gu, '') : '' }; } },
  'study.list': { perm: 'study.read', params: (p) => ({ limit: lim(p?.limit, 30, 20) }) },
  'notices.list': { perm: 'notices.read', params: (p) => ({ limit: lim(p?.limit, 30, 20) }) },
  'bills.list': { perm: 'bills.read', params: (p) => ({ limit: lim(p?.limit, 30, 20) }) },
  'weather.get': { perm: 'weather.read', params: () => ({}) },
  'transport.get': { perm: 'transport.read', params: () => ({}) },
  'gmail.summary': { perm: 'gmail.read', params: (p) => ({ limit: lim(p?.limit, 10, 5) }) },
  'classroom.list': { perm: 'classroom.read', params: (p) => ({ limit: lim(p?.limit, 15, 10), days: lim(p?.days, 30, 14) }) },
  'ai.ask': { perm: 'ai.use', params: (p) => { const prompt = s(p?.prompt, 2000).trim(); if (!prompt) throw new Error('prompt'); return { prompt }; } },
  'media.pickPhoto': { perm: 'media.photo', params: (p) => ({ maxSize: Math.max(128, Math.min(1600, Number(p?.maxSize) || 1024)), camera: !!p?.camera }) },
  'location.get': { perm: 'location', params: () => ({}) },
  'clipboard.write': { perm: 'clipboard', params: (p) => ({ text: s(p?.text, 4000) }) },
  'links.open': { perm: 'links.open', params: (p) => { const u = new URL(s(p?.url, 500)); if (u.protocol !== 'https:') throw new Error('https_only'); return { url: u.toString() }; } },
  'calendar.list': { perm: 'calendar.read', params: (p) => ({ days: Math.max(1, Math.min(14, Number(p?.days) || 7)) }) },
  'members.list': { perm: 'members.read', params: () => ({}) },
  'notify.show': { perm: 'notify', params: (p) => ({ title: s(p?.title, 60).replace(/[<>]/g, ''), body: s(p?.body ?? '', 160).replace(/[<>]/g, '') }) },
};

// Methods the host implements (all of them since 2026-10-18). Anything else answers 'not_supported'.
export const IMPLEMENTED = new Set(Object.keys(METHODS));

// → { ok:true, id, method, params } | { ok:false, id, error }
export function validateMessage(d, channel) {
  if (!d || typeof d !== 'object' || d.nest !== 1) return { ok: false, ignore: true };
  if (channel && d.ch !== channel) return { ok: false, ignore: true };
  const id = Number.isInteger(d.id) && d.id > 0 && d.id < 1e9 ? d.id : null;
  if (id == null) return { ok: false, ignore: true };
  const spec = typeof d.method === 'string' && Object.prototype.hasOwnProperty.call(METHODS, d.method) ? METHODS[d.method] : null;
  if (!spec) return { ok: false, id, error: 'unknown_method' };
  try {
    const raw = JSON.stringify(d.params ?? {});
    if (raw.length > 32 * 1024) return { ok: false, id, error: 'too_big' };
    return { ok: true, id, method: d.method, params: spec.params(JSON.parse(raw)) };
  } catch (e) { return { ok: false, id, error: `bad_params:${String(e.message || 'invalid').slice(0, 30)}` }; }
}

// Gate: declared capability + declared permission + user approval (data permissions) − user revocations + surface.
// → null (allowed) or an error code. Implied permissions (look / tab / widget / storage / background) come with the
// install but are still blocked once the user revokes them (denied).
export function gate(method, { manifest, granted = [], denied = [], surface }) {
  const spec = Object.prototype.hasOwnProperty.call(METHODS, method) ? METHODS[method] : null;
  if (!spec) return 'unknown_method';
  if (spec.surfaces && !spec.surfaces.includes(surface)) return 'wrong_surface';
  if (spec.cap && !(manifest?.capabilities || []).includes(spec.cap)) return 'capability_not_declared';
  if (spec.perm) {
    // Implied permissions also count as declared when the capabilities imply them (manifests stored before the
    // permission registry did not list them).
    const declared = (manifest?.permissions || []).includes(spec.perm) || (PERMS[spec.perm]?.implied && impliedFor(manifest?.capabilities || []).includes(spec.perm));
    if (!declared) return 'permission_not_declared';
    if (denied.includes(spec.perm)) return 'permission_revoked';
    if (!PERMS[spec.perm]?.implied && !granted.includes(spec.perm)) return 'permission_denied';
  }
  return null;
}

// Token buckets per method group. Defaults: 40 calls / 10 s overall; tighter for writes and UI.
export const RATE = {
  '*': [40, 10e3], 'ui.toast': [3, 60e3], 'reminders.create': [5, 60e3], 'storage.set': [60, 60e3],
  'theme.set': [10, 10e3], 'notify.show': [2, 60e3], 'ui.resize': [30, 10e3], 'calendar.list': [6, 60e3],
  'reminders.update': [10, 60e3], 'reminders.delete': [10, 60e3], 'calendar.create': [5, 60e3], 'calendar.update': [10, 60e3], 'calendar.delete': [10, 60e3],
  'memory.add': [3, 60e3], 'ai.ask': [3, 60e3], 'media.pickPhoto': [2, 30e3], 'location.get': [2, 60e3], 'clipboard.write': [5, 60e3], 'links.open': [3, 60e3],
  'gmail.summary': [3, 60e3], 'classroom.list': [3, 60e3], 'memory.list': [6, 60e3], 'study.list': [6, 60e3], 'notices.list': [6, 60e3], 'bills.list': [6, 60e3],
  'weather.get': [6, 60e3], 'transport.get': [6, 60e3],
};
export class RateLimiter {
  constructor(rules = RATE, now = () => Date.now()) { this.rules = rules; this.now = now; this.hits = {}; }
  take(method) {
    const t = this.now();
    for (const k of ['*', method]) {
      const r = this.rules[k]; if (!r) continue;
      const list = (this.hits[k] = (this.hits[k] || []).filter((x) => t - x < r[1]));
      if (list.length >= r[0]) return false;
    }
    for (const k of ['*', method]) if (this.rules[k]) this.hits[k].push(t);
    return true;
  }
}

// Per-plugin storage with a total size cap (backing store injected: localStorage in the app, a Map in tests).
export function pluginStorage(backing, ns, cap = 64 * 1024) {
  const read = () => { try { return JSON.parse(backing.getItem(ns) || '{}') || {}; } catch { return {}; } };
  return {
    get: (k) => read()[k] ?? null,
    keys: () => Object.keys(read()),
    set: (k, v) => {
      const all = read(); all[k] = v;
      const out = JSON.stringify(all);
      if (out.length > cap) throw new Error('storage_full');
      backing.setItem(ns, out); return true;
    },
    remove: (k) => { const all = read(); delete all[k]; backing.setItem(ns, JSON.stringify(all)); return true; },
    clear: () => backing.removeItem(ns),
    size: () => (backing.getItem(ns) || '').length,
  };
}
