// In-memory stand-in for Firebase. No side effects at import time.
// Used by (1) the landing page's live demo and (2) local screenshot builds (vite --mode mock).
import { dayKey, weekKey } from './plans.js';
import { mergeAttChunks } from './att-chunks.js';

const SEED = {
  'zh-Hant': {
    fam: '陳家', mum: '媽媽', dad: '爸爸', kid: 'Ethan',
    memories: [['Ethan 對花生過敏，外出用膳須留意。', '健康', -3, 'u1'], ['Ethan 校服尺碼為 140，皮鞋 US 4。', '學校', -6, 'u1'], ['鋼琴課逢星期六上午 10 時，地點沙田。', '活動', -9, 'u3'], ['遙控器放在電視櫃左邊第二個抽屜。', '家居', -2, 'u1']],
    reminders: [['繳交十月份午膳費', 1, 18, 'u1', false], ['中文默書（第三課）', 2, 8, 'u2', false], ['簽署秋季旅行回條', 4, 9, 'u3', false], ['圖書館還書', -1, 17, 'u2', true]],
    convTitle: '本週準備事項',
    convQ: '今個星期有甚麼要準備？',
    convA: '本週需要留意以下事項：\n\n1. **明天傍晚**前繳交十月份午膳費。\n2. **星期一** Ethan 有中文默書（第三課），建議今晚先溫習生字。\n3. **星期三**前簽署秋季旅行回條。\n\n需要我為默書溫習設定提醒嗎？',
    convQ2: '好，星期日晚上八時提醒 Ethan 溫習默書。另外記下：Ethan 的游泳課改為星期四。',
    convA2: '已為 Ethan 加入星期日晚上八時的溫習提醒，並記下游泳課改期。\n\n```nest-actions\n[{"type":"reminder.create","title":"溫習中文默書（第三課）","dueAt":"__SUN20__","member":"Ethan"},{"type":"memory.create","text":"Ethan 的游泳課改為逢星期四。","tag":"活動"}]\n```',
    convQ3: '圖書館還書那項已經完成，可以刪除了。',
    convA3: '刪除提醒需要你確認，請按下方「確認」。\n\n```nest-actions\n[{"type":"reminder.delete","id":"r4"}]\n```',
    inbox: ['學校通告：秋季旅行', '電郵提及 10 月 28 日秋季旅行，回條須於本週五前交回。', '交回秋季旅行回條'],
    quiz: ['光合作用', ['葉綠素的作用', '光反應']],
  },
  en: {
    fam: 'The Chans', mum: 'Mum', dad: 'Dad', kid: 'Ethan',
    memories: [['Ethan is allergic to peanuts — check when eating out.', 'Health', -3, 'u1'], ['Ethan\'s uniform size is 140; school shoes US 4.', 'School', -6, 'u1'], ['Piano lesson every Saturday 10am in Sha Tin.', 'Activities', -9, 'u3'], ['The TV remote lives in the second drawer left of the TV.', 'Home', -2, 'u1']],
    reminders: [['Pay October lunch fee', 1, 18, 'u1', false], ['Chinese dictation (Lesson 3)', 2, 8, 'u2', false], ['Sign the autumn trip slip', 4, 9, 'u3', false], ['Return library books', -1, 17, 'u2', true]],
    convTitle: 'This week',
    convQ: 'What do we need to prepare this week?',
    convA: 'Here is what needs attention this week:\n\n1. Pay the October lunch fee by **tomorrow evening**.\n2. Ethan has Chinese dictation (Lesson 3) on **Monday** — revise the words tonight.\n3. Sign the autumn trip slip by **Wednesday**.\n\nShall I set a revision reminder for the dictation?',
    convQ2: 'Yes — remind Ethan to revise at 8pm on Sunday. Also remember: Ethan\'s swimming moved to Thursdays.',
    convA2: 'Done: a Sunday 8pm revision reminder for Ethan, and the swimming change is saved.\n\n```nest-actions\n[{"type":"reminder.create","title":"Revise Chinese dictation (Lesson 3)","dueAt":"__SUN20__","member":"Ethan"},{"type":"memory.create","text":"Ethan\'s swimming lesson is now on Thursdays.","tag":"Activities"}]\n```',
    convQ3: 'The library books are returned — you can delete that reminder.',
    convA3: 'Deleting a reminder needs your OK — tap Confirm below.\n\n```nest-actions\n[{"type":"reminder.delete","id":"r4"}]\n```',
    inbox: ['School notice: autumn trip', 'An email mentions the 28 Oct autumn trip; the reply slip is due this Friday.', 'Return the autumn trip slip'],
    quiz: ['Photosynthesis', ['Role of chlorophyll', 'Light reactions']],
  },
};

