import { APP_HOSTS } from '../site.js';
import { writeAuthHint } from './auth-hint.js';
import { mergeAttChunks } from './att-chunks.js';
// Firebase Auth + Firestore data layer. Every Firestore call in the app goes through here.
import { initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut as fbSignOut,
  reauthenticateWithPopup, deleteUser, browserLocalPersistence,
  OAuthProvider, signInWithRedirect, getRedirectResult, EmailAuthProvider, reauthenticateWithCredential, updatePassword,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, onSnapshot,
  addDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, Timestamp, getDocs, limit, deleteField,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '../firebase-config.js';

export const MOCK = false;
// On every app hostname Firebase Auth runs same-origin: authDomain = the current host and vercel.json proxies
// /__/auth/* to <project>.firebaseapp.com (vercel.json rewrite — forks must point it at their own project). That keeps signInWithRedirect working in iOS Safari / standalone PWAs
// (no third-party storage). Each host's https://<host>/__/auth/handler is in the OAuth client's redirect URIs and each
// host is a Firebase authorized domain (all checked 2026-10-17). Other hosts (localhost, previews) use firebaseapp.com.
// Run 15: the host list lives in src/site.js (APP_HOSTS adds nesty.cyou once AUTH_ON_SITE is flipped).
const SAME_ORIGIN_AUTH = APP_HOSTS;
// No VITE_FIREBASE_* at build time (an unconfigured fork): initialise with inert placeholders so the public pages still
// load; App.jsx shows the "Firebase not configured" screen on every route that needs the backend.
const UNCONFIGURED = { apiKey: 'not-configured', authDomain: 'localhost', projectId: 'not-configured', appId: 'not-configured' };
const app = initializeApp(!isFirebaseConfigured ? UNCONFIGURED
  : typeof location !== 'undefined' && SAME_ORIGIN_AUTH.includes(location.hostname)
    ? { ...firebaseConfig, authDomain: location.hostname } : firebaseConfig);
// Sign-in survives app restarts: IndexedDB first, localStorage as fallback.
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver });
const db = getFirestore(app);

const norm = (snap) => {
  if (!snap.exists()) return null;
  const d = snap.data();
  for (const k of Object.keys(d)) if (d[k] instanceof Timestamp) d[k] = d[k].toDate();
  return { id: snap.id, ...d };
};
const list = (qs) => qs.docs.map(norm);

