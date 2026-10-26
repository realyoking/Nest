// 連接 → GitHub (Run 13): a row in the main list + a detail page (?svc=github). Status, connect / reconnect, disconnect
// (revokes the grant at GitHub), and — for the family owner — the parental switch per student member.
// zh-Hant = HK 書面語; zh-Hans generated with toHans.
import { useEffect, useState } from 'react';
import { BrandIcon, Button, Spinner, useToast } from './ui.jsx';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { toHans } from '../lib/hans.js';
import { githubStatus, githubConnect, githubDisconnect, githubRefresh, githubParental, onGithubChange } from '../lib/github.js';

const T = {
  'zh-Hant': {
    name: 'GitHub', desc: '讓 Nest AI 讀取你的程式庫、建立程式庫、提交檔案、開分支及拉取請求（每次寫入都要你先確認）。',
    on: '已連接', off: '未連接', notConfigured: '未設定', blocked: '未開放', needsParent: '需要家長允許',
    connect: '連接 GitHub', reconnect: '重新連接', disconnect: '中斷連接', refresh: '重新整理授權',
    account: '帳戶', scopes: '權限', expires: '授權有效至', renews: '會在到期前自動續期', since: '連接於',
    nc: 'GitHub 連接尚未由管理員設定（伺服器缺少 GitHub OAuth 設定）。設定完成後即可使用。',
    off_flag: '管理員已暫停 GitHub 連接。',
    parental: '學生帳戶需要家庭擁有人在「連接 → GitHub」開啟允許，才可以連接 GitHub。',
    nofam: '請先建立或加入家庭。',
    safety: '安全：GitHub 授權只會加密保存在 Nest 伺服器，不會傳到你的瀏覽器或 AI。Nest 不會刪除任何程式庫或檔案；每次建立或修改內容前，對話中都會先顯示確認卡。中斷連接會同時在 GitHub 撤銷授權。',
    parentTitle: '家長控制', parentFoot: '開啟後，該成員可以連接自己的 GitHub 帳戶，並讓 Nest AI 代為操作（每次寫入仍需確認）。關閉會即時中斷其連接。',
    allow: '允許', noKids: '家庭中沒有學生成員。',
    discTitle: '中斷 GitHub 連接？', discBody: 'Nest 會在 GitHub 撤銷授權並刪除保存的授權資料。你的程式庫不會受影響。',
    connected: '已連接 GitHub', disconnected: '已中斷 GitHub 連接', denied: '你已取消 GitHub 授權', expired: '連接要求已過期，請再試一次', error: '未能連接 GitHub，請再試一次', reauth: 'GitHub 授權已失效，請重新連接',
    demo: '示範模式不會連接真實帳戶。',
  },
  en: {
    name: 'GitHub', desc: 'Let Nest AI read your repos, create repos, commit files, open branches and pull requests (every write asks you first).',
    on: 'Connected', off: 'Not connected', notConfigured: 'Not set up', blocked: 'Unavailable', needsParent: 'Needs parent',
    connect: 'Connect GitHub', reconnect: 'Reconnect', disconnect: 'Disconnect', refresh: 'Refresh authorisation',
    account: 'Account', scopes: 'Permissions', expires: 'Access valid until', renews: 'renews automatically before it expires', since: 'Connected',
    nc: 'GitHub isn’t set up yet by the admin (the server has no GitHub OAuth settings). It will work once it is.',
    off_flag: 'The admin has paused the GitHub connection.',
    parental: 'Student accounts need the family owner to allow GitHub in Connections → GitHub first.',
    nofam: 'Create or join a family first.',
    safety: 'Safety: GitHub tokens are stored only on Nest’s server, encrypted — never in your browser or the AI. Nest never deletes repos or files, and shows a confirm card in chat before creating or changing anything. Disconnecting also revokes access at GitHub.',
    parentTitle: 'Parental control', parentFoot: 'When on, that member can connect their own GitHub and let Nest AI act on it (writes still need confirming). Turning it off disconnects them at once.',
    allow: 'Allow', noKids: 'No student members in this family.',
    discTitle: 'Disconnect GitHub?', discBody: 'Nest revokes its access at GitHub and deletes the saved authorisation. Your repos are not affected.',
    connected: 'GitHub connected', disconnected: 'GitHub disconnected', denied: 'You cancelled the GitHub authorisation', expired: 'The request expired — try again', error: 'Couldn’t connect GitHub — try again', reauth: 'GitHub access expired — reconnect',
    demo: 'The demo doesn’t connect real accounts.',
  },
};
const hansOf = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, toHans(v)]));
T['zh-Hans'] = hansOf(T['zh-Hant']);
export const useGhT = () => { const { lang } = useI18n(); return T[lang] || T['zh-Hant']; };

