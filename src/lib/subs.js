// Family subscriptions (Netflix, Spotify, tutoring…): pure helpers shared by the Subscriptions page, the Home decision
// card and the server dispatcher (api/_nest.js). Stored server-side in families/{fid}/nestSubs/{id} (service account,
// after a membership check) so the pre-renewal push can be scheduled in system/subFire.
// Sub: { id, service, purpose, amount, currency:'HKD', cycle: weekly|monthly|yearly, renewDate:'YYYY-MM-DD' (any known
//        renewal; later ones are derived), member: uid ('' = whole family), lastUsed:'YYYY-MM-DD'|'', cancelUrl,
//        decider: uid|'' (default = owner / first parent), notes, decision: { renewal, choice: keep|discuss|cancel, by, at },
//        notified: 'YYYY-MM-DD' (renewal the decider was pushed about) }
// Nest never cancels anything itself: "Cancel later" = a reminder + the provider's cancel page.
const HK = 8 * 3600e3;
const DAY = 864e5;
export const CYCLES = ['weekly', 'monthly', 'yearly'];
export const CHOICES = ['keep', 'discuss', 'cancel'];
export const LEAD_DAYS = 3;
const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const hkKey = (ms) => new Date(ms + HK).toISOString().slice(0, 10);
const keyMs = (k) => Date.parse(`${k}T00:00:00Z`);
export const addDaysKey = (k, n) => new Date(keyMs(k) + n * DAY).toISOString().slice(0, 10);
const CYCLE_DAYS = { weekly: 7, monthly: 30.44, yearly: 365.25 };

export function cleanSub(x = {}) {
  const service = String(x.service || '').trim().slice(0, 80);
  if (!service) throw Object.assign(new Error('bad_sub'), { status: 400 });
  const amount = Math.max(0, Math.round((Number(x.amount) || 0) * 100) / 100);
  const url = String(x.cancelUrl || '').trim();
  const uid = (v) => (/^[A-Za-z0-9_-]{1,128}$/.test(String(v || '')) ? String(v) : '');
  return {
    service, purpose: String(x.purpose || '').trim().slice(0, 80), amount, currency: 'HKD',
    cycle: CYCLES.includes(x.cycle) ? x.cycle : 'monthly', renewDate: okDate(x.renewDate) ? x.renewDate : '',
    member: uid(x.member), lastUsed: okDate(x.lastUsed) ? x.lastUsed : '', cancelUrl: /^https:\/\/[^\s]{3,300}$/.test(url) ? url : '',
    decider: uid(x.decider), notes: String(x.notes || '').slice(0, 500),
  };
}
// Next renewal on/after today (HK). '' when no date is known.
export function currentRenewal(sub, now = Date.now()) {
  const date = sub?.renewDate;
  if (!okDate(date)) return '';
  const today = hkKey(now);
  let [y, m, d] = date.split('-').map(Number);
  const key = () => { const last = new Date(Date.UTC(y, m, 0)).getUTCDate(); return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; };
  for (let i = 0; i < 2000 && key() < today; i++) {
    if (sub.cycle === 'yearly') y++;
    else if (sub.cycle === 'weekly') { const t = new Date(Date.UTC(y, m - 1, d + 7)); y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); }
    else { m++; if (m > 12) { m = 1; y++; } }
  }
  return key();
}
export const daysUntil = (date, now = Date.now()) => (okDate(date) ? Math.round((keyMs(date) - keyMs(hkKey(now))) / DAY) : null);
export const monthlyCost = (sub) => (Number(sub.amount) || 0) * (30.44 / (CYCLE_DAYS[sub.cycle] || 30.44));
export const monthlyTotal = (subs = []) => Math.round(subs.reduce((a, x) => a + monthlyCost(x), 0) * 100) / 100;
export const yearlyTotal = (subs = []) => Math.round(monthlyTotal(subs) * 12 * 100) / 100;

// Who decides: the sub's chosen decider if still a member, else the family owner (if a parent), else the first parent.
export function deciderOf(sub, family = {}, members = []) {
  const ids = members.map((m) => m.uid);
  if (sub.decider && ids.includes(sub.decider)) return sub.decider;
  const owner = members.find((m) => m.uid === family.ownerId);
  if (owner && owner.role !== 'student') return owner.uid;
  return members.find((m) => m.role === 'parent')?.uid || family.ownerId || ids[0] || '';
}
// Decision needed for the upcoming renewal: 0 ≤ days ≤ LEAD and no decision recorded for this renewal.
export function decisionPending(sub, now = Date.now(), lead = LEAD_DAYS) {
  const r = currentRenewal(sub, now);
  const n = daysUntil(r, now);
  if (!r || n == null || n < 0 || n > lead) return null;
  if (sub.decision?.renewal === r) return null;
  return { renewal: r, days: n };
}
// When the dispatcher should next push the decider: 09:00 HKT, LEAD days before the next renewal still undecided /
// un-notified (immediately if that moment has passed but the renewal is still ahead).
export function nextDecisionFire(sub, now = Date.now(), lead = LEAD_DAYS) {
  let r = currentRenewal(sub, now);
  if (!r) return null;
  if (sub.notified === r || sub.decision?.renewal === r) r = currentRenewal({ ...sub, renewDate: r }, keyMs(r) - HK + DAY);
  const at = keyMs(addDaysKey(r, -lead)) - HK + 9 * 3600e3;
  return Math.max(at, now);
}
// Grouped by member for the Subscriptions page: [{ uid ('' = family), subs, monthly }], family-wide first.
export function groupByMember(subs = [], members = []) {
  const order = ['', ...members.map((m) => m.uid)];
  const g = new Map();
  subs.forEach((x) => { const k = order.includes(x.member) ? x.member : ''; if (!g.has(k)) g.set(k, []); g.get(k).push(x); });
  return order.filter((k) => g.has(k)).map((uid) => ({ uid, subs: g.get(uid).sort((a, b) => (currentRenewal(a) || '9').localeCompare(currentRenewal(b) || '9')), monthly: monthlyTotal(g.get(uid)) }));
}
// "Last used" hint: unused for 30+ days → worth discussing.
export function usageHint(sub, now = Date.now()) {
  if (!okDate(sub.lastUsed)) return { days: null, stale: false };
  const days = -daysUntil(sub.lastUsed, now);
  return { days, stale: days >= 30 };
}
// Reminder plan for "Cancel later": the day before renewal at 09:00 HKT (or in 1 h when that has passed).
export function cancelReminderAt(renewal, now = Date.now()) {
  if (!okDate(renewal)) return now + 3600e3;
  const at = keyMs(addDaysKey(renewal, -1)) - HK + 9 * 3600e3;
  return at > now + 10 * 60e3 ? at : now + 3600e3;
}
// "Discuss": a family reminder this evening at 20:00 HKT (tomorrow 20:00 when it is already later than 19:30).
export function discussReminderAt(now = Date.now()) {
  const today = hkKey(now);
  let at = keyMs(today) - HK + 20 * 3600e3;
  if (at - now < 30 * 60e3) at += DAY;
  return at;
}
export const fmtMoney = (n) => `HK$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString('en-HK', { maximumFractionDigits: 2 })}`;
