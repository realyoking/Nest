import { inviteLink } from './links.js';
// Nest agent: a strict JSON action protocol. The model ends a reply with
//   ```nest-actions
//   [{"type":"reminder.create", ...}]
//   ```
// Actions run here in the browser, through the backend, with the user's own Firebase auth,
// so Firestore security rules apply to every one of them.
import { fromLocalInput } from './dates.js';
import { normPref, PREF_KEYS } from './prefs.js';
import { fetchService, hasAnyToken } from './google.js';
import { GH_READ, GH_WRITE, GH_TYPES, validGithubAction, githubArgs, ghNeedsConfirm, ghIsRead } from './github-core.js';
import { githubTool } from './github.js';
import { assertCanEdit, familyItem, canAddMemory, inferCat, MEM_CATS } from './family-memory.js';

const FENCE = /```(?:nest-actions|kabo-actions)\s*([\s\S]*?)(```|$)/;

export function parseAgent(raw = '') {
  let text = String(raw);
  const m = text.match(FENCE);
  let actions = [];
  if (m) {
    try { const j = JSON.parse(m[1]); actions = Array.isArray(j) ? j : j && typeof j === 'object' ? [j] : []; } catch {}
    text = text.replace(m[0], '');
  }
  // Hide a half-streamed fence opener.
  text = text.replace(/```[a-z-]*\s*$/i, '').trim();
  return { text, actions: actions.map(legacy).filter(validAction).slice(0, 8) };
}
// Old replies used {type:'reminder'} / {type:'memory'}.
const legacy = (a) => (a && a.type === 'reminder' ? { ...a, type: 'reminder.create' } : a && a.type === 'memory' ? { ...a, type: 'memory.create' } : a);

export const TYPES = ['reminder.create', 'reminder.update', 'reminder.complete', 'reminder.delete', 'memory.create', 'memory.update', 'memory.delete',
  'settings.update', 'invite.create', 'member.remove', 'connected.read', 'quiz.create', ...GH_TYPES];
const LOW = new Set(['reminder.create', 'reminder.update', 'reminder.complete', 'memory.create', 'memory.update', 'settings.update', 'connected.read', 'quiz.create', ...Object.keys(GH_READ)]);
const SOURCES = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];

export function validAction(a) {
  if (!a || typeof a !== 'object' || !TYPES.includes(a.type)) return false;
  if (a.type.startsWith('github.')) return validGithubAction(a);
  if (a.type === 'reminder.create') return typeof a.title === 'string' && a.title.trim();
  if (a.type === 'memory.create') return typeof a.text === 'string' && a.text.trim();
  if (a.type === 'settings.update') return PREF_KEYS.includes(a.key) && normPref(a.key, a.value) !== undefined;
  if (['reminder.update', 'reminder.complete', 'reminder.delete', 'memory.update', 'memory.delete', 'member.remove'].includes(a.type)) return typeof a.id === 'string' && a.id;
  if (a.type === 'quiz.create') return typeof a.notes === 'string' && a.notes.trim().length > 10;
  return true;
}

export const isDestructive = (a) => !LOW.has(a.type);
// Low-risk actions run straight away unless the user asked to approve everything.
// Reading connected accounts is read-only: it never needs a confirm card, whatever the autonomy setting.
// GitHub: reads run straight away; every write (create repo, commit, branch, PR, Pages) ALWAYS shows a confirm card.
export const needsConfirm = (a, prefs) => ghNeedsConfirm(a) || (a?.type !== 'connected.read' && !ghIsRead(a) && (isDestructive(a) || prefs?.autonomy === 'ask'));

function dueFrom(v, prefs) {
  if (!v) return null;
  const s = String(v).trim();
  const withTime = /T\d{1,2}:\d{2}/.test(s) ? s.slice(0, 16) : `${s.slice(0, 10)}T${prefs?.defaultReminderTime || '09:00'}`;
  const d = fromLocalInput(withTime);
  return d && !isNaN(d) ? d : null;
}
function memberFrom(s, m) {
  if (m == null || m === '') return s.user.uid;
  const v = String(m).trim().toLowerCase();
  if (['everyone', 'all', '全家', '所有人', 'family'].includes(v)) return '';
  const hit = s.members.find((x) => x.uid === m || x.displayName?.toLowerCase() === v);
  return hit ? hit.uid : s.user.uid;
}
const err = (code) => Object.assign(new Error(code), { code });
// Member name / uid → uid ('' when it is not a member of this family).
function aboutUid(s, v) {
  const x = String(v || '').trim().toLowerCase();
  if (!x || ['everyone', 'all', 'family', '全家', '所有人'].includes(x)) return '';
  const m = s.members.find((m) => m.uid === v || String(m.displayName || '').toLowerCase() === x) || s.members.find((m) => m.displayName && (x.includes(m.displayName.toLowerCase()) || m.displayName.toLowerCase().includes(x)));
  return m ? m.uid : '';
}

// ctx: { be, s, setLang, lang }
// Returns { result?, undo? } — both plain JSON so they can be stored on the message.
export async function execute(a, ctx) {
  const { be, s } = ctx;
  const fid = s.family.id;
  switch (a.type) {
    case 'reminder.create': {
      const due = dueFrom(a.dueAt, s.prefs);
      // Never add the same reminder twice (e.g. the model re-issues it after "Did you?"): same title, due within 2 min, still open.
      const norm = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();
      const dueMs = due ? +new Date(due) : 0;
      const twin = (s.reminders || []).find((r) => !r.done && norm(r.title) === norm(a.title) && Math.abs((r.dueAt ? +new Date(r.dueAt?.toDate ? r.dueAt.toDate() : r.dueAt) : 0) - dueMs) < 120e3);
      if (twin) return { result: { existing: twin.id } };
      const r = await be.addReminder(fid, { title: String(a.title).trim().slice(0, 120), dueAt: due, memberId: memberFrom(s, a.member) });
      return { undo: { op: 'deleteReminder', id: r?.id } };
    }
    case 'reminder.update': {
      const cur = s.reminders.find((r) => r.id === a.id); if (!cur) throw err('not_found');
      const patch = {};
      if (a.title) patch.title = String(a.title).slice(0, 120);
      if (a.dueAt) { const d = dueFrom(a.dueAt, s.prefs); if (d) patch.dueAt = d; }
      if (a.member != null) patch.memberId = memberFrom(s, a.member);
      if (!Object.keys(patch).length) throw err('nothing_to_change');
      await be.updateReminder(fid, a.id, patch);
      return { undo: { op: 'restoreReminder', id: a.id, prev: { title: cur.title, dueAt: cur.dueAt ? cur.dueAt.getTime() : null, memberId: cur.memberId || '' } } };
    }
    case 'reminder.complete': {
      const cur = s.reminders.find((r) => r.id === a.id); if (!cur) throw err('not_found');
      const done = a.done !== false;
      await be.updateReminder(fid, a.id, { done });
      return { undo: { op: 'setDone', id: a.id, done: !!cur.done } };
    }
    case 'reminder.delete': {
      const cur = s.reminders.find((r) => r.id === a.id); if (!cur) throw err('not_found');
      await be.deleteReminder(fid, a.id);
      return { undo: { op: 'readdReminder', data: { title: cur.title, dueAt: cur.dueAt ? cur.dueAt.getTime() : null, memberId: cur.memberId || '', done: !!cur.done } } };
    }
    case 'memory.create': {
      if (!canAddMemory(s)) throw err('forbidden');
      // Run 23b: a fact about another member is stored against that member (about = uid) with a category.
      const text = String(a.text).trim().slice(0, 500);
      const about = a.about ? aboutUid(s, a.about) : '';
      const cat = MEM_CATS.includes(a.cat) ? a.cat : inferCat(text);
      const r = await be.addMemory(fid, { text, tag: String(a.tag || '').slice(0, 24), about, cat });
      return { undo: { op: 'deleteMemory', id: r?.id } };
    }
    case 'memory.update': {
      const cur = s.memories.find((m) => m.id === a.id); if (!cur) throw err('not_found');
      assertCanEdit(s, familyItem(cur));
      const patch = {};
      if (a.text) patch.text = String(a.text).slice(0, 500);
      if (a.tag != null) patch.tag = String(a.tag).slice(0, 24);
      if (MEM_CATS.includes(a.cat)) patch.cat = a.cat;
      if (a.about != null) patch.about = aboutUid(s, a.about);
      await be.updateMemory(fid, a.id, patch);
      return { undo: { op: 'restoreMemory', id: a.id, prev: { text: cur.text, tag: cur.tag || '' } } };
    }
    case 'memory.delete': {
      const cur = s.memories.find((m) => m.id === a.id); if (!cur) throw err('not_found');
      assertCanEdit(s, familyItem(cur));
      await be.deleteMemory(fid, a.id);
      return { undo: { op: 'readdMemory', data: { text: cur.text, tag: cur.tag || '', ...(cur.about ? { about: cur.about } : {}), ...(cur.cat ? { cat: cur.cat } : {}) } } };
    }
    case 'settings.update': {
      const v = normPref(a.key, a.value);
      if (a.key === 'lang') {
        const prev = ctx.lang; ctx.setLang(v); await s.savePrefs({ lang: v }).catch(() => {});
        return { undo: { op: 'setLang', value: prev } };
      }
      const prev = s.prefs[a.key];
      await s.savePrefs({ [a.key]: v });
      return { undo: { op: 'setPref', key: a.key, value: prev } };
    }
    case 'invite.create': {
      const inv = await be.createInvite(fid, s.family.name);
      return { result: { link: inviteLink(inv.token), code: inv.code } };
    }
    case 'member.remove': {
      if (!s.isOwner) throw err('owner_only');
      if (a.id === s.user.uid || a.id === s.family.ownerId) throw err('cannot_remove_owner');
      if (!s.members.some((m) => m.uid === a.id)) throw err('not_found');
      await be.removeMember(fid, a.id);
      return {};
    }
    case 'connected.read': {
      const enabled = SOURCES.filter((g) => s.profile?.connections?.[g]);
      const want = (Array.isArray(a.sources) && a.sources.length ? a.sources : enabled).filter((x) => enabled.includes(x));
      if (!want.length) throw err('not_connected');
      if (!hasAnyToken(s.profile)) throw err('reauth');
      const groups = []; const problems = [];
      const results = await Promise.all(want.map((id) => fetchService(s.profile, id).then((r) => [id, r], (e) => [id, { items: [], expired: [], errors: [{ status: 0, message: e.message }], emails: [], missing: [] }])));
      for (const [id, r] of results) {
        const bad = [...(r.expired || []).map((e) => ({ email: e, why: 'reauth' })), ...(r.missing || []).map((e) => ({ email: e, why: 'missing' })), ...(r.errors || []).map((x) => ({ email: x.email, why: 'error', message: x.message || String(x.status || '') }))];
        bad.forEach((b) => problems.push({ id, ...b }));
        const usable = r.emails.length - (r.expired || []).length - (r.missing || []).length;
        if (r.items.length || usable > 0) groups.push({ id, items: r.items.slice(0, 6).map((i) => ({ title: i.title, sub: i.sub, account: i.account })) });
      }
      if (!groups.length) throw Object.assign(err(problems.some((p) => p.why === 'missing') ? 'missing_scope' : 'reauth'), { problems });
      return { result: { groups, problems } };
    }
    case 'quiz.create': {
      return { result: { notes: String(a.notes).slice(0, 6000), topic: String(a.topic || '').slice(0, 80) } };
    }
    default: {
      if (ghIsRead(a)) return { result: await githubTool(GH_READ[a.type], githubArgs(a)) };
      // Only reached from the confirm card (needsConfirm is always true for GitHub writes).
      if (ghNeedsConfirm(a)) return { result: await githubTool(GH_WRITE[a.type], githubArgs(a), { confirm: true }) };
      throw err('unknown');
    }
  }
}

export async function undo(u, ctx) {
  const { be, s } = ctx;
  const fid = s.family.id;
  const date = (ms) => (ms ? new Date(ms) : null);
  switch (u?.op) {
    case 'deleteReminder': return be.deleteReminder(fid, u.id);
    case 'restoreReminder': return be.updateReminder(fid, u.id, { ...u.prev, dueAt: date(u.prev.dueAt) });
    case 'setDone': return be.updateReminder(fid, u.id, { done: u.done });
    case 'readdReminder': { const r = await be.addReminder(fid, { ...u.data, dueAt: date(u.data.dueAt) }); if (u.data.done && r?.id) await be.updateReminder(fid, r.id, { done: true }); return; }
    case 'deleteMemory': return be.deleteMemory(fid, u.id);
    case 'restoreMemory': return be.updateMemory(fid, u.id, u.prev);
    case 'readdMemory': return be.addMemory(fid, u.data);
    case 'setLang': ctx.setLang(u.value); return s.savePrefs({ lang: u.value }).catch(() => {});
    case 'setPref': return s.savePrefs({ [u.key]: u.value });
    default: throw err('no_undo');
  }
}
