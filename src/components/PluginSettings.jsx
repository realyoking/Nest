// Settings → Plugins: installed list, on/off, per-plugin settings from the manifest schema, re-approval, uninstall.
// Also exports the Home widget strip and the plugin tab page.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Reveal } from './Reveal.jsx';
import { Button, Spinner, useToast, askConfirm } from './ui.jsx';
import { PluginIcon, SafeBadge, InstallSheet, RiskBadge, permText } from './PluginUI.jsx';
import { PERMS, sortByRisk, permDesc } from '../lib/plugins/permissions.js';
import { useI18n } from '../lib/i18n.jsx';
import { usePlugins, SandboxFrame } from '../lib/plugins/runtime.jsx';
import { pName, sLabel, settingsValues } from '../lib/plugins/manifest.js';
import { useSession } from '../lib/session.jsx';

function Toggle({ on, onChange, label }) {
  return <button className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function SettingsForm({ manifest, values, onChange, lang }) {
  const { t } = useI18n();
  const v = settingsValues(manifest, values);
  return (
    <div className="plug-form">
      {(manifest.settings || []).map((s) => {
        const label = sLabel(s, lang);
        const set = (x) => onChange({ ...v, [s.key]: x });
        if (s.type === 'toggle') return <div key={s.key} className="set-row"><div className="set-text"><b>{label}</b></div><div className="set-ctl"><Toggle on={!!v[s.key]} onChange={set} label={label} /></div></div>;
        return (
          <label key={s.key} className="field">
            <span className="field-label">{label}</span>
            {s.type === 'select' ? (
              <select className="select" value={v[s.key]} onChange={(e) => set(e.target.value)}>{s.options.map((o) => <option key={o.value} value={o.value}>{(lang !== 'en' && o.labelZh) || o.label}</option>)}</select>
            ) : s.type === 'number' ? (
              <input className="input" type="number" min={s.min} max={s.max} value={v[s.key]} onChange={(e) => set(Number(e.target.value))} />
            ) : s.type === 'color' ? (
              <input className="input plug-color" type="color" value={v[s.key]} onChange={(e) => set(e.target.value)} />
            ) : (
              <input className="input" type={s.type === 'time' ? 'time' : s.type === 'date' ? 'date' : 'text'} maxLength={s.maxLength} value={v[s.key] ?? ''} onChange={(e) => set(e.target.value)} />
            )}
          </label>
        );
      })}
      {!(manifest.settings || []).length && <p className="muted small">—</p>}
      {t && null}
    </div>
  );
}

function PluginSheet({ p, onClose }) {
  const { t, lang } = useI18n();
  const plug = usePlugins();
  const toast = useToast();
  const [vals, setVals] = useState(p.state.settings || {});
  const [busy, setBusy] = useState('');
  const m = p.manifest;
  const save = async () => { setBusy('save'); try { await plug.setSettings(p.id, vals); toast(t('plug.saved')); onClose(); } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); } };
  const remove = async () => {
    if (!(await askConfirm(t('plug.uninstallQ', { name: pName(m || { name: p.id }, lang) })))) return;
    setBusy('rm'); try { await plug.uninstall(p.id); toast(t('plug.uninstalled')); onClose(); } catch { toast(t('common.error'), 'err'); } finally { setBusy(''); }
  };
  return (
    <Sheet open onClose={onClose} title={m ? pName(m, lang) : p.id}
      footer={<div className="plug-sheet-foot"><Button variant="danger" onClick={remove} loading={busy === 'rm'}>{t('plug.uninstall')}</Button>{m?.settings?.length > 0 && <Button onClick={save} loading={busy === 'save'}>{t('common.save')}</Button>}</div>}>
      {m ? <SettingsForm manifest={m} values={vals} onChange={setVals} lang={lang} /> : <p className="muted">{t('plug.removed')}</p>}
      {m && <PermControls p={p} />}
      <ActivityLog pid={p.id} />
      {m && <p className="fine" style={{ marginTop: 14 }}><Link to={`/app/store/p/${p.id}`} onClick={onClose}>{t('plug.store')} ›</Link></p>}
    </Sheet>
  );
}

// What the plugin may do, with a switch per permission. Revoking takes effect at once (the bridge refuses the call);
// the plugin keeps running without it. Private chats, secrets and tokens are never available to any plugin.
function PermControls({ p }) {
  const { lang } = useI18n();
  const plug = usePlugins();
  const toast = useToast();
  const en = lang === 'en';
  const live = plug.list.find((x) => x.id === p.id) || p;
  const denied = live.state?.denied || [];
  const perms = sortByRisk((live.manifest?.permissions || []).filter((x) => PERMS[x]));
  if (!perms.length) return null;
  const flip = async (id, allow) => {
    try { await plug.setDenied(p.id, allow ? denied.filter((x) => x !== id) : [...denied, id]); toast(allow ? (en ? 'Allowed' : '已允許') : (en ? 'Permission revoked' : '已撤銷權限')); }
    catch { toast(en ? 'Could not save' : '未能儲存', 'err'); }
  };
  return (
    <div className="plug-perm-box" style={{ marginTop: 16 }}>
      <h3 className="set-h" style={{ fontSize: 15 }}>{en ? 'Permissions' : '權限'}</h3>
      {perms.map((id) => (
        <div key={id} className="plug-perm-ctl">
          <span>{permText(lang, id)}<small>{permDesc(id, lang)}</small></span>
          <span className="plug-perm-r"><RiskBadge risk={PERMS[id].risk} small /><Toggle on={!denied.includes(id)} label={permText(lang, id)} onChange={(on) => flip(id, on)} /></span>
        </div>
      ))}
      <p className="fine" style={{ marginTop: 8 }}>{en ? 'Plugins can never read your private chats, passwords or sign-in tokens.' : '插件永遠不能讀取你的私人對話、密碼或登入憑證。'}</p>
    </div>
  );
}

