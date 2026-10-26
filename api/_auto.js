// Automation scanner (Node runtime; used by api/push/cron.js — daily crons + POST /api/auto/scan when Home loads).
// Reads each user's connected Google accounts READ-ONLY (Gmail + Classroom announcements), finds school notices /
// reply slips, tests & homework, and fees / bills (src/lib/detect.js heuristics, refined by ONE batched model call
// through the Agnes API), and writes SUGGESTION cards to families/{fid}/inbox/{autoId} (create-only, so a card the
// family accepted or dismissed is never re-created). Never creates reminders, events or confirm cards by itself.
import { accessFor, configured } from './_google-lib.js';
import { fsCreate, fsPatch } from './_push-lib.js';
import { detectKind, heuristicItem, llmPrompt, parseLlm, mergeLlm, autoId, pickSigner, hkDayKey, detectSub, subItem } from '../src/lib/detect.js';

const lc = (s) => String(s || '').trim().toLowerCase();
const selected = (prof, id) => {
  if (!prof?.connections?.[id]) return [];
  const all = (prof.googleAccounts || []).map((a) => lc(a?.email)).filter(Boolean);
  const sel = prof.serviceAccounts?.[id];
  return (Array.isArray(sel) ? sel.map(lc) : all).filter((e) => all.includes(e));
};
const vaultFor = (prof, email) => Object.values(prof?.googleVault || {}).filter((v) => v?.enc && lc(v.email) === email).sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0];

