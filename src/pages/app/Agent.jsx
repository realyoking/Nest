import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, IconButton, Markdown, Spinner, useToast } from '../../components/ui.jsx';
import ChatDrawer, { useEdgeSwipe } from '../../components/ChatDrawer.jsx';
import { chatTitle } from '../../lib/ai.js';
import Icon from '../../components/Icon.jsx';
import { BlurText } from '../../components/Reveal.jsx';
import { AppMark } from '../../brand.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { agentContext, useSession } from '../../lib/session.jsx';
import { connectedContext, peekConnected, warmConnected } from '../../lib/google.js';
import { parseAgent, needsConfirm, isDestructive, execute, undo as undoAction } from '../../lib/agent.js';
import { githubStatus, githubNote, ghIsRead } from '../../lib/github.js';
import { aiPrefs } from '../../lib/prefs.js';
import { aiErrorText } from './Home.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { rebaseLink } from '../../lib/links.js';
import ActionCard from '../../components/ActionCard.jsx';
import RichText, { hasUi, VisualRetry } from '../../components/RichText.jsx';
import { parseIntent, parseCardBlock, stripCardBlock, cardWhen, attachmentCard } from '../../lib/intent.js';
import { toTraditional } from '../../lib/chatctx.js';
import { toHans } from '../../lib/hans.js';
import { preferredReminderTime } from '../../lib/insights.js';
import { extractFromChat } from '../../lib/memory.js';
import { AttachButton, AttachChips, MsgAttachments } from '../../components/Attachments.jsx';
import { processFile, AttachError } from '../../lib/attach.js';
import { buildContent, persistPlan, planDocs, historyText, historyDocs, attachLimits, kindOf, REQUEST_BUDGET, HISTORY_DOC_TOKENS, HISTORY_DOC_TOKENS_BUSY } from '../../lib/attach-core.js';
import { dayKey } from '../../lib/plans.js';
import { classify, softenClaim } from '../../lib/grounding.js';
import { usePlugins } from '../../lib/plugins/runtime.jsx';
import { enqueue, takeBatch, combineBatch, lastTurn, loadQueue, saveQueue, newBatchId } from '../../lib/chat-queue.js';
import { parseCards, cardsNote } from '../../lib/chat-cards.js';
import ChatCards from '../../components/ChatCards.jsx';
import ProgressCard, { chatSteps, useNestie } from '../../components/ProgressCard.jsx';
import { bgStart, bgStep, bgFinish, bgRunning, EVT_CHANGE } from '../../lib/bg-tasks.js';
import ModelPicker from '../../components/ModelPicker.jsx';
import { ThinkToggle, ThinkBlock } from '../../components/ThinkMode.jsx';
// Run 26c: thought summaries of this session's replies (by reply text) — memory only, never written to Firestore.
const THOUGHTS = new Map();
import { modelLabel, normModel, normThink } from '../../lib/ai-models.js';
let think26 = null; // Run 26c: the thinking of the reply being streamed
import ModelIcon from '../../components/ModelIcon.jsx';

// Run 22: multi-send copy (AI 助理 only).
const QL = {
  'zh-Hant': { queued: '待傳送', full: '最多可排隊 8 則訊息，請稍候。', attWait: '附件會留在輸入欄，待目前回覆完成後再傳送。', held: (n) => `${n} 則訊息未傳送`, sendNow: '傳送', discard: '移除' },
  en: { queued: 'Queued', full: 'Up to 8 messages can wait in line — one moment.', attWait: 'Attachments stay in the box until the current reply is done.', held: (n) => `${n} message${n > 1 ? 's' : ''} not sent`, sendNow: 'Send', discard: 'Remove' },
};
QL['zh-Hans'] = { ...Object.fromEntries(Object.entries(QL['zh-Hant']).map(([k, v]) => [k, typeof v === 'string' ? toHans(v) : v])), held: (n) => toHans(QL['zh-Hant'].held(n)) };

// Compact snapshot of the user's own app state for questions about their account (labels only, no ids / tokens).
function appSnapshot(s, plug) {
  const p = s.prefs || {};
  const now = Date.now();
  const open = (s.reminders || []).filter((r) => !r.done);
  const due = (r) => (r.dueAt ? +new Date(r.dueAt?.toDate ? r.dueAt.toDate() : r.dueAt) : 0);
  return {
    lang: p.lang || '', theme: p.theme || '', icon: p.appIcon || (typeof localStorage !== 'undefined' ? localStorage.getItem('nest.icon') : '') || 'auto', push: !!p.pushEnabled, replyStyle: p.replyStyle || '',
    role: s.me?.role || '', owner: !!s.isOwner,
    members: (s.members || []).map((m) => `${String(m.displayName || '?').slice(0, 20)} (${m.role === 'parent' ? 'parent' : 'student'})`).join(', ').slice(0, 300),
    connected: Object.entries(s.profile?.connections || {}).filter(([, v]) => v).map(([k]) => k).join(', ') + (Object.keys(s.profile?.appleVault || {}).length ? ', applecalendar' : ''),
    plugins: (plug?.list || []).map((x) => `${x.manifest?.name || x.id}${x.status === 'on' ? '' : ` (${x.status})`}`).join(', ').slice(0, 300),
    reminders: open.length, overdue: open.filter((r) => due(r) && due(r) < now).length, attToday: s.attToday || 0,
  };
}

// Video blob URLs of this session (playback in the bubble; not persisted — no file storage on this plan).
const LIVE_VIDEOS = {};
const ATT_ERR = {
  'zh-Hant': { heic_unsupported: '這個瀏覽器未能讀取 HEIC 相片，請在 iPhone 上選取或改用 JPEG。', image_unreadable: '未能讀取這張相片。', video_too_long: '影片最長 {max} 秒。', video_unreadable: '未能讀取這段影片。', video_frames_unavailable: '這個瀏覽器未能擷取影片畫面，請改用相片或在 iPhone／Chrome 上再試。', file_too_big: '檔案太大（上限 {max} MB）。', type_unsupported: '暫不支援這種檔案。可上載相片、影片（≤60 秒）、PDF、Word、Excel、PowerPoint、TXT 或 CSV。', legacy_office: '請把舊式 .doc / .xls / .ppt 另存為 .docx / .xlsx / .pptx 再上載。', file_unreadable: '未能讀取這個檔案。', too_many: '每則訊息最多 {n} 個附件（你的計劃）。', daily: '今天的附件數量已用完（每日 {n} 個），將於今晚 00:00 重設。', too_large: '附件總大小太大，請移除一些相片或影片。', loading: '附件仍在處理中…' },
  en: { heic_unsupported: 'This browser can’t read HEIC photos — pick it on the iPhone or use JPEG.', image_unreadable: 'Couldn’t read this photo.', video_too_long: 'Videos can be at most {max} seconds.', video_unreadable: 'Couldn’t read this video.', video_frames_unavailable: 'This browser can’t capture video frames — send photos instead, or try on iPhone / Chrome.', file_too_big: 'File too large (limit {max} MB).', type_unsupported: 'This file type isn’t supported yet. You can add photos, videos (≤60 s), PDF, Word, Excel, PowerPoint, TXT or CSV.', legacy_office: 'Save old .doc / .xls / .ppt files as .docx / .xlsx / .pptx first.', file_unreadable: 'Couldn’t read this file.', too_many: 'Up to {n} attachments per message on your plan.', daily: 'Today’s attachments are used up ({n} a day). Resets tonight at 00:00.', too_large: 'Attachments are too large together — remove a photo or video.', loading: 'Attachments are still processing…' },
};
const attErr = (lang, code, v = {}) => String(ATT_ERR[lang === 'en' ? 'en' : 'zh-Hant'][code] || ATT_ERR[lang === 'en' ? 'en' : 'zh-Hant'].file_unreadable).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