// What this plugin wrote (calendar events, memory notes) — users/{uid}.pluginLog, newest first.
const LOG_LABEL = { 'calendar.create': ['Added event', '新增活動'], 'calendar.update': ['Changed event', '修改活動'], 'calendar.delete': ['Deleted event', '刪除活動'], 'memory.add': ['Saved to family memory', '加入家庭記憶'] };
function ActivityLog({ pid }) {
  const { lang } = useI18n();
  const s = useSession();
  const en = lang === 'en';
  const rows = Object.values(s.profile?.pluginLog || {}).filter((x) => x?.pid === pid).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 20);
  if (!rows.length) return null;
  return (
    <div className="plug-perm-box" style={{ marginTop: 16 }}>
      <h3 className="set-h" style={{ fontSize: 15 }}>{en ? 'Activity' : '活動記錄'}</h3>
      <ul className="plug-log">{rows.map((r, i) => <li key={i}><b>{(LOG_LABEL[r.m] || [r.m, r.m])[en ? 0 : 1]}</b><span>{r.s}</span><small>{new Date(r.at).toLocaleString(en ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></li>)}</ul>
    </div>
  );
}

export default function PluginSettings({ delay = 100 }) {
  const { t, lang } = useI18n();
  const plug = usePlugins();
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [approve, setApprove] = useState(null);
  useEffect(() => { if (location.hash === '#plugins') setTimeout(() => document.getElementById('plugins')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350); }, []);
  if (!plug.enabled) return null;
  return (
    <Reveal className="card" delay={delay} id="plugins">
      <div className="hk-head"><h2 className="set-h">{t('plug.settings')}</h2><Button size="sm" variant="outline" icon="puzzle" to="/app/store">{t('plug.openStore')}</Button></div>
      {!plug.list.length && <p className="muted small" style={{ fontWeight: 600 }}>{t('plug.none')}</p>}
      <div className="plug-list">
        {plug.list.map((p) => {
          const m = p.manifest;
          const name = m ? pName(m, lang) : p.id;
          return (
            <div key={p.id} className="plug-li">
              <button type="button" className="plug-li-main" onClick={() => setOpen(p)}>
                <PluginIcon src={m?.icon} name={name} size={40} />
                <span><b>{name}{p.bundle?.safe && <SafeBadge small />}</b>
                  <small>{p.status === 'removed' ? t('plug.removed') : p.status === 'needs_approval' ? t('plug.needsApproval') : p.state.dev ? t('plug.prompt.dev') : (m?.version ? `v${m.version}` : t('plug.loading'))}</small></span>
              </button>
              {p.status === 'needs_approval' ? <Button size="sm" onClick={() => setApprove(p)}>{t('plug.prompt.approve')}</Button>
                : p.status === 'removed' || p.status === 'loading' ? null
                : <Toggle on={p.status === 'on'} label={name} onChange={async (on) => { try { await plug.setOn(p.id, on); toast(on ? t('plug.turnedOn') : t('plug.turnedOff')); } catch { toast(t('common.error'), 'err'); } }} />}
            </div>
          );
        })}
      </div>
      {open && <PluginSheet p={open} onClose={() => setOpen(null)} />}
      {approve && <InstallSheet open mode="approve" dev={!!approve.state.dev} v={approve.state.v} plugin={{ id: approve.id, name: approve.manifest.name, nameZh: approve.manifest.nameZh, icon: approve.manifest.icon, perms: approve.manifest.permissions, caps: approve.manifest.capabilities, safe: approve.bundle.safe }} onClose={() => setApprove(null)} />}
    </Reveal>
  );
}

// Home: one card per active widget plugin (sandboxed iframe, auto height).
export function PluginWidgets() {
  const { lang } = useI18n();
  const plug = usePlugins();
  if (!plug.enabled || !plug.widgets.length) return null;
  return plug.widgets.map((p) => (
    <section key={p.id} className="card plug-widget" aria-label={pName(p.manifest, lang)}>
      <div className="plug-widget-h"><PluginIcon src={p.manifest.icon} name={pName(p.manifest, lang)} size={22} /><b>{(lang !== 'en' && p.manifest.widget?.titleZh) || p.manifest.widget?.title || pName(p.manifest, lang)}</b></div>
      <SandboxFrame key={`${p.id}:${p.bundle.v}:${lang}`} p={p} surface="widget" minHeight={50} maxHeight={420} />
    </section>
  ));
}

// /app/p/:pid — a plugin's own tab.
export function PluginTabPage() {
  const { pid } = useParams();
  const { t, lang } = useI18n();
  const plug = usePlugins();
  const p = plug.active.find((x) => x.id === pid && x.manifest.capabilities.includes('tab'));
  if (!plug.ready && !p) return <div className="ps-loading"><Spinner /></div>;
  if (!p) return <div className="ps-page"><p className="muted">{t('plug.err.not_found')}</p><Button to="/app/store" variant="outline">{t('plug.openStore')}</Button></div>;
  return (
    <div className="plug-tab">
      <SandboxFrame key={`${p.id}:${p.bundle.v}:${lang}`} p={p} surface="tab" fill />
    </div>
  );
}

// Nav entries (sidebar + More) for plugin tabs.
export function usePluginTabs() {
  const { lang } = useI18n();
  const plug = usePlugins();
  return plug.tabs.map((x) => ({ id: x.id, path: `p/${x.id}`, icon: x.icon, label: (lang !== 'en' && x.titleZh) || x.title }));
}
export { Icon };
