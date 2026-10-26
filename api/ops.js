import { TEST_EMAIL_DOMAINS } from '../src/lib/test-domains.js';
// /api/ops (Nest 巢) — ONE serverless function (Hobby plan: 12 max) for the beta promo, the caller's effective plan
// and the admin panel. vercel.json rewrites:
//   GET  /api/promo              → op=promo-status   public: {max, claimed, remaining, open}
//   POST /api/promo/ping         → op=promo-ping     ID token: records activity (server index) + returns effective plan
//   POST /api/promo/claim        → op=promo-claim    ID token, {code:'BETA'}: atomic claim for the caller's family
//   GET  /api/admin/whoami|overview|summary, POST /api/admin/action  → op=admin-*   admin only, everyone else gets 404
//   POST /api/plugins/*          → op=plug-*        plugin store, studio, reviews, admin moderation (api/_plugins.js)
//   POST /api/memory/extract     → op=mem-extract    ID token: chat → private memory + suggestions (caller's own profile only)
// Storage + plan resolution: api/_ops-lib.js.
import {
  json, callerOf, isAdminClaims, fsGet, fsCount, fsCommit, docName, pathsWrite, enc,
  readLedger, ledgerTx, ledgerWrite, promoState, claimPromo, resolvePlan, hkDay, addMonths,
  hasServiceAccount, serviceToken, listAuthUsers, setAuthDisabled, listCollection, LEDGER_EMAILS, PROMO_MAX, PROJECT, isTestEmail, purgeTestClaims, isOfficialEmail, OFFICIAL,
} from './_ops-lib.js';
import { firebaseConfig } from '../src/firebase-config.js';
import { pluginOps } from './_plugins.js';
import { toHans } from '../src/lib/hans.js';
import { accountKind, normHandle, handleProblem } from '../src/lib/profile.js';
import { profileId } from './_plugins.js';
import { gate, appConfigOp, appAnnEvent, appImg, adminConfig, adminAnn, adminTranslate, adminCodes, redeemCode, revokeSessions, pluginStats, readConfigDoc } from './_admin.js';
import { readConfig } from '../src/lib/admin-config.js';
import { blogIndexOp, blogPostOp, blogSitemapOp, blogLlmsOp, blogMediaOp, blogAdminOp } from './_blog.js';
import { githubOps } from './_github.js';
import { emailOps } from './_email.js';
import { statusAllResponse } from './_status.js';
import { todayOp, familySettingsOp } from './_run23.js';
import { driveRoute } from './_run24.js';

export const config = { runtime: 'edge' };

const notFound = () => json(404, { error: 'not_found' });
const SYSTEM_RE = /@(system|waitlist)\.heynest\.invalid$/i;
const GOOGLE = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];

async function lookupSelf(idToken) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://heynest.vercel.app/' }, body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  return (await r.json()).users?.[0] || null;
}
const connOf = (p = {}) => ({
  gmail: !!p.connections?.gmail, gcal: !!p.connections?.googlecalendar, classroom: !!p.connections?.googleclassroom, drive: !!p.connections?.googledrive,
  gAccts: Object.keys(p.googleVault || {}).length || (Array.isArray(p.googleAccounts) ? p.googleAccounts.length : 0),
  apple: Object.keys(p.appleVault || {}).length,
});

// ---------------- promo ----------------
async function promoStatus() {
  try {
    await purgeTestClaims().catch(() => {});
    const st = promoState(await readLedger({ maxAge: 10e3 }));
    return json(200, { max: st.max, claimed: st.claimed, remaining: st.remaining, open: st.open });
  } catch { return json(200, { max: PROMO_MAX, claimed: null, remaining: null, open: true, unknown: true }); }
}

async function familyOf(c) {
  const prof = (await fsGet(`users/${c.uid}`, c.token))?.data || {};
  const fid = prof.familyId || null;
  let fam = null;
  if (fid) {
    fam = (await fsGet(`families/${fid}`, c.token).catch(() => null))?.data || null;
    if (fam && !(fam.memberIds || []).includes(c.uid)) fam = null;
  }
  return { prof, fid: fam ? fid : null, fam };
}

async function promoPing(c) {
  const day = hkDay();
  const [{ prof, fid, fam }, me, ledger, idx0] = await Promise.all([familyOf(c), lookupSelf(c.token), readLedger({ maxAge: 5e3 }).catch(() => ({})), readLedger({ which: 'index', maxAge: 15e3 }).catch(() => ({}))]);
  const plan = resolvePlan(fam?.plan, ledger, fid);
  // Sign-ups closed (admin config): an account CREATED after closing is blocked server-side (gateCaller → signup_closed).
  try {
    const cfg = readConfig((await readConfigDoc()).cfg);
    const created = Number(me?.createdAt) || 0;
    if (!cfg.signup.open && cfg.signup.closedAt && created > cfg.signup.closedAt && !isAdminClaims(c) && !ledger?.signupBlocked?.[c.uid]) {
      await ledgerTx((doc) => ({ entries: [[['signupBlocked', c.uid], { at: Date.now(), created }]], result: true }));
    }
  } catch {}
  const attToday = Number(idx0?.att?.[day]?.[c.uid] || 0);
  // Activity index (server-only). Best effort: never blocks the response on failure.
  try {
    if (!SYSTEM_RE.test(c.email)) {
      const entries = [
        [['u', c.uid], {
          e: c.email, n: me?.displayName || c.name || '', p: c.provider || (me?.providerUserInfo?.[0]?.providerId) || '',
          c: Number(me?.createdAt) || null, ll: Number(me?.lastLoginAt) || null, la: Date.now(), f: fid, cx: connOf(prof),
          wl: Object.keys(prof.waitlist || {}),
        }],
        [['act', day, c.uid], true],
      ];
      if (fid) {
        const [rem, mem] = await Promise.all([fsCount(`families/${fid}`, 'reminders', c.token), fsCount(`families/${fid}`, 'memories', c.token)]);
        entries.push([['f', fid], { n: fam.name || '', m: (fam.memberIds || []).length, ids: fam.memberIds || [], o: fam.ownerId || '', pl: fam.plan || 'free', la: Date.now(), r: rem, mem }]);
      }
      await ledgerWrite(entries, 'index');
    }
  } catch {}
  return json(200, { plan: plan.id, source: plan.source, until: plan.until, base: plan.base, betaUntil: plan.betaUntil, grantUntil: plan.grantUntil, ended: plan.ended, familyId: fid, disabled: !!ledger?.disabled?.[c.uid], attToday });
}

async function promoClaim(c, body) {
  const code = String(body?.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) return json(400, { error: 'bad_code' });
  if (code !== 'BETA') { // admin-made codes (api/_admin.js): Pro for N months as a ledger grant
    if (isTestEmail(c.email) && !/^TEST-/.test(code)) return json(403, { error: 'test_account_ineligible' });
    const { fid } = await familyOf(c);
    if (!fid) return json(409, { error: 'no_family' });
    const r = await redeemCode({ code, fid, uid: c.uid });
    const ok = r.status === 'claimed' || r.status === 'already';
    return json(ok ? 200 : r.status === 'bad_code' ? 400 : 409, ok ? r : { error: r.status, ...r });
  }
  if ((await readLedger({ maxAge: 10e3 }).catch(() => ({})))?.codes?.BETA?.disabled) return json(409, { error: 'promo_paused', status: 'paused' });
  // Test / system accounts can never take a beta slot (permanent rule, 2026-10-18).
  if (isTestEmail(c.email) || isOfficialEmail(c.email)) return json(403, { error: 'test_account_ineligible', message: 'Test and system accounts cannot claim the beta promo.' });
  const { fid, fam } = await familyOf(c);
  if (!fid) return json(409, { error: 'no_family' });
  const idx = await readLedger({ which: 'index' }).catch(() => ({}));
  if (isTestEmail(idx.u?.[fam?.ownerId]?.e)) return json(403, { error: 'test_account_ineligible', message: 'Families owned by test accounts cannot claim the beta promo.' });
  const r = await claimPromo({ key: 'beta', fid, uid: c.uid });
  // Mirror for display/compat (owner only; the ledger is the source of truth).
  if ((r.status === 'claimed' || r.status === 'already') && fam.ownerId === c.uid && r.until) {
    await fsCommit([{ ...pathsWrite(docName(`families/${fid}`), [[['betaProUntil'], new Date(r.until)]]), currentDocument: { exists: true } }], c.token).catch(() => {});
  }
  return json(200, r);
}

