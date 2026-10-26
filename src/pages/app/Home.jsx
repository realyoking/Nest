import { useEffect, useRef, useState, Suspense } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Empty, IconButton, Markdown, Modal, Spinner, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { BlurText, Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { aiContext, useSession } from '../../lib/session.jsx';
import { connectedContext, hasAnyToken, briefInputs } from '../../lib/google.js';
import { collectBrief, formatBrief } from '../../lib/brief.js';
import { hkDayKey, fromLocalInput } from '../../lib/dates.js';
import { aiPrefs, inQuietHours } from '../../lib/prefs.js';
import { weekKey } from '../../lib/plans.js';
import { ReminderForm, ReminderRow, useVisibleReminders } from './Reminders.jsx';
import { useSeason, SeasonChip } from '../../lib/season-hook.js';
import UsageMeter from '../../components/UsageMeter.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { prompt } from '../../lib/prompts.js';
import { GiftBanner } from '../../components/Promo.jsx';
import AdminCard from '../../components/AdminCard.jsx';
import { PluginWidgets } from '../../components/PluginSettings.jsx';
import { DigestView, InboxSheet, MailSheet } from '../../components/Digest.jsx';
import { syncInsights } from '../../lib/insights.js';
import { upcomingNotes } from '../../lib/memory.js';
import SubDecisionCards from '../../components/SubDecision.jsx';
import { useHK, useGoOut, WarnBanner, GoOutCard, NudgeCard, useNudgeAnswer } from '../../components/HomeCards.jsx';
import { buildDigest, demoInputs } from '../../lib/digest.js';
import { gateErrorText } from '../../lib/gate-errors.js';
import TodayCard from '../../components/TodayCard.jsx';
import ProgressCard from '../../components/ProgressCard.jsx';
import { SuggestionCard, HomePanels } from '../../components/HomeR23.jsx';

const GOOGLE = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];

function greeting(t) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? t('app.greetingMorning') : h < 18 ? t('app.greetingAfternoon') : t('app.greetingEvening');
}
export function aiErrorText(e, t) {
  const g = gateErrorText(e, t); if (g) return g;
  if (e?.code === 'attach_limit') {
    const en = t('common.send') === 'Send';
    return e.scope === 'day' ? (en ? `Today’s attachments are used up (${e.limit} a day). Resets tonight at 00:00.` : `今天的附件數量已用完（每日 ${e.limit} 個），將於今晚 00:00 重設。`) : (en ? `Up to ${e.limit} attachments per message on your plan.` : `你的計劃每則訊息最多 ${e.limit} 個附件。`);
  }
  if (e?.code === 'attach_too_large') return t('common.send') === 'Send' ? 'Attachments are too large together — remove a photo or video.' : '附件總大小太大，請移除一些相片或影片。';
  if (e?.code !== 'limit_reached') return t('common.error');
  return e.scope === 'week' ? t('agent.limitWeek') : e.scope === 'day' ? t('agent.limitDay') : t('agent.limit');
}