async function g(url, token, ms = 10000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw Object.assign(new Error(`google_${r.status}`), { status: r.status });
    return r.json();
  } finally { clearTimeout(t); }
}
const dec = (s) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const stripHtml = (h) => String(h).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export function messageText(payload) {
  let plain = ''; let html = ''; const files = [];
  const walk = (p) => {
    if (!p) return;
    if (p.filename) files.push(p.filename);
    if (p.mimeType === 'text/plain' && p.body?.data && !plain) plain = dec(p.body.data);
    else if (p.mimeType === 'text/html' && p.body?.data && !html) html = dec(p.body.data);
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  const text = (plain || stripHtml(html)).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return { text: text.slice(0, 3000), attachments: files.filter(Boolean).slice(0, 8) };
}
const header = (m, name) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || '';

async function gmailCandidates(email, token, days) {
  const base = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  const q = `newer_than:${days}d -category:promotions -category:social -in:spam -in:trash -in:sent`;
  const list = await g(`${base}?maxResults=40&q=${encodeURIComponent(q)}`, token);
  const metas = await Promise.all((list.messages || []).map((m) => g(`${base}/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, token).catch(() => null)));
  const cands = metas.filter(Boolean).map((m) => ({ id: m.id, from: header(m, 'from'), subject: header(m, 'subject'), snippet: String(m.snippet || ''), date: Number(m.internalDate) }))
    .filter((m) => detectKind(m).kind || detectSub(m) || /\.edu\.hk|school|學校|書院|中學|小學|幼稚園/i.test(m.from));
  return cands.slice(0, 12);
}
async function gmailFull(email, token, m) {
  const full = await g(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, token).catch(() => null);
  const { text, attachments } = full ? messageText(full.payload) : { text: '', attachments: [] };
  return { ...m, text, attachments, source: 'gmail', account: email, link: `https://mail.google.com/mail/?authuser=${encodeURIComponent(email)}#all/${m.id}` };
}
async function classroomCandidates(email, token, days, now) {
  const c = await g('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20', token);
  const since = now - days * 864e5; const out = [];
  await Promise.all((c.courses || []).slice(0, 15).map(async (course) => {
    const a = await g(`https://classroom.googleapis.com/v1/courses/${course.id}/announcements?pageSize=5&orderBy=updateTime%20desc`, token).catch(() => ({}));
    (a.announcements || []).forEach((x) => {
      const at = Date.parse(x.updateTime || x.creationTime);
      if (at < since) return;
      const msg = { id: x.id, from: course.name, subject: String(x.text || '').split('\n')[0].slice(0, 120), snippet: String(x.text || '').slice(0, 300), text: String(x.text || '').slice(0, 3000), source: 'classroom', account: email, date: at, link: x.alternateLink || '', attachments: (x.materials || []).map((mm) => mm.driveFile?.driveFile?.title || mm.link?.title || '').filter(Boolean) };
      if (detectKind(msg).kind) out.push(msg);
    });
  }));
  return out.slice(0, 8);
}

async function refine(lang, msgs, now) {
  const key = process.env.AGNES_API_KEY;
  if (!key || !msgs.length) return [];
  const { sys, user } = llmPrompt(lang, msgs, hkDayKey(now));
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'agnes-3.0-flash', stream: false, temperature: 0.1, messages: [{ role: 'system', content: sys }, { role: 'user', content: user.slice(0, 24000) }] }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return parseLlm(j.choices?.[0]?.message?.content || '');
  } catch { return []; } finally { clearTimeout(t); }
}

// Build the inbox doc for one detected item.
export function inboxDoc(uid, msg, it, { members = [], ownerId = '' } = {}) {
  const src = { type: msg.source, id: msg.id, account: msg.account, from: String(msg.from || '').slice(0, 120), subject: String(msg.subject || '').slice(0, 200), link: msg.link || '' };
  const at = it.date ? `${it.date}T${it.time || (it.kind === 'bill' ? '09:00' : '08:00')}` : '';
  const signer = it.kind === 'notice' ? pickSigner(members, uid, ownerId) : '';
  return {
    uid, status: 'new', auto: true, kind: it.kind, title: String(it.title).slice(0, 140), body: String(it.action || it.body || '').slice(0, 400),
    date: it.date || '', time: it.time || '', needsReply: !!it.needsReply, ...(it.amount ? { amount: it.amount, currency: it.currency || 'HKD' } : {}),
    ...(it.payee ? { payee: it.payee } : {}), ...(signer ? { signer } : {}), src,
    ...(it.kind === 'sub' ? { service: it.service || '', purpose: it.purpose || '', cycle: it.cycle || 'monthly', renewDate: it.renewDate || '', cancelUrl: it.cancelUrl || '' } : {}),
    reminder: { title: String(it.action || it.title).slice(0, 120), dueAt: at }, createdAt: new Date(),
  };
}

// Scan one user. fsToken = the caller's Firebase ID token (on-demand) or a service-account token (cron).
// Returns { added: [{id, kind, title}], scanned, errors }.
export async function scanUser({ uid, prof, members = [], ownerId = '', fsToken, now = Date.now(), days = 3, lang }) {
  const out = { added: [], scanned: 0, errors: [] };
  const fid = prof?.familyId;
  if (!fid || !configured()) return out;
  const L = lang || (prof?.prefs?.lang === 'en' ? 'en' : 'zh-Hant');
  const seen = new Set(Array.isArray(prof.autoSeen) ? prof.autoSeen : []);
  const accounts = [...new Set([...selected(prof, 'gmail'), ...selected(prof, 'googleclassroom')])];
  const tokens = {};
  await Promise.all(accounts.map(async (e) => { const v = vaultFor(prof, e); if (!v) return; const a = await accessFor(uid, v); if (a.token) tokens[e] = a.token; else out.errors.push({ account: e, error: a.error }); }));
  const cands = [];
  await Promise.all([
    ...selected(prof, 'gmail').filter((e) => tokens[e]).map(async (e) => {
      try {
        const list = (await gmailCandidates(e, tokens[e], days)).filter((m) => !seen.has(autoId({ type: 'gmail', account: e, id: m.id })));
        cands.push(...(await Promise.all(list.map((m) => gmailFull(e, tokens[e], m)))));
      } catch (err) { out.errors.push({ account: e, source: 'gmail', error: err.status || 'fetch' }); }
    }),
    ...selected(prof, 'googleclassroom').filter((e) => tokens[e]).map(async (e) => {
      try { cands.push(...(await classroomCandidates(e, tokens[e], days, now)).filter((m) => !seen.has(autoId({ type: 'classroom', account: e, id: m.id })))); }
      catch (err) { out.errors.push({ account: e, source: 'classroom', error: err.status || 'fetch' }); }
    }),
  ]);
  const batch = cands.sort((a, b) => b.date - a.date).slice(0, 14);
  out.scanned = batch.length;
  if (!batch.length) return out;
  const llm = await refine(L, batch, now);
  const byI = Object.fromEntries(llm.map((x) => [x.i, x]));
  const newSeen = [];
  const suggestedSchools = new Set((prof.schoolsSuggested || []).map((x) => String(x).toLowerCase()));
  for (let i = 0; i < batch.length; i++) {
    const m = batch[i];
    const id = autoId({ type: m.source, account: m.account, id: m.id });
    newSeen.push(id);
    // Subscription receipts (renewals / recurring charges) are recognised without the model.
    const sub = m.source === 'gmail' ? subItem(m, now, L) : null;
    const h = heuristicItem(m, now);
    const it = sub || (llm.length ? mergeLlm(h, byI[i]) : h);
    if (!it || !it.kind) continue;
    // A test / homework item without a date is noise; a notice or bill without a date is still worth a card.
    if ((it.kind === 'test' || it.kind === 'homework') && !it.date) continue;
    try {
      const r = await fsCreate(`families/${fid}/inbox/${id}`, inboxDoc(uid, m, it, { members, ownerId }), fsToken);
      if (r === 'created') out.added.push({ id, kind: it.kind, title: it.title });
      // Knowledge graph: a school sender becomes a SUGGESTED "school" entry (shown in Family Memory until accepted).
      const addr = (/<([^>]+)>/.exec(m.from || '') || [])[1] || '';
      if (r === 'created' && it.kind !== 'sub' && /\.edu\.hk$/i.test(addr) && !suggestedSchools.has(addr.toLowerCase())) {
        suggestedSchools.add(addr.toLowerCase());
        const name = String(m.from || '').replace(/<[^>]*>/g, '').replace(/"/g, '').trim().slice(0, 80) || addr.split('@')[1];
        const sid = `s${id.slice(1, 13)}`;
        await fsPatch(`users/${uid}`, { memSuggest: { [sid]: { kind: 'entity', type: 'school', name, about: '', fields: { email: addr }, confidence: 0.8, src: 'email', at: Date.now() } }, schoolsSuggested: [...suggestedSchools].slice(0, 30) }, fsToken, [`memSuggest.${sid}`, 'schoolsSuggested']).catch(() => {});
      }
    } catch (err) { out.errors.push({ source: 'write', error: err.status || 'write' }); }
  }
  // Remember what was looked at (owner-only profile field), newest 300.
  const keep = [...newSeen, ...[...seen].filter((x) => !newSeen.includes(x))].slice(0, 300);
  await fsPatch(`users/${uid}`, { autoSeen: keep, autoScanAt: new Date() }, fsToken).catch(() => {});
  return out;
}
