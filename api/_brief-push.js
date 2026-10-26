// Morning push brief (api/push/cron.js) with the same data as the Home 今日摘要 card (src/lib/brief.js):
// every selected Google account's Gmail / Calendar / Classroom / Drive, read with fresh access tokens from the
// encrypted refresh tokens in users/{uid}.googleVault (api/_google-lib.js), condensed by the model into one short
// notification body. Falls back to plain counts when the model is unavailable. Only runs inside the cron, which needs
// FIREBASE_SERVICE_ACCOUNT to read profiles.
import { collectBrief, formatBrief, briefCounts, BRIEF_SOURCES } from '../src/lib/brief.js';
import { accessFor, configured } from './_google-lib.js';

const lc = (e) => String(e || '').toLowerCase();
function selectionOf(prof) {
  const all = (prof.googleAccounts || []).map((a) => lc(a?.email)).filter(Boolean);
  return Object.fromEntries(BRIEF_SOURCES.map((id) => {
    if (!prof.connections?.[id]) return [id, []];
    const sel = prof.serviceAccounts?.[id];
    return [id, (Array.isArray(sel) ? sel.map(lc) : all).filter((e) => all.includes(e))];
  }));
}

export async function googleBrief(uid, prof, only) {
  if (!configured()) return null;
  const vault = Object.values(prof.googleVault || {}).filter((v) => v?.email && v?.enc);
  const selection = selectionOf(prof);
  if (only) Object.keys(selection).forEach((k) => { if (!only.includes(k)) selection[k] = []; });
  const wanted = new Set(Object.values(selection).flat());
  if (!wanted.size || !vault.length) return null;
  const tokens = {};
  await Promise.all(vault.filter((v) => wanted.has(lc(v.email))).map(async (v) => { const r = await accessFor(uid, v); if (r.token) tokens[lc(v.email)] = r.token; }));
  if (!Object.keys(tokens).length) return null;
  const data = await collectBrief(selection, tokens);
  return { text: formatBrief(data), counts: briefCounts(data), data };
}

// One notification body (≤ ~180 chars) naming the most important items. Returns '' on failure.
export async function pushBriefText(lang, briefText, extra) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return '';
  const zh = lang !== 'en';
  const sys = zh
    ? '你是家庭助理 Nest。根據以下資料，用繁體中文書面語寫一則手機通知內文（最多 120 字，不用表情符號、不用標題、不用 Markdown）。點名最重要、需要用戶處理的事項（例如需要回覆的電郵、今日活動、即將到期的功課），每項極簡。沒有重要事項就直說。只用資料中的內容，不可虛構。'
    : 'You are Nest, a family helper. From the data below write ONE phone notification body in English (max 180 characters, no emoji, no heading, no markdown) naming the most important items that need the user (emails needing a reply, today\'s events, homework due soon). If nothing is important, say so. Use only the data; never invent.';
  try {
    const r = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'agnes-3.0-flash', stream: false, temperature: 0.3, messages: [{ role: 'system', content: sys }, { role: 'user', content: `${extra ? `${extra}\n\n` : ''}${briefText}`.slice(0, 20000) }] }),
    });
    if (!r.ok) return '';
    const j = await r.json();
    return String(j.choices?.[0]?.message?.content || '').replace(/\s+/g, ' ').trim().slice(0, zh ? 160 : 220);
  } catch { return ''; }
}
export function countsText(lang, c) {
  const zh = lang !== 'en'; const parts = [];
  if (c.unread) parts.push(zh ? `${c.unread} 封未讀電郵` : `${c.unread} unread emails`);
  if (c.events) parts.push(zh ? `今天有 ${c.events} 個活動` : `${c.events} events today`);
  if (c.due) parts.push(zh ? `${c.due} 項功課即將到期` : `${c.due} assignments due soon`);
  if (c.news) parts.push(zh ? `${c.news} 則課堂公告` : `${c.news} class announcements`);
  if (c.shared) parts.push(zh ? `${c.shared} 個新共用檔案` : `${c.shared} new shared files`);
  return parts.join(zh ? '、' : ' · ');
}