// ---------- Auth ----------
// iOS home-screen apps (standalone): Google/Apple redirect sign-in opens in a Safari sheet that shares this origin's storage.
// The sheet finishes the sign-in and persists the user to IndexedDB, but the standalone window's Firebase instance keeps
// its in-memory "signed out" state until the app is force-quit (the bug fixed 2026-10-18). So:
//  1. the redirect result is awaited before anyone is told "signed out" (no flash of the sign-in page);
//  2. while signed out, whenever the app becomes visible again (visibilitychange / focus / pageshow incl. bfcache) and
//     every 1.5 s while a sign-in is pending, the persisted Firebase user is checked directly; if it exists the app reloads
//     once and comes up signed in;
//  3. the sheet itself shows "Signed in — tap Done to go back to Nest" (src/components/AuthHandoff.jsx).
let redirectP = null;
export const redirectReady = () => (redirectP ||= getRedirectResult(auth).then((r) => { if (r?.user) markAuthDone(); return r; }, (e) => { redirectErr = e; return null; }));
let redirectErr = null;
export const completeRedirect = async () => { const r = await redirectReady(); if (redirectErr) { const e = redirectErr; redirectErr = null; throw e; } return r; };
export const onAuth = (cb) => onAuthStateChanged(auth, async (u) => { if (!u) await redirectReady(); const cur = auth.currentUser || u || null; writeAuthHint(!!cur); cb(cur); });
const PENDING = 'nest.authPending';
const markPending = () => { try { localStorage.setItem(PENDING, JSON.stringify({ at: Date.now(), standalone: standalone() })); } catch {} };
function markAuthDone() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING) || 'null');
    localStorage.removeItem(PENDING);
    localStorage.setItem('nest.authDone', String(Date.now()));
    if (p?.standalone && !standalone()) sessionStorage.setItem('nest.authHandoff', '1');
  } catch {}
}
const authKey = () => `firebase:authUser:${firebaseConfig.apiKey}:[DEFAULT]`;
export function persistedUser() {
  return new Promise((resolve) => {
    try { if (localStorage.getItem(authKey())) { resolve(true); return; } } catch {}
    if (typeof indexedDB === 'undefined') { resolve(false); return; }
    const t = setTimeout(() => resolve(false), 1500);
    let req;
    try { req = indexedDB.open('firebaseLocalStorageDb'); } catch { clearTimeout(t); resolve(false); return; }
    req.onerror = () => { clearTimeout(t); resolve(false); };
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch {} };
    req.onsuccess = () => {
      const db2 = req.result;
      try {
        const g = db2.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').get(authKey());
        g.onsuccess = () => { clearTimeout(t); db2.close(); resolve(!!g.result); };
        g.onerror = () => { clearTimeout(t); db2.close(); resolve(false); };
      } catch { clearTimeout(t); try { db2.close(); } catch {} resolve(false); }
    };
  });
}
let watching = false;
export function watchSignInElsewhere() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  let reloading = false;
  const check = async () => {
    if (reloading || auth.currentUser || document.visibilityState === 'hidden') return;
    // Never decide before Firebase finished restoring the persisted user and the redirect result was consumed —
    // otherwise a normal cold start would look "signed out with a persisted user" and reload.
    try { await auth.authStateReady(); } catch {}
    await redirectReady();
    if (reloading || auth.currentUser || document.visibilityState === 'hidden') return;
    if (!(await persistedUser())) return;
    // Loop guard: at most one reload per 20 s (sessionStorage survives location.reload()).
    try {
      const last = Number(sessionStorage.getItem('nest.authReloadAt') || 0);
      if (Date.now() - last < 20e3) return;
      sessionStorage.setItem('nest.authReloadAt', String(Date.now()));
    } catch {}
    reloading = true; location.reload();
  };
  const pending = () => { try { const p = JSON.parse(localStorage.getItem(PENDING) || 'null'); return p && Date.now() - p.at < 15 * 60e3; } catch { return false; } };
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('storage', (e) => { if (e.key === 'nest.authDone' || e.key === authKey()) check(); });
  setInterval(() => { if (pending()) check(); }, 1500);
}
export const currentUser = () => auth.currentUser;
export const getIdToken = () => auth.currentUser?.getIdToken();
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const iOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Google sign-in: full-page redirect in standalone PWAs / iOS (popups are unreliable there), popup elsewhere.
export async function signInGoogle() {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  if (standalone() || iOS()) { markPending(); return signInWithRedirect(auth, p); }
  try { return await signInWithPopup(auth, p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) { markPending(); return signInWithRedirect(auth, p); }
    throw e;
  }
}
// Sign in with Apple. Popup first; full-page redirect where popups are unreliable (iOS Safari / standalone).
export async function signInApple() {
  const p = new OAuthProvider('apple.com');
  p.addScope('email'); p.addScope('name');
  if (standalone() || iOS()) { markPending(); return signInWithRedirect(auth, p); }
  try {
    return await signInWithPopup(auth, p);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) { markPending(); return signInWithRedirect(auth, p); }
    throw e;
  }
}
export const signInEmail = (email, pw) => signInWithEmailAndPassword(auth, email, pw);
export async function signUpEmail(email, pw, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, pw);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred;
}
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
// Run 18: Firebase's own verification email — used only when the Resend code email is not configured (503).
export const sendVerifyFallback = () => (auth.currentUser ? sendEmailVerification(auth.currentUser) : Promise.resolve());
// Run 18: after the server sets emailVerified=true, refresh the user + ID token so the gate and the server see it.
export async function reloadUser() { const u = auth.currentUser; if (!u) return null; await u.reload(); await u.getIdToken(true); return auth.currentUser; }
// Settings → 更改密碼 (email/password accounts only): re-authenticate with the current password, then update.
export async function changePassword(current, next) {
  const u = auth.currentUser;
  if (!u?.email) throw Object.assign(new Error('no_user'), { code: 'auth/no-current-user' });
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  await updatePassword(u, next);
}
// Signing out also drops this device's short-lived Google access tokens (the encrypted refresh tokens stay in the profile).
export const signOut = () => { writeAuthHint(false); try { sessionStorage.removeItem('nest.gtokens'); sessionStorage.removeItem('nest.gtoken'); } catch {} return fbSignOut(auth); };

// Connectors use their own Google OAuth flow in google.js (not Firebase reauth/link). Mock builds only.
export async function addGoogleAccount() { throw Object.assign(new Error('not_used'), { code: 'oauth/not_used' }); }

