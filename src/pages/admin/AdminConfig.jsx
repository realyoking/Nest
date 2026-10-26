// Admin → 設定 / 優惠碼 / 審核 (Run 8b). Everything here is written by /api/admin/* (admin-only, every change audited).
// The AI model is shown read-only: agnes-3.0-flash is fixed in code and is not part of the config.
import { useEffect, useState } from 'react';
import { Button, Field, Modal, Spinner, useToast } from '../../components/ui.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { FLAGS, FLAG_KEYS, PLAN_IDS, LANGS, THEMES } from '../../lib/admin-config.js';
import { PLANS } from '../../lib/plans.js';
import { api, post } from './adminApi.js';

const LANG_LABEL = { 'zh-Hant': '繁體中文', 'zh-Hans': '简体中文', en: 'English' };

export function ConfigTab() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askMaint, setAskMaint] = useState(false);
  const load = async () => { try { const r = await api('config'); setD(r); setCfg(JSON.parse(JSON.stringify(r.cfg))); } catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } };
  useEffect(() => { load(); }, []);
  if (!cfg) return <div className="card"><Spinner /></div>;
  const save = async (patch) => {
    setBusy(true);
    try { const r = await post('config', { patch }); setD((x) => ({ ...x, cfg: r.cfg })); setCfg(JSON.parse(JSON.stringify(r.cfg))); toast(t('adm2.cfg.saved')); window.dispatchEvent(new Event('nest:config-reload')); }
    catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } finally { setBusy(false); }
  };
  const flip = (k) => save({ flags: { [k]: !cfg.flags[k] } });
  const lim = (p, k, v) => setCfg((c) => ({ ...c, ai: { ...c.ai, limits: { ...c.ai.limits, [p]: { ...(c.ai.limits[p] || {}), [k]: v === '' ? undefined : +v } } } }));
  return (
    <div className="adm-cfg" data-testid="adm-config">
      <div className="card">
        <div className="card-head"><h2>{t('adm2.cfg.flags')}</h2><span className="muted small">{t('adm2.cfg.rev', { n: cfg.rev })}</span></div>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.cfg.flagsHint')}</p>
        <div className="adm-flags">
          {FLAG_KEYS.map((k) => (
            <label key={k} className="adm-flag">
              <span>{lang === 'en' ? FLAGS[k].en : FLAGS[k].zh}</span>
              <input type="checkbox" role="switch" className="switch" checked={cfg.flags[k]} disabled={busy} onChange={() => flip(k)} aria-label={FLAGS[k].en} data-flag={k} />
            </label>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>{t('adm2.cfg.maint')}</h2>{cfg.maintenance.on && <span className="pill warn">ON</span>}</div>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.cfg.maintHint')}</p>
        {LANGS.map((l) => (
          <Field key={l} label={`${t('adm2.cfg.maintMsg')} · ${LANG_LABEL[l]}`}><input className="input" value={cfg.maintenance.msg[l] || ''} maxLength={400} onChange={(e) => setCfg((c) => ({ ...c, maintenance: { ...c.maintenance, msg: { ...c.maintenance.msg, [l]: e.target.value } } }))} /></Field>
        ))}
        <div className="adm-actions wrap">
          <Button variant="secondary" loading={busy} onClick={() => save({ maintenance: { msg: cfg.maintenance.msg } })}>{t('adm2.cfg.save')}</Button>
          {cfg.maintenance.on
            ? <Button loading={busy} onClick={() => save({ maintenance: { on: false } })}>{t('adm2.cfg.maintOn')}: OFF</Button>
            : <Button variant="danger" loading={busy} onClick={() => setAskMaint(true)}>{t('adm2.cfg.maintOn')}</Button>}
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h2>{t('adm2.cfg.ai')}</h2></div>
        <div className="adm-row"><span>{t('adm2.cfg.model')}</span><b><code>{d?.model || 'agnes-3.0-flash'}</code> 🔒</b></div>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.cfg.modelLocked')}</p>
        <p className="small" style={{ fontWeight: 800, margin: '12px 0 6px' }}>{t('adm2.cfg.limits')}</p>
        <div className="adm-limits">
          {PLAN_IDS.map((p) => (
            <div key={p} className="adm-limit">
              <b>{t(`adm.plan.${p}`)}</b>
              <Field label={`${t('adm2.cfg.daily')} (${PLANS[p]?.daily})`}><input className="input" type="number" min={1} value={cfg.ai.limits[p]?.daily ?? ''} placeholder={String(PLANS[p]?.daily)} onChange={(e) => lim(p, 'daily', e.target.value)} /></Field>
              <Field label={`${t('adm2.cfg.weekly')} (${PLANS[p]?.weekly})`}><input className="input" type="number" min={1} value={cfg.ai.limits[p]?.weekly ?? ''} placeholder={String(PLANS[p]?.weekly)} onChange={(e) => lim(p, 'weekly', e.target.value)} /></Field>
            </div>
          ))}
        </div>
        <Field label={t('adm2.cfg.promptAdd')}><textarea className="textarea" rows={4} maxLength={1500} value={cfg.ai.promptAdd} onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, promptAdd: e.target.value } }))} /></Field>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.cfg.promptHint')}</p>
        <Button loading={busy} onClick={() => save({ ai: { promptAdd: cfg.ai.promptAdd, limits: Object.fromEntries(PLAN_IDS.map((p) => [p, cfg.ai.limits[p] && (cfg.ai.limits[p].daily || cfg.ai.limits[p].weekly) ? cfg.ai.limits[p] : null])) } })}>{t('adm2.cfg.save')}</Button>
      </div>
      <div className="card">
        <div className="card-head"><h2>{t('adm2.cfg.signup')}</h2></div>
        <label className="adm-flag"><span>{t('adm2.cfg.signupOpen')}</span><input type="checkbox" role="switch" className="switch" checked={cfg.signup.open} disabled={busy} onChange={() => save({ signup: { open: !cfg.signup.open } })} /></label>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.cfg.signupHint')}</p>
        <div className="card-head" style={{ marginTop: 18 }}><h2>{t('adm2.cfg.defaults')}</h2></div>
        <div className="adm-2col">
          <Field label={t('adm2.cfg.defLang')}><select className="select" value={cfg.defaults.lang} onChange={(e) => save({ defaults: { lang: e.target.value } })}>{LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}</select></Field>
          <Field label={t('adm2.cfg.defTheme')}><select className="select" value={cfg.defaults.theme} onChange={(e) => save({ defaults: { theme: e.target.value } })}>{THEMES.map((x) => <option key={x} value={x}>{t(`adm2.cfg.themes.${x}`)}</option>)}</select></Field>
        </div>
      </div>
      <Modal open={askMaint} onClose={() => setAskMaint(false)} title={t('adm2.cfg.maintQ')}>
        <p style={{ fontWeight: 600 }}>{t('adm2.cfg.maintBody')}</p>
        <div className="adm-actions"><Button variant="secondary" onClick={() => setAskMaint(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { setAskMaint(false); await save({ maintenance: { on: true, msg: cfg.maintenance.msg } }); }}>{t('common.confirm')}</Button></div>
      </Modal>
    </div>
  );
}

