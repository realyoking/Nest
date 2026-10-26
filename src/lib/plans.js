// Shared by the client and /api/chat. Payments are not live: every family is on "free"
// until billing launches (firestore.rules blocks clients from changing the plan).
// AI usage limits are per family, per Hong Kong day and per ISO week (Monday 00:00 HKT).
// Keep daily/weekly in sync with dayLimit()/weekLimit() in firestore.rules.
// Placeholder prices (HK$). Yearly = monthly × 12 × 0.83 (17% off), rounded to a whole dollar.
export const YEARLY_DISCOUNT = 0.17;
export const yearlyOf = (monthly) => Math.round(monthly * 12 * (1 - YEARLY_DISCOUNT));
export const perMonthOfYearly = (yearly) => Math.round(yearly / 12);
const plan = (o) => ({ ...o, yearly: yearlyOf(o.monthly) });
export const PLANS = {
  free: plan({ id: 'free', monthly: 0, daily: 100, weekly: 400, capacity: 1, members: 3, families: 1 }),
  starter: plan({ id: 'starter', monthly: 38, daily: 300, weekly: 1500, capacity: 3, members: 6, families: 1 }), // HK$378/yr
  pro: plan({ id: 'pro', monthly: 78, daily: 800, weekly: 4000, capacity: 8, members: 10, families: 1 }), // HK$777/yr
};
export const BILLING = ['monthly', 'yearly'];
export const PLAN_ORDER = ['free', 'starter', 'pro'];
export const planOf = (id) => PLANS[id] || PLANS.free;

const HK = 8 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');
// A Date whose UTC fields read as Hong Kong wall time.
const hk = (d) => new Date(d.getTime() + HK);

// usage/d-2026-10-17
export const dayKey = (d = new Date()) => {
  const h = hk(d);
  return `d-${h.getUTCFullYear()}-${pad(h.getUTCMonth() + 1)}-${pad(h.getUTCDate())}`;
};
// usage/w-2026-W42 (ISO 8601 week, Monday start, Hong Kong time)
export const weekKey = (d = new Date()) => {
  const h = hk(d);
  const t = new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow); // Thursday of this week decides the year
  const y = t.getUTCFullYear();
  const wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `w-${y}-W${pad(wk)}`;
};
// Next 00:00 HKT.
export const nextDayReset = (d = new Date()) => {
  const h = hk(d);
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + 1) - HK);
};
// Next Monday 00:00 HKT.
export const nextWeekReset = (d = new Date()) => {
  const h = hk(d);
  const dow = h.getUTCDay() || 7;
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), h.getUTCDate() + (8 - dow)) - HK);
};
// Whole percent, 0–100. A little use never shows as 0%.
export const pctOf = (used, limit) => {
  if (!limit || !used) return 0;
  const p = (used / limit) * 100;
  return Math.min(100, p < 1 ? 1 : Math.round(p));
};
