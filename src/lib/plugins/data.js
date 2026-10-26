// Minimal, scoped data a plugin may receive for each data permission. Pure (browser + server + tests).
// Rule: every shaper whitelists fields, clips strings and caps counts. Nothing here ever returns uids, emails, tokens,
// message ids, links into a mailbox, private memory or chat text.
const toMs = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const t = Date.parse(v); return Number.isFinite(t) ? t : null;
};
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);
const cap = (n, max, d) => Math.max(1, Math.min(max, Number(n) || d));

// Family memory: family-visible plain notes only (callers pass plainMemories(s)); entities / insights / subs excluded.
export function shapeMemories(list = [], limit = 20, pid = '') {
  return list.filter((m) => m && (!m.kind || m.kind === 'chat') && m.text).slice(0, cap(limit, 50, 20)).map((m) => ({
    id: clip(m.id, 64), text: clip(m.text, 300), tag: clip(m.tag, 24), at: toMs(m.createdAt || m.updatedAt || m.at), mine: !!pid && m.byPlugin === pid,
  }));
}
// Quiz results (the caller's own): topic, score, total, date. weakAreas are left out (free text about the child).
export function shapeQuiz(list = [], limit = 20) {
  return list.slice(0, cap(limit, 30, 20)).map((q) => ({ topic: clip(q.topic, 80), score: Number(q.score) || 0, total: Number(q.total) || 0, at: toMs(q.createdAt) }));
}
// School items Nest found (inbox cards): never src (email id / sender / link) or body.
export const NOTICE_KINDS = ['notice', 'test', 'homework'];
export function shapeNotices(list = [], limit = 20) {
  return list.filter((x) => x && NOTICE_KINDS.includes(x.kind) && x.status !== 'dismissed').slice(0, cap(limit, 30, 20)).map((x) => ({
    kind: x.kind, title: clip(x.title, 140), date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) ? x.date : '', time: /^\d{2}:\d{2}$/.test(String(x.time || '')) ? x.time : '',
    needsReply: !!x.needsReply, done: x.status === 'accepted' || x.status === 'done',
  }));
}
// Subscriptions (service, amount, cycle, renewal) + bill cards (payee, amount, due date). No notes, cancel links or members.
export function shapeBills(subs = [], inbox = [], limit = 20) {
  const n = cap(limit, 30, 20);
  return {
    subscriptions: subs.slice(0, n).map((x) => ({ service: clip(x.service, 80), amount: Number(x.amount) || 0, currency: 'HKD', cycle: ['weekly', 'monthly', 'yearly'].includes(x.cycle) ? x.cycle : 'monthly', renewDate: /^\d{4}-\d{2}-\d{2}$/.test(String(x.renewDate || '')) ? x.renewDate : '' })),
    bills: inbox.filter((x) => x && x.kind === 'bill' && x.status !== 'dismissed').slice(0, n).map((x) => ({ payee: clip(x.payee || x.title, 80), amount: Number(x.amount) || 0, date: /^\d{4}-\d{2}-\d{2}$/.test(String(x.date || '')) ? x.date : '', paid: x.status === 'paid' })),
  };
}
// Gmail (server side): display name only (never the address), subject, a short snippet, date, unread.
export const senderName = (from) => {
  const s = String(from || '');
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/);
  const name = (m ? m[1] : s.includes('@') ? '' : s).trim();
  if (name) return clip(name.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '').trim() || name, 60);
  const dom = s.match(/@([\w.-]+)/); return dom ? clip(dom[1], 60) : '';
};
const stripAddr = (t) => String(t || '').replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
export function shapeGmail(msgs = [], limit = 5) {
  return msgs.filter(Boolean).slice(0, cap(limit, 10, 5)).map((m) => ({
    from: senderName(m.from), subject: clip(stripAddr(m.subject), 120), snippet: clip(stripAddr(String(m.snippet || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')), 140),
    date: toMs(m.date), unread: !!m.unread,
  }));
}
// Classroom (server side): course name, title, due (ms, HK), state. No links, descriptions, attachments or ids.
export function shapeClassroom(items = [], limit = 10) {
  return items.filter(Boolean).sort((a, b) => (a.due || 0) - (b.due || 0)).slice(0, cap(limit, 15, 10)).map((w) => ({ course: clip(w.course, 80), title: clip(w.title, 120), due: toMs(w.due), late: !!w.late }));
}
// Classroom dueDate {year,month,day} + dueTime {hours,minutes} (UTC per the API) → ms.
export function classroomDue(cw) {
  const d = cw?.dueDate; if (!d?.year) return null;
  const t = cw.dueTime || {};
  return Date.UTC(d.year, (d.month || 1) - 1, d.day || 1, t.hours ?? 15, t.minutes || 0);
}

// Server-side check for every server-served call (api/calendar.js op=pdata). Defence in depth: the browser gate already
// refused ungranted / revoked calls, but a page script could call /api/pdata directly, so the server re-checks with its own
// records. → '' (allowed) or an error code.
//   plugin: nestPlugins/{pid} · install: nestPlugins/{pid}/installs/{uid} · state: users/{uid}.plugins.{pid} (owner profile)
export function serverGate({ perm, uid, plugin, install, state, verifiedOnly = [] }) {
  if (!plugin || plugin.deleted) return 'plugin_not_found';
  if (!install || install.removed) return 'not_installed';
  if (!state) return 'not_installed';
  if (state.on === false) return 'plugin_off';
  const own = plugin.creatorUid === uid;
  const dev = !!install.dev;
  if (dev && !own) return 'not_installed';
  if (!dev && !(plugin.listed === true && Number(plugin.live) > 0)) return 'plugin_removed';
  if (!(Array.isArray(install.granted) ? install.granted : []).includes(perm)) return 'permission_denied';
  if (!(Array.isArray(state.perms) ? state.perms : []).includes(perm)) return 'permission_denied';
  if ((Array.isArray(state.denied) ? state.denied : []).includes(perm)) return 'permission_revoked';
  if (verifiedOnly.includes(perm) && !dev) {
    const safe = Number(plugin.safeV) > 0 && Number(plugin.safeV) === Number(plugin.live);
    if (!safe && !plugin.verified) return 'needs_verified_plugin';
  }
  return '';
}

// Per-user + per-plugin call budget (server, per isolate) — on top of the browser's token buckets.
const hits = new Map();
export function budgetOk(key, max, ms, now = Date.now()) {
  const l = (hits.get(key) || []).filter((t) => now - t < ms);
  if (l.length >= max) { hits.set(key, l); return false; }
  l.push(now); hits.set(key, l);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return true;
}
export const SERVER_BUDGET = { 'gmail.summary': [6, 60e3], 'classroom.list': [6, 60e3], 'calendar.create': [10, 60e3], 'calendar.update': [20, 60e3], 'calendar.delete': [20, 60e3] };

// Activity log entry stored in the owner-only profile (users/{uid}.pluginLog.<key>) — what a plugin wrote, when.
export const logKey = (now = Date.now()) => `l${now.toString(36)}${Math.floor(Math.random() * 1296).toString(36).padStart(2, '0')}`;
export const logEntry = (pid, method, summary, now = Date.now()) => ({ pid: clip(pid, 40), m: clip(method, 30), s: clip(summary, 120), at: now });
export function pruneLog(log = {}, keep = 100) {
  const keys = Object.entries(log || {}).sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0)).map(([k]) => k);
  return keys.slice(keep);
}

// Transport: the user's saved going-out stops (users/{uid}.hk.goOut.items) + /api/hk/eta → minutes until the next departures.
// stationName: (code, lang) → name (injected so this stays pure). No home / school locations are derived or sent.
export function shapeTransport(items = [], eta = {}, { keyOf, stationName = (c) => c, lang = 'zh-Hant', now = Date.now() } = {}) {
  const byKey = Object.fromEntries((eta?.items || []).map((x) => [x.key, x]));
  const mins = (list) => list.map((t) => Math.max(0, Math.round((t - now) / 60e3))).filter((m) => m <= 180).slice(0, 3);
  return items.slice(0, 6).map((it) => {
    const d = byKey[keyOf(it)] || {};
    if (it.co === 'mtr') {
      const dirs = ['UP', 'DOWN'].filter((k) => !it.dir || it.dir === k).map((k) => {
        const l = (d.mtr?.[k] || []).filter((x) => x.t >= now - 30e3);
        return { dir: k, to: l[0] ? stationName(l[0].dest, lang) : '', minutes: mins(l.map((x) => x.t)) };
      });
      return { type: 'mtr', line: clip(it.line, 8), station: stationName(it.sta, lang), departures: dirs, status: d.error ? 'no_data' : 'ok' };
    }
    const l = (d.etas || []).filter((x) => x.t >= now - 30e3);
    return { type: 'bus', company: it.co === 'kmb' ? 'KMB' : 'Citybus', route: clip(it.route, 8), stop: clip(it.name, 60), to: l[0] ? clip(lang === 'en' ? l[0].dest_en : l[0].dest_tc, 60) : clip(it.dest, 60), minutes: mins(l.map((x) => x.t)), status: d.error ? 'no_data' : 'ok' };
  });
}
