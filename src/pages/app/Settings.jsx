import UsageMeter from '../../components/UsageMeter.jsx';
import PushSettings from '../../components/PushSettings.jsx';
import PluginSettings from '../../components/PluginSettings.jsx';
import ProfilePhoto from '../../components/AvatarEditor.jsx';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandIcon, Button, Field, LangSegment, PageHeader, useToast } from '../../components/ui.jsx';
import { familySettings } from '../../lib/nestie.js';
import Icon from '../../components/Icon.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { selectedFor, serviceLive } from '../../lib/google.js';
import { useBe } from '../../lib/be-context.jsx';
import { HandleField, VerifiedBadge } from '../../components/Identity.jsx';
import IconPicker from '../../components/IconPicker.jsx';
import { profileSave } from '../../lib/plugins/api.js';
import { normHandle, pwProblem } from '../../lib/profile.js';
import { APP_VERSION, latestEntry } from '../../data/changelog.js';
import { useWhatsNew } from '../../lib/whatsnew.js';
import { RegionCard } from '../../components/RegionGate.jsx';
import { seasonalEnabled } from '../../lib/seasons.js';
import { setSeasonalEnabled } from '../../lib/season-hook.js';
import { FREQ, freqOf, customN, MAX_CUSTOM, suggestCap } from '../../lib/suggest.js';

const GOOGLE = [['gmail', 'Gmail'], ['googlecalendar', 'Google Calendar'], ['googleclassroom', 'Google Classroom'], ['googledrive', 'Google Drive']];

function Seg({ value, options, onChange, label }) {
  const { t } = useI18n();
  return (
    <div className="segment seg-wrap" role="radiogroup" aria-label={label}>
      {options.map((o) => <button key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{t(`settings.vals.${o}`)}</button>)}
    </div>
  );
}
function Toggle({ on, onChange, label }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}
function Row({ title, hint, children }) {
  return (
    <div className="set-row">
      <div className="set-text"><b>{title}</b>{hint && <small>{hint}</small>}</div>
      <div className="set-ctl">{children}</div>
    </div>
  );
}
// Run 24 step 2a: how many proactive suggestions a day (personal; the family's "off" still wins; quiet hours respected).
function SuggestFreqRow({ p, setPref }) {
  const { t } = useI18n();
  const s = useSession();
  const fs = familySettings(s.family);
  const famOff = fs.suggestLevel === 'off';
  const v = freqOf(p, s.family?.settings);
  const [n, setN] = useState(customN(p.suggestN));
  useEffect(() => { setN(customN(p.suggestN)); }, [p.suggestN]);
  const commitN = (x) => { const c = customN(x); setN(c); if (c !== p.suggestN) setPref('suggestN', c); };
  const qs = p.quietEnabled ? [p.quietStart, p.quietEnd] : fs.quietStart && fs.quietEnd ? [fs.quietStart, fs.quietEnd] : null;
  return (
    <div className="set-row sf-row" data-testid="suggest-freq">
      <div className="set-text"><b>{t('r24.sf.title')}</b><small>{famOff ? t('r24.sf.famOff') : t('r24.sf.hint')}{qs && !famOff ? ` ${t('r24.sf.quietNote', { from: qs[0], to: qs[1] })}` : ''}</small></div>
      <div className="sf-ctl">
        <div className="segment seg-wrap sf-seg" role="radiogroup" aria-label={t('r24.sf.title')}>
          {FREQ.map((o) => <button type="button" key={o} role="radio" aria-checked={v === o} className={v === o ? 'on' : ''} disabled={famOff} onClick={() => { if (v !== o) setPref('suggestFreq', o); }} data-testid={`sf-${o}`}>{t(`r24.sf.opt.${o}`)}</button>)}
        </div>
        {v === 'custom' && !famOff && (
          <label className="sf-custom">
            <span>{t('r24.sf.perDay')}</span>
            <button type="button" className="sf-step" aria-label="−" disabled={n <= 1} onClick={() => commitN(n - 1)}>−</button>
            <input className="input sf-n" type="number" inputMode="numeric" min={1} max={MAX_CUSTOM} value={n} onChange={(e) => setN(e.target.value)} onBlur={(e) => commitN(e.target.value)} aria-label={t('r24.sf.perDay')} data-testid="sf-n" />
            <button type="button" className="sf-step" aria-label="+" disabled={n >= MAX_CUSTOM} onClick={() => commitN(n + 1)}>+</button>
            <span>{t('r24.sf.unit')}</span>
          </label>
        )}
      </div>
    </div>
  );
}
// Run 22: seasonal themes on/off (this device; the landing page reads the same switch).
const SEASON_L = {
  'zh-Hant': ['節日主題', '節日期間，在「今天」頁面和網站首頁加入小裝飾（萬聖節、聖誕節、農曆新年、中秋節）。只適用於這部裝置。'],
  'zh-Hans': ['节日主题', '节日期间，在“今天”页面和网站首页加入小装饰（万圣节、圣诞节、农历新年、中秋节）。只适用于这部设备。'],
  en: ['Holiday themes', 'Small seasonal touches on Today and the homepage (Halloween, Christmas, Lunar New Year, Mid-Autumn). This device only.'],
};
function SeasonRow() {
  const { uiLang } = useI18n();
  const [on, setOn] = useState(() => seasonalEnabled());
  const [title, hint] = SEASON_L[uiLang] || SEASON_L.en;
  return <div data-testid="season-setting"><Row title={title} hint={hint}><Toggle on={on} onChange={(v) => { setOn(v); setSeasonalEnabled(v); }} label={title} /></Row></div>;
}
const once = (watch) => new Promise((resolve) => { let off; let done = false; off = watch((v) => { if (done) return; done = true; resolve(v); setTimeout(() => off && off(), 0); }); });

