// Run 23b: small Home panels the member picks, adds, removes and reorders. Stored per member on the owner-only
// profile doc (users/{uid}.homePanels = [{ id, type, title?, date? }]), max 6. Data comes from what the app already has.
export const PANEL_TYPES = ['countdown', 'shopping', 'homework'];
export const MAX_PANELS = 6;
const HK = 8 * 3600e3;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const toMs = (d) => (d == null ? NaN : typeof d === 'number' ? d : d instanceof Date ? d.getTime() : d?.toDate ? d.toDate().getTime() : Date.parse(d));
export const hkDay = (ms = Date.now()) => new Date(ms + HK).toISOString().slice(0, 10);

// Run 24 step 2a: each panel also has a size (s / m / l; m is the default and is not stored) and its own settings:
// countdown { title, date }, shopping { listName? }, homework { scope?: 'mine' | 'family' }.
export const SIZES = ['s', 'm', 'l'];
export const HW_SCOPES = ['mine', 'family'];
const clean = (v, n) => String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
export function cleanPanels(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set(); const out = [];
  for (const p of list) {
    if (!p || !PANEL_TYPES.includes(p.type)) continue;
    const id = String(p.id || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || `${p.type}${out.length}`;
    if (seen.has(id)) continue;
    let q;
    if (p.type === 'countdown') {
      const title = clean(p.title, 40);
      if (!title || !DATE.test(p.date || '')) continue;
      q = { id, type: 'countdown', title, date: p.date };
    } else if (p.type === 'shopping') {
      q = { id, type: 'shopping' }; const n = clean(p.listName, 24); if (n) q.listName = n;
    } else {
      q = { id, type: 'homework' }; if (HW_SCOPES.includes(p.scope)) q.scope = p.scope;
    }
    if (p.size === 's' || p.size === 'l') q.size = p.size;
    seen.add(id); out.push(q);
    if (out.length >= MAX_PANELS) break;
  }
  return out;
}
export const sizeOf = (p) => (p && SIZES.includes(p.size) ? p.size : 'm');
export const addPanel = (list, p) => cleanPanels([...cleanPanels(list), { ...p, id: p.id || `${p.type[0]}${Date.now().toString(36)}` }]);
export const removePanel = (list, id) => cleanPanels(list).filter((p) => p.id !== id);
export function movePanel(list, id, dir) {
  const a = cleanPanels(list); const i = a.findIndex((p) => p.id === id); const j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]]; return a;
}
// Drag reorder: put panel `id` at position `to` (clamped).
export function movePanelTo(list, id, to) {
  const a = cleanPanels(list); const i = a.findIndex((p) => p.id === id);
  if (i < 0) return a;
  const [x] = a.splice(i, 1); a.splice(Math.max(0, Math.min(a.length, to)), 0, x); return a;
}
export const resizePanel = (list, id, size) => cleanPanels(cleanPanels(list).map((p) => (p.id === id ? { ...p, size: SIZES.includes(size) ? size : 'm' } : p)));
// Per-panel settings; an invalid patch (e.g. empty countdown title) keeps the panel as it was.
export function updatePanel(list, id, patch = {}) {
  const a = cleanPanels(list);
  return a.map((p) => {
    if (p.id !== id) return p;
    const { id: _i, type: _t, ...rest } = patch || {}; void _i; void _t;
    const next = cleanPanels([{ ...p, ...rest }])[0];
    return next || p;
  });
}
// Presets. Countdown titles come from the caller (localised); dates are relative to today (HK).
export const PRESETS = ['simple', 'student', 'parent'];
export function presetPanels(name, { now = Date.now(), examTitle = 'Exam' } = {}) {
  const in14 = hkDay(now + 14 * 864e5);
  if (name === 'student') return cleanPanels([{ id: 'student-hw', type: 'homework', scope: 'mine', size: 'l' }, { id: 'student-cd', type: 'countdown', title: examTitle, date: in14 }, { id: 'student-shop', type: 'shopping' }]);
  if (name === 'parent') return cleanPanels([{ id: 'parent-hw', type: 'homework', scope: 'family' }, { id: 'parent-shop', type: 'shopping' }]);
  if (name === 'simple') return cleanPanels([{ id: 'simple-shop', type: 'shopping', size: 'l' }]);
  return [];
}
// Which preset (if any) a saved list still matches — ignores countdown titles / dates so a renamed exam still counts.
export function matchPreset(list) {
  const a = cleanPanels(list); const sig = (l) => l.map((p) => `${p.id}:${sizeOf(p)}:${p.scope || ''}`).join('|');
  return PRESETS.find((n) => sig(presetPanels(n)) === sig(a)) || '';
}

// Whole days from today (HK) to the date: 0 = today, negative = past.
export const daysUntil = (date, now = Date.now()) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${hkDay(now)}T00:00:00Z`)) / 864e5);

// Shopping list = open reminders whose title starts with the shopping prefix (購物： / Buy: — what one-tap cards create).
export const SHOP_PREFIXES = ['購物：', '购物：', 'Buy: ', 'Buy:', 'ซื้อ: '];
export const isShopping = (r) => SHOP_PREFIXES.some((p) => String(r.title || '').startsWith(p));
export const shopName = (r) => { const t = String(r.title || ''); const p = SHOP_PREFIXES.find((x) => t.startsWith(x)); return p ? t.slice(p.length).trim() : t; };
export const shoppingItems = (reminders = []) => reminders.filter((r) => !r.done && isShopping(r));

// Homework progress this week (Mon–Sun, HK): reminders that look like schoolwork, done / total.
export const HOMEWORK_RE = /功課|作業|工作紙|默書|測驗|考試|溫習|補習|報告|homework|assignment|worksheet|dictation|quiz|test|exam|revis|report|การบ้าน|สอบ/i;
export function homeworkProgress(reminders = [], now = Date.now(), uid = '') {
  // uid '' = whole family (parents' default or scope 'family'); a uid = that member's own + family-wide items.
  const day = hkDay(now); const wd = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = Date.parse(`${day}T00:00:00+08:00`) - wd * 864e5; const end = start + 7 * 864e5;
  const items = reminders.filter((r) => HOMEWORK_RE.test(r.title || '') && (!uid || !r.memberId || r.memberId === uid)).filter((r) => { const ms = toMs(r.dueAt); return !isNaN(ms) && ms >= start && ms < end; });
  const done = items.filter((r) => r.done).length;
  return { done, total: items.length, next: items.filter((r) => !r.done).sort((a, b) => toMs(a.dueAt) - toMs(b.dueAt)).slice(0, 3) };
}