// ---------------- admin ----------------
async function overview() {
  const now = Date.now();
  const [ledger, index] = await Promise.all([readLedger({ maxAge: 0 }), readLedger({ which: 'index' }).catch(() => ({}))]);
  const full = hasServiceAccount();
  const iu = index.u || {};
  const ifam = index.f || {};
  let users = []; let families = []; const notes = []; let crBy = {};

  if (full) {
    const tok = await serviceToken();
    const [auth, fams, profs, creators] = await Promise.all([listAuthUsers(tok), listCollection('families', tok), listCollection('users', tok), listCollection('nestCreators', tok).catch(() => [])]);
    const profBy = Object.fromEntries(profs.map((p) => [p.id, p.data]));
    crBy = Object.fromEntries(creators.map((x) => [x.id, x.data]));
    users = auth.map((u) => {
      const p = profBy[u.localId] || {}; const ix = iu[u.localId] || {};
      return {
        uid: u.localId, email: u.email || '', name: u.displayName || p.displayName || ix.n || '', provider: (u.providerUserInfo || []).map((x) => x.providerId).join(', ') || 'password',
        createdAt: Number(u.createdAt) || null, lastLogin: Number(u.lastLoginAt) || null, lastActive: Math.max(Number(u.lastRefreshAt ? Date.parse(u.lastRefreshAt) : 0) || 0, ix.la || 0) || null,
        fid: p.familyId || null, disabled: !!u.disabled, emailVerified: !!u.emailVerified, cx: connOf(p), wl: Object.keys(p.waitlist || {}),
      };
    });
    const famCounts = await Promise.all(fams.map(async (f) => {
      const [r, m, cv] = await Promise.all(['reminders', 'memories', 'conversations'].map((col) => fsCount(`families/${f.id}`, col, tok)));
      return [f.id, { r, mem: m, conv: cv }];
    }));
    const cBy = Object.fromEntries(famCounts);
    families = fams.map((f) => ({ fid: f.id, name: f.data.name || '', members: (f.data.memberIds || []).length, memberIds: f.data.memberIds || [], ownerId: f.data.ownerId, basePlan: f.data.plan || 'free', createdAt: f.createTime, lastActive: ifam[f.id]?.la || null, reminders: cBy[f.id]?.r, memories: cBy[f.id]?.mem, conversations: cBy[f.id]?.conv }));
    notes.push('Full mode: every Firebase Auth user and family is listed via the service account.');
  } else {
    users = Object.entries(iu).map(([uid, x]) => ({
      uid, email: x.e || '', name: x.n || '', provider: x.p || '', createdAt: x.c || null, lastLogin: x.ll || null, lastActive: x.la || null,
      fid: x.f || null, disabled: !!ledger?.disabled?.[uid], cx: x.cx || {}, wl: x.wl || [],
    }));
    families = Object.entries(ifam).map(([fid, x]) => ({ fid, name: x.n || '', members: x.m || 0, memberIds: x.ids || [], ownerId: x.o || '', basePlan: x.pl || 'free', createdAt: null, lastActive: x.la || null, reminders: x.r, memories: x.mem, conversations: null }));
    // Families that claimed the promo but were never pinged.
    for (const fid of Object.keys(ledger?.promos?.beta?.claims || {})) if (!ifam[fid]) families.push({ fid, name: '', members: null, memberIds: [], basePlan: 'free', lastActive: null });
    notes.push('Limited mode: no FIREBASE_SERVICE_ACCOUNT. Lists only users who opened Nest since the admin panel launched (2026-10-18). Disable/enable only blocks AI requests in Nest (not the Firebase sign-in).');
  }

  await purgeTestClaims().catch(() => {});
  // ONE definition for Overview, Users tab and the Home admin card: kind = real | test | system | official
  // (src/lib/profile.js accountKind). Every stat counts kind 'real' only; other rows stay listed, tagged.
  users = users.map((u) => {
    const kind = accountKind(u.email);
    const cr = crBy[profileId(u.uid)];
    return { ...u, kind, test: kind !== 'real', verified: !!cr?.verified, handle: cr?.handle || '' };
  });
  const userBy = Object.fromEntries(users.map((u) => [u.uid, u]));
  families = families.map((f) => ({ ...f, test: !!userBy[f.ownerId]?.test })).map((f) => {
    const p = resolvePlan(f.basePlan, ledger, f.fid, now);
    const claim = ledger?.promos?.beta?.claims?.[f.fid];
    const grant = ledger?.grants?.[f.fid];
    return { ...f, owner: userBy[f.ownerId]?.email || '', plan: p.id, planSource: p.source, planUntil: p.until, betaUntil: claim ? Number(claim.until) : null, betaAt: claim ? Number(claim.at) : null, grantUntil: grant ? Number(grant.until) : null };
  });
  const famBy = Object.fromEntries(families.map((f) => [f.fid, f]));
  users = users.map((u) => ({ ...u, familyName: famBy[u.fid]?.name || '', plan: u.fid ? (famBy[u.fid]?.plan || 'free') : '—', planSource: famBy[u.fid]?.planSource || '' }));
  // Stats below exclude test accounts / test families (rows stay listed, tagged "Test").
  const allUsers = users; const allFamilies = families;
  users = users.filter((u) => !u.test); families = families.filter((f) => !f.test);
  const testUids = new Set(allUsers.filter((u) => u.test).map((u) => u.uid));

  // Analytics
  const DAY = 864e5;
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(hkDay(now - i * DAY));
  const signups = Object.fromEntries(days.map((d) => [d, 0]));
  for (const u of users) if (u.createdAt) { const d = hkDay(u.createdAt); if (d in signups) signups[d]++; }
  const act = index.act || {};
  const today = hkDay(now);
  const week = new Set();
  for (let i = 0; i < 7; i++) for (const uid of Object.keys(act[hkDay(now - i * DAY)] || {})) if (!testUids.has(uid)) week.add(uid);
  const lastActiveWithin = (ms) => users.filter((u) => u.lastActive && now - u.lastActive < ms).length;
  const dau = Math.max(Object.keys(act[today] || {}).filter((u) => !testUids.has(u)).length, lastActiveWithin(DAY));
  const msgs = { chat: 0, tutor: 0, quiz: 0, summary: 0, memory: 0, inbox: 0, draft: 0 };
  const msgDays = {};
  for (const [d, m] of Object.entries(index.m || {})) {
    if (!days.includes(d)) continue;
    let t = 0;
    for (const [k, v] of Object.entries(m || {})) { msgs[k] = (msgs[k] || 0) + Number(v || 0); t += Number(v || 0); }
    msgDays[d] = t;
  }
  const wl = { starter: 0, pro: 0 };
  for (const x of Object.values(index.wl || {})) if (x?.p in wl) wl[x.p]++;
  // Signed-in waitlist entries stored on profiles (users/{uid}.waitlist.{plan}) that predate the index.
  const wlUsers = { starter: 0, pro: 0 };
  for (const u of users) for (const p of u.wl || []) if (p in wlUsers) wlUsers[p]++;
  const sum = (k) => families.reduce((n, f) => n + (Number(f[k]) || 0), 0);
  const analytics = {
    totalUsers: users.length, totalFamilies: families.filter((f) => f.members !== null).length,
    signups: days.map((d) => ({ day: d.slice(2), n: signups[d] })),
    messagesPerDay: days.map((d) => ({ day: d.slice(2), n: msgDays[d] || 0 })),
    dau, wau: Math.max(week.size, lastActiveWithin(7 * DAY)),
    activeFamilies7d: families.filter((f) => f.lastActive && now - f.lastActive < 7 * DAY).length,
    features: {
      aiMessages30d: Object.values(msgs).reduce((a, b) => a + b, 0), byMode: msgs,
      reminders: sum('reminders'), memories: sum('memories'),
      gmail: users.filter((u) => u.cx?.gmail).length, gcal: users.filter((u) => u.cx?.gcal).length, classroom: users.filter((u) => u.cx?.classroom).length,
      drive: users.filter((u) => u.cx?.drive).length, apple: users.reduce((n, u) => n + (Number(u.cx?.apple) || 0), 0),
    },
    paid: { live: false, paidFamilies: 0, conversion: 0, waitlist: { starter: Math.max(wl.starter, wlUsers.starter), pro: Math.max(wl.pro, wlUsers.pro) } },
    since: index.since || '2026-10-18',
    plugins: await pluginStats().catch(() => null),
  };

  const st = promoState(ledger);
  const promo = {
    max: st.max, claimed: st.claimed, remaining: st.remaining,
    claims: Object.entries(st.claims).map(([fid, x]) => ({ fid, family: famBy[fid]?.name || '', by: userBy[x.uid]?.email || x.uid, at: Number(x.at), until: Number(x.until), active: Number(x.until) > now })).sort((a, b) => a.at - b.at),
  };
  // Prune activity older than 40 days (server index only).
  const old = Object.keys(act).filter((d) => d < hkDay(now - 40 * DAY));
  const oldM = Object.keys(index.m || {}).filter((d) => d < hkDay(now - 40 * DAY));
  if (old.length || oldM.length) ledgerWrite([...old.map((d) => [['act', d], undefined]), ...oldM.map((d) => [['m', d], undefined])], 'index').catch(() => {});

  const counts = { real: 0, test: 0, system: 0, official: 0 };
  for (const u of allUsers) counts[u.kind] = (counts[u.kind] || 0) + 1;
  return json(200, {
    mode: full ? 'full' : 'limited', notes, now, counts,
    users: allUsers.sort((a, b) => (b.lastActive || b.createdAt || 0) - (a.lastActive || a.createdAt || 0)),
    families: allFamilies.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0)),
    analytics, promo, log: (ledger.log || []).slice().sort((a, b) => b.at - a.at),
  });
}