export function CodesTab() {
  const { t } = useI18n();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [f, setF] = useState({ code: '', months: 1, max: 10, expires: '', note: '' });
  const [busy, setBusy] = useState('');
  const load = async () => { try { setD(await api('codes')); } catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } };
  useEffect(() => { load(); }, []);
  const err = (e) => toast(t(`adm2.codes.err.${e.code}`) !== `adm2.codes.err.${e.code}` ? t(`adm2.codes.err.${e.code}`) : t('adm.failed', { code: e.code }), 'err');
  const toggle = async (code, disabled) => { setBusy(code); try { await post('codes', { op: disabled ? 'enable' : 'disable', code }); toast(t('adm.done')); load(); } catch (e) { err(e); } finally { setBusy(''); } };
  if (!d) return <div className="card"><Spinner /></div>;
  return (
    <div className="adm-cfg" data-testid="adm-codes">
      <div className="card">
        <div className="card-head"><h2>{t('adm2.codes.beta')}</h2><span className="pill">{t('adm2.codes.builtIn')}</span></div>
        <div className="adm-row"><span><code>BETA</code></span><b>{t('adm2.codes.betaLine', { a: d.beta.claimed, b: d.beta.max })} · {d.beta.disabled ? t('adm2.codes.disabled') : t('adm2.codes.open')}</b></div>
        <p className="muted small" style={{ fontWeight: 600 }}>{t('adm2.codes.betaHint')}</p>
        <Button size="sm" variant={d.beta.disabled ? 'primary' : 'secondary'} loading={busy === 'BETA'} onClick={() => toggle('BETA', d.beta.disabled)}>{d.beta.disabled ? t('adm2.codes.enable') : t('adm2.codes.disable')}</Button>
      </div>
      <div className="card">
        <div className="card-head"><h2>{t('adm2.codes.title')}</h2></div>
        {d.codes.length === 0 && <p className="muted small">—</p>}
        {d.codes.map((c) => (
          <div key={c.code} className="adm-row">
            <span><code>{c.code}</code> <small className="muted">Pro × {c.months} · {t('adm2.codes.uses', { a: c.used, b: c.max })}{c.note ? ` · ${c.note}` : ''}</small></span>
            <span className="row" style={{ gap: 6 }}><span className={`pill ${c.open ? 'ok' : 'warn'}`}>{c.disabled ? t('adm2.codes.disabled') : c.remaining <= 0 ? t('adm2.codes.full') : c.open ? t('adm2.codes.open') : t('adm2.codes.expired')}</span>
              <Button size="sm" variant="secondary" loading={busy === c.code} onClick={() => toggle(c.code, c.disabled)}>{c.disabled ? t('adm2.codes.enable') : t('adm2.codes.disable')}</Button></span>
          </div>
        ))}
        <div className="card-head" style={{ marginTop: 18 }}><h2>{t('adm2.codes.create')}</h2></div>
        <div className="adm-2col">
          <Field label={t('adm2.codes.code')}><input className="input" value={f.code} maxLength={24} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="SPRING-2027" /></Field>
          <Field label={t('adm2.codes.months')}><input className="input" type="number" min={1} max={24} value={f.months} onChange={(e) => setF({ ...f, months: +e.target.value })} /></Field>
          <Field label={t('adm2.codes.max')}><input className="input" type="number" min={1} value={f.max} onChange={(e) => setF({ ...f, max: +e.target.value })} /></Field>
          <Field label={`${t('adm2.codes.expires')} (HKT)`}><input className="input" type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} /></Field>
        </div>
        <Field label={t('adm2.codes.note')}><input className="input" value={f.note} maxLength={200} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <Button loading={busy === 'new'} disabled={!f.code} onClick={async () => {
          setBusy('new');
          try { await post('codes', { op: 'create', code: { ...f, expires: f.expires ? Date.parse(`${f.expires}T23:59:00+08:00`) : null } }); toast(t('adm.done')); setF({ code: '', months: 1, max: 10, expires: '', note: '' }); load(); } catch (e) { err(e); } finally { setBusy(''); }
        }}>{t('adm2.codes.create')}</Button>
      </div>
    </div>
  );
}

export function ModTab({ stats, goPlugins }) {
  const { t } = useI18n();
  const p = stats || null;
  return (
    <div className="card" data-testid="adm-mod">
      <div className="card-head"><h2>{t('adm2.mod.title')}</h2></div>
      {!p ? <p className="muted small">—</p> : (
        <>
          <div className="adm-stats">
            <div className="adm-stat"><small>{t('adm2.mod.pending')}</small><b>{p.pending}</b></div>
            <div className="adm-stat"><small>{t('adm2.mod.reports')}</small><b>{p.openReports}</b></div>
            <div className="adm-stat"><small>{t('adm2.mod.listed')}</small><b>{p.listed}/{p.total}</b></div>
            <div className="adm-stat"><small>{t('adm2.mod.installs')}</small><b>{p.installs}</b></div>
          </div>
          {!p.pending && !p.openReports && <p className="muted small">{t('adm2.mod.none')}</p>}
        </>
      )}
      <Button onClick={goPlugins}>{t('adm2.mod.open')}</Button>
    </div>
  );
}
