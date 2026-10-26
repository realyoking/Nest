import { LANG_IDS, normLang } from './langs.js';
import { MODEL_CHOICES, THINK_CHOICES } from './ai-models.js';
// Per-user settings, stored in users/{uid}.prefs (owner-only by Firestore rules).
export const DEFAULT_PREFS = {
  replyStyle: 'concise',        // concise | detailed
  tutorStrictness: 'standard',  // gentle | standard | strict
  tutorMode: 'hints',           // hints | explain  (default tutor mode)
  autonomy: 'auto_low',         // ask | auto_low
  inboxFreq: 'daily',           // off | weekly | daily | twice
  notifyReminders: true,
  notifyInbox: true,
  pushEnabled: false,           // master switch for system notifications on this account's devices
  notifyHomework: true,         // Classroom homework deadlines
  notifyTests: true,            // tests / exams (Classroom + reminders whose title mentions a test)
  notifyBirthdays: true,        // family birthdays (members' optional birthday)
  notifyBrief: true,            // 07:00 HKT daily brief
  notifyWarnings: true,         // HKO typhoon / rainstorm etc. (new warnings, server-side dedupe)
  notifyNotices: true,          // new school notices / tests detected in Gmail + Classroom
  notifyBills: true,            // bills & fees: N days before due + the day before
  billLead: '3',
  chatMemory: true,             // "Remember from past chats": extract + use chat-derived memory (off = neither)                // days before a bill's due date for the first reminder
  quietEnabled: false,
  quietStart: '22:00',
  quietEnd: '07:00',
  defaultReminderTime: '09:00',
  theme: 'light',               // light | dark | system
  fontSize: 'md',               // sm | md | lg
  aiThink: 'auto',              // Run 26c: thinking mode — auto (hard requests only) | on | off
  aiModel: 'auto',              // Run 25: AI 助理 model — 'auto' (instant rules) or one model id (src/lib/ai-models.js)
};

export const PREF_OPTIONS = {
  replyStyle: ['concise', 'detailed'],
  tutorStrictness: ['gentle', 'standard', 'strict'],
  tutorMode: ['hints', 'explain'],
  autonomy: ['ask', 'auto_low'],
  inboxFreq: ['off', 'weekly', 'daily', 'twice'],
  theme: ['light', 'dark', 'system'],
  fontSize: ['sm', 'md', 'lg'],
  lang: LANG_IDS,
  billLead: ['1', '2', '3', '5', '7'],
  suggestFreq: ['off', '1', '2', 'custom', 'unlimited'],
  aiThink: THINK_CHOICES, // Run 26c
  aiModel: MODEL_CHOICES, // Run 25 // Run 24: proactive suggestions a day (unset = family level)
};
const BOOL = ['notifyReminders', 'notifyInbox', 'quietEnabled', 'pushEnabled', 'notifyHomework', 'notifyTests', 'notifyBirthdays', 'notifyBrief', 'notifyWarnings', 'notifyNotices', 'notifyBills', 'chatMemory'];
const TIME = ['quietStart', 'quietEnd', 'defaultReminderTime'];
const NUM = { suggestN: [1, 20] }; // custom suggestions a day
export const PREF_KEYS = [...Object.keys(PREF_OPTIONS), ...BOOL, ...TIME, ...Object.keys(NUM)];

export const prefsOf = (profile) => ({ ...DEFAULT_PREFS, ...(profile?.prefs || {}) });

// Normalises a value for a key; returns undefined when invalid.
export function normPref(key, value) {
  if (PREF_OPTIONS[key]) {
    const v = String(value);
    if (key === 'lang') return normLang(v);
    return PREF_OPTIONS[key].includes(v) ? v : undefined;
  }
  if (BOOL.includes(key)) return value === true || value === 'true' || value === 1 ? true : value === false || value === 'false' || value === 0 ? false : undefined;
  if (TIME.includes(key)) { const m = String(value).match(/^(\d{1,2}):(\d{2})$/); return m && +m[1] < 24 && +m[2] < 60 ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined; }
  if (NUM[key]) { const n = Math.round(Number(value)); return Number.isFinite(n) && n >= NUM[key][0] && n <= NUM[key][1] ? n : undefined; }
  return undefined;
}

// Is the given moment inside the user's quiet hours (Hong Kong time)?
export function inQuietHours(p, d = new Date()) {
  if (!p.quietEnabled) return false;
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const { quietStart: a, quietEnd: b } = p;
  return a <= b ? hm >= a && hm < b : hm >= a || hm < b;
}

// Subset the server uses to shape replies.
export const aiPrefs = (p) => ({ replyStyle: p.replyStyle, tutorStrictness: p.tutorStrictness, tutorMode: p.tutorMode, defaultReminderTime: p.defaultReminderTime, autonomy: p.autonomy });
