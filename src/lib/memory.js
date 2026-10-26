// Family memory model (all stored in the family's own space; nothing is used for training):
//   families/{fid}/memories/*   (family-visible)  plain notes (no kind) · kind 'chat' (accepted from chats, optional exp)
//                                                 · kind 'entity' (knowledge graph: type, name, about uid, fields, notes[], vis 'family')
//                                                 · kind 'insight' (src/lib/insights.js) · kind 'sub' (subscriptions)
//   users/{uid}.chatMem.<id>     (owner only)    private facts from the user's chats — saved automatically, visible + deletable
//   users/{uid}.memSuggest.<id>  (owner only)    suggestions from chats / email — nothing about other people is kept until accepted
//   users/{uid}.privateMem.<id>  (owner only)    entities / people notes the user chose to keep private
// "Remember from past chats" (prefs.chatMemory, default on): off = no extraction and no chat-derived memory in AI context.
const HK = 8 * 3600e3;
const todayKey = () => new Date(Date.now() + HK).toISOString().slice(0, 10);
const live = (x) => !x?.exp || x.exp >= todayKey();
import { reportGate } from './gate-errors.js';
export const ENTITY_TYPES = ['person', 'school', 'class', 'tutor', 'doctor', 'contact', 'allergy', 'size', 'medication', 'other'];
export const ENTITY_FIELDS = ['relation', 'phone', 'email', 'address', 'schedule', 'birthday', 'note'];
const STRUCT = new Set(['insight', 'entity', 'sub']);

export const plainMemories = (s, remember = true) => (s.memories || []).filter((m) => !STRUCT.has(m.kind) && (m.kind !== 'chat' || remember) && live(m));
export const entitiesOf = (s) => [
  ...(s.memories || []).filter((m) => m.kind === 'entity').map((m) => ({ ...m, vis: 'family' })),
  ...Object.entries(s.profile?.privateMem || {}).map(([id, m]) => ({ ...m, id, vis: 'private' })),
];
export function entityLine(e, s) {
  const f = Object.entries(e.fields || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('; ');
  const notes = (e.notes || []).slice(-3).map((n) => n.text).join(' / ');
  return `${e.type}: ${e.name}${e.about ? ` (for ${s.memberName?.(e.about) || e.about})` : ''}${f ? ` — ${f}` : ''}${notes ? ` — notes: ${notes}` : ''}${e.vis === 'private' ? ' [private to this user]' : ''}`;
}
export const knowledgeLines = (s) => entitiesOf(s).slice(0, 60).map((e) => entityLine(e, s));
export const personalLines = (profile) => Object.values(profile?.chatMem || {}).filter(live).sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-40).map((m) => `${m.text}${m.exp ? ` (until ${m.exp})` : ''}`);
export const chatMemList = (profile) => Object.entries(profile?.chatMem || {}).map(([id, m]) => ({ id, ...m })).filter(live).sort((a, b) => (b.at || 0) - (a.at || 0));
export const suggestionsOf = (profile) => Object.entries(profile?.memSuggest || {}).map(([id, m]) => ({ id, ...m })).sort((a, b) => (b.at || 0) - (a.at || 0));
// Time-bound personal notes for today / tomorrow (daily summary: e.g. "important meeting tomorrow — sleep early").
export const upcomingNotes = (profile) => chatMemList(profile).filter((m) => m.exp && m.exp <= new Date(Date.now() + HK + 864e5).toISOString().slice(0, 10));

const memberByName = (s, name) => (name ? s.members.find((m) => m.displayName && (m.displayName === name || name.includes(m.displayName) || m.displayName.includes(name))) : null);
// Accept a suggestion as family-visible or private.
export async function acceptSuggestion(be, s, sug, { vis = 'family', edits = {} } = {}) {
  const x = { ...sug, ...edits };
  const about = memberByName(s, x.about)?.uid || (s.members.some((m) => m.uid === x.about) ? x.about : '');
  if (x.kind === 'entity') {
    const ent = { kind: 'entity', type: x.type || 'other', name: x.name, about, fields: x.fields || {}, notes: x.note ? [{ text: x.note, at: Date.now() }] : [], src: x.src || 'chat' };
    if (vis === 'private') await be.saveProfile(s.user.uid, { privateMem: { [`p${Date.now().toString(36)}`]: { ...ent, at: Date.now() } } });
    else await be.addMemory(s.family.id, ent);
  } else if (vis === 'private') await be.saveProfile(s.user.uid, { chatMem: { [`c${Date.now().toString(36)}`]: { text: x.text, exp: x.exp || '', at: Date.now() } } });
  else await be.addMemory(s.family.id, { kind: 'chat', text: x.text, tag: '', about, exp: x.exp || '' });
  await be.deleteProfileKeys(s.user.uid, [`memSuggest.${sug.id}`]);
}
export const dismissSuggestion = (be, uid, id) => be.deleteProfileKeys(uid, [`memSuggest.${id}`]);
export const deleteChatMem = (be, uid, id) => be.deleteProfileKeys(uid, [`chatMem.${id}`]);
export const deletePrivateMem = (be, uid, id) => be.deleteProfileKeys(uid, [`privateMem.${id}`]);

// After a chat turn: server-side extraction (only when the toggle is on and the user said something, not just asked).
const QUESTIONY = /^[^。.!！]{0,60}[？?]\s*$/;
export async function extractFromChat(be, s, history, lang) {
  if (be.MOCK || s.prefs?.chatMemory === false) return null;
  const last = [...history].reverse().find((m) => m.role === 'user');
  const txt = String(last?.content || '').trim();
  if (txt.length < 6 || QUESTIONY.test(txt)) return null;
  const existing = [...plainMemories(s).map((m) => m.text), ...personalLines(s.profile), ...entitiesOf(s).map((e) => `${e.type}: ${e.name}`)].slice(0, 60);
  try {
    const r = await fetch('/api/memory/extract', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await be.getIdToken()}` },
      body: JSON.stringify({ messages: history.slice(-8), lang, me: s.me?.displayName || '', members: s.members.map((m) => ({ uid: m.uid, name: m.displayName, role: m.role })), existing }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); reportGate({ code: d.error, feature: d.feature, gateMessage: d.message }); return null; }
    return r.json();
  } catch { return null; }
}

// Reminder fires ("Call Mum") → the last relevant note about that person, if the family recorded one.
export function personContext(s, title) {
  const t = String(title || '');
  const p = entitiesOf(s).filter((e) => e.type === 'person' || e.type === 'contact').find((e) => [e.name, ...(String(e.fields?.relation || '').split(/[,，、/]/))].map((x) => String(x).trim()).filter((x) => x.length >= 1).some((x) => t.includes(x)));
  if (!p) return null;
  const note = (p.notes || []).slice(-1)[0]?.text || p.fields?.note || '';
  return note ? { name: p.name, note } : null;
}
// "What our family remembered about you": everything visible to this member that is about them, newest first.
export function aboutMe(s) {
  const uid = s.user.uid;
  const at = (m) => (m.createdAt instanceof Date ? m.createdAt.getTime() : Number(m.at || m.lastSeen || 0) || 0);
  return [
    ...(s.memories || []).filter((m) => m.about === uid || m.memberId === uid || (m.kind === 'entity' && m.about === uid)),
    ...(s.memories || []).filter((m) => !m.kind && s.me?.displayName && String(m.text).includes(s.me.displayName)),
  ].filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i).sort((a, b) => at(b) - at(a)).map((m) => ({ ...m, when: at(m) }));
}
