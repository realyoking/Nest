// Run 22: AI 助理 multi-send. While a reply is being generated the user can keep sending; those messages wait in a
// queue (shown in the thread as pending) and go out together as ONE request when the reply ends (or is stopped).
// Pure helpers here (unit-tested in test/run22-chat-queue.test.mjs); the wiring is in src/pages/app/Agent.jsx.
export const QUEUE_MAX = 8;          // queued messages per batch
export const ITEM_MAX = 4000;        // chars per queued message
export const BATCH_MAX = 11000;      // chars of the combined turn (server keeps 12000 per message)
const STORE = 'nest.chatq';

let seq = 0;
export const newQid = () => `q${Date.now().toString(36)}${(seq++).toString(36)}`;
export const newBatchId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Add a message to the queue. Returns { queue, ok, reason }.
export function enqueue(queue, { text, cid }, now = Date.now()) {
  const t = String(text || '').trim();
  if (!t) return { queue, ok: false, reason: 'empty' };
  const mine = queue.filter((q) => q.cid === cid);
  if (mine.length >= QUEUE_MAX) return { queue, ok: false, reason: 'full' };
  return { queue: [...queue, { qid: newQid(), cid: cid || '', text: t.slice(0, ITEM_MAX), at: now }], ok: true };
}
// Take every queued message of a conversation (in order) — the rest stay.
export function takeBatch(queue, cid) {
  const batch = queue.filter((q) => q.cid === (cid || ''));
  return { batch, rest: queue.filter((q) => q.cid !== (cid || '')) };
}
// Put a batch back at the front (a failed send never loses messages); de-duplicated by qid.
export function restore(queue, batch) {
  const have = new Set(queue.map((q) => q.qid));
  return [...batch.filter((b) => !have.has(b.qid)), ...queue];
}
// One user turn for the model. A single message stays as typed; several are numbered [1] … [n] in order, so the model
// can answer them together or one by one (the server adds the instruction when context.batch > 1).
export function combineBatch(texts) {
  const list = texts.map((x) => String(x || '').trim()).filter(Boolean);
  if (list.length <= 1) return { text: (list[0] || '').slice(0, BATCH_MAX), n: list.length };
  const per = Math.max(200, Math.floor(BATCH_MAX / list.length) - 8);
  return { text: list.map((x, i) => `[${i + 1}] ${x.length > per ? `${x.slice(0, per)}…` : x}`).join('\n\n'), n: list.length };
}
// Retry: the messages of the last turn. A batch is the run of user messages at the end of the thread (after the last
// assistant reply) that share the last one's `batch` id; a plain turn is just the last user message.
export function lastTurn(msgs) {
  const li = msgs.map((m) => m.role).lastIndexOf('user');
  if (li < 0) return null;
  const b = msgs[li].batch;
  let first = li;
  if (b) while (first > 0 && msgs[first - 1].role === 'user' && msgs[first - 1].batch === b) first -= 1;
  return { first, last: li, items: msgs.slice(first, li + 1) };
}

// sessionStorage persistence (survives a reload of the tab, not a new tab).
export function loadQueue() {
  try { const v = JSON.parse(sessionStorage.getItem(STORE) || '[]'); return Array.isArray(v) ? v.filter((q) => q && typeof q.text === 'string' && q.qid).slice(0, 40) : []; } catch { return []; }
}
export function saveQueue(q) { try { if (q.length) sessionStorage.setItem(STORE, JSON.stringify(q)); else sessionStorage.removeItem(STORE); } catch {} }