// ---------- Profile ----------
export const watchProfile = (uid, cb) => onSnapshot(doc(db, 'users', uid), (s) => cb(norm(s)), () => cb(null));
export const saveProfile = (uid, data) => setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
// Remove nested profile keys, e.g. ['memSuggest.m12ab', 'chatMem.c9'] (owner-only doc).
export const deleteProfileKeys = (uid, paths) => updateDoc(doc(db, 'users', uid), Object.fromEntries(paths.map((p) => [p, deleteField()])));

// ---------- Family ----------
const randomId = (n, alphabet) => {
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return Array.from(a, (x) => alphabet[x % alphabet.length]).join('');
};
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function createFamily({ name, displayName, role }) {
  const u = auth.currentUser;
  const fref = doc(collection(db, 'families'));
  const b = writeBatch(db);
  b.set(fref, { name, ownerId: u.uid, memberIds: [u.uid], plan: 'free', createdAt: serverTimestamp() });
  b.set(doc(db, 'families', fref.id, 'members', u.uid), {
    uid: u.uid, displayName, role, isOwner: true, email: u.email || '', photoURL: u.photoURL || '', joinedAt: serverTimestamp(),
  });
  await b.commit();
  await saveProfile(u.uid, { familyId: fref.id, displayName, role, email: u.email || '' });
  return fref.id;
}

export async function getInvite(token) {
  const s = await getDoc(doc(db, 'invites', token));
  const inv = norm(s);
  if (!inv || !inv.expiresAt || inv.expiresAt < new Date()) return null;
  return inv;
}
export async function resolveInviteInput(input) {
  const raw = String(input || '').trim();
  const m = raw.match(/join\/([A-Za-z0-9]+)/);
  if (m) return getInvite(m[1]);
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length === 6) {
    const c = norm(await getDoc(doc(db, 'inviteCodes', code)));
    if (!c || c.expiresAt < new Date()) return null;
    return getInvite(c.token);
  }
  if (raw.length >= 16) return getInvite(raw);
  return null;
}

export async function joinFamily(invite, { displayName, role }) {
  const u = auth.currentUser;
  const b = writeBatch(db);
  b.set(doc(db, 'families', invite.familyId, 'members', u.uid), {
    uid: u.uid, displayName, role, isOwner: false, email: u.email || '', photoURL: u.photoURL || '',
    inviteToken: invite.id, joinedAt: serverTimestamp(),
  });
  b.update(doc(db, 'families', invite.familyId), { memberIds: arrayUnion(u.uid) });
  await b.commit();
  await saveProfile(u.uid, { familyId: invite.familyId, displayName, role, email: u.email || '' });
}