export function useGithubStatus(demo) {
  const [st, setSt] = useState(null);
  useEffect(() => {
    if (demo) { setSt({ configured: false, allowed: false, why: 'demo', connected: false }); return undefined; }
    let live = true;
    githubStatus({ maxAge: 0 }).then((x) => live && setSt(x)).catch(() => live && setSt({ configured: true, error: true, connected: false }));
    const off = onGithubChange((x) => live && setSt(x));
    return () => { live = false; off(); };
  }, [demo]);
  return [st, setSt];
}
export function ghLabel(st, L) {
  if (!st) return { text: '…', cls: '' };
  if (st.connected) return { text: st.login ? `@${st.login}` : L.on, cls: 'on' };
  if (st.configured === false || st.why === 'not_configured') return { text: L.notConfigured, cls: '' };
  if (st.why === 'parental_required') return { text: L.needsParent, cls: 'warn' };
  if (st.allowed === false) return { text: L.blocked, cls: '' };
  return { text: L.off, cls: '' };
}

export function GithubRow({ demo, onOpen }) {
  const L = useGhT();
  const [st] = useGithubStatus(demo);
  const lb = ghLabel(st, L);
  return (
    <button type="button" data-svc="github" className="ios-row tall" onClick={onOpen} data-testid="gh-row">
      <span className="cx-svc-ic"><BrandIcon id="github" size={22} /></span>
      <span className="ios-label"><b>GitHub</b><small className="cx-sub">{st?.connected && st.login ? `@${st.login}` : L.desc}</small></span>
      <span className={`cx-state ${lb.cls}`}>{st?.connected ? L.on : lb.text}</span>
      <Icon name="chevronRight" size={16} className="ios-chev" />
    </button>
  );
}

