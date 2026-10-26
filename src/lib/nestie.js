// Run 23: family-level settings shared by the browser and the server (api/_run23.js, api/chat.js).
//   families/{fid}.settings = { nestieName, personality, suggestLevel, holidayTheme, memoryEdit, quietStart, quietEnd }
//   families/{fid}/members/{uid}.role ∈ ROLES (legacy 'student' reads as 'kid'), .roleLabel for 'custom'.
// Pure functions only (no imports) so node tests and the Edge function can use them.

export const DEFAULT_NAME = 'Nestie';
export const PERSONALITIES = ['gentle', 'lively', 'concise'];
export const SUGGEST_LEVELS = ['off', 'low', 'normal']; // proactive suggestions per day: 0 / 1 / 2 (Run 23b)
export const MEMORY_EDIT = ['everyone', 'adults', 'owner'];
export const ROLES = ['parent', 'kid', 'grandparent', 'sibling', 'helper', 'guest', 'custom'];
export const ADULT_ROLES = ['parent', 'grandparent'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_SETTINGS = Object.freeze({ nestieName: DEFAULT_NAME, personality: 'gentle', suggestLevel: 'low', holidayTheme: true, memoryEdit: 'adults', quietStart: '', quietEnd: '' });

// Name: letters / digits / spaces / a few marks, 1–16 characters. Anything else falls back to Nestie.
export function cleanName(v) {
  const s = String(v ?? '').replace(/[\u0000-\u001f<>{}`"\\]/g, '').replace(/\s+/g, ' ').trim();
  const chars = [...s];
  if (!chars.length) return DEFAULT_NAME;
  return chars.slice(0, 16).join('').trim() || DEFAULT_NAME;
}

// Full, valid settings object from whatever is stored (missing / bad keys → defaults).
export function familySettings(fam) {
  const x = (fam && typeof fam.settings === 'object' && fam.settings) || {};
  return {
    nestieName: x.nestieName ? cleanName(x.nestieName) : DEFAULT_NAME,
    personality: PERSONALITIES.includes(x.personality) ? x.personality : DEFAULT_SETTINGS.personality,
    suggestLevel: SUGGEST_LEVELS.includes(x.suggestLevel) ? x.suggestLevel : DEFAULT_SETTINGS.suggestLevel,
    holidayTheme: x.holidayTheme !== false,
    memoryEdit: MEMORY_EDIT.includes(x.memoryEdit) ? x.memoryEdit : DEFAULT_SETTINGS.memoryEdit,
    quietStart: HHMM.test(x.quietStart || '') ? x.quietStart : '',
    quietEnd: HHMM.test(x.quietEnd || '') ? x.quietEnd : '',
  };
}

// Validates a patch from the client. Returns { ok, patch } (only known keys, cleaned) or { ok:false, error }.
export function cleanSettingsPatch(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'bad_patch' };
  const out = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'nestieName') { if (typeof v !== 'string') return { ok: false, error: 'bad_nestieName' }; out[k] = cleanName(v); }
    else if (k === 'personality') { if (!PERSONALITIES.includes(v)) return { ok: false, error: 'bad_personality' }; out[k] = v; }
    else if (k === 'suggestLevel') { if (!SUGGEST_LEVELS.includes(v)) return { ok: false, error: 'bad_suggestLevel' }; out[k] = v; }
    else if (k === 'holidayTheme') { if (typeof v !== 'boolean') return { ok: false, error: 'bad_holidayTheme' }; out[k] = v; }
    else if (k === 'memoryEdit') { if (!MEMORY_EDIT.includes(v)) return { ok: false, error: 'bad_memoryEdit' }; out[k] = v; }
    else if (k === 'quietStart' || k === 'quietEnd') { if (v !== '' && !HHMM.test(String(v))) return { ok: false, error: `bad_${k}` }; out[k] = String(v); }
    else if (k === 'familyName') { const n = String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40); if (!n) return { ok: false, error: 'bad_familyName' }; out[k] = n; }
    else return { ok: false, error: `unknown_${k}` };
  }
  if (!Object.keys(out).length) return { ok: false, error: 'empty' };
  return { ok: true, patch: out };
}

export const normRole = (r) => (r === 'student' ? 'kid' : ROLES.includes(r) ? r : 'kid');
export const isAdult = (m) => !!m && ADULT_ROLES.includes(normRole(m.role));
// The role as a word for the AI ("grandparent", "helper/caregiver", custom label).
export function roleWord(m) {
  const r = normRole(m?.role);
  if (r === 'custom') return String(m?.roleLabel || 'member').replace(/[\u0000-\u001f<>]/g, '').slice(0, 20) || 'member';
  return r === 'helper' ? 'helper/caregiver' : r;
}
export function cleanRole(role, label) {
  if (!ROLES.includes(role)) return null;
  if (role !== 'custom') return { role, roleLabel: '' };
  const l = String(label ?? '').replace(/[\u0000-\u001f<>{}`"\\]/g, '').trim().slice(0, 20);
  return l ? { role, roleLabel: l } : null;
}

// Who may change family settings: the owner and adults (parent / grandparent).
export const canEditFamily = ({ member, isOwner }) => !!isOwner || isAdult(member);
// Who may edit / delete family memory (Run 23b uses it everywhere memory can change).
export function canEditMemory(settings, { member, isOwner }) {
  const lvl = familySettings({ settings }).memoryEdit;
  if (isOwner) return true;
  if (!member || normRole(member.role) === 'guest') return false;
  if (lvl === 'owner') return false;
  if (lvl === 'adults') return isAdult(member);
  return true;
}

// Personality → one paragraph for the system prompt. The name is always cleaned (no prompt injection through it).
const PERSONA = {
  gentle: 'Personality: gentle (溫柔). Warm, patient and reassuring; acknowledge feelings briefly before helping; soft wording, never pushy.',
  lively: 'Personality: lively (活潑). Upbeat, encouraging and a little playful; short energetic sentences and the odd exclamation mark; still no emoji and never silly about serious topics.',
  concise: 'Personality: concise (簡潔). Straight to the point: the answer first, as few words as possible, no small talk or filler.',
};
export function personaRule(settings) {
  const s = familySettings({ settings });
  const named = s.nestieName !== DEFAULT_NAME ? ` The family calls you "${s.nestieName}" — that is your name in this family; use it if you refer to yourself, and answer to it.` : ' In this family you are called "Nestie".';
  return `${named}\n${PERSONA[s.personality]}`;
}

// UI copy flavour by personality (progress card, Today line attribution).
export const personaTone = (settings) => familySettings({ settings }).personality;

// Family quiet hours ("22:00"–"07:00"): true inside the window (Hong Kong time).
export function inFamilyQuiet(settings, now = Date.now()) {
  const s = familySettings({ settings });
  if (!s.quietStart || !s.quietEnd || s.quietStart === s.quietEnd) return false;
  const hk = new Date(now + 8 * 3600e3).toISOString().slice(11, 16);
  return s.quietStart < s.quietEnd ? hk >= s.quietStart && hk < s.quietEnd : hk >= s.quietStart || hk < s.quietEnd;
}

// Role as shown in the UI (t = i18n lookup).
export const roleLabel = (t, m) => (normRole(m?.role) === 'custom' ? (String(m?.roleLabel || '').trim() || t('roles.custom')) : t(`roles.${normRole(m?.role)}`));
