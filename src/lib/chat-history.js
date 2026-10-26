// Chat history grouping (HKT). Pure, unit-tested.
const HK = 8 * 3600e3;
const dayN = (ms) => Math.floor((ms + HK) / 864e5);
const msOf = (v) => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : v?.toDate ? v.toDate().getTime() : v ? Date.parse(v) : 0);
// Pure grouping (unit-tested): pinned first, then by Hong Kong calendar day of updatedAt.
export function groupChats(convs, now = Date.now()) {
  const today = dayN(now);
  const out = { pinned: [], today: [], yesterday: [], week: [], month: [], older: [] };
  for (const c of [...convs].sort((a, b) => msOf(b.updatedAt || b.createdAt) - msOf(a.updatedAt || a.createdAt))) {
    if (c.pinned) { out.pinned.push(c); continue; }
    const d = today - dayN(msOf(c.updatedAt || c.createdAt) || now);
    out[d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? 'week' : d < 30 ? 'month' : 'older'].push(c);
  }
  return Object.entries(out).filter(([, l]) => l.length);
}