// Compact numbers for the admin card on Home (cheap: no per-family counts, no analytics).
async function summary() {
  const [ledger, index] = await Promise.all([readLedger({ maxAge: 10e3 }), readLedger({ which: 'index' }).catch(() => ({}))]);
  const full = hasServiceAccount();
  let users; let families;
  if (full) {
    const tok = await serviceToken();
    const [auth, fams] = await Promise.all([listAuthUsers(tok), listCollection('families', tok)]);
    const real = new Set(auth.filter((u) => accountKind(u.email) === 'real').map((u) => u.localId));
    users = real.size;
    families = fams.filter((f) => real.has(f.data?.ownerId)).length;
  } else {
    const real = new Set(Object.entries(index.u || {}).filter(([, x]) => accountKind(x?.e) === 'real').map(([u]) => u));
    users = real.size;
    families = Object.values(index.f || {}).filter((f) => real.has(f?.o)).length;
  }
  const st = promoState(ledger);
  const today = hkDay(Date.now());
  return json(200, {
    mode: full ? 'full' : 'limited', users, families,
    activeToday: Object.keys(index.act?.[today] || {}).length,
    beta: { claimed: st.claimed, max: st.max, remaining: st.remaining },
  });
}

async function action(c, body) {
  const type = String(body?.type || '');
  const now = Date.now();
  const fid = String(body?.fid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  const uid = String(body?.uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
  const until = Number(body?.until);
  const note = String(body?.note || '').slice(0, 200);
  const needUntil = () => { if (!(until > now) || until > now + 3 * 366 * 864e5) throw Object.assign(new Error('bad_until'), { status: 400 }); };
  const entry = (detail) => ({ at: now, by: c.email, action: type, target: fid || uid, detail });
  const withLog = (doc, entries, detail) => [...entries, [['log'], [entry(detail), ...(doc.log || [])].slice(0, 300)]];

  if (type === 'grant') {
    if (!fid) return json(400, { error: 'bad_target' });
    needUntil();
    await ledgerTx((doc) => ({ entries: withLog(doc, [[['grants', fid], { until, by: c.email, at: now, note }]], `Pro until ${new Date(until).toISOString()}${note ? ` · ${note}` : ''}`), result: true }));
  } else if (type === 'revoke') {
    if (!fid) return json(400, { error: 'bad_target' });
    await ledgerTx((doc) => {
      const e = [[['grants', fid], undefined]];
      const claim = doc?.promos?.beta?.claims?.[fid];
      if (claim && Number(claim.until) > now) e.push([['promos', 'beta', 'claims', fid, 'until'], now]);
      return { entries: withLog(doc, e, `Pro revoked${claim ? ' (beta gift ended now; slot stays used)' : ''}`), result: true };
    });
  } else if (type === 'extend') {
    if (!fid) return json(400, { error: 'bad_target' });
    needUntil();
    const r = await ledgerTx((doc) => {
      if (!doc?.promos?.beta?.claims?.[fid]) return { result: false };
      return { entries: withLog(doc, [[['promos', 'beta', 'claims', fid, 'until'], until]], `Beta gift until ${new Date(until).toISOString()}`), result: true };
    });
    if (!r) return json(409, { error: 'no_beta_claim' });
  } else if (type === 'set-plan') {
    // The family's own (base) plan — written with the service account (clients can never change it), logged.
    const plan = String(body?.plan || '');
    if (!fid || !['free', 'starter', 'pro'].includes(plan)) return json(400, { error: 'bad_target' });
    if (!hasServiceAccount()) return json(503, { error: 'no_service_account' });
    const w = await fsCommit([{ ...pathsWrite(docName(`families/${fid}`), [[['plan'], plan]]), currentDocument: { exists: true } }], await serviceToken());
    if (!w.ok) return json(502, { error: 'write_failed' });
    await ledgerTx((doc) => ({ entries: withLog(doc, [], `Family plan set to ${plan}${note ? ` · ${note}` : ''}`), result: true }));
  } else if (type === 'disable' || type === 'enable') {
    if (!uid) return json(400, { error: 'bad_target' });
    const off = type === 'disable';
    let authFlag = false;
    if (hasServiceAccount()) { await setAuthDisabled(await serviceToken(), uid, off); authFlag = true; }
    await ledgerTx((doc) => ({ entries: withLog(doc, [[['disabled', uid], off ? { at: now, by: c.email, ...(note ? { note } : {}) } : undefined], ...(off ? [] : [[['signupBlocked', uid], undefined]])], `${off ? 'Disabled' : 'Enabled'}${authFlag ? ' (Firebase Auth flag + Nest AI)' : ' (Nest AI only — no service account)'}`), result: true }));
  } else if (type === 'verify-user' || type === 'unverify-user') {
    // Verified badge on the unified public profile (nestCreators/{uid}); every change is logged.
    if (!uid) return json(400, { error: 'bad_target' });
    if (!hasServiceAccount()) return json(503, { error: 'no_service_account' });
    const on = type === 'verify-user';
    const id = profileId(uid);
    const w = await fsCommit([pathsWrite(docName(`nestCreators/${id}`), [[['uid'], id], [['verified'], on], [['verifiedAt'], now], [['verifiedBy'], c.email]])], await serviceToken());
    if (!w.ok) return json(502, { error: 'write_failed' });
    await ledgerTx((doc) => ({ entries: withLog(doc, [], on ? 'Verified badge on' : 'Verified badge off'), result: true }));
  } else if (type === 'repair-profile') {
    // Run 10: undo landing-demo pollution of a public profile (handle / display name). Admin only, service account, logged.
    if (!uid) return json(400, { error: 'bad_target' });
    if (!hasServiceAccount()) return json(503, { error: 'no_service_account' });
    const id = profileId(uid);
    const st = await serviceToken();
    const cur = (await fsGet(`nestCreators/${id}`, st))?.data || {};
    const h = body?.handle != null ? normHandle(String(body.handle)) : '';
    if (h && handleProblem(h, { admin: true })) return json(400, { error: handleProblem(h, { admin: true }) });
    let name = body?.name != null ? String(body.name).trim().slice(0, 40) : null;
    // Run 11: name omitted + nameFromProfile → restore the public name from users/<uid>.displayName (what Settings always saves).
    if (!name && body?.nameFromProfile) name = String((await fsGet(`users/${uid}`, st))?.data?.displayName || '').trim().slice(0, 40) || null;
    const writes = [];
    const fields = [[['uid'], id], [['updatedAt'], now]];
    if (h && h !== cur.handle) {
      const owner = (await fsGet(`nestHandles/${h}`, st))?.data;
      if (owner && owner.uid !== id) return json(409, { error: 'handle_taken' });
      if (!owner) writes.push({ ...pathsWrite(docName(`nestHandles/${h}`), [[['uid'], id]]), currentDocument: { exists: false } });
      if (cur.handle) { const o = (await fsGet(`nestHandles/${cur.handle}`, st))?.data; if (!o || o.uid === id) writes.push({ delete: docName(`nestHandles/${cur.handle}`) }); }
      fields.push([['handle'], h]);
    }
    if (name) fields.push([['name'], name]);
    writes.push(pathsWrite(docName(`nestCreators/${id}`), fields));
    const w = await fsCommit(writes, st);
    if (!w.ok) return json(502, { error: 'write_failed', detail: w.status });
    await ledgerTx((doc) => ({ entries: withLog(doc, [], `Profile repaired: @${cur.handle || '—'} → @${h || cur.handle || '—'}; name "${cur.name || ''}" → "${name || cur.name || ''}"${note ? ` · ${note}` : ''}`), result: true }));
    return json(200, { ok: true, handle: h || cur.handle || '', name: name || cur.name || '', released: h && cur.handle && h !== cur.handle ? cur.handle : '' });
  } else return json(400, { error: 'bad_action' });
  return json(200, { ok: true });
}

// ---------------- memory from chats ----------------
// POST /api/memory/extract (ID token) {messages:[{role,content}], lang, members:[{uid,name,role}], existing:[text]}
// One Agnes call. Writes ONLY to the caller's own owner-only profile (users/{uid}):
//   chatMem.<id>    = {text, exp, about, at}      private facts about the user's own life — saved automatically (visible + deletable
//                                                    in Family Memory → From your chats; expires for time-bound items)
//   memSuggest.<id> = {kind:'chat'|'entity', ...}   anything about other people / the family, and structured entities
//                                                    (schools, tutors, doctors, contacts, allergies, sizes, medications, people) —
//                                                    shown as SUGGESTIONS until the user accepts (no hidden profiling).
// The client only calls this when Settings → "Remember from past chats" is on.
const MEM_TYPES = ['school', 'class', 'tutor', 'doctor', 'contact', 'allergy', 'size', 'medication', 'person', 'other'];
async function memExtract(c, body) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  const prof = (await fsGet(`users/${c.uid}`, c.token))?.data || {};
  if (prof.prefs?.chatMemory === false) return json(200, { ok: true, skipped: 'off' });
  const msgs = (Array.isArray(body?.messages) ? body.messages : []).slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').replace(/```[\s\S]*?```/g, '').slice(0, 1500) }));
  if (!msgs.some((m) => m.role === 'user')) return json(200, { ok: true, saved: 0 });
  const zh = body?.lang !== 'en';
  const today = hkDay();
  const members = (Array.isArray(body?.members) ? body.members : []).slice(0, 12).map((m) => `${String(m.name || '').slice(0, 40)} (${m.role === 'parent' ? 'parent' : 'student'})`).join(', ');
  const existing = (Array.isArray(body?.existing) ? body.existing : []).slice(0, 60).map((x) => `- ${String(x).slice(0, 160)}`).join('\n');
  const sys = [
    'Extract durable, useful memory from a family-helper chat. Output ONLY JSON: {"facts":[...],"entities":[...]}. Empty arrays when nothing qualifies.',
    `Today is ${today} (Hong Kong). The user is ${String(body?.me || 'the user').slice(0, 40)}. Family members: ${members || 'unknown'}.`,
    'facts: {"text": short statement in the THIRD person that names who it is about — never first person (USER: 「我是你的開發者」 → "<user name> 是這個 app 的開發者" / "<user name> is the developer of this app"; never 「我是…」 or "I am…"), "scope": "private" (about the user\'s own life/plans/preferences) | "family" (about other members or the household), "about": member name or "", "expires": "YYYY-MM-DD" for time-bound items (e.g. an important meeting tomorrow → tomorrow\'s date) or ""}.',
    'Examples: 「明天有重要會議得早睡」 → {"text":"明天（YYYY-MM-DD）有重要會議，想早點睡","scope":"private","about":"","expires":"<tomorrow>"}.',
    `entities: {"type": one of ${MEM_TYPES.join('|')}, "name": string, "about": member name or "", "fields": {"phone","email","address","schedule","relation","birthday","note"} (only keys you are given), "confidence": 0..1}. Only real, explicitly stated details. Never guess phone numbers or emails.`,
    'Skip: greetings, questions, things the assistant said that the user did not confirm, sensitive identifiers (ID numbers, card numbers, passwords). Never duplicate the existing memory below.',
    zh ? 'All text values in Traditional Chinese (繁體中文書面語) unless the user wrote English.' : 'All text values in English unless the user wrote Chinese.',
    existing ? `Existing memory:\n${existing}` : '',
  ].filter(Boolean).join('\n');
  let out = { facts: [], entities: [] };
  try {
    const r = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'agnes-3.0-flash', stream: false, temperature: 0.1, messages: [{ role: 'system', content: sys }, { role: 'user', content: msgs.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') }] }) });
    if (!r.ok) return json(502, { error: 'model' });
    const t = String((await r.json()).choices?.[0]?.message?.content || '');
    const a = t.indexOf('{'); const b = t.lastIndexOf('}');
    out = JSON.parse(t.slice(a, b + 1));
  } catch { return json(200, { ok: true, saved: 0, suggested: 0 }); }
  const BAD = /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b|[A-Z]{1,2}\d{6}\(?[0-9A]\)?|password|密碼/i;
  const id = () => 'm' + Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => x.toString(16).padStart(2, '0')).join('');
  const entries = []; let saved = 0; let suggested = 0;
  for (const f of (Array.isArray(out.facts) ? out.facts : []).slice(0, 6)) {
    const text = String(f?.text || '').trim().slice(0, 300);
    if (text.length < 4 || BAD.test(text)) continue;
    const exp = /^\d{4}-\d{2}-\d{2}$/.test(f.expires || '') ? f.expires : '';
    if (f.scope === 'family' || f.about) { entries.push([['memSuggest', id()], { kind: 'chat', text, about: String(f.about || '').slice(0, 40), exp, at: Date.now() }]); suggested++; }
    else { entries.push([['chatMem', id()], { text, exp, at: Date.now() }]); saved++; }
  }
  for (const e of (Array.isArray(out.entities) ? out.entities : []).slice(0, 6)) {
    const type = MEM_TYPES.includes(e?.type) ? e.type : 'other';
    const name = String(e?.name || '').trim().slice(0, 80);
    if (!name || Number(e?.confidence ?? 1) < 0.6) continue;
    const fields = Object.fromEntries(Object.entries(e.fields || {}).filter(([k, v]) => ['phone', 'email', 'address', 'schedule', 'relation', 'birthday', 'note'].includes(k) && v && !BAD.test(String(v))).map(([k, v]) => [k, String(v).slice(0, 200)]));
    entries.push([['memSuggest', id()], { kind: 'entity', type, name, about: String(e.about || '').slice(0, 40), fields, confidence: Number(e.confidence) || 0.8, src: 'chat', at: Date.now() }]); suggested++;
  }
  if (entries.length) {
    const w = await fsCommit([{ ...pathsWrite(docName(`users/${c.uid}`), entries), currentDocument: { exists: true } }], c.token);
    if (!w.ok) return json(502, { error: 'write', status: w.status });
  }
  return json(200, { ok: true, saved, suggested });
}

// ---------------- chat titles ----------------
// POST /api/chat-title (ID token) {lang, user, assistant} → {title}. One tiny Agnes call (≤ 24 tokens) after the first
// exchange of a chat; not counted against the family's AI quota. Rate limited per user per isolate (40/hour).
const titleHits = new Map();
export function cleanTitle(t, lang) {
  let s = String(t || '').split('\n')[0].trim().replace(/^(title|標題)\s*[:：]\s*/i, '').replace(/^["'「『“*]+|["'」』”*。．.!！?？]+$/g, '').trim();
  s = s.replace(/\s+/g, ' ');
  return lang === 'en' ? s.slice(0, 48) : s.slice(0, 16);
}
async function chatTitle(c, body) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  const now = Date.now();
  const l = (titleHits.get(c.uid) || []).filter((x) => now - x < 3600e3);
  if (l.length >= 40) return json(429, { error: 'rate_limited' });
  l.push(now); titleHits.set(c.uid, l);
  const lang = body?.lang === 'en' ? 'en' : 'zh-Hant';
  const u = String(body?.user || '').replace(/```[\s\S]*?```/g, '').slice(0, 600);
  const a = String(body?.assistant || '').replace(/```[\s\S]*?```/g, '').slice(0, 600);
  if (!u.trim()) return json(400, { error: 'empty' });
  const sys = lang === 'en'
    ? 'Write a short title (2–5 words, Title Case, no quotes, no emoji, no final punctuation) for this chat between a family member and the Nest helper app. Reply with the title only.'
    : '為這段家庭成員與 Nest 助理的對話寫一個簡短標題：4 至 10 個字，繁體中文書面語，不要引號、表情符號或句號。只回覆標題。';
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'agnes-3.0-flash', stream: false, temperature: 0.3, max_tokens: 24, messages: [{ role: 'system', content: sys }, { role: 'user', content: `USER: ${u}\n\nASSISTANT: ${a}` }] }) });
    if (!r.ok) return json(502, { error: 'model' });
    let title = cleanTitle((await r.json()).choices?.[0]?.message?.content, lang);
    if (body?.lang === 'zh-Hans') title = toHans(title);
    return json(200, { title });
  } catch { return json(504, { error: 'timeout' }); } finally { clearTimeout(tm); }
}