const fmt = (ms, lang) => (ms ? new Date(ms).toLocaleString(lang === 'en' ? 'en-HK' : lang === 'zh-Hans' ? 'zh-CN' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

export function GithubDetail({ demo, onBack, backLabel, flash }) {
  const L = useGhT();
  const { lang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [st, setSt] = useGithubStatus(demo);
  const [busy, setBusy] = useState('');
  const [confirmOff, setConfirmOff] = useState(false);
  const [par, setPar] = useState({});
  useEffect(() => { if (flash && L[flash]) toast(L[flash], ['connected'].includes(flash) ? undefined : 'err'); }, [flash]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st?.parental) setPar(Object.fromEntries(Object.keys(st.parental).map((k) => [k, true]))); }, [st?.parental]);
  const lb = ghLabel(st, L);
  const fail = (e) => toast(L[e?.code === 'github_reauth' ? 'reauth' : 'error'] + (e?.code && !['github_reauth'].includes(e.code) ? ` (${e.code})` : ''), 'err');
  const connect = async () => {
    if (demo) { toast(L.demo); return; }
    setBusy('connect');
    try { await githubConnect(); } catch (e) { setBusy(''); fail(e); }
  };
  const disconnect = async () => {
    setConfirmOff(false); setBusy('off');
    try { await githubDisconnect(); setSt(await githubStatus({ maxAge: 0 })); toast(L.disconnected); } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const refresh = async () => { setBusy('refresh'); try { setSt(await githubRefresh()); } catch (e) { fail(e); try { setSt(await githubStatus({ maxAge: 0 })); } catch {} } finally { setBusy(''); } };
  const setAllow = async (uid, allow) => {
    setBusy(`p:${uid}`);
    try { await githubParental(uid, allow); setPar((p) => ({ ...p, [uid]: allow })); } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const kids = (s.members || []).filter((m) => m.uid !== s.user?.uid && m.uid !== s.family?.ownerId && m.role !== 'parent');
  const note = !st ? null : st.configured === false || st.why === 'not_configured' ? L.nc : st.why === 'feature_disabled' ? L.off_flag : st.why === 'parental_required' ? L.parental : st.why === 'no_family' ? L.nofam : st.why === 'demo' ? L.demo : null;
  const canConnect = st && st.configured !== false && st.allowed && !st.connected;
  return (
    <div className="cx-page push-in" data-testid="gh-detail">
      <button type="button" className="cx-back" onClick={onBack}><Icon name="chevronRight" size={18} stroke={2.5} className="icon-flip" />{backLabel}</button>
      <div className="cx-hero">
        <span className="cx-logo"><BrandIcon id="github" size={30} /></span>
        <div className="cx-hero-t"><h1 className="cx-title">GitHub</h1><p>{L.desc}</p></div>
        <span className={`cx-status ${lb.cls}`} data-testid="gh-status">{st?.connected ? L.on : lb.text}</span>
      </div>
      {!st ? <div className="ios-list"><div className="ios-row"><Spinner small /></div></div> : (
        <>
          {note && <p className="gh-note" data-testid="gh-note">{note}</p>}
          {st.connected && (
            <section className="ios-group">
              <div className="ios-list">
                <div className="ios-row"><span className="ios-label"><b>{L.account}</b></span><span className="cx-state on">@{st.login}</span></div>
                <div className="ios-row"><span className="ios-label"><b>{L.scopes}</b><small className="cx-sub">{(st.scopes || []).join(', ') || '—'}</small></span></div>
                {st.accessExp && <div className="ios-row"><span className="ios-label"><b>{L.expires}</b><small className="cx-sub">{fmt(st.accessExp, lang)} · {L.renews}</small></span></div>}
                <div className="ios-row"><span className="ios-label"><b>{L.since}</b><small className="cx-sub">{fmt(st.since, lang)}</small></span></div>
              </div>
            </section>
          )}
          <section className="ios-group">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap', padding: '0 4px' }}>
              {canConnect && <Button icon="link" loading={busy === 'connect'} onClick={connect} data-testid="gh-connect">{st.reason ? L.reconnect : L.connect}</Button>}
              {st.connected && <Button variant="secondary" loading={busy === 'refresh'} onClick={refresh} data-testid="gh-refresh">{L.refresh}</Button>}
              {st.connected && <Button variant="danger" loading={busy === 'off'} onClick={() => setConfirmOff(true)} data-testid="gh-disconnect">{L.disconnect}</Button>}
            </div>
            <p className="ios-foot">{L.safety}</p>
          </section>
          {st.owner && st.configured !== false && (
            <section className="ios-group">
              <h2 className="ios-group-h">{L.parentTitle}</h2>
              <div className="ios-list">
                {kids.length ? kids.map((m) => (
                  <label className="ios-row" key={m.uid}>
                    <span className="ios-label"><b>{m.displayName}</b></span>
                    {busy === `p:${m.uid}` ? <Spinner small /> : <input type="checkbox" className="switch" role="switch" aria-label={`${L.allow} ${m.displayName}`} checked={!!par[m.uid]} onChange={(e) => setAllow(m.uid, e.target.checked)} data-testid="gh-parental" />}
                  </label>
                )) : <div className="ios-row"><span className="muted small">{L.noKids}</span></div>}
              </div>
              <p className="ios-foot">{L.parentFoot}</p>
            </section>
          )}
        </>
      )}
      <Sheet open={confirmOff} onClose={() => setConfirmOff(false)} title={L.discTitle}
        footer={<div className="sheet-actions"><Button variant="ghost" onClick={() => setConfirmOff(false)}>{lang === 'en' ? 'Cancel' : '取消'}</Button><Button variant="danger" onClick={disconnect} data-testid="gh-disconnect-confirm">{L.disconnect}</Button></div>}>
        <p style={{ margin: 0, fontWeight: 700, lineHeight: 1.6 }}>{L.discBody}</p>
      </Sheet>
    </div>
  );
}