export const watchFamily = (fid, cb, onErr) => onSnapshot(doc(db, 'families', fid), (s) => cb(norm(s)), (e) => onErr?.(e));
export const watchMembers = (fid, cb) => onSnapshot(collection(db, 'families', fid, 'members'), (qs) => cb(list(qs)), () => cb([]));
export const renameFamily = (fid, name) => updateDoc(doc(db, 'families', fid), { name });
// Run 23: family-level settings go through /api/app/family-settings (owner + adults; validated server-side).
export async function updateFamilySettings(fid, patch) {
  const r = await fetch('/api/app/family-settings', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await auth.currentUser.getIdToken()}` }, body: JSON.stringify({ patch }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'error'), { code: d.error || 'error', status: r.status });
  return d.settings;
}
export const setMemberRoleFull = (fid, uid, role, roleLabel = '') => updateDoc(doc(db, 'families', fid, 'members', uid), { role, roleLabel });

export async function createInvite(fid, familyName) {
  const u = auth.currentUser;
  const token = randomId(24, TOKEN_ALPHABET);
  const code = randomId(6, CODE_ALPHABET);
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 7 * 864e5));
  const b = writeBatch(db);
  b.set(doc(db, 'invites', token), { familyId: fid, familyName, code, createdBy: u.uid, expiresAt, createdAt: serverTimestamp() });
  b.set(doc(db, 'inviteCodes', code), { token, familyId: fid, expiresAt });
  b.set(doc(db, 'families', fid, 'invites', token), { code, createdBy: u.uid, expiresAt, createdAt: serverTimestamp() });
  await b.commit();
  return { id: token, token, code, expiresAt: expiresAt.toDate() };
}
export const watchInvites = (fid, cb) => onSnapshot(collection(db, 'families', fid, 'invites'), (qs) => cb(list(qs)), () => cb([]));
export async function revokeInvite(fid, inv) {
  const b = writeBatch(db);
  b.delete(doc(db, 'invites', inv.id));
  b.delete(doc(db, 'inviteCodes', inv.code));
  b.delete(doc(db, 'families', fid, 'invites', inv.id));
  await b.commit();
}

export async function removeMember(fid, uid) {
  const b = writeBatch(db);
  b.delete(doc(db, 'families', fid, 'members', uid));
  b.update(doc(db, 'families', fid), { memberIds: arrayRemove(uid) });
  await b.commit();
}
export const setMemberRole = (fid, uid, role) => updateDoc(doc(db, 'families', fid, 'members', uid), { role });
export const updateMyMember = (fid, uid, data) => updateDoc(doc(db, 'families', fid, 'members', uid), data);
// Optional birthday "YYYY-MM-DD" ('' clears). Owner can set anyone's; members their own (needs the updated rules).
export const setMemberBirthday = (fid, uid, birthday) => updateDoc(doc(db, 'families', fid, 'members', uid), { birthday });

// ---------- Push devices ----------
// users/{uid}/pushSubs/* (needs the pushSubs rules block). Before the rules are published the listener errors
// and reports [] — the profile fallback map users/{uid}.pushSubs (from watchProfile) covers that case.
export const watchPushSubs = (uid, cb) => onSnapshot(collection(db, 'users', uid, 'pushSubs'), (qs) => cb(list(qs)), () => cb([]));
export const deletePushSubMock = async () => {};

export async function leaveFamily(fid) {
  const u = auth.currentUser;
  await updateDoc(doc(db, 'families', fid), { memberIds: arrayRemove(u.uid) });
  await deleteDoc(doc(db, 'families', fid, 'members', u.uid)).catch(() => {});
  await saveProfile(u.uid, { familyId: null });
}

// Leave the current family before joining another. Owners can only leave when they are the sole member.
export async function exitFamily(family) {
  const u = auth.currentUser;
  if (!family) return;
  if (family.ownerId === u.uid) {
    if ((family.memberIds || []).length > 1) throw Object.assign(new Error('owner_with_members'), { code: 'owner_with_members' });
    await deleteDoc(doc(db, 'families', family.id, 'members', u.uid)).catch(() => {});
    await deleteDoc(doc(db, 'families', family.id));
  } else {
    await leaveFamily(family.id);
  }
}

export async function deleteAccount({ family, members }) {
  const u = auth.currentUser;
  if (family) {
    const others = (family.memberIds || []).filter((x) => x !== u.uid);
    if (family.ownerId === u.uid) {
      if (others.length) {
        const heir = members.find((m) => m.uid !== u.uid && m.role === 'parent') || members.find((m) => m.uid !== u.uid);
        await updateDoc(doc(db, 'families', family.id, 'members', heir.uid), { isOwner: true }).catch(() => {});
        await updateDoc(doc(db, 'families', family.id), { ownerId: heir.uid, memberIds: arrayRemove(u.uid) });
        await deleteDoc(doc(db, 'families', family.id, 'members', u.uid)).catch(() => {});
      } else {
        await deleteDoc(doc(db, 'families', family.id, 'members', u.uid)).catch(() => {});
        await deleteDoc(doc(db, 'families', family.id)).catch(() => {});
      }
    } else {
      await leaveFamily(family.id).catch(() => {});
    }
  }
  await deleteDoc(doc(db, 'users', u.uid)).catch(() => {});
  try {
    await deleteUser(u);
  } catch (e) {
    if (e.code === 'auth/requires-recent-login') {
      const google = u.providerData.some((x) => x.providerId === 'google.com');
      if (google) { await reauthenticateWithPopup(u, new GoogleAuthProvider()); await deleteUser(u); }
      else throw e;
    } else throw e;
  }
}

// ---------- Family collections ----------
const sub = (fid, name) => collection(db, 'families', fid, name);
export const watchMemories = (fid, cb) => onSnapshot(sub(fid, 'memories'), (qs) => cb(list(qs).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))), () => cb([]));
export const addMemory = (fid, data) => addDoc(sub(fid, 'memories'), { ...data, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
export const updateMemory = (fid, id, data) => updateDoc(doc(db, 'families', fid, 'memories', id), data);
// Upsert with a known id (insights: ins_<uid>_<key>). createdBy must be the caller (rules); kept on updates.
export const setMemory = (fid, id, data) => setDoc(doc(db, 'families', fid, 'memories', id), { ...data, createdBy: auth.currentUser.uid, updatedAt: serverTimestamp() }, { merge: true });
export const deleteMemory = (fid, id) => deleteDoc(doc(db, 'families', fid, 'memories', id));

// Family calendar sharing (opt-in): each member's own client writes a compact snapshot of their upcoming events to
// families/{fid}/calendarShare/{uid}; other members read it. Needs the calendarShare rule in firestore.rules.
export const watchCalendarShares = (fid, cb, onErr) => onSnapshot(sub(fid, 'calendarShare'), (qs) => cb(list(qs)), (e) => { cb([]); onErr?.(e); });
export const saveCalendarShare = (fid, uid, data) => setDoc(doc(db, 'families', fid, 'calendarShare', uid), { ...data, uid, updatedAt: serverTimestamp() });
export const deleteCalendarShare = (fid, uid) => deleteDoc(doc(db, 'families', fid, 'calendarShare', uid));

export const watchReminders = (fid, cb) => onSnapshot(sub(fid, 'reminders'), (qs) => cb(list(qs)), () => cb([]));
export const addReminder = (fid, { title, dueAt, memberId }) =>
  addDoc(sub(fid, 'reminders'), {
    title, dueAt: dueAt ? Timestamp.fromDate(dueAt) : null, memberId: memberId || '', done: false,
    createdBy: auth.currentUser.uid, createdAt: serverTimestamp(),
  });
// Completing a reminder records when and by whom (behavioural insights: e.g. which weekday payments get done).
export const updateReminder = (fid, id, data) => updateDoc(doc(db, 'families', fid, 'reminders', id), data.done === true ? { ...data, doneAt: serverTimestamp(), doneBy: auth.currentUser.uid } : data);
export const deleteReminder = (fid, id) => deleteDoc(doc(db, 'families', fid, 'reminders', id));

export const watchUsage = (fid, month, cb) => onSnapshot(doc(db, 'families', fid, 'usage', month), (s) => cb(norm(s) || { count: 0, perMember: {} }), () => cb({ count: 0, perMember: {} }));

// Conversations (private to their owner)
export const watchConversations = (fid, uid, cb) =>
  onSnapshot(query(sub(fid, 'conversations'), where('ownerId', '==', uid)), (qs) => cb(list(qs).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))), () => cb([]));
export async function createConversation(fid, title) {
  const r = await addDoc(sub(fid, 'conversations'), { ownerId: auth.currentUser.uid, title, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return r.id;
}
export const touchConversation = (fid, cid, data = {}) => updateDoc(doc(db, 'families', fid, 'conversations', cid), { ...data, updatedAt: serverTimestamp() });
// Rename / pin without moving the chat in the history (updatedAt unchanged).
export const updateConversation = (fid, cid, data = {}) => updateDoc(doc(db, 'families', fid, 'conversations', cid), data);
export const listMessages = async (fid, cid) => mergeAttChunks(list(await getDocs(query(collection(db, 'families', fid, 'conversations', cid, 'messages'), limit(260)))));
export const watchMessages = (fid, cid, cb) =>
  onSnapshot(collection(db, 'families', fid, 'conversations', cid, 'messages'), (qs) => cb(mergeAttChunks(list(qs)).sort((a, b) => (a.createdAt || new Date()) - (b.createdAt || new Date()))), () => cb([]));
export const addMessage = (fid, cid, msg) => addDoc(collection(db, 'families', fid, 'conversations', cid, 'messages'), { ...msg, createdAt: serverTimestamp() });
export const updateMessage = (fid, cid, mid, data) => updateDoc(doc(db, 'families', fid, 'conversations', cid, 'messages', mid), data);
export async function deleteConversation(fid, cid) {
  const qs = await getDocs(query(collection(db, 'families', fid, 'conversations', cid, 'messages'), limit(400)));
  const b = writeBatch(db);
  qs.docs.forEach((d) => b.delete(d.ref));
  b.delete(doc(db, 'families', fid, 'conversations', cid));
  await b.commit();
}

// Quiz results & agent inbox (private to the member)
export const watchQuizResults = (fid, uid, cb) =>
  onSnapshot(query(sub(fid, 'quizResults'), where('uid', '==', uid)), (qs) => cb(list(qs).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))), () => cb([]));
export const addQuizResult = (fid, data) => addDoc(sub(fid, 'quizResults'), { ...data, uid: auth.currentUser.uid, createdAt: serverTimestamp() });

export const watchInbox = (fid, uid, cb) =>
  onSnapshot(query(sub(fid, 'inbox'), where('uid', '==', uid)), (qs) => cb(list(qs).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))), () => cb([]));
export const addInboxItem = (fid, data) => addDoc(sub(fid, 'inbox'), { ...data, uid: auth.currentUser.uid, status: 'new', createdAt: serverTimestamp() });
export const updateInboxItem = (fid, id, data) => updateDoc(doc(db, 'families', fid, 'inbox', id), data);