// ---------------- plan audit (admin, read-only) ----------------
// GET /api/admin/plan-audit?email=… → every place a plan can come from for that user, plus the resolved effective plan.
// Never writes anything (the beta ledger is only read).
const PLAN_KEYS = /plan|pro|beta|subscr|tier|grant|until|stripe|billing|trial/i;
async function planAudit(email) {
  if (!hasServiceAccount()) return json(503, { error: 'no_service_account' });
  const tok = await serviceToken();
  const want = String(email || '').trim().toLowerCase();
  const auth = (await listAuthUsers(tok)).filter((u) => String(u.email || '').toLowerCase() === want);
  if (!auth.length) return json(404, { error: 'no_such_user' });
  const [ledger, index] = await Promise.all([readLedger({ maxAge: 0 }), readLedger({ which: 'index' }).catch(() => ({}))]);
  const out = [];
  for (const u of auth) {
    const prof = (await fsGet(`users/${u.localId}`, tok).catch(() => null))?.data || {};
    const pick = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => PLAN_KEYS.test(k)).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]));
    const fid = prof.familyId || null;
    const fam = fid ? (await fsGet(`families/${fid}`, tok).catch(() => null))?.data || null : null;
    const plan = resolvePlan(fam?.plan, ledger, fid);
    out.push({
      uid: u.localId, providers: (u.providerUserInfo || []).map((x) => x.providerId), emailVerified: !!u.emailVerified, customClaims: u.customAttributes ? Object.keys(JSON.parse(u.customAttributes)) : [],
      profilePlanFields: pick(prof), familyId: fid, familyName: fam?.name || null, familyPlanFields: pick(fam || {}), familyOwner: fam?.ownerId === u.localId,
      ledgerGrant: fid ? ledger?.grants?.[fid] || null : null, ledgerBetaClaim: fid ? ledger?.promos?.beta?.claims?.[fid] || null : null, ledgerBetaUid: ledger?.promos?.beta?.uids?.[u.localId] || null,
      indexPlan: fid ? index.f?.[fid]?.pl || null : null, resolved: plan,
    });
  }
  return json(200, { email: want, accounts: out });
}