export function createMockBackend({ mode = 'in', lang = 'zh-Hant', connections } = {}) {
  const L = SEED[lang] || SEED['zh-Hant'];
  const now = Date.now();
  const d = (days, h = 9) => { const x = new Date(now + days * 864e5); x.setUTCHours(h - 8, 0, 0, 0); return x; };
  // Next Sunday 20:00 HKT, as an HK wall-clock string for the demo action.
  const hkNow = new Date(now + 8 * 3600e3);
  const sun = new Date(hkNow); sun.setUTCDate(hkNow.getUTCDate() + ((7 - hkNow.getUTCDay()) % 7 || 7));
  const SUN20 = sun.toISOString().slice(0, 10) + 'T20:00';
  const me = mode === 'verify' // Run 18: a brand-new email/password sign-up that still has to enter the 6-digit code
    ? { uid: 'u1', email: 'mum@example.com', displayName: L.mum, photoURL: '', emailVerified: false, providerData: [{ providerId: 'password' }], metadata: { createdAt: String(now) } }
    : { uid: 'u1', email: 'mum@example.com', displayName: L.mum, photoURL: '', providerData: [{ providerId: 'google.com' }] };
  const S = {
    'users/u1': mode === 'new' ? { displayName: L.mum } : { familyId: 'f1', displayName: L.mum, role: 'parent', onboarded: true, region: 'HK', connections: connections ?? { gmail: true, googlecalendar: true, googleclassroom: true },
      googleAccounts: [{ email: 'chan.family@gmail.com', name: 'Chan Family', photo: '', scopes: [] }, { email: 'ethan.chan@school.edu.hk', name: 'Ethan Chan', photo: '', scopes: [] }],
      serviceAccounts: { gmail: ['chan.family@gmail.com', 'ethan.chan@school.edu.hk'], googlecalendar: ['chan.family@gmail.com'], googleclassroom: ['ethan.chan@school.edu.hk'] },
      chatMem: { c1: { text: lang === 'en' ? 'Has an important meeting tomorrow — wants an early night' : '明天有重要會議，想早點睡', exp: new Date(now + 8 * 3600e3 + 864e5).toISOString().slice(0, 10), at: now - 3600e3 } },
      memSuggest: {
        s1: { kind: 'entity', type: 'tutor', name: lang === 'en' ? 'Miss Lee (maths tutor)' : '李老師（數學補習）', about: L.kid, fields: { schedule: lang === 'en' ? 'Tue & Thu 5pm' : '逢星期二、四 下午 5 時', phone: '9123 4567' }, confidence: 0.86, src: 'chat', at: now - 7200e3 },
        s2: { kind: 'chat', text: lang === 'en' ? 'Grandma’s knee has been hurting' : '外婆最近膝頭痛', about: '', exp: '', at: now - 9000e3 },
      } },
    'families/f1': { name: L.fam, ownerId: 'u1', memberIds: ['u1', 'u2', 'u3'], plan: 'free' },
    'families/f1/members/u1': { uid: 'u1', displayName: L.mum, role: 'parent', isOwner: true, email: 'mum@example.com' },
    'families/f1/members/u2': { uid: 'u2', displayName: L.kid, role: 'student', isOwner: false, email: 'ethan@example.com', birthday: '2015-03-14' },
    'users/u1/pushSubs/s1a2b3c4d5e6f7a8b9c0d1e2f': { endpoint: 'https://web.push.apple.com/mock1', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', createdAt: d(-3) },
    'users/u1/pushSubs/s9f8e7d6c5b4a3f2e1d0c9b8a': { endpoint: 'https://fcm.googleapis.com/mock2', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36', createdAt: d(-1) },
    'families/f1/members/u3': { uid: 'u3', displayName: L.dad, role: 'parent', isOwner: false, email: 'dad@example.com' },
    ['families/f1/usage/' + dayKey()]: { count: 42, perMember: { u1: 24, u2: 14, u3: 4 } },
    ['families/f1/usage/' + weekKey()]: { count: 72, perMember: { u1: 38, u2: 26, u3: 8 } },
    'families/f1/invites/tok1': { code: 'K7Q2MD', createdBy: 'u1', expiresAt: d(6) },
    'families/f1/conversations/c1': { ownerId: 'u1', title: L.convTitle, updatedAt: d(0) },
    ...Object.fromEntries([['c2', '數學測驗溫習計劃', 'Maths test revision plan', 1, true], ['c3', '週末親子活動', 'Weekend family ideas', 1], ['c4', '中文默書詞語', 'Chinese dictation words', 4], ['c5', '學校旅行回條', 'School trip reply slip', 12], ['c6', '暑假補習安排', 'Summer tutoring plan', 70]]
      .map(([id, zh, en, ago, pin]) => [`families/f1/conversations/${id}`, { ownerId: 'u1', title: lang === 'en' ? en : zh, titleAuto: true, pinned: !!pin, updatedAt: new Date(now - ago * 864e5) }])),
    'families/f1/conversations/c1/messages/a': { role: 'user', content: L.convQ, createdAt: d(0, 8) },
    'families/f1/conversations/c1/messages/b': { role: 'assistant', content: L.convA, createdAt: new Date(d(0, 8).getTime() + 1000) },
    'families/f1/conversations/c1/messages/c': { role: 'user', content: L.convQ2, createdAt: new Date(d(0, 8).getTime() + 2000) },
    'families/f1/conversations/c1/messages/e': {
      role: 'assistant', content: L.convA2.replace('__SUN20__', SUN20), createdAt: new Date(d(0, 8).getTime() + 3000),
      actionState: { 0: { status: 'done', undo: { op: 'deleteReminder', id: 'rx' } }, 1: { status: 'done', undo: { op: 'deleteMemory', id: 'mx' } } },
    },
    'families/f1/conversations/c1/messages/f': { role: 'user', content: L.convQ3, createdAt: new Date(d(0, 8).getTime() + 4000) },
    'families/f1/conversations/c1/messages/g': { role: 'assistant', content: L.convA3, createdAt: new Date(d(0, 8).getTime() + 5000), actionState: { 0: { status: 'pending' } } },
    'families/f1/inbox/i1': { uid: 'u1', status: 'new', title: L.inbox[0], body: L.inbox[1], reminder: { title: L.inbox[2], dueAt: d(3, 9).toISOString() }, createdAt: d(0) },
    ...(() => {
      const zh = lang !== 'en'; const key = (n) => new Date(now + 8 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
      return {
        'families/f1/inbox/a1': { uid: 'u1', status: 'new', auto: true, kind: 'notice', title: zh ? '秋季旅行回條' : 'Autumn trip reply slip', body: zh ? '簽署回條並於星期五前交回班主任。' : 'Sign the reply slip and return it to the class teacher by Friday.', date: key(4), time: '', needsReply: true, signer: 'u1', src: { type: 'gmail', id: 'demo-a1', account: 'chan.family@gmail.com', from: zh ? '聖保羅小學' : 'St Paul’s Primary', subject: zh ? '通告第 12 號：秋季旅行' : 'Circular 12: autumn trip', link: '' }, reminder: { title: zh ? '交回秋季旅行回條' : 'Return the autumn trip slip', dueAt: `${key(4)}T08:00` }, createdAt: d(0, 7) },
        'families/f1/inbox/a2': { uid: 'u1', status: 'new', auto: true, kind: 'bill', title: zh ? '十月份午膳費' : 'October lunch fee', body: '', date: key(2), amount: 420, currency: 'HKD', payee: zh ? '學校午膳' : 'School lunch', src: { type: 'gmail', id: 'demo-a2', account: 'chan.family@gmail.com', from: zh ? '聖保羅小學' : 'St Paul’s Primary', subject: zh ? '午膳費繳費通知' : 'Lunch fee payment', link: '' }, reminder: { title: '', dueAt: `${key(2)}T09:00` }, createdAt: d(0, 7) },
        'families/f1/inbox/a3': { uid: 'u1', status: 'new', auto: true, kind: 'test', title: zh ? '中文默書（第三課）' : 'Chinese dictation (Lesson 3)', body: zh ? '溫習第三課生字。' : 'Revise the Lesson 3 words.', date: key(1), src: { type: 'classroom', id: 'demo-a3', account: 'ethan.chan@school.edu.hk', from: zh ? '4A 中文' : '4A Chinese', subject: '', link: '' }, reminder: { title: '', dueAt: '' }, createdAt: d(0, 7) },
      };
    })(),
    'families/f1/quizResults/q1': { uid: 'u1', topic: L.quiz[0], score: 6, total: 8, weakAreas: L.quiz[1], createdAt: d(-2) },
  };
  S['families/f1/memories/ins_u1_reminderTime'] = { kind: 'insight', key: 'reminderTime', memberId: 'u1', data: { time: '18:00' }, confidence: 0.72, evidence: 6, lastSeen: now - 864e5, createdBy: 'u1', text: lang === 'en' ? 'Usually sets reminders for 18:00' : '通常把提醒設在 18:00', createdAt: d(-5) };
  S['families/f1/memories/ins_u2_stuckOn'] = { kind: 'insight', key: 'stuckOn', memberId: 'u2', data: { topic: lang === 'en' ? 'Fractions' : '分數' }, confidence: 0.55, evidence: 3, lastSeen: now - 2 * 864e5, createdBy: 'u2', text: lang === 'en' ? 'Most often stuck on “Fractions”' : '溫習時最常卡在「分數」', createdAt: d(-9) };
  L.memories.forEach(([text, tag, day, by], i) => { S[`families/f1/memories/m${i + 1}`] = { text, tag, createdBy: by, createdAt: d(day) }; });
  L.reminders.forEach(([title, day, h, memberId, done], i) => { S[`families/f1/reminders/r${i + 1}`] = { title, dueAt: d(day, h), memberId, done, createdBy: 'u1' }; });

  // Run 23b demo: Dad's birthday tomorrow (one suggestion), memories about members (about + cat), a shared shopping list,
  // and a chat with a homework photo + a document + a checklist (Files tab).
  const tmr = new Date(now + 8 * 3600e3 + 864e5).toISOString().slice(5, 10);
  S['families/f1/members/u3'].birthday = `1982-${tmr}`;
  const en = lang === 'en';
  S['families/f1/memories/m1'].about = 'u2'; S['families/f1/memories/m1'].cat = 'allergy';
  S['families/f1/memories/m5'] = { text: en ? 'Prefers less rice at dinner' : '晚餐想少吃一點飯', about: 'u3', cat: 'preference', createdBy: 'u3', createdAt: d(-4) };
  S['families/f1/memories/m6'] = { text: en ? 'Reads for 20 minutes before bed' : '每晚睡前閱讀二十分鐘', about: 'u2', cat: 'habit', createdBy: 'u1', createdAt: d(-7) };
  (en ? ['Milk', 'Eggs', 'Rice'] : ['牛奶', '雞蛋', '白米']).forEach((x, i) => { S[`families/f1/reminders/shop${i + 1}`] = { title: `${en ? 'Buy: ' : '購物：'}${x}`, dueAt: null, memberId: '', done: false, createdBy: 'u1', createdAt: d(-1) }; });
  S['families/f1/reminders/hw1'] = { title: en ? 'Maths worksheet 4' : '數學工作紙 4', dueAt: d(0, 20), memberId: 'u2', done: true, createdBy: 'u1' };
  const thumb = (bg, fg, label) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${bg}"/><g stroke="${fg}" stroke-width="3" opacity=".55">${[60, 95, 130, 165, 200].map((y) => `<line x1="34" y1="${y}" x2="286" y2="${y}"/>`).join('')}</g><text x="34" y="44" font-family="sans-serif" font-size="22" font-weight="700" fill="${fg}">${label}</text></svg>`)}`;
  S['families/f1/conversations/cf'] = { ownerId: 'u1', title: en ? 'Homework help' : '功課求助', titleAuto: true, updatedAt: d(-1) };
  S['families/f1/conversations/cf/messages/a'] = { role: 'user', content: en ? 'Can you check this worksheet?' : '可以幫我看看這份工作紙嗎？', createdAt: d(-1, 19), atts: [
    { id: 'p1', kind: 'image', name: en ? 'maths-worksheet.jpg' : '數學工作紙.jpg', size: 184320, mime: 'image/jpeg', thumb: thumb('#f4f1ea', '#222', en ? 'Fractions' : '分數') },
    { id: 'p2', kind: 'image', name: en ? 'chinese-dictation.jpg' : '中文默書.jpg', size: 152000, mime: 'image/jpeg', thumb: thumb('#eef2f6', '#222', en ? 'Lesson 3' : '第三課') },
    { id: 'p3', kind: 'pdf', name: en ? 'autumn-trip-notice.pdf' : '秋季旅行通告.pdf', size: 96000, pages: 2, mime: 'application/pdf', text: en ? 'Autumn trip on 30 October. Bring a water bottle and a hat.' : '秋季旅行將於十月三十日舉行，請帶備水壺及帽子。' } ] };
  S['families/f1/conversations/cf/messages/b'] = { role: 'assistant', createdAt: new Date(d(-1, 19).getTime() + 1000), content: `${en ? 'Here is a packing list for the trip:' : '秋季旅行的準備清單：'}\n\`\`\`nest-cards\n${JSON.stringify({ cards: [{ type: 'checklist', title: en ? 'Autumn trip packing' : '秋季旅行準備', items: en ? ['Water bottle', 'Hat', 'Snacks', 'Signed slip'] : ['水壺', '帽子', '小食', '已簽回條'] }] })}\n\`\`\`` };

  // Dad shares his calendar with the family (Calendar tab demo).
  const hk = (days, h, m = 0) => { const x = new Date(now + days * 864e5); x.setUTCHours(h - 8, m, 0, 0); return x.toISOString(); };
  S['families/f1/calendarShare/u3'] = { uid: 'u3', name: L.dad, updatedAt: new Date(), events: [
    { t: lang === 'en' ? 'Dentist' : '牙醫覆診', s: hk(1, 15), e: hk(1, 16), c: 'iCloud' },
    { t: lang === 'en' ? 'Work dinner' : '公司晚宴', s: hk(3, 19), e: hk(3, 21, 30), c: 'iCloud' },
  ] };
  const Ls = new Set();
  const fire = () => Ls.forEach((f) => f());
  const getP = (p) => (S[p] ? { id: p.split('/').pop(), ...S[p] } : null);
  const listP = (col) => Object.keys(S).filter((k) => k.startsWith(col + '/') && k.split('/').length === col.split('/').length + 1).map(getP);
  const watch = (fn, cb) => { const f = () => cb(fn()); Ls.add(f); setTimeout(f, 30); return () => Ls.delete(f); };
  let uidC = 0; const nid = () => 'x' + (++uidC) + Date.now().toString(36);

  let authed = mode !== 'out' ? me : null;
  const authL = new Set();
  const setAuth = (u) => { authed = u; authL.forEach((f) => f(u)); };
  const saveProfile = async (uid, data) => {
    const cur = S['users/' + uid] || {};
    const deep = Object.fromEntries(['prefs', 'chatMem', 'privateMem', 'memSuggest', 'nudges', 'hk', 'insightOff', 'plugins'].filter((k) => data[k] && typeof data[k] === 'object').map((k) => [k, { ...(cur[k] || {}), ...data[k] }]));
    S['users/' + uid] = { ...cur, ...data, ...deep };
    fire();
  };
  const deleteProfileKeys = async (uid, paths) => {
    const cur = { ...(S['users/' + uid] || {}) };
    paths.forEach((p) => { const [a, b] = p.split('.'); if (b && cur[a]) { cur[a] = { ...cur[a] }; delete cur[a][b]; } else delete cur[a]; });
    S['users/' + uid] = cur; fire();
  };
  const mk = (col) => ({
    watch: (fid, cb) => watch(() => listP(`families/${fid}/${col}`), cb),
    add: async (fid, data) => { const id = nid(); S[`families/${fid}/${col}/${id}`] = { createdBy: 'u1', createdAt: new Date(), ...data }; fire(); return { id }; },
    upd: async (fid, id, data) => { if (S[`families/${fid}/${col}/${id}`]) Object.assign(S[`families/${fid}/${col}/${id}`], data); fire(); },
    del: async (fid, id) => { delete S[`families/${fid}/${col}/${id}`]; fire(); },
  });
  const M = mk('memories'), R = mk('reminders'), Q = mk('quizResults'), I = mk('inbox'), C = mk('conversations');

  return {
    MOCK: true,
    auth: { get currentUser() { return authed; } },
    onAuth: (cb) => { authL.add(cb); setTimeout(() => cb(authed), 50); return () => authL.delete(cb); },
    currentUser: () => authed,
    getIdToken: async () => 'mock-token',
    signInGoogle: async () => setAuth(me), signInEmail: async () => setAuth(me), signInApple: async () => setAuth(me),
    completeRedirect: async () => null, watchSignInElsewhere: () => {}, persistedUser: async () => false, signUpEmail: async () => setAuth(me), resetPassword: async () => {},
    sendVerifyFallback: async () => {}, reloadUser: async () => { me.emailVerified = true; return authed; },
    signOut: async () => setAuth(null),
    connectGoogle: async () => 'mock-access-token',
    addGoogleAccount: async (scopes, { hint } = {}) => {
      const pool = [{ email: 'chan.family@gmail.com', name: 'Chan Family' }, { email: 'ethan.chan@school.edu.hk', name: 'Ethan Chan' }];
      const have = (S['users/u1']?.googleAccounts || []).map((a) => a.email);
      const a = pool.find((x) => x.email === hint) || pool.find((x) => !have.includes(x.email)) || pool[0];
      return { token: `mock-${a.email}`, ...a, photo: '' };
    },
    watchProfile: (uid, cb) => watch(() => getP('users/' + uid), cb),
    saveProfile, deleteProfileKeys,
    createFamily: async ({ name, displayName, role }) => { S['families/f1'] = { name, ownerId: 'u1', memberIds: ['u1'], plan: 'free' }; S['families/f1/members/u1'] = { uid: 'u1', displayName, role, isOwner: true }; await saveProfile('u1', { familyId: 'f1', displayName, role }); return 'f1'; },
    getInvite: async () => ({ id: 'tok1', familyId: 'f1', familyName: L.fam, code: 'K7Q2MD', expiresAt: d(6) }),
    resolveInviteInput: async () => ({ id: 'tok1', familyId: 'f1', familyName: L.fam, code: 'K7Q2MD', expiresAt: d(6) }),
    joinFamily: async (inv, { displayName, role }) => saveProfile('u1', { familyId: 'f1', displayName, role }),
    watchFamily: (fid, cb) => watch(() => getP('families/' + fid), cb),
    watchMembers: (fid, cb) => watch(() => listP(`families/${fid}/members`), cb),
    renameFamily: async (fid, name) => { S['families/' + fid].name = name; fire(); },
    createInvite: async (fid) => { const t = nid(); S[`families/${fid}/invites/${t}`] = { code: 'P4M9TX', expiresAt: d(7) }; fire(); return { id: t, token: t, code: 'P4M9TX', expiresAt: d(7) }; },
    watchInvites: (fid, cb) => watch(() => listP(`families/${fid}/invites`), cb),
    revokeInvite: async (fid, inv) => { delete S[`families/${fid}/invites/${inv.id}`]; fire(); },
    removeMember: async (fid, uid) => { delete S[`families/${fid}/members/${uid}`]; S['families/' + fid].memberIds = S['families/' + fid].memberIds.filter((x) => x !== uid); fire(); },
    setMemberRole: async (fid, uid, role) => { S[`families/${fid}/members/${uid}`].role = role; fire(); },
    setMemberRoleFull: async (fid, uid, role, roleLabel = '') => { Object.assign(S[`families/${fid}/members/${uid}`], { role, roleLabel }); fire(); },
    updateFamilySettings: async (fid, patch) => {
      const f = S['families/' + fid]; const { familyName, ...rest } = patch || {};
      if (familyName) f.name = familyName;
      f.settings = { ...(f.settings || {}), ...rest }; fire(); return f.settings;
    },
    updateMyMember: async (fid, uid, data) => { Object.assign(S[`families/${fid}/members/${uid}`], data); fire(); },
    setMemberBirthday: async (fid, uid, birthday) => { Object.assign(S[`families/${fid}/members/${uid}`], { birthday }); fire(); },
    watchPushSubs: (uid, cb) => watch(() => listP(`users/${uid}/pushSubs`), cb),
    deletePushSubMock: async (uid, id) => { delete S[`users/${uid}/pushSubs/${id}`]; fire(); },
    leaveFamily: async () => saveProfile('u1', { familyId: null }),
    exitFamily: async () => {},
    deleteAccount: async () => setAuth(null),
    watchMemories: (fid, cb) => M.watch(fid, (l) => cb(l.sort((a, b) => b.createdAt - a.createdAt))),
    addMemory: M.add, updateMemory: M.upd, deleteMemory: M.del,
    setMemory: async (fid, id, data) => { S[`families/${fid}/memories/${id}`] = { createdAt: new Date(), ...(S[`families/${fid}/memories/${id}`] || {}), ...data }; fire(); },
    watchReminders: R.watch,
    addReminder: (fid, r) => R.add(fid, { ...r, done: false }),
    updateReminder: R.upd, deleteReminder: R.del,
    watchUsage: (fid, key, cb) => watch(() => getP(`families/${fid}/usage/${key}`) || { count: 0, perMember: {} }, cb),
    watchConversations: (fid, uid, cb) => C.watch(fid, (l) => cb(l.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)))),
    createConversation: async (fid, title) => (await C.add(fid, { ownerId: 'u1', title, updatedAt: new Date() })).id,
    touchConversation: async (fid, cid, data = {}) => C.upd(fid, cid, { ...data, updatedAt: new Date() }),
    updateConversation: async (fid, cid, data = {}) => C.upd(fid, cid, data),
    listMessages: async (fid, cid) => mergeAttChunks(listP(`families/${fid}/conversations/${cid}/messages`)),
    watchMessages: (fid, cid, cb) => watch(() => mergeAttChunks(listP(`families/${fid}/conversations/${cid}/messages`)).sort((a, b) => a.createdAt - b.createdAt), cb),
    addMessage: async (fid, cid, msg) => { const id = nid(); S[`families/${fid}/conversations/${cid}/messages/${id}`] = { ...msg, createdAt: new Date() }; fire(); return { id }; },
    updateMessage: async (fid, cid, mid, data) => { const k = `families/${fid}/conversations/${cid}/messages/${mid}`; if (S[k]) Object.assign(S[k], data); fire(); },
    deleteConversation: C.del,
    watchQuizResults: (fid, uid, cb) => Q.watch(fid, cb),
    addQuizResult: Q.add,
    watchInbox: (fid, uid, cb) => I.watch(fid, cb),
    addInboxItem: (fid, data) => I.add(fid, { ...data, uid: 'u1', status: 'new' }),
    updateInboxItem: I.upd,
    watchCalendarShares: (fid, cb) => watch(() => listP(`families/${fid}/calendarShare`), cb),
    saveCalendarShare: async (fid, uid, data) => { S[`families/${fid}/calendarShare/${uid}`] = { ...data, uid, updatedAt: new Date() }; fire(); },
    deleteCalendarShare: async (fid, uid) => { delete S[`families/${fid}/calendarShare/${uid}`]; fire(); },
  };
}