const GOOGLE = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];
const SOURCE_NAMES = { gmail: 'Gmail', googlecalendar: 'Google Calendar', googleclassroom: 'Google Classroom', googledrive: 'Google Drive' };

export function useAutosize(ref, value) {
  useEffect(() => {
    const el = ref.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [value]);
}

// GitHub actions (Run 13): label + what exactly will happen, so the confirm card shows repo / path / files before any write.
const GH_L = {
  'zh-Hant': { repos: 'GitHub · 程式庫', search: 'GitHub · 搜尋程式庫', read: 'GitHub · 讀取檔案', tree: 'GitHub · 檔案列表', branches: 'GitHub · 分支', createRepo: 'GitHub · 建立程式庫', putFile: 'GitHub · 建立／更新檔案', commit: 'GitHub · 提交檔案', branch: 'GitHub · 建立分支', pr: 'GitHub · 開拉取請求', pages: 'GitHub · 啟用 Pages', priv: '私人', pub: '公開', files: '個檔案', mine: '我的程式庫' },
  en: { repos: 'GitHub · Repos', search: 'GitHub · Search repos', read: 'GitHub · Read file', tree: 'GitHub · List files', branches: 'GitHub · Branches', createRepo: 'GitHub · Create repo', putFile: 'GitHub · Create / update file', commit: 'GitHub · Commit files', branch: 'GitHub · Create branch', pr: 'GitHub · Open pull request', pages: 'GitHub · Enable Pages', priv: 'private', pub: 'public', files: 'files', mine: 'My repos' },
};
GH_L['zh-Hans'] = Object.fromEntries(Object.entries(GH_L['zh-Hant']).map(([k, v]) => [k, toHans(v)]));
function ghDescribe(a, lang) {
  const L = GH_L[lang] || GH_L['zh-Hant'];
  const k = a.type.slice(7);
  const base = { icon: 'link', label: L[k] || a.type };
  switch (a.type) {
    case 'github.repos': return { ...base, title: L.mine };
    case 'github.search': return { ...base, title: a.q };
    case 'github.read': case 'github.tree': return { ...base, title: `${a.repo}/${a.path || ''}`, sub: a.ref || '' };
    case 'github.branches': case 'github.pages': return { ...base, title: a.repo, sub: a.branch || '' };
    case 'github.createRepo': return { ...base, title: a.name, sub: a.private === false ? L.pub : L.priv };
    case 'github.putFile': return { ...base, title: `${a.repo}/${a.path}`, sub: [a.branch, a.message].filter(Boolean).join(' · ') };
    case 'github.commit': return { ...base, title: `${a.repo}${a.branch ? ` @${a.branch}` : ''}`, sub: `${a.files.length} ${L.files}: ${a.files.slice(0, 4).map((f) => f.path).join(', ')}${a.files.length > 4 ? '…' : ''}` };
    case 'github.branch': return { ...base, title: `${a.repo} @${a.name}`, sub: a.from ? `← ${a.from}` : '' };
    case 'github.pr': return { ...base, title: a.title || `${a.head} → ${a.base}`, sub: `${a.repo} · ${a.head} → ${a.base}` };
    default: return { ...base, title: '' };
  }
}

// Human description of one action.
export function describeAction(a, s, t, fmtDate, lang = 'zh-Hant') {
  const rem = (id) => s.reminders.find((r) => r.id === id);
  const mem = (id) => s.memories.find((m) => m.id === id);
  const when = (v) => {
    if (!v) return '';
    const str = String(v); const d = new Date(`${str.slice(0, 10)}T${/T\d/.test(str) ? str.slice(11, 16) : s.prefs.defaultReminderTime}:00+08:00`);
    return isNaN(d) ? '' : fmtDate(d, { month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' });
  };
  const who = (m) => { if (m == null || m === '') return ''; const x = s.members.find((y) => y.uid === m || y.displayName?.toLowerCase() === String(m).toLowerCase()); return x ? x.displayName : /everyone|全家|all/i.test(m) ? t('common.everyone') : ''; };
  const L = (k) => t(`agent.act.${k}`);
  switch (a.type) {
    case 'reminder.create': return { icon: 'bell', label: L('reminderCreate'), title: a.title, sub: [when(a.dueAt), who(a.member)].filter(Boolean).join(' · ') };
    case 'reminder.update': return { icon: 'bell', label: L('reminderUpdate'), title: a.title || rem(a.id)?.title || '—', sub: [when(a.dueAt), who(a.member)].filter(Boolean).join(' · ') };
    case 'reminder.complete': return { icon: 'check', label: a.done === false ? L('reminderReopen') : L('reminderComplete'), title: rem(a.id)?.title || '—' };
    case 'reminder.delete': return { icon: 'trash', label: L('reminderDelete'), title: rem(a.id)?.title || '—' };
    case 'memory.create': return { icon: 'brain', label: L('memoryCreate'), title: a.text, sub: a.tag ? `#${a.tag}` : '' };
    case 'memory.update': return { icon: 'brain', label: L('memoryUpdate'), title: a.text || mem(a.id)?.text || '—' };
    case 'memory.delete': return { icon: 'trash', label: L('memoryDelete'), title: mem(a.id)?.text || '—' };
    case 'settings.update': {
      const val = typeof a.value === 'boolean' ? t(a.value ? 'settings.on' : 'settings.off') : t(`settings.vals.${a.value}`);
      return { icon: 'gear', label: L('settings'), title: `${t(`settings.keys.${a.key}`)}: ${String(val).startsWith('settings.') ? a.value : val}` };
    }
    case 'invite.create': return { icon: 'link', label: L('invite'), title: s.family.name, sub: t('family.inviteSub') };
    case 'member.remove': return { icon: 'users', label: L('memberRemove'), title: s.members.find((m) => m.uid === a.id)?.displayName || '—' };
    case 'connected.read': return { icon: 'mail', label: L('connected'), title: (a.sources?.length ? a.sources : GOOGLE.filter((g) => s.profile?.connections?.[g])).map((x) => SOURCE_NAMES[x] || x).join('、') || '—' };
    case 'quiz.create': return { icon: 'cards', label: L('quiz'), title: a.topic || String(a.notes).slice(0, 60) };
    case 'github.repos': case 'github.search': case 'github.read': case 'github.tree': case 'github.branches': case 'github.createRepo': case 'github.putFile': case 'github.commit': case 'github.branch': case 'github.pr': case 'github.pages': return ghDescribe(a, lang);
    default: return { icon: 'sparkle', label: a.type, title: '' };
  }
}

const errText = (t, code) => { const v = t(`agent.errors.${code}`); return v.startsWith('agent.') ? t('common.error') : v; };

function ActionResult({ a, st }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const r = st?.result;
  if (!r || st.status !== 'done') return null;
  if (a.type === 'invite.create') return (
    <div className="action-result">
      <div className="invite-code" style={{ fontSize: 28 }}>{r.code}</div>
      <div className="invite-link"><code title={rebaseLink(r.link)}>{rebaseLink(r.link)}</code><Button size="sm" variant="secondary" icon="copy" onClick={() => { navigator.clipboard?.writeText(rebaseLink(r.link)); toast(t('common.copied')); }}>{t('common.copy')}</Button></div>
    </div>
  );
  if (a.type === 'connected.read') return (
    <div className="action-result">
      {r.groups.map((g) => (
        <div key={g.id} className="ar-group">
          <small>{SOURCE_NAMES[g.id]}</small>
          {g.items.length ? g.items.map((i, k) => <div key={k} className="ar-item"><b>{i.title}</b><span>{i.account ? <em className="acct-tag">{i.account}</em> : null}{i.sub}</span></div>) : <span className="muted small">{t('connections.noItems')}</span>}
        </div>
      ))}
      {(r.problems || []).map((p, k) => <p key={k} className="action-note err" style={{ margin: '4px 0 0' }}>{SOURCE_NAMES[p.id]} · {p.email}: {p.why === 'missing' ? t('agent.errors.missing_scope') : p.why === 'reauth' ? t('agent.errors.reauth') : `${t('common.error')} ${p.message || ''}`}</p>)}
    </div>
  );
  if (a.type.startsWith('github.')) {
    const links = [r.html_url, r.repo?.html_url].filter((u) => typeof u === 'string' && /^https:\/\/([a-z0-9-]+\.)?github\.(com|io)\//.test(u));
    return (
      <div className="action-result">
        {Array.isArray(r.repos) && r.repos.slice(0, 8).map((x) => <div key={x.full_name} className="ar-item"><b>{x.full_name}</b><span>{x.private ? '🔒 ' : ''}{x.description || x.language || ''}</span></div>)}
        {typeof r.content === 'string' && <pre className="gh-pre">{r.content.slice(0, 1500)}{r.content.length > 1500 ? '\n…' : ''}</pre>}
        {Array.isArray(r.entries || r.dir) && <div className="ar-item"><span>{(r.entries || r.dir).slice(0, 30).map((e) => `${e.name}${e.type === 'dir' ? '/' : ''}`).join('  ')}</span></div>}
        {Array.isArray(r.branches) && <div className="ar-item"><span>{r.branches.slice(0, 30).join(', ')}</span></div>}
        {links.slice(0, 1).map((u) => <a key={u} className="btn btn-outline btn-sm" href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^https:\/\//, '').slice(0, 60)}</a>)}
      </div>
    );
  }
  if (a.type === 'quiz.create') return (
    <div className="action-result"><Button size="sm" icon="cards" onClick={() => nav('/app/quiz', { state: { notes: r.notes, auto: true } })}>{t('agent.openQuiz')}</Button></div>
  );
  return null;
}

// Same to-do? Compares titles without filler words ("提我", "提醒", "remind me") by character bigrams.
export function sameItem(a, b) {
  const norm = (x) => String(x || '').toLowerCase().replace(/提我|提醒我?|記得|remind me( to)?|reminder|[\s\p{P}\p{S}]/gu, '');
  const A = norm(a); const B = norm(b);
  if (!A || !B) return false;
  if (A.includes(B) || B.includes(A)) return true;
  const grams = (x) => new Set(Array.from({ length: Math.max(1, x.length - 1) }, (_, i) => x.slice(i, i + 2)));
  const ga = grams(A); const gb = grams(B);
  let hit = 0; ga.forEach((g) => { if (gb.has(g)) hit += 1; });
  return hit / Math.min(ga.size, gb.size) >= 0.5;
}

function ActionCards({ actions, state = {}, legacy, onState }) {
  const { be } = useBe();
  const { t, lang, setLang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  if (!actions.length) return null;
  const ctx = { be, s, lang, setLang };
  const confirm = async (i) => {
    setBusy(i);
    try { const r = await execute(actions[i], ctx); await onState(i, { status: 'done', ...r }); }
    catch (e) { await onState(i, { status: 'error', code: e.code || 'error', ...(e.problems ? { problems: e.problems } : {}) }); toast(errText(t, e.code), 'err'); }
    finally { setBusy(null); }
  };
  const revert = async (i) => {
    setBusy(i);
    try { await undoAction(state[i].undo, ctx); await onState(i, { status: 'undone' }); toast(t('agent.undone')); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(null); }
  };
  return (
    <div className="actions-card">
      {actions.map((a, i) => {
        const d = describeAction(a, s, t, fmtDate, lang);
        const st = state[i] || { status: legacy ? 'pending' : 'pending' };
        const danger = isDestructive(a);
        return (
          <div className={`action ${st.status} ${danger ? 'danger' : ''}`} key={i}>
            <div className="action-row">
              <span className="action-icon"><Icon name={d.icon} size={17} /></span>
              <div className="action-main">
                <small>{d.label}{d.sub ? ` · ${d.sub}` : ''}</small>
                <b>{d.title}</b>
              </div>
              <div className="action-side">
                {busy === i ? <Spinner small /> : st.status === 'pending' ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => onState(i, { status: 'cancelled' })}>{t('common.cancel')}</Button>
                    <Button size="sm" variant={danger ? 'danger' : 'primary'} onClick={() => confirm(i)}>{t('common.confirm')}</Button>
                  </>
                ) : st.status === 'done' ? (
                  <span className="done-chip"><Icon name="check" size={14} stroke={2.4} />{/create$/.test(a.type) ? (lang === 'en' ? 'Added' : '已新增') : t('agent.done')}
                    {st.undo && <><i>·</i><button onClick={() => revert(i)}>{t('agent.undo')}</button></>}</span>
                ) : st.status === 'undone' ? <span className="pill">{t('agent.undone')}</span>
                  : st.status === 'cancelled' ? <span className="pill">{t('agent.cancelled')}</span>
                  : <span className="pill warn">{t('agent.failed')}</span>}
              </div>
            </div>
            {st.status === 'pending' && <p className="action-note"><b className="pending-tag">{lang === 'en' ? 'Awaiting confirmation' : '待確認'}</b> · {danger ? t('agent.confirmDanger') : (lang === 'en' ? 'Tap Confirm to set it.' : '按確認即可設定。')}</p>}
            {st.status === 'done' && /^(reminder|memory)\./.test(a.type) && !/delete/.test(a.type) && (
              <p className="action-note"><Button size="sm" variant="ghost" to={a.type.startsWith('reminder') ? '/app/reminders' : '/app/memory'}>{a.type.startsWith('reminder') ? (lang === 'en' ? 'Open Reminders ›' : '查看提醒 ›') : (lang === 'en' ? 'Open Family memory ›' : '查看家庭記憶 ›')}</Button></p>
            )}
            {st.status === 'error' && <p className="action-note err">{errText(t, st.code)}</p>}
            {st.status === 'error' && (st.problems || []).map((p, k) => <p key={k} className="action-note err" style={{ marginTop: 2 }}>{SOURCE_NAMES[p.id]} · {p.email}{p.message ? `: ${p.message}` : ''}</p>)}
            {(a.type === 'connected.read' || ghIsRead(a)) && ['done', 'error'].includes(st.status) && busy !== i && (
              <div className="row" style={{ gap: 8, marginTop: 6 }}>
                <Button size="sm" variant="outline" icon="refresh" onClick={() => confirm(i)}>{t('agent.reload')}</Button>
                {st.status === 'error' && <Button size="sm" variant="ghost" to={a.type.startsWith('github.') ? '/app/connections?svc=github' : '/app/connections'}>{t('app.nav.connections')}</Button>}
              </div>
            )}
            <ActionResult a={a} st={st} />
          </div>
        );
      })}
    </div>
  );
}

export function Message({ m, onActionState, onCard, onCardState }) {
  const { t, uiLang } = useI18n();
  if (m.role === 'user') {
    return (
      <>
        <div className={`msg user${m.queued ? ' queued' : ''}`} data-queued={m.queued ? '1' : undefined}><div className="msg-body">
          {m.image && <img src={m.image} alt="" />}
          {Array.isArray(m.atts) && m.atts.length > 0 && <MsgAttachments atts={m.atts} live={LIVE_VIDEOS} />}
          {(m.display || m.content) && <div style={{ whiteSpace: 'pre-wrap' }}>{m.display || m.content}</div>}
        </div></div>
        {m.queued && <p className="msg-queued" data-testid="msg-queued"><Icon name="clock" size={13} />{m.queuedLabel}</p>}
        {m.card && onCard && <div className="msg-card"><ActionCard key={`${m.id}-${m.card.status || ''}-${m.card.rev || 0}`} card={m.card} compact onDone={(c) => onCard(m, { ...c, status: 'done' })} onDismiss={() => onCard(m, { ...m.card, status: 'dismissed' })} /></div>}
      </>
    );
  }
  const pc = parseCards(stripCardBlock(m.content || ''));
  const { text, actions } = parseAgent(pc.text);
  // Run 23: no text yet → a progress card with steps (instead of the three dots); the reply pops in when it starts.
  const working = !text && (m.streaming || m.progress) && !(actions.length && !m.streaming);
  return (
    <div className={`msg assistant${working ? ' is-working' : ''}${!m.streaming && !m.progress && m.fresh ? ' popped' : ''}`}><div className={`msg-body${hasUi(text) ? ' has-ui' : ''}`}>
      {(m.think || THOUGHTS.get(m.content) || (m.thinkSec ? { sec: m.thinkSec } : null)) && <ThinkBlock think={m.think || THOUGHTS.get(m.content) || { sec: m.thinkSec }} streaming={!!m.streaming && !text} />}
      {m.streaming && m.status && !working && <StatusLine st={m.status} />}
      {text ? <RichText text={text} streaming={!!m.streaming} /> : working ? <ProgressCard steps={chatSteps(t, { seen: m.seen || [], attach: !!m.attach })} hint={m.progress || (m.seen || []).length ? t('r23.progress.leave') : ''} /> : actions.length && !m.streaming ? null : <div className="typing"><i /><i /><i /></div>}
      {!m.streaming && pc.cards.length > 0 && <ChatCards cards={pc.cards} state={m.cardState || {}} onState={onCardState ? (i, st) => onCardState(m, i, st) : undefined} readOnly={!onCardState} />}
      {Array.isArray(m.sources) && m.sources.length > 0 && text && (
        <div className="msg-sources">{m.sources.slice(0, 3).map((x, i) => <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" className="src-chip"><Icon name="globe" size={12} />{x.title}<small>{srcSite(x.url)}</small></a>)}</div>
      )}
      {m.interrupted && <p className="muted small" style={{ margin: '6px 0 0', fontWeight: 700 }}>{t('agent.interrupted')}</p>}
      {m.model && text && modelLabel(m.model, uiLang) && <p className="msg-model" data-testid="msg-model"><ModelIcon id={m.model.id} size={12} />{modelLabel(m.model, uiLang)}</p>}
      {!m.streaming && onActionState && <ActionCards actions={actions} state={m.actionState || {}} legacy={!m.actionState} onState={(i, st) => onActionState(m, i, st)} />}
    </div></div>
  );
}

// Run 27: source chip label = the site (Wikipedia for wikipedia.org).
export function srcSite(u) { try { const h = new URL(u).hostname.replace(/^www\./, ''); return /(^|\.)wikipedia\.org$/.test(h) ? 'Wikipedia' : h.slice(0, 28); } catch { return ''; } }

// Live status from the chat router (server events): web search, account state, action card, diagram.
function StatusLine({ st }) {
  const { t } = useI18n();
  const busy = ['lookup', 'state', 'action', 'diagram', 'thinking', 'reasoning'].includes(st.key);
  const txt = st.key === 'lookup' ? t('agentStatus.lookup', { q: st.q }) : st.key === 'sources' ? t('agentStatus.sources', { n: st.n }) : st.key === 'thinking' ? (st.prev ? t(`agentStatus.${st.prev.key}`, { n: st.prev.n, q: st.prev.q }) : '') : t(`agentStatus.${st.key}`);
  if (!txt) return null;
  return <p className={`msg-status ${busy && st.key !== 'thinking' ? 'busy' : ''}`} role="status" data-testid="msg-status"><Icon name={st.key === 'lookup' || st.key === 'sources' || st.key === 'lookupFailed' ? 'globe' : st.key === 'state' ? 'gauge' : st.key === 'diagram' || st.key === 'reasoning' ? 'sparkle' : 'check'} size={13} />{txt}</p>;
}

// The model must know what really happened to the cards it proposed (otherwise "Did you?" → "No" → a duplicate):
// each turn's history carries a short app note with the real state of every action / one-tap card.
export function withActionNotes(m, text) {
  if (typeof text !== 'string') return text;
  const notes = [];
  const word = (st) => (st === 'done' ? 'DONE — it exists in the app now' : st === 'pending' ? 'shown as a confirm card, NOT confirmed by the user yet' : st === 'dismissed' ? 'dismissed by the user' : st === 'error' ? 'FAILED' : st === 'undone' ? 'undone by the user' : 'not done');
  if (m.role === 'assistant') {
    const { actions } = parseAgent(parseCards(stripCardBlock(m.content || '')).text);
    const pcs = parseCards(stripCardBlock(m.content || '')).cards;
    if (pcs.length) notes.push(`reply cards — ${cardsNote(pcs, m.cardState || {})}`);
    actions.forEach((a, i) => { const st = m.actionState?.[i]?.status; const gn = a.type.startsWith('github.') && st === 'done' ? githubNote(a, m.actionState?.[i]?.result) : ''; notes.push(`${a.type}${a.title ? ` "${String(a.title).slice(0, 60)}"` : ''}: ${word(st)}${gn ? ` — ${gn}` : ''}`); });
  } else if (m.card && m.card.type) {
    if (m.card.status !== 'replaced') notes.push(`one-tap ${m.card.type} card "${String(m.card.title || '').slice(0, 60)}"${m.card.date ? ` ${m.card.date} ${m.card.time || ''}` : ''}: ${word(m.card.status || 'pending')}`);
  }
  return notes.length ? `${text}\n[App note — real state of the actions above: ${notes.join('; ')}. Never create a DONE item again.]` : text;
}

const HIDDEN_CHATS = new Set();

export default function Agent() {
  const { be, ai, demo } = useBe();
  useEffect(() => { if (!demo) githubStatus().catch(() => {}); }, [demo]); // agent context: is GitHub connected?
  const { cid } = useParams();
  const nav = useNavigate();
  const { t, lang, uiLang, setLang } = useI18n();
  const s = useSession();
  const sRef = useRef(s); sRef.current = s;
  const toast = useToast();
  const [convs, setConvs] = useState([]);
  const convsRef = useRef([]); convsRef.current = convs;
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(null);
  const [streamSources, setStreamSources] = useState([]);
  const [streamStatus, setStreamStatus] = useState(null);
  const [streamSeen, setStreamSeen] = useState([]); // Run 23: server status keys of the running turn (progress card)
  const [streamAttach, setStreamAttach] = useState(false);
  const [streamThink, setStreamThink] = useState(null); // Run 26c: { text, start, end } while a reply is thinking
  const [streamModel, setStreamModel] = useState(null); // Run 25: { id, auto, fb } of the model answering now
  const nestie = useNestie();
  const [, bgBump] = useState(0);
  useEffect(() => { const f = () => bgBump((n) => n + 1); window.addEventListener(EVT_CHANGE, f); return () => window.removeEventListener(EVT_CHANGE, f); }, []);
  const plug = usePlugins();
  // Composer attachments: { id, kind, name, size, status: loading|ready|error, progress, thumb, data | frames | text, error }
  const [atts, setAtts] = useState([]);
  const attsRef = useRef([]); attsRef.current = atts;
  const [dragging, setDragging] = useState(false);
  const planId = s.plan?.id || 'free';
  const lim = attachLimits(planId);
  const attDayKey = `nest.att.${s.user?.uid}.${dayKey()}`;
  const addFiles = (list) => {
    const files = [...(list || [])].filter(Boolean);
    if (!files.length) return;
    const room = lim.perMsg - attsRef.current.filter((a) => a.status !== 'error').length;
    if (room <= 0) { toast(attErr(lang, 'too_many', { n: lim.perMsg }), 'err'); return; }
    if (files.length > room) toast(attErr(lang, 'too_many', { n: lim.perMsg }), 'err');
    const usedToday = Math.max(Number(localStorage.getItem(attDayKey) || 0), s.attToday || 0);
    if (usedToday + attsRef.current.length >= lim.daily) { toast(attErr(lang, 'daily', { n: lim.daily }), 'err'); return; }
    const budget = Math.floor(REQUEST_BUDGET / lim.perMsg) - 20000;
    for (const f of files.slice(0, room)) {
      const k = kindOf(f.name, f.type);
      const tmp = { id: Math.random().toString(36).slice(2, 10), kind: k === 'image' || k === 'heic' ? 'image' : k === 'video' ? 'video' : 'pending-file', name: f.name || 'file', size: f.size, status: 'loading', progress: 0 };
      setAtts((x) => [...x, tmp]);
      const upd = (patch) => setAtts((x) => x.map((a) => (a.id === tmp.id ? { ...a, ...patch } : a)));
      processFile(f, { plan: planId, budget, onProgress: (p) => upd({ progress: p }) })
        .then((r) => { if (r.kind === 'video' && r.url) LIVE_VIDEOS[tmp.id] = r.url; upd({ ...r, id: tmp.id, status: 'ready', progress: 1 }); })
        .catch((e) => { const msg = attErr(lang, e instanceof AttachError ? e.code : 'file_unreadable', e); upd({ status: 'error', kind: tmp.kind === 'pending-file' ? 'file' : tmp.kind, error: msg }); toast(`${tmp.name}: ${msg}`, 'err'); });
    }
  };
  const removeAtt = (id) => setAtts((x) => x.filter((a) => a.id !== id));
  // Earlier turns for the model. Documents attached earlier travel again as the parts most related to the NEW question
  // (budgeted, newest first) — a follow-up like "what does page 13 say?" sees page 13, not a 2,000-character preview.
  const histOf = (list, question, busy = false) => {
    const hd = historyDocs(list, question, lang, { tokens: busy ? HISTORY_DOC_TOKENS_BUSY : HISTORY_DOC_TOKENS, note: withActionNotes });
    return list.map((m) => ({ role: m.role, content: hd[m.id] || withActionNotes(m, historyText(m, lang)) }));
  };
  const [err, setErr] = useState('');
  const [histOpen, setHistOpen] = useState(false);
  // History: drawer on phones, persistent collapsible sidebar above 900px.
  const [desktop, setDesktop] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(min-width: 901px)').matches);
  useEffect(() => { const mq = matchMedia('(min-width: 901px)'); const f = () => setDesktop(mq.matches); mq.addEventListener?.('change', f); return () => mq.removeEventListener?.('change', f); }, []);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('nest.chat.side') === '0'; } catch { return false; } });
  const toggleSide = () => { if (!desktop) { setHistOpen(true); return; } setCollapsed((v) => { try { localStorage.setItem('nest.chat.side', v ? '1' : '0'); } catch {} return !v; }); };
  const openDrawer = useCallback(() => setHistOpen(true), []);
  useEdgeSwipe(!desktop && !histOpen, openDrawer);
  // Chats waiting for their undo toast to expire. Module-level so it survives the /agent/:cid → /agent remount.
  const [, bump] = useState(0);
  useEffect(() => { const f = () => bump((n) => n + 1); window.addEventListener('nest:chat-hidden', f); return () => window.removeEventListener('nest:chat-hidden', f); }, []);
  const hidden = HIDDEN_CHATS;
  const setHidden = (fn) => { const next = fn(new Set(HIDDEN_CHATS)); HIDDEN_CHATS.clear(); next.forEach((x) => HIDDEN_CHATS.add(x)); window.dispatchEvent(new Event('nest:chat-hidden')); };
  const scroller = useRef(null);
  const ta = useRef(null);
  useAutosize(ta, input);
  // Instant action card while typing (local parse, debounced). Dismissed drafts stay hidden for that text.
  const [typed, setTyped] = useState('');
  useEffect(() => { const h = setTimeout(() => setTyped(input), 300); return () => clearTimeout(h); }, [input]);
  const [draftOff, setDraftOff] = useState('');
  const intentOpts = () => ({ defaultTime: preferredReminderTime(s) || s.prefs.defaultReminderTime || '09:00', members: s.members, meUid: s.user.uid });
  const draft = useMemo(() => (typed.trim() && typed !== draftOff ? parseIntent(typed, lang, Date.now(), intentOpts()) : null), [typed, draftOff, lang, s.members.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draftDone, setDraftDone] = useState(null);

  useEffect(() => be.watchConversations(s.family.id, s.user.uid, setConvs), [s.family.id]);
  // Warm the connected-account context while the user is typing (chat turns then never wait for Google).
  useEffect(() => { if (!be.MOCK) warmConnected(GOOGLE.filter((g) => s.profile?.connections?.[g]), s.profile); }, [s.profile?.connections]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!cid) { setMsgs([]); return; } return be.watchMessages(s.family.id, cid, setMsgs); }, [cid]);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [msgs.length, streaming]);

  const msgsRef = useRef([]); msgsRef.current = msgs;
  const stopRef = useRef(null);
  // Run 22 multi-send: messages typed while a reply is generating wait here (sessionStorage) and go out as ONE request.
  const QLx = QL[uiLang] || (lang === 'en' ? QL.en : QL['zh-Hant']);
  const [queue, setQueueState] = useState(() => loadQueue());
  const queueRef = useRef(queue); queueRef.current = queue;
  const setQueue = (fn) => { const next = typeof fn === 'function' ? fn(queueRef.current) : fn; queueRef.current = next; saveQueue(next); setQueueState(next); };
  const [held, setHeld] = useState(() => loadQueue().length > 0); // queued but not auto-sent (after an error or a reload)
  const busyRef = useRef(false); // a turn is running (set synchronously, unlike `streaming`)
  const runCid = useRef(null);
  useEffect(() => { if (queue.length) scroller.current?.scrollTo({ top: 1e9, behavior: 'smooth' }); }, [queue.length]);
  const [retryable, setRetryable] = useState(false);
  // Run one assistant turn for `history` (which ends with the user's message) in conversation `id`.
  // Returns 'ok' | 'aborted' | 'error' (multi-send decides from it whether the queue goes out now).
  const run = async (id, history, card = null, userMsgId = null, attach = null, batchN = 0) => {
    setErr(''); setRetryable(false);
    busyRef.current = true; runCid.current = id;
    if (queueRef.current.some((q) => !q.cid)) setQueue((q) => q.map((x) => (x.cid ? x : { ...x, cid: id })));
    const ctl = new AbortController(); stopRef.current = ctl;
    let partial = '';
    let failed = false;
    try {
      setStreaming(''); setStreamSources([]); setStreamStatus(null); setStreamSeen([]); setStreamAttach(!!attach); setStreamModel(null); setStreamThink(null); think26 = null;
      bgStart(id);
      const enabled = GOOGLE.filter((g) => s.profile?.connections?.[g]);
      // Connected data is a bonus and must not delay the first token: use the warm cache; when it is cold, wait at most
      // 1.2 s (3.5 s when the message is clearly about mail / school / calendar) and let the fetch finish in the background.
      const lastC = history[history.length - 1]?.content;
      const lastText = Array.isArray(lastC) ? String(lastC[0]?.text || '') : String(lastC || '');
      const needsG = /email|e-mail|mail|gmail|inbox|calendar|schedule|classroom|homework|assignment|due|drive|郵件|電郵|日曆|行事曆|功課|作業|功課|課業|到期|截止|classroom|雲端/i.test(lastText);
      let connected = enabled.length ? peekConnected(enabled, s.profile) : '';
      if (connected === null) connected = await Promise.race([warmConnected(enabled, s.profile) || Promise.resolve(''), new Promise((r) => setTimeout(() => r(''), needsG ? 3500 : 1200))]) || '';
      if (ctl.signal.aborted) return 'aborted';
      const cardHint = card ? `${card.type} | ${card.title} | ${card.date || ''} ${card.time || ''}${card.repeat && card.repeat !== 'none' ? ` | repeats ${card.repeat}` : ''}${card.status === 'done' ? ' | ALREADY CONFIRMED by the user' : ''}` : '';
      // The user's own app state (usage, plan, settings, plugins…) only when the question is about their account.
      const appState = classify(lastText, 'chat').state ? appSnapshot(sRef.current, plug) : null;
      let sources = []; let modelMeta = null;
      // One silent retry when the request failed before any text arrived (cold start / upstream hiccup); the error banner
      // only shows if the retry fails too.
      const once = () => ai.streamChat({ mode: 'chat', lang, messages: history, context: agentContext(s, { connected, ...(cardHint ? { cardHint } : {}), ...(attach ? { attachHint: attach.hint } : {}), ...(appState ? { appState } : {}), ...(batchN > 1 ? { batch: batchN } : {}) }), prefs: aiPrefs(s.prefs), onDelta: (x) => { partial = x; setStreaming(x); if (think26 && !think26.end && x) { think26 = { ...think26, end: Date.now() }; setStreamThink(think26); } }, onThink: (t) => { think26 = think26 ? { ...think26, text: (think26.text + t).slice(-8000) } : { text: t, start: Date.now(), end: 0 }; setStreamThink(think26); }, think: normThink(s.prefs?.aiThink), onSources: (x) => { sources = x; setStreamSources(x); }, onModel: (x) => { modelMeta = x; setStreamModel(x); }, model: normModel(s.prefs?.aiModel), onStatus: (x) => { if (x?.key && x.key !== 'thinking') { setStreamSeen((v) => (v.includes(x.key) ? v : [...v, x.key])); bgStep(id, x.key); } setStreamStatus((p) => (x.key === 'thinking' ? (p ? { key: 'thinking', prev: p.key === 'thinking' ? p.prev : p } : null) : x)); }, signal: ctl.signal, ...(attach ? { attach: { n: attach.n } } : {}) });
      let full;
      try { full = await once(); }
      catch (e1) {
        const transient = /^(network|http_5\d\d|ai_error|ai_timeout|stream_failed|bad_gateway)$/.test(String(e1?.code || '')) && !e1?.partial && !ctl.signal.aborted;
        console.warn('[nest] chat failed', e1?.code, e1?.status || '', transient ? '→ retrying once' : '');
        if (!transient) throw e1;
        full = await once();
      }
      if (full) {
        // Run low-risk actions now (unless the user wants to approve everything); queue the rest as confirm cards.
        const { actions } = ctl.signal.aborted ? { actions: [] } : parseAgent(stripCardBlock(full));
        // Model refinement of the pending one-tap card (never executes anything by itself).
        const umid = await Promise.resolve(userMsgId).catch(() => null);
        const fix = card && card.status !== 'done' && umid ? parseCardBlock(full) : null;
        if (fix) {
          const ok = (k, re) => (typeof fix[k] === 'string' && re.test(fix[k]) ? { [k]: fix[k] } : {});
          const next = { ...card, ...ok('date', /^\d{4}-\d{2}-\d{2}$/), ...ok('time', /^\d{2}:\d{2}$/), ...(typeof fix.title === 'string' && fix.title.trim() ? { title: fix.title.trim().slice(0, 200) } : {}), ...(['reminder', 'event', 'task', 'memory', 'shopping'].includes(fix.type) ? { type: fix.type } : {}), rev: (card.rev || 0) + 1, refined: true };
          await be.updateMessage(s.family.id, id, umid, { card: JSON.parse(JSON.stringify(next)) }).catch(() => {});
        }
        // A photo / file of a notice, letter or poster → one-tap reminder / event card from the model's nest-card block.
        const found = !card && attach && umid && !ctl.signal.aborted ? parseCardBlock(full) : null;
        const nc = found ? attachmentCard(found, { fixText: lang === 'zh-Hant' ? toTraditional : (t) => t }) : null;
        if (nc) await be.updateMessage(s.family.id, id, umid, { card: JSON.parse(JSON.stringify(nc)) }).catch(() => {});
        const actionState = {};
        // An unconfirmed one-tap card for the same item is still on screen (this message or a recent one): the model's
        // create action becomes a confirm card (待確認) and replaces that card, so nothing is added twice or unasked.
        const pendCards = [
          ...(card && card.status !== 'done' && umid ? [{ mid: umid, card }] : []),
          ...msgsRef.current.slice(-8).filter((m) => m.role === 'user' && m.id && m.card && m.card.status === 'pending').map((m) => ({ mid: m.id, card: m.card })),
        ];
        const replaced = new Set();
        for (let i = 0; i < actions.length; i++) {
          const cur = sRef.current;
          const a = actions[i];
          const twin = a.type === 'reminder.create' ? pendCards.find((p) => sameItem(p.card.title, a.title)) : null;
          if (twin) { replaced.add(twin.mid); actionState[i] = { status: 'pending' }; continue; }
          if (needsConfirm(a, cur.prefs)) { actionState[i] = { status: 'pending' }; continue; }
          try { actionState[i] = { status: 'done', ...(await execute(actions[i], { be, s: cur, lang, setLang })) }; }
          catch (e) { actionState[i] = { status: 'error', code: e.code || 'error', ...(e.problems ? { problems: e.problems } : {}) }; }
        }
        for (const rm of replaced) {
          const pc = pendCards.find((p) => p.mid === rm);
          if (pc) await be.updateMessage(s.family.id, id, rm, { card: JSON.parse(JSON.stringify({ ...pc.card, status: 'replaced' })) }).catch(() => {});
        }
        const anyPending = Object.values(actionState).some((x) => x.status === 'pending');
        const shown = anyPending ? softenClaim(full, lang) : full;
        if (think26) THOUGHTS.set(shown, think26.end ? think26 : { ...think26, end: Date.now() });
        await be.addMessage(s.family.id, id, { role: 'assistant', content: shown, ...(sources.length ? { sources } : {}), ...(modelMeta?.id ? { model: modelMeta } : {}), ...(think26 ? { thinkSec: Math.max(1, Math.round(((think26.end || Date.now()) - think26.start) / 1000)) } : {}), ...(ctl.signal.aborted ? { interrupted: true } : {}), ...(actions.length ? { actionState: JSON.parse(JSON.stringify(actionState)) } : {}) });
        if (ctl.signal.aborted) setRetryable(true);
        // Cross-chat memory (server-side extraction; skipped when "Remember from past chats" is off).
        else extractFromChat(be, sRef.current, [...history, { role: 'assistant', content: stripCardBlock(parseAgent(full).text) }], lang).catch(() => {});
      }
      await be.touchConversation(s.family.id, id);
      // Short AI title after the first exchange (cheap server call; the first-message title stays if it fails).
      if (!demo && history.filter((m) => m.role === 'user').length === 1 && !ctl.signal.aborted && full) {
        const conv = sRef.current && convsRef.current.find((c) => c.id === id);
        if (!conv?.titleAuto) chatTitle({ lang, user: lastText || (attach ? '附件' : ''), assistant: parseAgent(full).text })
          .then((title) => title && be.updateConversation(s.family.id, id, { title, titleAuto: true })).catch(() => {});
      }
      return ctl.signal.aborted ? 'aborted' : 'ok';
    } catch (e) {
      failed = true;
      const got = e?.partial || partial;
      if (e?.code === 'aborted') { setRetryable(true); return 'aborted'; }
      if (got) await be.addMessage(s.family.id, id, { role: 'assistant', content: parseAgent(got).text || got, interrupted: true }).catch(() => {});
      const m = e?.code === 'stalled' ? t('agent.stalled') : aiErrorText(e, t);
      setErr(m); setRetryable(e?.code !== 'limit_reached');
      if (e?.code !== 'stalled') toast(m, 'err');
      return 'error';
    } finally {
      stopRef.current = null; busyRef.current = false; setStreaming(null);
      // Run 23: the user may have left this chat while it ran — tell them it is ready (AppShell shows the toast).
      const conv = convsRef.current.find((c) => c.id === id);
      bgFinish(id, { ok: !failed && !ctl.signal.aborted, title: conv?.title || '' });
    }
  };

  // After a turn: the queue of this conversation goes out as one batch, unless the turn failed (then it waits — shown
  // with a Send button — so nothing is lost and nothing is spent twice).
  const afterRun = (outcome) => {
    const id = runCid.current;
    if (!queueRef.current.some((q) => q.cid === id)) return;
    if (outcome === 'error') { setHeld(true); return; }
    flushQueue(id);
  };
  const flushQueue = async (id) => {
    const { batch } = takeBatch(queueRef.current, id);
    if (!id || !batch.length || busyRef.current) return;
    busyRef.current = true; setHeld(false); setErr('');
    // let the previous reply's snapshot land in msgsRef first
    await new Promise((r) => setTimeout(r, 80));
    const prior = histOf(msgsRef.current.filter((m) => !m.interrupted && !batch.some((b) => b.qid === m.qid)).slice(-11), batch.map((b) => b.text).join('\n'));
    const bid = batch.length > 1 ? newBatchId() : null;
    try {
      for (const q of batch) await be.addMessage(s.family.id, id, { role: 'user', content: q.text, qid: q.qid, ...(bid ? { batch: bid } : {}) });
    } catch (e) {
      busyRef.current = false; setHeld(true);
      const m = aiErrorText(e, t); setErr(m); toast(m, 'err'); return;
    }
    setQueue((q) => q.filter((x) => !batch.some((b) => b.qid === x.qid)));
    const { text, n } = combineBatch(batch.map((b) => b.text));
    busyRef.current = false;
    const outcome = await run(id, [...prior, { role: 'user', content: text }], null, null, null, n);
    afterRun(outcome);
  };

  const send = async (textArg) => {
    // Run 22: a reply is generating → queue (the input never blocks); held messages + this one → one batch.
    if (busyRef.current || streaming !== null) {
      const r = enqueue(queueRef.current, { text: textArg ?? input, cid: runCid.current || cid || '' });
      if (!r.ok) { if (r.reason === 'full') toast(QLx.full, 'err'); return; }
      setQueue(r.queue);
      if (textArg == null) { setInput(''); setTyped(''); if (attsRef.current.length) toast(QLx.attWait); }
      return;
    }
    if (cid && queueRef.current.some((q) => q.cid === cid)) {
      const r = enqueue(queueRef.current, { text: textArg ?? input, cid });
      if (r.ok) setQueue(r.queue);
      if (textArg == null) { setInput(''); setTyped(''); }
      flushQueue(cid);
      return;
    }
    const text = (textArg ?? input).trim();
    const pend = textArg != null ? [] : attsRef.current;
    if (pend.some((a) => a.status === 'loading')) { toast(attErr(lang, 'loading'), 'err'); return; }
    const ready = pend.filter((a) => a.status === 'ready');
    if ((!text && !ready.length) || streaming !== null || busyRef.current) return;
    busyRef.current = true; // until run() takes over (no second turn can start while the conversation is created)
    const chars = ready.reduce((n, a) => n + (a.data?.length || 0) + (a.frames || []).reduce((m, f) => m + f.length, 0), 0);
    if (chars > REQUEST_BUDGET + 200000) { toast(attErr(lang, 'too_large'), 'err'); return; }
    setInput(''); setErr(''); if (pend.length) setAtts([]);
    // The one-tap card goes under the sent message (already confirmed while typing → shown as done).
    const parsed = ready.length || text === draftOff ? null : parseIntent(text, lang, Date.now(), intentOpts());
    const card = parsed ? (draftDone && draftDone.text === text ? { ...draftDone.card, status: 'done' } : { ...parsed, status: 'pending' }) : null;
    setDraftDone(null); setTyped(''); setDraftOff('');
    let id = cid; let mid = null;
    const docPlan = ready.length ? planDocs(text, ready) : {};
    try {
      if (!id) { id = await be.createConversation(s.family.id, (text || ready[0]?.name || '').slice(0, 48)); nav(`/app/agent/${id}`, { replace: true }); }
      // Speed: the user's message is written in parallel with the model call (the reply is only stored after it).
      // Full extracted text is kept with the message (long texts spill into chunk docs, merged back by the backend);
      // sentWords records how much of each document the model got this turn (shown under the file when trimmed).
      const saved = persistPlan(ready, docPlan);
      mid = be.addMessage(s.family.id, id, { role: 'user', content: text, ...(ready.length ? { atts: JSON.parse(JSON.stringify(saved.atts)) } : {}), ...(card ? { card: JSON.parse(JSON.stringify(card)) } : {}) }).then((ref) => ref?.id || null);
      mid.catch(() => {});
      if (saved.chunks.length) { const fid = s.family.id; const cid2 = id; mid.then((m) => m && Promise.all(saved.chunks.map((c) => be.addMessage(fid, cid2, { role: 'attext', of: m, ...c })))).catch(() => toast(lang === 'en' ? 'Part of the long document could not be saved to Files.' : '長文件有部分未能儲存到檔案。', 'err')); }
    } catch (e) { busyRef.current = false; const m = aiErrorText(e, t); setErr(m); toast(m, 'err'); return; }
    const history = [...histOf(msgs.filter((m) => !m.interrupted).slice(-11), text, Object.keys(docPlan).length > 0), { role: 'user', content: buildContent(text, ready, lang, docPlan) }];
    let attach = null;
    if (ready.length) {
      attach = { n: ready.length, hint: lang === 'en' ? 'The user attached photos/files/video. Only if one is a school notice, letter, invoice, invitation or poster that itself states a FUTURE date (an event or a deadline — never for plain lists, menus or photos), append ONE ```nest-card {"type":"reminder|event","title":"...","date":"YYYY-MM-DD","time":"HH:MM"}``` block (Hong Kong time) after your reply; otherwise none.' : '用戶附上了相片／檔案／影片。只有當其中有學校通告、信件、帳單、邀請或海報，而且文件本身寫明一個未來日期（活動或截止日期；普通清單、菜單或相片不要），才在回覆後附上一個 ```nest-card {"type":"reminder|event","title":"...","date":"YYYY-MM-DD","time":"HH:MM"}``` 區塊（香港時間，標題用繁體中文）；否則不要。' };
      try { localStorage.setItem(attDayKey, String(Number(localStorage.getItem(attDayKey) || 0) + ready.length)); } catch {}
    }
    const outcome = await run(id, history, card, mid, attach);
    if (attach) s.refreshPlan?.();
    afterRun(outcome);
  };
  // 重試: answer the last user message again (an interrupted partial reply is left out of the history).
  const retry = async () => {
    if (!cid || streaming !== null || busyRef.current) return;
    const lt = lastTurn(msgs);
    if (!lt) return;
    let outcome;
    if (lt.items.length > 1) { // a multi-send batch: the same messages again, as one request
      const { text, n } = combineBatch(lt.items.map((m) => m.content));
      const before = histOf(msgs.slice(0, lt.first).filter((m) => !m.interrupted).slice(-11), text);
      outcome = await run(cid, [...before, { role: 'user', content: text }], null, null, null, n);
    } else {
      const history = histOf(msgs.slice(0, lt.last + 1).filter((m) => !m.interrupted).slice(-12), msgs[lt.last]?.content || '');
      outcome = await run(cid, history);
    }
    afterRun(outcome);
  };
  // 未能顯示圖表 → 重試: ask for the drawing again (the model sees its malformed block in the history).
  const retryVisual = () => send(lang === 'en' ? 'Please draw that diagram again.' : lang === 'zh-Hans' ? '请重新画这个图。' : '請重新畫這個圖。');
  const stop = () => stopRef.current?.abort();

  const onActionState = async (m, i, st) => {
    if (!m.id || m.id === 'stream') return;
    const next = { ...(m.actionState || {}), [i]: st };
    await be.updateMessage(s.family.id, cid, m.id, { actionState: JSON.parse(JSON.stringify(next)) }).catch(() => toast(t('common.error'), 'err'));
  };
  const onCardState = async (m, i, st) => {
    if (!m.id || m.id === 'stream') return;
    const next = { ...(m.cardState || {}), [i]: st };
    await be.updateMessage(s.family.id, cid, m.id, { cardState: JSON.parse(JSON.stringify(next)) }).catch(() => toast(t('common.error'), 'err'));
  };
  const onCard = async (m, card) => { await be.updateMessage(s.family.id, cid, m.id, { card: JSON.parse(JSON.stringify(card)) }).catch(() => toast(t('common.error'), 'err')); };
  // Delete with undo: hidden at once, really deleted when the undo toast expires.
  const del = (c) => {
    const id = c.id; let undone = false;
    setHidden((h) => new Set([...h, id]));
    if (id === cid) nav('/app/agent');
    toast(t('agent.deleted'), 'ok', {
      action: { label: t('agent.undo'), onClick: () => { undone = true; setHidden((h) => { const n = new Set(h); n.delete(id); return n; }); } },
      onExpire: () => { if (!undone) be.deleteConversation(s.family.id, id).catch(() => { toast(t('common.error'), 'err'); setHidden((h) => { const n = new Set(h); n.delete(id); return n; }); }); },
    });
  };
  const renameChat = (c, title) => be.updateConversation(s.family.id, c.id, { title, titleAuto: false }).catch(() => toast(t('common.error'), 'err'));
  const pinChat = (c, pinned) => be.updateConversation(s.family.id, c.id, { pinned }).then(() => toast(pinned ? t('agent.pinned') : t('agent.unpinned'))).catch(() => toast(t('common.error'), 'err'));
  const textCache = useRef(new Map());
  const searchContent = async (ql) => {
    const recent = convs.slice(0, 40);
    await Promise.all(recent.filter((c) => !textCache.current.has(c.id)).map(async (c) => {
      const ms = await be.listMessages(s.family.id, c.id).catch(() => []);
      textCache.current.set(c.id, ms.map((m) => String(m.content || '')).join('\n').toLowerCase());
    }));
    return new Set(recent.filter((c) => textCache.current.get(c.id)?.includes(ql)).map((c) => c.id));
  };
  const shownConvs = convs.filter((c) => !hidden.has(c.id));
  const current = convs.find((c) => c.id === cid);
  const pendingHere = queue.filter((q) => q.cid === (cid || runCid.current || '') && !msgs.some((m) => m.qid === q.qid));
  const view = [
    ...msgs,
    ...(streaming !== null ? [{ id: 'stream', role: 'assistant', content: streaming, streaming: true, sources: streamSources, status: streamStatus, seen: streamSeen, attach: streamAttach, model: streamModel, think: streamThink }] : []),
    // Run 23: a turn of this chat is still running from before the user left and came back.
    ...(streaming === null && cid && bgRunning(cid) ? [{ id: 'bg', role: 'assistant', content: '', progress: true, seen: bgRunning(cid).steps }] : []),
    ...pendingHere.map((q) => ({ id: q.qid, role: 'user', content: q.text, queued: true, queuedLabel: QLx.queued })),
  ];

  return (
    <div className={`chat-layout ${desktop && !collapsed ? 'with-side' : ''}`}>
      <ChatDrawer desktop={desktop} collapsed={collapsed} open={histOpen} onClose={() => setHistOpen(false)} convs={shownConvs} cid={cid}
        onSelect={(c) => nav(`/app/agent/${c.id}`)} onNew={() => nav('/app/agent')} onDelete={del} onRename={renameChat} onPin={pinChat} searchContent={searchContent} />
      <section className={`chat ${dragging ? 'dragging' : ''}`}
        onDragOver={(e) => { if (!demo && [...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); setDragging(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }}
        onDrop={(e) => { if (demo) return; e.preventDefault(); setDragging(false); addFiles(e.dataTransfer?.files); }}>
        {dragging && <div className="att-drop" aria-hidden="true">{lang === 'en' ? 'Drop to attach' : '放開以加入附件'}</div>}
        <div className="chat-head">
          <IconButton icon="menu" label={t('agent.history')} onClick={toggleSide} aria-expanded={desktop ? !collapsed : histOpen} />
          <b className="chat-head-t">{current?.title || (cid ? t('agent.untitled') : t('agent.newChat'))}</b>
          {cid ? <IconButton icon="plus" label={t('agent.newChat')} onClick={() => nav('/app/agent')} /> : <span style={{ width: 38 }} />}
        </div>
        <div className="chat-scroll" ref={scroller}>
          {view.length === 0 ? (
            <div className="chat-empty">
              <div style={{ marginBottom: 22 }}><AppMark size={56} /></div>
              <BlurText as="h2" text={t('agent.empty')} key={lang} />
              <p className="nestie-chip" data-testid="nestie-chip">{t('r23.nestie.chip', { name: nestie.nestieName, p: t(`r23.nestie.p.${nestie.personality}`) })}</p>
              <div className="chips">{t('agent.suggestions').map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
            </div>
          ) : <VisualRetry.Provider value={retryVisual}>{view.map((m) => <Message key={m.id} m={m} onActionState={onActionState} onCard={onCard} onCardState={onCardState} />)}</VisualRetry.Provider>}
        </div>
        {(err || (retryable && streaming === null)) && (
          <div className="notice row" style={{ justifyContent: 'space-between', gap: 10 }}>
            <span>{err || t('agent.stopped')}</span>
            {retryable && <Button size="sm" variant="outline" icon="refresh" onClick={retry}>{t('common.retry')}</Button>}
          </div>
        )}
        {held && streaming === null && pendingHere.length > 0 && (
          <div className="queue-bar" data-testid="queue-bar">
            <span>{QLx.held(pendingHere.length)}</span>
            <span className="row" style={{ gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={() => { setQueue((q) => q.filter((x) => !pendingHere.some((p) => p.qid === x.qid))); setHeld(false); }}>{QLx.discard}</Button>
              <Button size="sm" icon="arrowUp" onClick={() => flushQueue(cid)}>{QLx.sendNow}</Button>
            </span>
          </div>
        )}
        {draft && streaming === null && !(draftDone && draftDone.text === typed) && (
          <div className="draft-card"><ActionCard key={`${draft.type}|${draft.title}|${draft.date}|${draft.time}`} card={draft} compact onDone={(c) => setDraftDone({ text: typed, card: c })} onDismiss={() => setDraftOff(typed)} /></div>
        )}
        {draftDone && draftDone.text === typed && typed && <div className="draft-card"><ActionCard card={{ ...draftDone.card, status: 'done' }} compact /></div>}
        <AttachChips atts={atts} onRemove={removeAtt} />
        {!demo && <div className="composer-tools"><ModelPicker /><ThinkToggle /></div>}
        <form className="composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
          {!demo && <AttachButton onFiles={addFiles} disabled={streaming !== null} />}
          <textarea ref={ta} rows={1} value={input} placeholder={t('r23.nestie.ask', { name: nestie.nestieName })} onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => { const f = [...(e.clipboardData?.files || [])]; if (f.length && !demo) { e.preventDefault(); addFiles(f); } }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
          {streaming !== null && input.trim() && <button className="send-btn" type="submit" aria-label={t('common.send')} data-testid="queue-send"><Icon name="arrowUp" size={20} stroke={2.25} /></button>}
          {streaming !== null
            ? <button className="send-btn stop" type="button" onClick={stop} aria-label={t('agent.stop')} title={t('agent.stop')}><span style={{ width: 14, height: 14, borderRadius: 3, background: 'currentColor', display: 'block' }} /></button>
            : <button className="send-btn" type="submit" disabled={!input.trim() && !atts.some((a) => a.status === 'ready')} aria-label={t('common.send')}><Icon name="arrowUp" size={20} stroke={2.25} /></button>}
        </form>
      </section>
    </div>
  );
}