// ---------------- test-data cleanup (admin, 2026-10-18) ----------------
// GET  /api/admin/cleanup            → dry-run plan (nothing written)
// POST /api/admin/cleanup {step}     → step = plugins | accounts | counts | testreset (each short; every step logged)
// Hard safety rails: only accounts whose kind is 'test' (src/lib/profile.js accountKind) and that are NOT one of the two
// standing test accounts (KEEP_TEST) are deleted; the official account, system/ledger accounts and real users are never touched;
// a family is deleted only when every member is a deleted account (or it has no members). The beta ledger is only edited
// for the test family / test uids (never a real claim).
const FSB = 'https://firestore.googleapis.com/v1';
const IDTB = 'https://identitytoolkit.googleapis.com/v1';
// Standing test accounts that cleanup keeps (NEST_KEEP_TEST_EMAILS, comma-separated; default nest-test-owner/-member@<first test domain>).
export const KEEP_TEST = (process.env.NEST_KEEP_TEST_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).length
  ? (process.env.NEST_KEEP_TEST_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  : [`nest-test-owner@${TEST_EMAIL_DOMAINS[0]}`, `nest-test-member@${TEST_EMAIL_DOMAINS[0]}`];
export const CLEAN_PLUGINS = ['daily-encouragement', 'my-plugin-8z4i', 'qa-revision-pack'];
// Family id of the standing test family (NEST_TEST_FAMILY_ID); empty = no test-family promo reset.
const TEST_FAMILY = process.env.NEST_TEST_FAMILY_ID || '';
export function cleanupTargets(authUsers, families) {
  const del = authUsers.filter((u) => accountKind(u.email) === 'test' && !KEEP_TEST.includes(String(u.email || '').toLowerCase()) && u.localId !== OFFICIAL.uid);
  const delSet = new Set(del.map((u) => u.localId));
  const keepSet = new Set(authUsers.filter((u) => !delSet.has(u.localId)).map((u) => u.localId));
  const fams = [];
  const skipped = [];
  for (const f of families) {
    const ids = f.data?.memberIds || [];
    const ownerGone = delSet.has(f.data?.ownerId) || (f.data?.ownerId && !keepSet.has(f.data.ownerId) && !delSet.has(f.data.ownerId));
    const allGone = ids.every((m) => delSet.has(m) || !keepSet.has(m));
    if (ownerGone || (ids.length && allGone)) { if (ids.some((m) => keepSet.has(m))) skipped.push(f.id); else fams.push(f.id); }
  }
  return { accounts: del.map((u) => ({ uid: u.localId, email: u.email })), families: fams, skippedFamilies: skipped };
}
async function subcollections(path, tok) {
  const r = await fetch(`${FSB}/${docName(path)}:listCollectionIds`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ pageSize: 100 }) });
  if (!r.ok) return [];
  return (await r.json()).collectionIds || [];
}
async function docTree(path, tok, out = []) {
  out.push(path);
  for (const col of await subcollections(path, tok)) {
    const docs = await listCollection(`${path}/${col}`, tok, 5000).catch(() => []);
    await Promise.all(docs.map((d) => docTree(`${path}/${col}/${d.id}`, tok, out)));
  }
  return out;
}
async function deletePaths(paths, tok) {
  for (let i = 0; i < paths.length; i += 400) {
    const w = await fsCommit(paths.slice(i, i + 400).map((pth) => ({ delete: docName(pth) })), tok);
    if (!w.ok) throw Object.assign(new Error('delete_failed'), { status: 502 });
  }
  return paths.length;
}
async function realInstallCount(pid, tok, kindOf) {
  const rows = await listCollection(`nestPlugins/${pid}/installs`, tok, 5000).catch(() => []);
  return rows.filter((r) => r.data && !r.data.removed && !r.data.dev && kindOf(r.id) === 'real').length;
}
// Run 11: landing-demo values (src/lib/mock-core.js seed) that must never appear on a real public profile / family.
export const DEMO_HANDLES = ['mum', 'dad', 'ethan'];
export const DEMO_NAMES = ['媽媽', '妈妈', '爸爸', 'Mum', 'Dad', 'Ethan'];
export const DEMO_FAMILIES = ['陳家', '陈家', 'The Chans'];
const WL_RE = /^wl-[a-z0-9]+@waitlist\.heynest\.invalid$/;
// Waitlist placeholder accounts (api/waitlist.js) hold a real person's waitlist entry unless every stored email is a
// test address (or nothing was stored). Only those two kinds are ever offered for deletion.
export function classifyWaitlist(profileWaitlist) {
  const emails = Object.values(profileWaitlist || {}).map((x) => String(x?.email || '').toLowerCase()).filter(Boolean);
  if (!emails.length) return 'empty';
  return emails.every((e) => accountKind(e) === 'test') ? 'test' : 'real';
}
async function demoScan(tok, auth, fams) {
  const emailBy = Object.fromEntries(auth.map((u) => [u.localId, u.email || '']));
  const creators = await listCollection('nestCreators', tok).catch(() => []);
  const profiles = [];
  for (const c of creators) {
    const h = String(c.data?.handle || ''); const n = String(c.data?.name || '');
    if (!DEMO_HANDLES.includes(h) && !DEMO_NAMES.includes(n)) continue;
    const prof = (await fsGet(`users/${c.id}`, tok).catch(() => null))?.data || {};
    profiles.push({ uid: c.id, email: emailBy[c.id] || '', kind: accountKind(emailBy[c.id] || ''), handle: h, name: n, profileName: String(prof.displayName || '') });
  }
  const families = fams.filter((f) => DEMO_FAMILIES.includes(String(f.data?.name || ''))).map((f) => ({ fid: f.id, name: f.data.name, owner: emailBy[f.data?.ownerId] || f.data?.ownerId || '', ownerKind: accountKind(emailBy[f.data?.ownerId] || '') }));
  return { profiles, families };
}
async function waitlistScan(tok, auth) {
  const out = [];
  for (const u of auth.filter((x) => WL_RE.test(String(x.email || '').toLowerCase()))) {
    const prof = (await fsGet(`users/${u.localId}`, tok).catch(() => null))?.data || null;
    out.push({ uid: u.localId, email: u.email, kind: classifyWaitlist(prof?.waitlist) });
  }
  return out;
}
async function cleanupPlan(tok) {
  const [auth, fams, plugins, ledger] = await Promise.all([listAuthUsers(tok), listCollection('families', tok), listCollection('nestPlugins', tok), readLedger({ maxAge: 0 })]);
  const [demo, wl] = await Promise.all([demoScan(tok, auth, fams).catch(() => ({ profiles: [], families: [], error: true })), waitlistScan(tok, auth).catch(() => [])]);
  const t = cleanupTargets(auth, fams);
  const emailBy = Object.fromEntries(auth.map((u) => [u.localId, u.email || '']));
  const kindOf = (uid) => (emailBy[uid] === undefined ? 'gone' : accountKind(emailBy[uid]));
  const counts = await Promise.all(plugins.filter((x) => !x.data.deleted).map(async (x) => ({ id: x.id, firstParty: !!x.data.firstParty, installs: Number(x.data.installs) || 0, real: await realInstallCount(x.id, tok, kindOf) })));
  const testFam = TEST_FAMILY ? (await fsGet(`families/${TEST_FAMILY}`, tok).catch(() => null))?.data || null : null;
  const testUids = testFam?.memberIds || [];
  const p = ledger?.promos?.beta || {};
  return {
    accounts: t.accounts, families: t.families, skippedFamilies: t.skippedFamilies,
    plugins: [...new Set([...CLEAN_PLUGINS, ...plugins.filter((x) => !x.data.firstParty && kindOf(x.data.creatorUid) === 'test').map((x) => x.id)])].map((id) => { const x = plugins.find((y) => y.id === id); return x ? { id, exists: true, firstParty: !!x.data.firstParty, review: x.data.review || 'none', live: Number(x.data.live) || 0, pendingV: Number(x.data.pendingV) || 0, listed: !!x.data.listed, deleted: !!x.data.deleted } : { id, exists: false }; }),
    installCounts: counts.filter((c) => c.installs !== c.real),
    testFamily: { fid: TEST_FAMILY, exists: !!testFam, betaProUntil: testFam?.betaProUntil ? String(testFam.betaProUntil) : null, ledgerClaim: !!p.claims?.[TEST_FAMILY], ledgerGrant: !!ledger?.grants?.[TEST_FAMILY], ledgerUids: testUids.filter((u) => p.uids?.[u]) },
    keptTest: auth.filter((u) => KEEP_TEST.includes(String(u.email || '').toLowerCase())).map((u) => ({ uid: u.localId, email: u.email })),
    promo: { claimed: Object.keys(p.claims || {}).length, max: Number(p.max || PROMO_MAX) },
    demo,
    waitlist: { test: wl.filter((x) => x.kind === 'test').map((x) => ({ uid: x.uid, email: x.email })), empty: wl.filter((x) => x.kind === 'empty').map((x) => ({ uid: x.uid, email: x.email })), realKept: wl.filter((x) => x.kind === 'real').length },
  };
}
async function cleanupStep(c, step, tok) {
  const plan = await cleanupPlan(tok);
  const logIt = (detail) => ledgerTx((doc) => ({ entries: [[['log'], [{ at: Date.now(), by: c.email, action: `cleanup-${step}`, target: step, detail: String(detail).slice(0, 300) }, ...(doc.log || [])].slice(0, 300)]], result: true }));
  let out = {};
  if (step === 'plugins') {
    let n = 0; const done = [];
    for (const pl of plan.plugins) {
      if (!pl.exists || pl.firstParty) continue;
      n += await deletePaths(await docTree(`nestPlugins/${pl.id}`, tok), tok); done.push(pl.id);
    }
    const cleanIds = plan.plugins.map((x) => x.id);
    const reps = (await listCollection('nestPluginReports', tok, 2000).catch(() => [])).filter((r) => cleanIds.includes(r.data?.pid)).map((r) => `nestPluginReports/${r.id}`);
    n += await deletePaths(reps, tok);
    out = { deletedPlugins: done, docs: n };
    await logIt(`Deleted test plugins ${done.join(', ') || '—'} (${n} docs)`);
  } else if (step === 'accounts') {
    const delUids = new Set(plan.accounts.map((a) => a.uid));
    const paths = [];
    for (const fid of plan.families) paths.push(...await docTree(`families/${fid}`, tok));
    const famSet = new Set(plan.families);
    const [inv, codes] = await Promise.all([listCollection('invites', tok, 5000).catch(() => []), listCollection('inviteCodes', tok, 5000).catch(() => [])]);
    for (const x of inv) if (famSet.has(x.data?.familyId) || delUids.has(x.data?.createdBy)) paths.push(`invites/${x.id}`);
    for (const x of codes) if (famSet.has(x.data?.familyId)) paths.push(`inviteCodes/${x.id}`);
    for (const uid of delUids) {
      paths.push(...await docTree(`users/${uid}`, tok));
      const cr = (await fsGet(`nestCreators/${uid}`, tok).catch(() => null))?.data;
      if (cr) { paths.push(...await docTree(`nestCreators/${uid}`, tok)); if (cr.handle) paths.push(`nestHandles/${cr.handle}`); }
    }
    const plugins = await listCollection('nestPlugins', tok).catch(() => []);
    for (const pl of plugins) for (const uid of delUids) { paths.push(`nestPlugins/${pl.id}/installs/${uid}`, `nestPlugins/${pl.id}/reviews/${uid}`); }
    const n = await deletePaths([...new Set(paths)], tok);
    const authDeleted = [];
    for (const uid of delUids) {
      const r = await fetch(`${IDTB}/projects/${PROJECT()}/accounts:delete`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ localId: uid }) });
      if (r.ok) authDeleted.push(uid);
    }
    // Server index (activity / directory) entries of deleted accounts and families.
    const idx = await readLedger({ which: 'index', maxAge: 0 }).catch(() => ({}));
    const ent = [];
    for (const uid of delUids) { if (idx.u?.[uid]) ent.push([['u', uid], undefined]); for (const d of Object.keys(idx.act || {})) if (idx.act[d]?.[uid]) ent.push([['act', d, uid], undefined]); for (const d of Object.keys(idx.att || {})) if (idx.att[d]?.[uid]) ent.push([['att', d, uid], undefined]); }
    for (const fid of famSet) if (idx.f?.[fid]) ent.push([['f', fid], undefined]);
    if (ent.length) await ledgerWrite(ent, 'index').catch(() => {});
    out = { authDeleted: authDeleted.length, accounts: plan.accounts.map((a) => a.email), families: plan.families, docs: n, indexEntries: ent.length };
    await logIt(`Deleted ${authDeleted.length} test accounts (${plan.accounts.map((a) => a.email).join(', ')}) + ${plan.families.length} families (${plan.families.join(', ')}), ${n} docs`);
  } else if (step === 'counts') {
    const fixed = [];
    for (const x of plan.installCounts) {
      const w = await fsCommit([pathsWrite(docName(`nestPlugins/${x.id}`), [[['installs'], x.real]])], tok);
      if (w.ok) fixed.push(`${x.id} ${x.installs}→${x.real}`);
    }
    out = { fixed };
    await logIt(`Install counts reset to real installs: ${fixed.join(', ') || 'none needed'}`);
  } else if (step === 'testreset') {
    const plugins = await listCollection('nestPlugins', tok).catch(() => []);
    const paths = [];
    for (const k of plan.keptTest) for (const pl of plugins) { paths.push(`nestPlugins/${pl.id}/installs/${k.uid}`, `nestPlugins/${pl.id}/reviews/${k.uid}`); }
    // Studio projects (threads + versions) of the kept test accounts.
    for (const k of plan.keptTest) for (const pr of await listCollection(`nestStudio/${k.uid}/projects`, tok, 500).catch(() => [])) paths.push(...await docTree(`nestStudio/${k.uid}/projects/${pr.id}`, tok));
    const n = await deletePaths(paths, tok);
    for (const k of plan.keptTest) await fsCommit([{ ...pathsWrite(docName(`users/${k.uid}`), [[['plugins'], undefined], [['pluginLog'], undefined]]), currentDocument: { exists: true } }], tok).catch(() => {});
    const tf = plan.testFamily;
    if (tf.ledgerClaim || tf.ledgerGrant || tf.ledgerUids.length) await purgeTestClaims({ force: true, extraUids: tf.ledgerUids });
    if (tf.betaProUntil) await fsCommit([{ ...pathsWrite(docName(`families/${TEST_FAMILY}`), [[['betaProUntil'], undefined]]), currentDocument: { exists: true } }], tok).catch(() => {});
    out = { removedDocs: n, testAccounts: plan.keptTest.map((k) => k.email), testFamilyPromoBefore: tf };
    await logIt(`Test accounts reset (plugin installs/reviews, Studio projects and plugin activity cleared); test family promo data: ${tf.ledgerClaim || tf.ledgerGrant || tf.ledgerUids.length || tf.betaProUntil ? 'removed' : 'none'}`);
  } else if (step === 'demofix') {
    // Public names that still carry a landing-demo value go back to the account's own users/<uid>.displayName.
    // Handles are never guessed: a real account still on a demo handle is reported (fix it with 修復個人頁).
    const fixed = []; const handleLeft = [];
    for (const x of plan.demo?.profiles || []) {
      if (x.kind === 'test') continue; // deleted by the accounts step
      if (DEMO_NAMES.includes(x.name) && x.profileName && !DEMO_NAMES.includes(x.profileName)) {
        const w = await fsCommit([pathsWrite(docName(`nestCreators/${x.uid}`), [[['name'], x.profileName], [['updatedAt'], Date.now()]])], tok);
        if (w.ok) fixed.push(`${x.email || x.uid}: "${x.name}" → "${x.profileName}"`);
      }
      if (DEMO_HANDLES.includes(x.handle)) handleLeft.push(`${x.email || x.uid} @${x.handle}`);
    }
    out = { fixed, handleLeft };
    await logIt(`Demo values removed from public names: ${fixed.join('; ') || 'none'}${handleLeft.length ? `; still on a demo handle: ${handleLeft.join(', ')}` : ''}`);
  } else if (step === 'waitlist') {
    // Waitlist placeholder accounts whose stored entry is a test address, or that stored nothing. Real entries are kept.
    const del = [...(plan.waitlist?.test || []), ...(plan.waitlist?.empty || [])];
    const paths = [];
    for (const x of del) paths.push(...await docTree(`users/${x.uid}`, tok));
    const wdocs = await listCollection('waitlist', tok, 5000).catch(() => []);
    const wlIds = [];
    for (const d of wdocs) if (accountKind(String(d.data?.email || '')) === 'test') { paths.push(`waitlist/${d.id}`); wlIds.push(d.id); }
    for (const x of del) { const m = String(x.email).match(/^wl-([a-z0-9]+)@/); if (m) wlIds.push(m[1]); }
    const n = await deletePaths([...new Set(paths)], tok);
    const authDeleted = [];
    for (const x of del) {
      const r = await fetch(`${IDTB}/projects/${PROJECT()}/accounts:delete`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ localId: x.uid }) });
      if (r.ok) authDeleted.push(x.email);
    }
    const idx = await readLedger({ which: 'index', maxAge: 0 }).catch(() => ({}));
    const ent = [...new Set(wlIds)].filter((id) => idx.wl?.[id]).map((id) => [['wl', id], undefined]);
    if (ent.length) await ledgerWrite(ent, 'index').catch(() => {});
    out = { authDeleted, docs: n, waitlistDocs: wlIds.length, indexEntries: ent.length, realKept: plan.waitlist?.realKept || 0 };
    await logIt(`Deleted ${authDeleted.length} waitlist placeholder accounts (test/empty entries only; ${plan.waitlist?.realKept || 0} real kept), ${n} docs`);
  } else return json(400, { error: 'bad_step' });
  return json(200, { ok: true, step, ...out });
}

