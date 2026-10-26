// ONE effective-plan resolver for the whole app (user decision 2026-10-18: the shown plan must be real everywhere).
// Imported by the server (api/_ops-lib.js → /api/promo/ping, /api/chat limits, admin) AND the client (session.jsx →
// 用量, sidebar, Settings, avatar menu, Home, attachment limits, AI state block).
//
// Inputs that exist in Nest:
//   - the family's own plan        families/{fid}.plan            ('free' until payments go live; rules block client changes)
//   - an admin grant with expiry   ledger.grants[fid].until       (admin → 插件/家庭 → grant Pro, logged)
//   - the beta gift with expiry    ledger.promos.beta.claims[fid].until
// There is no per-user plan anywhere in Nest: plans (and AI usage) belong to the family, so every member sees the same plan.
// Highest unexpired source wins; an expired grant/gift drops back by itself (time-based, no write needed).
import { PLANS, planOf } from './plans.js';

export const RANK = { free: 0, starter: 1, pro: 2 };
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

// Server: from the ledger doc. Returns { id, source: 'plan'|'grant'|'beta', until, base, betaUntil, grantUntil, ended }
// `ended` = the most recent grant/gift that has already expired (so the UI can say "Beta ended 2026-11-18").
export function resolvePlan(basePlanId, ledger, fid, now = Date.now()) {
  const base = PLANS[basePlanId] ? basePlanId : 'free';
  const grant = fid ? ledger?.grants?.[fid] : null;
  const beta = fid ? ledger?.promos?.beta?.claims?.[fid] : null;
  const gU = num(grant?.until); const bU = num(beta?.until);
  const g = gU > now ? gU : 0;
  const b = bU > now ? bU : 0;
  const ended = Math.max(gU && gU <= now ? gU : 0, bU && bU <= now ? bU : 0) || null;
  const common = { base, betaUntil: bU || null, grantUntil: gU || null };
  if (base === 'pro' || (!g && !b)) return { id: base, source: 'plan', until: null, ended: base === 'pro' ? null : ended, ...common };
  const source = g >= b ? 'grant' : 'beta';
  return { id: 'pro', source, until: Math.max(g, b), ended: null, ...common };
}

// Client: family doc + the server's answer (planInfo = { plan, source, until, base, ... } from /api/promo/ping or the
// x-nest-plan header of /api/chat). Only until the server has answered, the owner-written betaProUntil mirror is a hint.
// known=false while nothing trustworthy says the family is on its base plan (the UI shows "…" instead of a wrong 免費).
export function effectivePlan(family, planInfo, now = Date.now(), { assumeKnown = false } = {}) {
  const basePlan = planOf(family?.plan);
  const cands = [{ id: basePlan.id, source: 'plan', until: null }];
  const infoLive = planInfo && RANK[planInfo.plan] != null && (!planInfo.until || planInfo.until > now);
  if (infoLive && planInfo.source !== 'plan') cands.push({ id: planInfo.plan, source: planInfo.source, until: planInfo.until || null });
  const toMs = (v) => (v ? +new Date(v?.toDate ? v.toDate() : v) : 0);
  const mirror = toMs(family?.betaProUntil);
  if (!planInfo && mirror > now) cands.push({ id: 'pro', source: 'beta', until: mirror });
  const best = cands.sort((a, b) => RANK[b.id] - RANK[a.id] || (b.until || 0) - (a.until || 0))[0];
  const giftOn = best.source !== 'plan' && RANK[best.id] > RANK[basePlan.id];
  // Member caps are enforced by Firestore rules on the family's own plan, so they stay on basePlan.
  const plan = giftOn ? { ...PLANS[best.id], members: basePlan.members } : basePlan;
  const ended = !giftOn ? (num(planInfo?.ended) || ((planInfo?.until && planInfo.until <= now) ? planInfo.until : 0) || null) : null;
  const known = assumeKnown || !!planInfo || basePlan.id !== 'free' || giftOn;
  return {
    basePlan, plan, known,
    source: giftOn ? best.source : 'plan',
    until: giftOn && best.until ? best.until : null,
    ended,
    gift: giftOn ? { source: best.source, until: best.until ? new Date(best.until) : null } : null,
  };
}

// "2026-11-18" in Hong Kong time.
export const hkYmd = (ms) => (ms ? new Date(Number(ms) + 8 * 3600e3).toISOString().slice(0, 10) : '');
// Within 2 days the time matters too: "2026-10-18 23:17".
const hkWhen = (ms, now = Date.now()) => (ms && Math.abs(Number(ms) - now) < 2 * 864e5 ? new Date(Number(ms) + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : hkYmd(ms));

// Display label parts: { name: 'Pro', detail: 'Beta 至 2026-11-18' } — t is the app's i18n function.
export function planLabelParts(eff, t) {
  if (!eff || !eff.known) return { name: '…', detail: '', full: '…' };
  const name = t(`pricing.names.${eff.plan.id}`);
  let detail = '';
  if (eff.source === 'beta') detail = t('planx.beta', { date: hkWhen(eff.until) });
  else if (eff.source === 'grant') detail = t('planx.grant', { date: hkWhen(eff.until) });
  else if (eff.plan.id !== 'free') detail = t('planx.family');
  else if (eff.ended && eff.ended > Date.now() - 30 * 864e5) detail = t('planx.ended', { date: hkWhen(eff.ended) });
  return { name, detail, full: detail ? `${name} · ${detail}` : name };
}

// Compact string for the x-nest-plan header and back: "pro|beta|1795000000000|free".
export const planHeader = (r) => `${r.id}|${r.source}|${r.until || ''}|${r.base || 'free'}|${r.ended || ''}`;
export function parsePlanHeader(h) {
  const [plan, source, until, base, ended] = String(h || '').split('|');
  if (RANK[plan] == null || !['plan', 'grant', 'beta'].includes(source)) return null;
  return { plan, source, until: num(until) || null, base: RANK[base] != null ? base : 'free', ended: num(ended) || null };
}
