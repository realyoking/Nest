// Client calls for family subscriptions (/api/nest/subs, /api/nest/subwrite → api/calendar.js → api/_nest.js).
// Mock / landing demo: in-memory list with two fixtures.
import { call } from './calendar.js';
import { MOCK } from './backend.js';
import { cleanSub, currentRenewal, addDaysKey } from './subs.js';

const HK = 8 * 3600e3;
const today = () => new Date(Date.now() + HK).toISOString().slice(0, 10);
let mock = null;
function mockList() {
  if (!mock) {
    const t = today();
    mock = [
      { id: 's00000000000000000001', service: 'Netflix', purpose: '影片串流', amount: 93, currency: 'HKD', cycle: 'monthly', renewDate: addDaysKey(t, 2), member: '', lastUsed: addDaysKey(t, -1), cancelUrl: 'https://www.netflix.com/cancelplan', decider: '', notes: '' },
      { id: 's00000000000000000002', service: 'Spotify', purpose: '音樂', amount: 78, currency: 'HKD', cycle: 'monthly', renewDate: addDaysKey(t, 12), member: '', lastUsed: addDaysKey(t, -40), cancelUrl: 'https://www.spotify.com/account/subscription/', decider: '', notes: '' },
      { id: 's00000000000000000003', service: '編程班 Coding Club', purpose: '編程／STEM 課程', amount: 880, currency: 'HKD', cycle: 'monthly', renewDate: addDaysKey(t, 20), member: 'kid', lastUsed: addDaysKey(t, -3), cancelUrl: '', decider: '', notes: '' },
      { id: 's00000000000000000004', service: 'iCloud+', purpose: 'Apple 訂閱', amount: 8, currency: 'HKD', cycle: 'monthly', renewDate: addDaysKey(t, 25), member: '', lastUsed: '', cancelUrl: 'https://apps.apple.com/account/subscriptions', decider: '', notes: '' },
    ];
  }
  return mock;
}
let cache = { at: 0, subs: null };
const listeners = new Set();
export const onSubsChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const changed = () => { cache = { at: 0, subs: null }; listeners.forEach((f) => { try { f(); } catch {} }); };

export async function listSubs({ maxAge = 30e3, demo = false } = {}) {
  if (MOCK || demo) return mockList().map((x) => ({ ...x }));
  if (cache.subs && Date.now() - cache.at < maxAge) return cache.subs;
  const r = await call('/api/nest/subs', {});
  cache = { at: Date.now(), subs: r.subs || [] };
  return cache.subs;
}
export async function writeSub(action, { id, sub, choice } = {}, { demo = false } = {}) {
  if (MOCK || demo) {
    const l = mockList();
    if (action === 'create') l.push({ ...cleanSub(sub), id: `s${Date.now().toString(16).padStart(20, '0').slice(-20)}` });
    else if (action === 'update') Object.assign(l.find((x) => x.id === id) || {}, cleanSub(sub));
    else if (action === 'delete') mock = l.filter((x) => x.id !== id);
    else if (action === 'decide') { const x = l.find((y) => y.id === id); if (x) x.decision = { renewal: currentRenewal(x), choice, by: 'me', at: Date.now() }; }
    else if (action === 'used') { const x = l.find((y) => y.id === id); if (x) x.lastUsed = today(); }
    changed();
    return { ok: true };
  }
  const r = await call('/api/nest/subwrite', { action, id, sub, choice });
  changed();
  return r;
}
