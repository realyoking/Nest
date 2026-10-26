// Run 23: chat replies as cards. The model may append ONE fenced block
//   ```nest-cards
//   [{"type":"reminder","title":"…","due":"YYYY-MM-DDTHH:mm","member":"name|everyone|"},
//    {"type":"checklist","title":"…","items":["…","…"]},
//    {"type":"schedule","title":"…","items":[{"date":"YYYY-MM-DD","time":"HH:MM","title":"…"}]}]
//   ```
// The app renders them as cards with one-tap add / complete (nothing is added until the user taps).
// Invalid JSON → the block's readable text is shown as plain text instead (never lost, never raw JSON).
// Pure module: used by the browser (Agent.jsx) and the server prompt (api/chat.js).

export const CARD_TYPES = ['reminder', 'checklist', 'schedule'];
export const MAX_CARDS = 3;
export const MAX_ITEMS = 12;
const FENCE = /```nest-cards\s*([\s\S]*?)```/;
const OPEN = /```nest-cards[\s\S]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

export function cleanCard(c) {
  if (!c || typeof c !== 'object' || !CARD_TYPES.includes(c.type)) return null;
  const title = str(c.title, 120);
  if (c.type === 'reminder') {
    if (!title) return null;
    const due = String(c.due || c.dueAt || '').trim();
    const d = due.slice(0, 10); const tm = due.length >= 16 ? due.slice(11, 16) : '';
    return { type: 'reminder', title, date: DATE.test(d) ? d : '', time: TIME.test(tm) ? tm : '', member: str(c.member, 40) };
  }
  if (c.type === 'checklist') {
    const items = (Array.isArray(c.items) ? c.items : []).map((x) => str(typeof x === 'object' ? x?.text ?? x?.title : x, 120)).filter(Boolean).slice(0, MAX_ITEMS);
    return items.length ? { type: 'checklist', title, items } : null;
  }
  const items = (Array.isArray(c.items) ? c.items : []).map((x) => (x && typeof x === 'object' ? { date: DATE.test(x.date || '') ? x.date : '', time: TIME.test(x.time || '') ? x.time : '', title: str(x.title || x.text, 120) } : null))
    .filter((x) => x && x.title).slice(0, MAX_ITEMS);
  return items.length ? { type: 'schedule', title, items } : null;
}

// → { text, cards, fallback }  (fallback = readable text recovered from an unparseable block)
export function parseCards(raw = '') {
  let text = String(raw ?? '');
  const m = text.match(FENCE);
  let cards = []; let fallback = '';
  if (m) {
    let j = null;
    try { j = JSON.parse(m[1]); } catch {}
    const arr = Array.isArray(j) ? j : j && typeof j === 'object' ? (Array.isArray(j.cards) ? j.cards : [j]) : null;
    if (arr) cards = arr.map(cleanCard).filter(Boolean).slice(0, MAX_CARDS);
    if (!arr || !cards.length) fallback = readable(m[1]);
    text = text.replace(m[0], '');
  }
  text = text.replace(OPEN, ''); // half-streamed block: hide until it closes
  text = text.trim();
  if (fallback) text = `${text}${text ? '\n\n' : ''}${fallback}`;
  return { text, cards, fallback: !!fallback };
}
export const stripCards = (raw = '') => parseCards(raw).text;
// Best-effort plain text from broken JSON: quoted strings that look like titles / items.
function readable(s) {
  const vals = [...String(s).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1].replace(/\\"/g, '"'))
    .filter((v) => v && !CARD_TYPES.includes(v) && !/^(type|title|items|due|dueAt|member|date|time|text|cards)$/.test(v) && !DATE.test(v) && !TIME.test(v) && !/^\d{4}-\d{2}-\d{2}T/.test(v));
  return vals.slice(0, MAX_ITEMS + 2).map((v) => `- ${v}`).join('\n');
}

// Card → reminder payloads (pure; due = Hong Kong wall time string "YYYY-MM-DDTHH:mm" or '').
export function reminderPayloads(card, { defaultTime = '09:00' } = {}) {
  if (card.type === 'reminder') return [{ title: card.title, due: card.date ? `${card.date}T${card.time || defaultTime}` : '', member: card.member }];
  if (card.type === 'checklist') return card.items.map((t) => ({ title: t, due: '', member: '' }));
  return card.items.map((x) => ({ title: x.title, due: x.date ? `${x.date}T${x.time || defaultTime}` : '', member: '' }));
}
// History note for the model (what really happened to its cards).
export function cardsNote(cards = [], state = {}) {
  return cards.map((c, i) => {
    const st = state[i] || {};
    const added = Object.keys(st.added || {}).length; const done = Object.values(st.done || {}).filter(Boolean).length;
    return `${c.type} card "${c.title || (c.items?.[0]?.title ?? c.items?.[0] ?? '')}": ${added ? `${added} item(s) added by the user` : 'nothing added yet'}${done ? `, ${done} ticked off` : ''}`;
  }).join('; ');
}

export const CARDS_PROTOCOL = `
Reply cards (optional, separate from nest-actions): when your answer IS a short checklist (packing list, things to bring, steps to prepare), a schedule / timetable / plan with dates or times, or one reminder you are suggesting (not one the user asked you to set), ALSO append ONE fenced block so the app shows it as a card with one-tap Add buttons:
\`\`\`nest-cards
[{"type":"checklist","title":"…","items":["…","…"]}]
\`\`\`
Card shapes: {"type":"reminder","title":"…","due":"YYYY-MM-DDTHH:mm","member":"member name or empty"} · {"type":"checklist","title":"…","items":["…"]} (max 12 items) · {"type":"schedule","title":"…","items":[{"date":"YYYY-MM-DD","time":"HH:MM","title":"…"}]}. At most 3 cards; valid JSON only; Hong Kong time; titles in the reply language. Keep your text short when a card carries the list (do not repeat every item in full). Nothing is added until the user taps, so never say a card's items were added or set. If the user explicitly asked you to set / add / remind, use nest-actions instead (not a card). No cards for chit-chat or plain explanations.`;