export default function Settings() {
  const { be, demo } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const p = s.prefs;
  const nestie = familySettings(s.family);
  const [name, setName] = useState(s.me?.displayName || '');
  const [role, setRole] = useState(s.me?.role || 'student');
  const [famName, setFamName] = useState(s.family.name);
  const [birthday, setBirthday] = useState(s.me?.birthday || '');
  const [busy, setBusy] = useState('');
  // The member doc can arrive after the first render: fill fields that the user has not touched yet.
  useEffect(() => { if (s.me && !name) { setName(s.me.displayName || ''); setRole(s.me.role || 'student'); setBirthday(s.me.birthday || ''); } }, [s.me?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const pub = s.pubProfile;
  const [handle, setHandle] = useState(null); // null = not edited yet → shows the saved handle
  const [hState, setHState] = useState('idle');
  const handleVal = handle ?? (pub?.handle || '');

  const setPref = async (k, v) => {
    try { await s.savePrefs({ [k]: v }); toast(t('settings.saved')); } catch { toast(t('common.error'), 'err'); }
  };
  const save = async () => {
    setBusy('save');
    try {
      await be.updateMyMember(s.family.id, s.user.uid, { displayName: name.trim(), role });
      await be.saveProfile(s.user.uid, { displayName: name.trim(), role, birthday });
      if ((s.me?.birthday || '') !== birthday) await be.setMemberBirthday(s.family.id, s.user.uid, birthday).catch(() => toast(t('family.birthdayFail'), 'err'));
      if (s.isOwner && famName.trim() && famName.trim() !== s.family.name) await be.renameFamily(s.family.id, famName.trim());
      // Unified identity: display name / photo / @handle are ONE public profile.
      const h = normHandle(handleVal);
      if (!demo && (pub || h)) { // never in the landing demo (Run 10 '@mum' fix)
        const patch = { name: name.trim() };
        if (h && h !== (pub?.handle || '')) patch.handle = h;
        if (!pub && s.myPhoto) patch.photo = s.myPhoto;
        try { const r = await profileSave(patch); s.refreshProfile(r.profile); setHandle(null); }
        catch (e) { toast(t(e.code === 'handle_taken' ? 'id.taken' : e.code === 'bad_handle' ? 'id.bad' : 'common.error'), 'err'); return; }
      }
      toast(t('settings.saved'));
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const del = async () => {
    const msg = t('settings.deleteConfirm') + (s.isOwner && s.members.length > 1 ? `\n${t('settings.deleteOwner')}` : '');
    if (!confirm(msg)) return;
    setBusy('del');
    try { await be.deleteAccount({ family: s.family, members: s.members }); nav('/'); }
    catch (e) { toast(`${t('common.error')}${e.code ? ` (${e.code})` : ''}`, 'err'); } finally { setBusy(''); }
  };
  // Everything this user can read about themself and their family, as one JSON file.
  const exportData = async () => {
    setBusy('export');
    try {
      const fid = s.family.id;
      const convs = await once((cb) => be.watchConversations(fid, s.user.uid, cb));
      const conversations = await Promise.all(convs.map(async (c) => ({ ...c, messages: await once((cb) => be.watchMessages(fid, c.id, cb)) })));
      const data = {
        exportedAt: new Date().toISOString(), app: 'Nest',
        account: { uid: s.user.uid, email: s.user.email },
        profile: s.profile,
        family: { id: fid, name: s.family.name, plan: s.family.plan, members: s.members.map((m) => ({ uid: m.uid, displayName: m.displayName, role: m.role, isOwner: !!m.isOwner })) },
        reminders: s.reminders, memories: s.memories,
        quizResults: await once((cb) => be.watchQuizResults(fid, s.user.uid, cb)),
        inbox: await once((cb) => be.watchInbox(fid, s.user.uid, cb)),
        conversations,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `nest-export-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  const providers = (s.user.providerData || []).map((x) => x.providerId);

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="grid-2 set-grid">
        <div className="col-stack">
          <Reveal className="card stack" id="profile">
            <h2 className="set-h">{t('settings.profile')}</h2>
            <ProfilePhoto />
            <Field label={t('settings.displayName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} /></Field>
            <Field label={<>{t('id.handle')}<VerifiedBadge on={!!pub?.verified} /></>} hint={t('id.handleHint')}><HandleField value={handleVal} initial={pub?.handle || ''} onChange={setHandle} onState={setHState} /></Field>
            <button type="button" className="set-row set-link id-setlink" onClick={() => nav('/app/profile')}>
              <span className="set-text"><b>{t('id.editPublic')}</b><small>{t('id.editPublicSub')}</small></span>
              <span className="set-ctl"><Icon name="chevronRight" size={18} /></span>
            </button>
            <Field label={t('settings.role')}>
              <div className="segment">{['parent', 'student'].map((r) => <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{t(`common.${r}`)}</button>)}</div>
            </Field>
            <Field label={t('family.birthday')} hint={t('family.birthdayHint')}><input className="input" type="date" value={birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBirthday(e.target.value)} /></Field>
            {s.isOwner && <Field label={t('onboarding.familyName')}><input className="input" value={famName} onChange={(e) => setFamName(e.target.value)} maxLength={40} /></Field>}
            <div><Button loading={busy === 'save'} onClick={save} disabled={!name.trim() || ['taken', 'bad', 'checking'].includes(hState)}>{t('common.save')}</Button></div>
          </Reveal>

          <Reveal className="card" delay={40}>
            <h2 className="set-h">{t('settings.display')}</h2>
            <Row title={t('settings.language')} hint={t('settings.languageHint')}><LangSegment /></Row>
            <Row title={t('settings.keys.theme')}><Seg value={p.theme} options={['light', 'dark', 'system']} onChange={(v) => setPref('theme', v)} label={t('settings.keys.theme')} /></Row>
            <Row title={t('settings.keys.fontSize')}><Seg value={p.fontSize} options={['sm', 'md', 'lg']} onChange={(v) => setPref('fontSize', v)} label={t('settings.keys.fontSize')} /></Row>
            <SeasonRow />
            <IconPicker />
          </Reveal>

          <Reveal className="card" delay={80}>
            <h2 className="set-h">{t('settings.ai')}</h2>
            <Row title={t('settings.keys.replyStyle')} hint={t('settings.hints.replyStyle')}><Seg value={p.replyStyle} options={['concise', 'detailed']} onChange={(v) => setPref('replyStyle', v)} /></Row>
            <Row title={t('settings.keys.autonomy')} hint={t('settings.hints.autonomy')}><Seg value={p.autonomy} options={['ask', 'auto_low']} onChange={(v) => setPref('autonomy', v)} /></Row>
            <Row title={t('settings.keys.tutorMode')} hint={t('settings.hints.tutorMode')}><Seg value={p.tutorMode} options={['hints', 'explain']} onChange={(v) => setPref('tutorMode', v)} /></Row>
            <Row title={t('settings.keys.tutorStrictness')} hint={t('settings.hints.tutorStrictness')}><Seg value={p.tutorStrictness} options={['gentle', 'standard', 'strict']} onChange={(v) => setPref('tutorStrictness', v)} /></Row>
            <Row title={t('mem2.setting')} hint={t('mem2.settingHint')}><Toggle on={p.chatMemory !== false} onChange={(v) => setPref('chatMemory', v)} label={t('mem2.setting')} /></Row>
            <Row title={t('r23.mem.title', { name: nestie.nestieName })} hint={t('r23.mem.control')}><Button size="sm" variant="outline" iconRight="chevronRight" to="/app/settings/memory" data-testid="open-nestie-memory">{t('r23.mem.open', { name: nestie.nestieName })}</Button></Row>
          </Reveal>
        </div>

        <div className="col-stack">
          <PushSettings delay={90} />
          <RegionCard delay={95} Reveal={Reveal} Icon={Icon} onTransport={() => nav('/app/transport')} transportLabel={t('app.nav.transport')} transportHint={t('hkset.movedHint')} />
          <PluginSettings delay={97} />
          <Reveal className="card" delay={100}>
            <h2 className="set-h">{t('settings.notifications')}</h2>
            <Row title={t('settings.keys.notifyReminders')}><Toggle on={p.notifyReminders} onChange={(v) => setPref('notifyReminders', v)} label={t('settings.keys.notifyReminders')} /></Row>
            <Row title={t('settings.keys.notifyInbox')}><Toggle on={p.notifyInbox} onChange={(v) => setPref('notifyInbox', v)} label={t('settings.keys.notifyInbox')} /></Row>
            <Row title={t('settings.keys.inboxFreq')} hint={t('settings.hints.inboxFreq')}><Seg value={p.inboxFreq} options={['off', 'weekly', 'daily', 'twice']} onChange={(v) => setPref('inboxFreq', v)} /></Row>
            <Row title={t('settings.keys.quietEnabled')} hint={t('settings.hints.quiet')}><Toggle on={p.quietEnabled} onChange={(v) => setPref('quietEnabled', v)} label={t('settings.keys.quietEnabled')} /></Row>
            {p.quietEnabled && (
              <div className="set-times">
                <Field label={t('settings.keys.quietStart')}><input className="input" type="time" value={p.quietStart} onChange={(e) => e.target.value && setPref('quietStart', e.target.value)} /></Field>
                <Field label={t('settings.keys.quietEnd')}><input className="input" type="time" value={p.quietEnd} onChange={(e) => e.target.value && setPref('quietEnd', e.target.value)} /></Field>
              </div>
            )}
            <SuggestFreqRow p={p} setPref={setPref} />
            <Row title={t('settings.keys.defaultReminderTime')} hint={t('settings.hints.defaultReminderTime')}>
              <input className="input set-time" type="time" value={p.defaultReminderTime} onChange={(e) => e.target.value && setPref('defaultReminderTime', e.target.value)} />
            </Row>
          </Reveal>

          <Reveal className="card" delay={120}>
            <div className="card-head" style={{ marginBottom: 8 }}><h2 className="set-h" style={{ margin: 0 }}>{t('settings.accounts')}</h2><Button size="sm" variant="outline" to="/app/connections">{t('settings.manage')}</Button></div>
            {GOOGLE.map(([id, label]) => {
              const on = !!s.profile?.connections?.[id];
              const live = on && serviceLive(s.profile, id);
              const emails = selectedFor(s.profile, id);
              return (
                <div className="set-acct" key={id}>
                  <span className="conn-logo sm"><BrandIcon id={id} size={18} /></span>
                  <b>{label}{on && emails.length > 0 && <small className="set-acct-mail">{emails.join('、')}</small>}</b>
                  <span className={`pill ${on ? 'dark' : ''}`}>{on ? (live ? t('connections.connected') : t('settings.needsReauth')) : t('settings.notConnected')}</span>
                </div>
              );
            })}
            <p className="muted small set-signin"><Icon name="shield" size={15} />{t('settings.signInWith')}: {providers.map((x) => (x === 'google.com' ? 'Google' : x === 'password' ? t('settings.emailPw') : x === 'apple.com' ? 'Apple' : x)).join('、') || '—'}</p>
          </Reveal>

          {providers.includes('password') && <ChangePassword />}
          <Reveal className="card stack" delay={140}>
            <h2 className="set-h">{t('settings.plan')}</h2>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, fontSize: 22 }} data-testid="settings-plan">{s.planLabel(t).name}{s.planLabel(t).detail && <small className="muted" style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{s.planLabel(t).detail}</small>}</span>
              <Button size="sm" variant="outline" to="/pricing">{t('usage.upgrade')}</Button>
            </div>
            <span className="muted small" style={{ fontWeight: 700 }}>{s.plan.capacity > 1 ? t('usage.capacity', { x: s.plan.capacity }) : t('usage.capacityFree')} · {s.plan.members} {t('pricing.members')}</span>
            <UsageMeter />
          </Reveal>

          <AboutCard />
          <Reveal className="card stack" delay={160}>
            <h2 className="set-h">{t('settings.account')}</h2>
            <span className="muted small" style={{ fontWeight: 700 }}>{s.user.email}</span>
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <Button variant="secondary" icon="download" loading={busy === 'export'} onClick={exportData}>{t('settings.export')}</Button>
              <Button variant="secondary" icon="logout" onClick={() => be.signOut()}>{t('common.signOut')}</Button>
              <Button variant="danger" icon="trash" loading={busy === 'del'} onClick={del}>{t('settings.deleteAccount')}</Button>
            </div>
            <small className="muted" style={{ fontWeight: 600 }}>{t('settings.exportHint')}</small>
          </Reveal>
        </div>
      </div>
    </>
  );
}

// Settings → 更改密碼 (only for accounts with the email/password provider). Client-side Firebase re-auth + updatePassword.
const PW_TXT = {
  'zh-Hant': { h: '更改密碼', cur: '目前密碼', nw: '新密碼', cf: '確認新密碼', hint: '最少 10 個字元，須包含英文字母及數字。', btn: '更改密碼', ok: '密碼已更改', short: '新密碼最少要 10 個字元。', mix: '新密碼須同時包含英文字母及數字。', mismatch: '兩次輸入的新密碼不一致。', same: '新密碼不可與目前密碼相同。', wrong: '目前密碼不正確。', weak: '新密碼太弱，請換一個更長的密碼。', recent: '為安全起見，請先登出再登入，然後再試。', many: '嘗試次數太多，請稍後再試。', net: '網絡錯誤，請再試。', err: '未能更改密碼' },
  en: { h: 'Change password', cur: 'Current password', nw: 'New password', cf: 'Confirm new password', hint: 'At least 10 characters, with letters and numbers.', btn: 'Change password', ok: 'Password changed', short: 'The new password needs at least 10 characters.', mix: 'The new password needs both letters and numbers.', mismatch: 'The two new passwords don’t match.', same: 'The new password must differ from the current one.', wrong: 'The current password is incorrect.', weak: 'The new password is too weak — try a longer one.', recent: 'For security, sign out and sign in again, then retry.', many: 'Too many attempts — please try again later.', net: 'Network error — try again.', err: 'Could not change the password' },
};
function ChangePassword() {
  const { be } = useBe();
  const { lang } = useI18n();
  const toast = useToast();
  const T = PW_TXT[lang === 'en' ? 'en' : 'zh-Hant'];
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [cf, setCf] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e?.preventDefault?.();
    setErr('');
    const p = pwProblem(nw);
    if (p) { setErr(T[p]); return; }
    if (nw !== cf) { setErr(T.mismatch); return; }
    if (nw === cur) { setErr(T.same); return; }
    setBusy(true);
    try {
      await be.changePassword(cur, nw);
      setCur(''); setNw(''); setCf(''); toast(T.ok);
    } catch (x) {
      const c = String(x?.code || '');
      setErr(/wrong-password|invalid-credential|invalid-login|user-mismatch/.test(c) ? T.wrong : /weak-password|password-does-not-meet/.test(c) ? T.weak : /requires-recent-login/.test(c) ? T.recent : /too-many-requests/.test(c) ? T.many : /network/.test(c) ? T.net : `${T.err} (${c || 'error'})`);
    } finally { setBusy(false); }
  };
  return (
    <Reveal className="card" delay={130} id="password">
      <h2 className="set-h">{T.h}</h2>
      <div className="set-pw" role="group" aria-label={T.h}>
        <input type="text" name="username" autoComplete="username" value={be.currentUser?.()?.email || ''} readOnly hidden />
        <Field label={T.cur}><input className="input" id="pw-current" name="current-password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
        <Field label={T.nw} hint={T.hint}><input className="input" id="pw-new" name="new-password" type="password" autoComplete="new-password" value={nw} onChange={(e) => setNw(e.target.value)} /></Field>
        <Field label={T.cf}><input className="input" id="pw-confirm" name="confirm-password" type="password" autoComplete="new-password" value={cf} onChange={(e) => setCf(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(e); }} /></Field>
        {err && <p className="error-text small" role="alert">{err}</p>}
        <Button onClick={go} loading={busy} disabled={!cur || !nw || !cf}>{T.btn}</Button>
      </div>
    </Reveal>
  );
}

// Settings → 關於 Nest: version + 最新動態 (changelog) row with the what's-new dot.
function AboutCard() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const unseen = useWhatsNew();
  const e = latestEntry();
  return (
    <Reveal className="card stack" delay={150}>
      <h2 className="set-h">{t('changelog.about')}</h2>
      <button type="button" className="set-row set-link" onClick={() => nav('/app/changelog')} data-testid="settings-changelog">
        <span className="set-text"><b>{t('changelog.title')}{unseen && <i className="wn-dot" aria-label={t('changelog.newDot')} />}</b><small>{(e[lang] || e['zh-Hant']).title} · {e.date}</small></span>
        <span className="set-ctl"><Icon name="chevronRight" size={18} /></span>
      </button>
      <span className="muted small" style={{ fontWeight: 700 }}>{t('changelog.versionLine', { v: APP_VERSION })}</span>
    </Reveal>
  );
}