export default function Home() {
  const { be, ai } = useBe();
  const { t, lang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const sumKey = `nest.summary.${s.user.uid}.${hkDayKey()}.${lang}`;
  const [summary, setSummary] = useState(() => localStorage.getItem(sumKey) || '');
  const [sumAt, setSumAt] = useState(() => Number(localStorage.getItem(`${sumKey}.at`)) || 0);
  const [sumBusy, setSumBusy] = useState(false);
  const [sumStage, setSumStage] = useState(0); // 0 reading accounts · 1 writing (progress card)
  const [remOpen, setRemOpen] = useState(false);
  const loc = useLocation();
  useNudgeAnswer(loc.search);
  // Structured brief data (Gmail / Calendar / Classroom / Drive) for the grouped 今日摘要, cached per HK day.
  const briefKey = `nest.brief.${s.user.uid}.${hkDayKey()}`;
  const [brief, setBrief] = useState(() => { try { return JSON.parse(localStorage.getItem(briefKey) || 'null'); } catch { return null; } });
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [mail, setMail] = useState(null);
  const hk = useHK();
  // Behavioural insights: recomputed on-device at most once a day (quiz results + chat times + reminders).
  useEffect(() => {
    if (!s.family?.id || !be.watchQuizResults) return;
    let quiz = null; let chats = null; let done = false;
    const go = () => { if (done || quiz === null || chats === null) return; done = true; syncInsights(be, s, { quizResults: quiz, chats, lang }).catch(() => {}); };
    const a = be.watchQuizResults(s.family.id, s.user.uid, (l) => { quiz = l; go(); });
    const b = be.watchConversations(s.family.id, s.user.uid, (l) => { chats = l; go(); });
    return () => { a && a(); b && b(); };
  }, [s.family?.id, s.reminders.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const go = useGoOut();
  const [inbox, setInbox] = useState([]);
  const [scanning, setScanning] = useState(false);
  const scanned = useRef(false);

  useEffect(() => be.watchInbox(s.family.id, s.user.uid, setInbox), [s.family.id]);

  const enabled = GOOGLE.filter((g) => s.profile?.connections?.[g]);
  const scanAtKey = `nest.inbox.${s.user.uid}.at`;
  const [scanAt, setScanAt] = useState(() => Number(localStorage.getItem(scanAtKey)) || 0);
  const [scanErr, setScanErr] = useState('');
  const [sumErr, setSumErr] = useState('');
  // Proactive agent: scan connected Google data for things that need action. Runs on its cadence, or on ↻ (manual).
  const scan = async (manual = false) => {
    if (scanning) return;
    setScanning(true); setScanErr('');
    try {
      const connected = await Promise.race([connectedContext(enabled, s.profile, { fresh: manual }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))]);
      if (!connected) { if (manual) setScanErr(t('home.noConnectedData')); return; }
      const data = await ai.jsonChat({ mode: 'inbox', lang, messages: [{ role: 'user', content: prompt(lang, 'inboxScan') }], context: aiContext(s, { connected }), prefs: aiPrefs(s.prefs) });
      const existing = new Set(inbox.map((i) => i.title));
      let added = 0;
      for (const it of (data?.items || []).slice(0, 4)) {
        if (!it?.title || existing.has(it.title)) continue;
        await be.addInboxItem(s.family.id, { title: String(it.title).slice(0, 140), body: String(it.body || '').slice(0, 400), reminder: it.reminder?.title ? { title: String(it.reminder.title).slice(0, 120), dueAt: it.reminder.dueAt || '' } : null });
        added++;
      }
      const at = Date.now(); localStorage.setItem(scanAtKey, String(at)); setScanAt(at);
      if (manual) toast(added ? t('home.inboxAdded', { n: added }) : t('home.inboxNothingNew'));
    } catch (e) {
      setScanErr(e?.code === 'limit_reached' ? aiErrorText(e, t) : t('home.reloadFailed'));
    } finally { setScanning(false); }
  };
  useEffect(() => {
    const p = s.prefs;
    if (scanned.current || !enabled.length || !hasAnyToken(s.profile) || be.MOCK) return;
    if (p.inboxFreq === 'off' || !p.notifyInbox || inQuietHours(p)) return;
    // Proactive scan cadence: weekly / daily / twice a day (Hong Kong time).
    const hkHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', hour: 'numeric', hour12: false }).format(new Date()));
    const slot = p.inboxFreq === 'weekly' ? weekKey() : p.inboxFreq === 'twice' ? `${hkDayKey()}-${hkHour < 12 ? 'am' : 'pm'}` : hkDayKey();
    const key = `nest.inbox.${s.user.uid}.${slot}`;
    if (localStorage.getItem(key)) return;
    scanned.current = true; localStorage.setItem(key, '1');
    scan(false);
  }, [enabled.join(','), s.family.id, s.prefs.inboxFreq]); // eslint-disable-line react-hooks/exhaustive-deps

  const genSummary = async () => {
    if (sumBusy) return;
    setSumBusy(true); setSumErr(''); setSumStage(0);
    const prev = summary;
    try {
      // Everything from every selected account (see src/lib/brief.js), not just the newest few messages.
      let connected = '';
      if (be.MOCK) connected = enabled.length ? await connectedContext(enabled, s.profile) : '';
      else if (enabled.length) {
        connected = await Promise.race([(async () => {
          const { selection, tokens } = await briefInputs(s.profile);
          return formatBrief(await collectBrief(selection, tokens));
        })(), new Promise((r) => setTimeout(() => r(''), 30000))]);
      }
      setSummary(''); setSumStage(1);
      const text = await ai.streamChat({ mode: 'summary', lang, messages: [{ role: 'user', content: prompt(lang, 'briefing') }], context: aiContext(s, { connected }), prefs: aiPrefs(s.prefs), onDelta: setSummary });
      setSummary(text);
      localStorage.setItem(sumKey, text);
      const at = Date.now(); localStorage.setItem(`${sumKey}.at`, String(at)); setSumAt(at);
    } catch (e) {
      // Never leave the card empty or spinning: keep the partial text if there is some, else the previous summary.
      setSummary((cur) => (e?.partial || cur || prev || ''));
      setSumErr(e?.code === 'limit_reached' ? aiErrorText(e, t) : e?.code === 'stalled' ? t('agent.stalled') : t('home.reloadFailed'));
    } finally { setSumBusy(false); }
  };
  // Fresh brief data (no AI). Mock / demo builds use static demo data.
  const loadBrief = async (manual = false) => {
    if (briefBusy) return;
    if (be.MOCK) { setBrief({ at: Date.now(), data: demoInputs(lang).brief }); return; }
    if (!enabled.length) { setBrief({ at: Date.now(), data: {} }); return; }
    setBriefBusy(true); setBriefErr('');
    try {
      const data = await Promise.race([(async () => { const { selection, tokens } = await briefInputs(s.profile); return collectBrief(selection, tokens); })(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))]);
      const v = { at: Date.now(), data };
      setBrief(v); try { localStorage.setItem(briefKey, JSON.stringify(v)); } catch {}
    } catch { if (manual) setBriefErr(t('home.reloadFailed')); } finally { setBriefBusy(false); }
  };
  // Server-side scan of the user's own Gmail / Classroom for school notices, tests and bills (suggestion cards only).
  const serverScan = async (force = false) => {
    if (be.MOCK || !enabled.some((x) => x === 'gmail' || x === 'googleclassroom')) return;
    const k = `nest.autoscan.${s.user.uid}`;
    if (!force && Date.now() - (+localStorage.getItem(k) || 0) < 15 * 60e3) return;
    localStorage.setItem(k, String(Date.now()));
    try { await fetch('/api/auto/scan', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await be.getIdToken()}` }, body: JSON.stringify({ force, lang }) }); } catch {}
  };
  useEffect(() => {
    if (!s.profile) return;
    if (!brief || Date.now() - (brief.at || 0) > 15 * 60e3 || be.MOCK) loadBrief(false);
    serverScan(false);
  }, [enabled.join(','), lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const refreshAll = () => { loadBrief(true); serverScan(true); };
  const digest = buildDigest({
    brief: brief?.data || {}, reminders: s.reminders, uid: s.user.uid, inbox, warn: hk.warn, weather: hk.weather,
    goOut: go.rows, holidays: hk.holidays, notes: s.prefs.chatMemory !== false ? upcomingNotes(s.profile) : [],
  });
  const notifDigest = buildDigest({ inbox: inbox.filter((i) => i.status === 'new' || (i.kind === 'bill' && i.status === 'accepted')) });
  const openItem = (x) => {
    if (x.kind === 'mail') { setMail(x); return; }
    if (x.kind === 'note') { setRemOpen(true); return; }
    const it = inbox.find((i) => i.id === x.inboxId); if (it) setSheet(it);
  };
  const timeOf = (ms) => new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

  const acceptInbox = async (it) => {
    try {
      const due = it.reminder?.dueAt ? fromLocalInput(String(it.reminder.dueAt).slice(0, 16)) : null;
      await be.addReminder(s.family.id, { title: it.reminder?.title || it.title, dueAt: due && !isNaN(due) ? due : null, memberId: s.user.uid });
      await be.updateInboxItem(s.family.id, it.id, { status: 'accepted' });
      toast(t('home.added'));
    } catch { toast(t('common.error'), 'err'); }
  };

  const season = useSeason();
  const soon = useVisibleReminders(s.reminders).filter((r) => !r.done && r.dueAt && r.dueAt < new Date(Date.now() + 7 * 864e5)).sort((a, b) => a.dueAt - b.dueAt).slice(0, 6);
  const name = s.me?.displayName || s.user.displayName || '';
  const QA = [['/app/agent', 'chat', 'ask'], ['/app/tutor', 'camera', 'homework'], ['/app/quiz', 'cards', 'quiz'], [null, 'bell', 'remind'], ['/app/memory', 'brain', 'memory'], ['/app/family', 'users', 'invite']];

  return (
    <>
      <BlurText as="h1" className="greet" text={`${greeting(t)}${lang === 'en' ? ', ' : '，'}${name}`} key={lang} />
      <p className="greet-sub">{fmtDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })} · {s.family.name}</p>
      {season && <Suspense fallback={null}><SeasonChip season={season} /></Suspense>}
      <GiftBanner />
      <WarnBanner warn={hk.warn} />
      <TodayCard weather={hk.weather} warn={hk.warn} brief={brief?.data} />
      <SuggestionCard weather={hk.weather} holidays={hk.holidays} inbox={inbox} />
      <HomePanels />

      <div className="grid-2">
        <div>
          <SubDecisionCards />
          <PluginWidgets />
          <NudgeCard brief={brief?.data} inbox={inbox} />
          <GoOutCard go={go} weather={hk.weather} />
          <Reveal className="card dg-card">
            <div className="card-head">
              <h2><Icon name="sparkle" size={18} />{t('home.summary')}</h2>
              <Button size="sm" variant="outline" icon="refresh" loading={briefBusy} onClick={refreshAll}>{t('today.refresh')}</Button>
            </div>
            {brief?.at > 0 && !briefBusy && <p className="muted small dg-at">{t('home.lastRun', { time: timeOf(brief.at) })}</p>}
            {briefBusy && <p className="muted small dg-at">{t('home.regenerating')}</p>}
            {briefErr && !briefBusy && <p className="error-text small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{briefErr}</p>}
            <DigestView digest={digest} onOpen={openItem} empty={briefBusy ? <div className="typing"><i /><i /><i /></div> : (
              <Empty icon="sparkle" text={t('today.empty')} action={!enabled.length && <Button size="sm" variant="outline" to="/app/connections">{t('app.nav.connections')}</Button>} />
            )} />
            <div className="dg-ai">
              <button className="dg-sec-h" onClick={() => { setAiOpen((v) => !v); if (!aiOpen && !summary && !sumBusy) genSummary(); }} aria-expanded={aiOpen}>
                <Icon name="sparkle" size={17} /><span>{t('today.aiSummary')}</span>
                {summary && sumAt > 0 && !sumBusy && <small className="muted">{timeOf(sumAt)}</small>}
                <Icon name="chevronDown" size={16} className={`dg-chev ${aiOpen ? 'on' : ''}`} />
              </button>
              {aiOpen && (
                <div className="dg-ai-body">
                  {sumErr && !sumBusy && <p className="error-text small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{sumErr}</p>}
                  {summary ? <Markdown text={summary} /> : sumBusy ? <ProgressCard compact testid="summary-progress" steps={[{ key: 'acc', label: t('r23.progress.readAccounts'), state: sumStage ? 'done' : 'active' }, { key: 'w', label: t('r23.progress.writeSummary'), state: sumStage ? 'active' : 'todo' }]} /> : null}
                  {(summary || sumErr) && <Button size="sm" variant="outline" icon="refresh" loading={sumBusy} onClick={genSummary}>{t('home.regenerate')}</Button>}
                </div>
              )}
            </div>
          </Reveal>

          <Reveal className="card" delay={60}>
            <div className="card-head"><h2><Icon name="inbox" size={18} />{t('home.inbox')}</h2>
              {enabled.length > 0 && !be.MOCK && <Button size="sm" variant="outline" icon="refresh" loading={scanning} onClick={() => { scan(true); serverScan(true); }}>{t('home.regenerate')}</Button>}
            </div>
            {scanning && <p className="muted small dg-at">{t('home.regenerating')}</p>}
            {scanAt > 0 && !scanning && enabled.length > 0 && <p className="muted small dg-at">{t('home.lastRun', { time: timeOf(scanAt) })}</p>}
            {scanErr && !scanning && <p className="error-text small" style={{ margin: '0 0 8px', fontWeight: 700 }}>{scanErr}</p>}
            <DigestView digest={notifDigest} pin={false} onOpen={openItem} compactChips empty={scanning ? <p className="muted small" style={{ fontWeight: 700 }}>{t('home.inboxScanning')}</p> : (
              <Empty icon="inbox" text={t('home.inboxEmpty')} action={!enabled.length && <Button size="sm" variant="outline" to="/app/connections">{t('app.nav.connections')}</Button>} />
            )} />
          </Reveal>
        </div>

        <div>
          {s.isAdmin && <AdminCard delay={80} />}
          <Reveal className="card" delay={100}>
            <div className="card-head"><h2><Icon name="bell" size={18} />{t('home.dueSoon')}</h2><Link to="/app/reminders" className="small muted" style={{ fontWeight: 800 }}>{t('reminders.all')}</Link></div>
            {soon.length ? soon.map((r, i) => <ReminderRow key={r.id} r={r} i={i} />) : <Empty icon="check" text={t('home.noDue')} />}
          </Reveal>
          <Reveal className="card" delay={140}>
            <div className="card-head"><h2>{t('home.quick')}</h2></div>
            <div className="quick">
              {QA.map(([to, icon, k]) => to
                ? <Link key={k} to={to}><Icon name={icon} size={22} />{t(`home.qa.${k}`)}</Link>
                : <button key={k} onClick={() => setRemOpen(true)}><Icon name={icon} size={22} />{t(`home.qa.${k}`)}</button>)}
            </div>
          </Reveal>
          <Reveal className="card" delay={180}>
            <div className="card-head"><h2><Icon name="gauge" size={18} />{t('app.nav.usage')}</h2><Link to="/app/usage" className="small muted" style={{ fontWeight: 800 }}>{s.planLabel(t).full}</Link></div>
            <UsageMeter />
          </Reveal>
        </div>
      </div>
      {mail && <MailSheet key={mail.id} item={mail} onClose={() => setMail(null)} />}
      {sheet && <InboxSheet key={sheet.id} item={sheet} onClose={() => setSheet(null)} />}
      <Modal open={remOpen} onClose={() => setRemOpen(false)} title={t('home.qa.remind')}>
        <ReminderForm onDone={() => setRemOpen(false)} />
      </Modal>
    </>
  );
}