// Named exports for local tests only (Vercel serves the default export).
export { overview as _overview, action as _action, promoPing as _promoPing, summary as _summary };

export default async function handler(req) {
  const url = new URL(req.url);
  const op = url.searchParams.get('op') || '';
  try {
    if (op === 'promo-status' && req.method === 'GET') return await promoStatus();
    // Run 19 — status.nesty.cyou: ALL server-side checks in one CDN-shared call (api/_status.js). Booleans only, always 200.
    if (op === 'status-all' && (req.method === 'GET' || req.method === 'HEAD')) return await statusAllResponse(req);
    // Run 16 — public status page (status.nesty.cyou): is the AI provider reachable and is the chat model listed? Uses the
    // provider's free GET /models (no completion, no tokens spent), booleans only, CDN-cached 60 s so visits don't hammer it.
    if (op === 'status-ai' && (req.method === 'GET' || req.method === 'HEAD')) {
      const out = { configured: !!process.env.AGNES_API_KEY, reachable: false, model: false };
      if (out.configured) {
        try {
          const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 6000);
          const r = await fetch('https://apihub.agnes-ai.com/v1/models', { headers: { authorization: `Bearer ${process.env.AGNES_API_KEY}` }, signal: ctl.signal });
          clearTimeout(tm);
          out.reachable = r.ok;
          if (r.ok) out.model = ((await r.json()).data || []).some((m) => m?.id === 'agnes-3.0-flash');
        } catch {}
      }
      const ok = out.configured && out.reachable && out.model;
      return json(ok ? 200 : 503, out, { 'cache-control': 'public, max-age=30', 'vercel-cdn-cache-control': 'max-age=60', 'access-control-allow-origin': '*' });
    }
    // Booleans only (no user data): does admin full mode work — service account → Auth accounts:batchGet + Firestore list.
    if (op === 'promo-health' && req.method === 'GET') {
      const out = { serviceAccount: hasServiceAccount(), authList: false, firestore: false, mode: hasServiceAccount() ? 'full' : 'limited' };
      if (out.serviceAccount) {
        try {
          const tok = await serviceToken();
          const [u, f] = await Promise.allSettled([listAuthUsers(tok, 1), listCollection('families', tok, 1)]);
          out.authList = u.status === 'fulfilled' && u.value.length > 0; out.firestore = f.status === 'fulfilled';
        } catch {}
      }
      return json(out.authList && out.firestore ? 200 : 503, out);
    }
    // Blog (api/_blog.js, Run 12): public SSR pages / sitemap / llms.txt / media via vercel.json rewrites; admin writes via
    // /api/app/blog-admin — server allowlist only: 401 without a token, 403 for any other signed-in user.
    // HEAD answers like GET (same status + headers, no body) so crawlers / link checkers don't see a 404.
    if (op.startsWith('blog-') && (req.method === 'GET' || req.method === 'HEAD')) {
      const r = op === 'blog-index' ? await blogIndexOp(url)
        : op === 'blog-post' ? await blogPostOp(url)
        : op === 'blog-sitemap' ? await blogSitemapOp()
        : op === 'blog-llms' ? await blogLlmsOp()
        : op === 'blog-media' ? await blogMediaOp(url.searchParams.get('id'))
        : notFound();
      return req.method === 'HEAD' ? new Response(null, { status: r.status, headers: r.headers }) : r;
    }
    // GitHub connection (api/_github.js, Run 13): /api/github/:op → op=github-:op (start, callback, status, refresh,
    // disconnect, parental, tool, audit). Missing env → graceful not_configured, never 404.
    if (op.startsWith('github-')) return await githubOps(op, req, url);
    if (op === 'app-blog-admin') {
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      if (!isAdminClaims(c)) return json(403, { error: 'forbidden' });
      return await blogAdminOp(c, req, url);
    }
    // Run 18 — email verification by code + password-reset emails via Resend (api/_email.js).
    if (op === 'app-verify-send' || op === 'app-verify-check' || op === 'app-reset-send') return await emailOps(op, req, callerOf);
    // App config + announcements (api/_admin.js): /api/app/config (token optional), /api/app/ann, /api/app/img
    // Run 23: 今日 card AI line (once per family per HK day, cached) + family-level settings.
    if (op === 'app-today' || op === 'app-family-settings') {
      if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      { const g = await gate(c, { admin: isAdminClaims(c), ...(op === 'app-today' ? { feature: 'aiChat' } : {}) }); if (g) return g; }
      const b = await req.json().catch(() => ({}));
      return op === 'app-today' ? await todayOp(c, b) : await familySettingsOp(c, b);
    }
    // Run 24: 全家檔案 (folders, in-app documents, uploads chunked into Firestore) — api/_run24.js + src/lib/drive.js.
    if (op === 'app-drive') {
      if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      { const g = await gate(c, { admin: isAdminClaims(c) }); if (g) return g; }
      return await driveRoute(c, await req.json().catch(() => ({})));
    }
    if (op === 'app-config' && req.method === 'GET') { const c = await callerOf(req); return await appConfigOp(c, { admin: isAdminClaims(c), lang: url.searchParams.get('lang') || 'zh-Hant' }); }
    if (op === 'app-img' && req.method === 'GET') return await appImg(url.searchParams.get('id'));
    if (op === 'app-ann' && req.method === 'POST') { const c = await callerOf(req); if (!c) return json(401, { error: 'unauthorized' }); return await appAnnEvent(c, await req.json().catch(() => ({}))); }
    if (op.startsWith('promo-')) {
      if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      if (op === 'promo-claim') { const g = await gate(c, { admin: isAdminClaims(c) }); if (g) return g; }
      const body = await req.json().catch(() => ({}));
      if (op === 'promo-ping') return await promoPing(c);
      if (op === 'promo-claim') return await promoClaim(c, body);
      return json(404, { error: 'not_found' });
    }
    if (op === 'chat-title') {
      if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      { const g = await gate(c, { admin: isAdminClaims(c), feature: 'aiChat' }); if (g) return g; }
      return await chatTitle(c, await req.json().catch(() => ({})));
    }
    if (op === 'mem-extract') {
      if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      const c = await callerOf(req);
      if (!c) return json(401, { error: 'unauthorized' });
      { const g = await gate(c, { admin: isAdminClaims(c), feature: 'memoryFromChats' }); if (g) return g; }
      return await memExtract(c, await req.json().catch(() => ({})));
    }
    // Plugin store (api/_plugins.js): /api/plugins/:op → op=plug-:op. Admin plugin ops answer 404 to non-admins.
    if (op.startsWith('plug-')) return await pluginOps(op, req);
    if (op.startsWith('admin-')) {
      const c = await callerOf(req);
      if (!isAdminClaims(c)) return notFound();
      if (op === 'admin-whoami' && req.method === 'GET') return json(200, { ok: true, email: c.email, mode: hasServiceAccount() ? 'full' : 'limited', project: PROJECT() });
      if (op === 'admin-overview' && req.method === 'GET') return await overview();
      if (op === 'admin-summary' && req.method === 'GET') return await summary();
      if (op === 'admin-plan-audit' && req.method === 'GET') return await planAudit(url.searchParams.get('email'));
      if (op === 'admin-cleanup') {
        if (!hasServiceAccount()) return json(503, { error: 'no_service_account' });
        const tok = await serviceToken();
        if (req.method === 'GET') return json(200, { plan: await cleanupPlan(tok) });
        if (req.method === 'POST') return await cleanupStep(c, String((await req.json().catch(() => ({})))?.step || ''), tok);
      }
      if (op === 'admin-action' && req.method === 'POST') return await action(c, await req.json().catch(() => ({})));
      if (op === 'admin-config' && (req.method === 'GET' || req.method === 'POST')) return await adminConfig(c, req);
      if (op === 'admin-ann' && (req.method === 'GET' || req.method === 'POST')) return await adminAnn(c, req);
      if (op === 'admin-translate' && req.method === 'POST') return await adminTranslate(c, await req.json().catch(() => ({})));
      if (op === 'admin-codes' && (req.method === 'GET' || req.method === 'POST')) return await adminCodes(c, req);
      if (op === 'admin-revoke' && req.method === 'POST') return await revokeSessions(c, String((await req.json().catch(() => ({})))?.uid || ''));
      return notFound();
    }
    return notFound();
  } catch (e) {
    return json(e.status && e.status < 600 ? e.status : 500, { error: String(e.message || 'error').split(' ')[0] });
  }
}
