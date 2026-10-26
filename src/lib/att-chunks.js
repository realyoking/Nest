// Long chat-attachment texts that do not fit on their message doc are stored in extra docs of the same messages
// collection ({ role: 'attext', of, att, n, total, text }); see persistPlan in attach-core.js. Tiny on purpose: the
// backend imports it to merge them back on every list / watch, so no screen ever sees a chunk doc as a message.
// Chunk docs (role 'attext') → folded back into their message's attachment; never shown as messages.
export function mergeAttChunks(list = []) {
  const chunks = list.filter((m) => m && m.role === 'attext');
  if (!chunks.length && !list.some((m) => Array.isArray(m?.atts) && m.atts.some((a) => a.split))) return list;
  const by = {};
  for (const c of chunks) (by[`${c.of}/${c.att}`] ||= []).push(c);
  return list.filter((m) => m && m.role !== 'attext').map((m) => {
    if (!Array.isArray(m.atts) || !m.atts.some((a) => a.split)) return m;
    return { ...m, atts: m.atts.map((a) => {
      if (!a.split) return a;
      const got = (by[`${m.id}/${a.id}`] || []).sort((x, y) => x.n - y.n);
      if (got.length < a.split) return { ...a, partial: true };
      const { split, ...rest } = a;
      return { ...rest, text: got.map((c) => c.text).join('') };
    }) };
  });
}
