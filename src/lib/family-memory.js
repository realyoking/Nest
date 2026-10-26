// Run 23b: family-wide AI memory, per member. Pure helpers (browser + node tests).
//   Family items  = families/{fid}/memories (plain notes, kind 'chat', kind 'entity') with `about` = member uid (or '')
//                   and `cat` ∈ MEM_CATS (preference / allergy / habit / fact; inferred when missing).
//   Private items = users/{uid}.chatMem (only the user themself ever sees or edits them).
// Who may edit / delete family items: the family setting 「誰可以修改家庭記憶」 (canEditMemory in nestie.js), and every
// member except guests may always edit what they themselves added.
import { canEditMemory, normRole } from './nestie.js';

export const MEM_CATS = ['preference', 'allergy', 'habit', 'fact'];
const HK = 8 * 3600e3;
const today = (now = Date.now()) => new Date(now + HK).toISOString().slice(0, 10);
const live = (x, now) => !x?.exp || x.exp >= today(now);
const STRUCT = new Set(['insight', 'sub']);

export function inferCat(text = '', type = '') {
  const t = String(text);
  if (type === 'allergy' || /過敏|敏感|allerg|intoleran|แพ้/i.test(t)) return 'allergy';
  if (/喜歡|最愛|偏好|愛吃|愛聽|不喜歡|討厭|prefer|favourite|favorite|\blikes?\b|\bloves?\b|hates?|ชอบ/i.test(t)) return 'preference';
  if (/通常|每天|每晚|每週|逢星期|習慣|經常|usually|every (day|night|week)|habit|often|ประจำ|ทุกวัน/i.test(t)) return 'habit';
  return 'fact';
}
const catOf = (m) => (MEM_CATS.includes(m.cat) ? m.cat : inferCat(m.kind === 'entity' ? `${m.name} ${m.fields?.note || ''}` : m.text, m.type));
const textOf = (m) => (m.kind === 'entity' ? `${m.name}${m.fields?.note ? ` · ${m.fields.note}` : ''}${m.fields?.schedule ? ` · ${m.fields.schedule}` : ''}` : String(m.text || ''));

// Which member a family item is about: explicit `about`, else a member named in the text (longest name wins), else ''.
export function aboutOf(m, members = []) {
  if (m.about && members.some((x) => x.uid === m.about)) return m.about;
  const txt = textOf(m);
  const hit = members.filter((x) => x.displayName && x.displayName.length >= 2 && txt.includes(x.displayName)).sort((a, b) => b.displayName.length - a.displayName.length)[0];
  return hit ? hit.uid : '';
}

// → [{ uid ('' = whole family), items: [{ id, text, cat, src: 'family' | 'private', createdBy, exp, raw }] }]
export function memoryByMember(s, now = Date.now()) {
  const members = s.members || [];
  const buckets = new Map([['', []], ...members.map((m) => [m.uid, []])]);
  for (const m of s.memories || []) {
    if (STRUCT.has(m.kind) || !live(m, now)) continue;
    const uid = aboutOf(m, members);
    (buckets.get(uid) || buckets.get('')).push({ id: m.id, text: textOf(m), cat: catOf(m), src: 'family', createdBy: m.createdBy || '', exp: m.exp || '', kind: m.kind || '', raw: m });
  }
  const me = s.user?.uid;
  if (me && buckets.has(me)) {
    for (const [id, m] of Object.entries(s.profile?.chatMem || {})) {
      if (!live(m, now)) continue;
      buckets.get(me).push({ id, text: String(m.text || ''), cat: MEM_CATS.includes(m.cat) ? m.cat : inferCat(m.text), src: 'private', createdBy: me, exp: m.exp || '', raw: m });
    }
  }
  return [...buckets.entries()].map(([uid, items]) => ({ uid, items }));
}

// Permission for one item (UI + agent actions use the same check).
export function canEditItem(s, item) {
  if (!item) return false;
  const uid = s.user?.uid;
  if (item.src === 'private') return !!uid && item.createdBy === uid;
  const member = s.me || (s.members || []).find((m) => m.uid === uid);
  if (!member || normRole(member.role) === 'guest') return false;
  if (canEditMemory(s.family?.settings, { member, isOwner: !!s.isOwner || s.family?.ownerId === uid })) return true;
  return !!uid && (item.createdBy || item.raw?.createdBy) === uid;
}
export class MemoryForbidden extends Error { constructor() { super('forbidden'); this.code = 'forbidden'; } }
// Throws before any write the member is not allowed to make.
export function assertCanEdit(s, item) { if (!canEditItem(s, item)) throw new MemoryForbidden(); }
// A family memory doc → item shape for the check.
export const familyItem = (m) => (m ? { id: m.id, src: 'family', createdBy: m.createdBy || '', raw: m } : null);
// Adding to family memory: everyone except guests.
export const canAddMemory = (s) => { const m = s.me || (s.members || []).find((x) => x.uid === s.user?.uid); return !!m && normRole(m.role) !== 'guest'; };
