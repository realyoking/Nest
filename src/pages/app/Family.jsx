import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MemberName } from '../../components/Identity.jsx';
import { Avatar, Button, Empty, Field, IconButton, Modal, PageHeader, Progress, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { inviteLink } from '../../lib/links.js';
import Sheet from '../../components/Sheet.jsx';
import { familySettings, roleLabel, normRole, ROLES, PERSONALITIES, SUGGEST_LEVELS, MEMORY_EDIT, canEditFamily, canEditMemory, cleanName } from '../../lib/nestie.js';
import { aboutMe } from '../../lib/memory.js';

export default function Family() {
  const { be } = useBe();
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const [invites, setInvites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null);
  const [bday, setBday] = useState(null); // { uid, name, value }
  const [prof, setProf] = useState(null); // member uid whose profile sheet is open
  const saveBday = async () => {
    if (bday.uid === s.user.uid) await be.saveProfile(s.user.uid, { birthday: bday.value || '' }).catch(() => {});
    try { await be.setMemberBirthday(s.family.id, bday.uid, bday.value || ''); toast(t('family.birthdaySaved')); setBday(null); }
    catch { toast(t('family.birthdayFail'), 'err'); }
  };
  useEffect(() => be.watchInvites(s.family.id, setInvites), [s.family.id]);

  const full = s.members.length >= s.plan.members;
  const linkOf = inviteLink;
  const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast(t('common.copied')); } catch { toast(text); } };
  const share = async (inv) => {
    const url = linkOf(inv.token || inv.id);
    if (navigator.share) { try { await navigator.share({ title: s.family.name, text: `${t('join.invitedTo')} ${s.family.name} · ${inv.code}`, url }); return; } catch {} }
    copy(url);
  };
  const create = async () => {
    setBusy(true);
    try { setFresh(await be.createInvite(s.family.id, s.family.name)); } catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const active = invites.filter((i) => i.expiresAt > new Date()).sort((a, b) => b.expiresAt - a.expiresAt);

  return (
    <>
      <PageHeader title={s.family.name} sub={t('family.limit', { n: s.members.length, max: s.plan.members })} />
      <div className="grid-2 fam-grid">
        <div className="col-stack">
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="users" size={18} />{t('family.members')}</h2></div>
          <div style={{ marginBottom: 14 }}><Progress value={s.members.length} max={s.plan.members} calm /></div>
          {[...s.members].sort((a, b) => (b.isOwner ? 1 : 0) - (a.isOwner ? 1 : 0)).map((m) => (
            <div className="list-row fam-row" key={m.uid}>
              <button type="button" className="fam-row-btn" onClick={() => setProf(m.uid)} aria-label={`${t('r23.fam.open')}: ${m.displayName}`} data-testid="member-open">
                <Avatar name={m.displayName} src={s.photoOf(m.uid)} />
                <span className="list-row-main">
                  <b><MemberName uid={m.uid} name={m.displayName} />{m.uid === s.user.uid ? ` (${t('common.you')})` : ''}</b>
                  <span className="fam-pills">
                    {m.uid === s.family.ownerId && <span className="pill dark">{t('common.owner')}</span>}
                    <span className="pill" data-testid="role-pill">{roleLabel(t, m)}</span>
                    {m.birthday && <small>{t('family.birthday')} {fmtDate(new Date(m.birthday + 'T12:00:00+08:00'), { month: 'short', day: 'numeric' })}</small>}
                  </span>
                </span>
                <Icon name="chevronRight" size={18} className="fam-chev" />
              </button>
            </div>
          ))}
          {!s.isOwner && (
            <div style={{ marginTop: 16 }}>
              <Button variant="danger" size="sm" icon="logout" onClick={async () => { if (confirm(t('family.leave') + '?')) { await be.leaveFamily(s.family.id); await be.saveProfile(s.user.uid, { onboarded: false }); nav('/onboarding'); } }}>{t('family.leave')}</Button>
            </div>
          )}
        </Reveal>

        <Reveal className="card" delay={80}>
          <div className="card-head"><h2><Icon name="link" size={18} />{t('family.invite')}</h2></div>
          <p className="muted small" style={{ marginTop: -6, fontWeight: 600 }}>{t('family.inviteSub')}</p>
          {fresh && (
            <div className="invite-box" style={{ marginBottom: 16 }}>
              <div className="muted small" style={{ fontWeight: 800 }}>{t('family.code')}</div>
              <div className="invite-code-row"><span className="invite-code">{fresh.code}</span><IconButton icon="copy" label={t('common.copy')} onClick={() => copy(fresh.code)} /></div>
              <div className="muted small" style={{ fontWeight: 800, marginTop: 8 }}>{t('family.link')}</div>
              <div className="invite-link"><code title={linkOf(fresh.token)}>{linkOf(fresh.token)}</code><Button size="sm" icon="copy" onClick={() => share(fresh)}>{t('common.copy')}</Button></div>
              <div className="muted small" style={{ fontWeight: 700, marginTop: 10 }}>{t('family.expires', { date: fmtDate(fresh.expiresAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) })}</div>
            </div>
          )}
          {full ? <div className="notice">{t('family.full')}</div> : <Button icon="plus" loading={busy} onClick={create}>{t('family.generate')}</Button>}
          <h3 style={{ fontSize: 14, color: 'var(--muted)', letterSpacing: 0, margin: '24px 0 4px' }}>{t('family.active')}</h3>
          {active.length ? active.map((i) => (
            <div className="list-row" key={i.id}>
              <div className="list-row-main"><b style={{ letterSpacing: '.1em' }}>{i.code}</b><small>{t('family.expires', { date: fmtDate(i.expiresAt) })}</small></div>
              <IconButton icon="link" label={t('common.copy')} onClick={() => share(i)} />
              <IconButton icon="trash" label={t('family.revoke')} onClick={() => be.revokeInvite(s.family.id, i)} />
            </div>
          )) : <Empty icon="link" text={t('common.noData')} />}
        </Reveal>
        </div>
        <div className="col-stack"><FamilySettingsCard /></div>
      </div>
      {prof && <MemberSheet uid={prof} onClose={() => setProf(null)} onBirthday={(m) => { setProf(null); setBday({ uid: m.uid, name: m.displayName, value: m.birthday || '' }); }} onRemove={(m) => { if (confirm(t('family.removeConfirm'))) { setProf(null); be.removeMember(s.family.id, m.uid).catch(() => toast(t('common.error'), 'err')); } }} />}
      <Modal open={!!bday} onClose={() => setBday(null)} title={`${t('family.setBirthday')}${bday?.name ? ' · ' + bday.name : ''}`}>
        {bday && (
          <div className="stack">
            <Field label={t('family.birthday')} hint={t('family.birthdayHint')}><input className="input" type="date" value={bday.value} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setBday({ ...bday, value: e.target.value })} /></Field>
            <div className="row"><Button onClick={saveBday}>{t('common.save')}</Button>{bday.value && <Button variant="ghost" onClick={() => setBday({ ...bday, value: '' })}>{t('family.clear')}</Button>}</div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ---------- Run 23: family-level settings ----------
function Toggle({ on, onChange, label, disabled }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}
function SetRow({ title, hint, children, testid }) {
  return <div className="set-row" data-testid={testid}><div className="set-text"><b>{title}</b>{hint && <small>{hint}</small>}</div><div className="set-ctl">{children}</div></div>;
}
export function FamilySettingsCard() {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const base = familySettings(s.family);
  // Run 23b: optimistic selection — the chosen option shows at once instead of after the server + snapshot round trip.
  const [opt, setOpt] = useState({});
  const fs = { ...base, ...opt };
  const baseKey = JSON.stringify(base);
  useEffect(() => { setOpt((o) => { const n = Object.fromEntries(Object.entries(o).filter(([k, v]) => base[k] !== v)); return Object.keys(n).length === Object.keys(o).length ? o : n; }); }, [baseKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const can = canEditFamily({ member: s.me, isOwner: s.isOwner });
  const [name, setName] = useState(fs.nestieName);
  const [famName, setFamName] = useState(s.family.name || '');
  useEffect(() => { setName(fs.nestieName); }, [fs.nestieName]);
  useEffect(() => { setFamName(s.family.name || ''); }, [s.family.name]);
  const save = async (patch) => {
    const quick = Object.fromEntries(Object.entries(patch).filter(([k]) => k !== 'familyName' && k !== 'nestieName'));
    if (Object.keys(quick).length) setOpt((o) => ({ ...o, ...quick }));
    try { await be.updateFamilySettings(s.family.id, patch); toast(t('r23.fam.saved')); }
    catch (e) {
      setOpt((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !(k in quick))));
      // No server path (or the server refused): the owner can still write the family doc directly (Firestore rules).
      if (s.isOwner && !be.MOCK && e?.status !== 400 && be.renameFamily && patch.familyName && Object.keys(patch).length === 1) { await be.renameFamily(s.family.id, patch.familyName).then(() => toast(t('r23.fam.saved'))).catch(() => toast(t('r23.fam.saveFail'), 'err')); return; }
      toast(t('r23.fam.saveFail'), 'err');
    }
  };
  const seg = (key, opts, label) => (
    <div className="segment fam-seg" role="radiogroup" aria-label={label}>
      {opts.map((o) => <button type="button" key={o} role="radio" aria-checked={fs[key] === o} className={fs[key] === o ? 'on' : ''} disabled={!can} onClick={() => fs[key] !== o && save({ [key]: o })}>{t(`r23.fam.${key === 'suggestLevel' ? 'suggestOpt' : 'memEditOpt'}.${o}`)}</button>)}
    </div>
  );
  return (
    <Reveal className="card fam-settings" delay={40} data-testid="family-settings">
      <div className="card-head"><h2><Icon name="gear" size={18} />{t('r23.fam.settings')}</h2></div>
      <p className="muted small" style={{ marginTop: -6, fontWeight: 600 }}>{can ? t('r23.fam.settingsSub') : t('r23.fam.onlyAdults')}</p>
      <div className="nestie-box" data-testid="nestie-settings">
        <div className="nestie-top">
          <span className={`nestie-face p-${fs.personality}`} aria-hidden="true"><i /><i /><b /></span>
          <div className="nestie-name">
            <label htmlFor="nestie-name" className="small muted" style={{ fontWeight: 800 }}>{t('r23.nestie.title')} · {t('r23.nestie.name')}</label>
            <form className="row" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); const v = cleanName(name); if (v !== fs.nestieName) save({ nestieName: v }); }}>
              <input id="nestie-name" className="input" value={name} maxLength={16} disabled={!can} onChange={(e) => setName(e.target.value)} onBlur={() => { const v = cleanName(name); if (can && v !== fs.nestieName) save({ nestieName: v }); }} data-testid="nestie-name" />
            </form>
            <small className="muted">{t('r23.nestie.nameHint')}</small>
          </div>
        </div>
        <div className="persona-grid" role="radiogroup" aria-label={t('r23.nestie.personality')}>
          {PERSONALITIES.map((p) => (
            <button type="button" key={p} role="radio" aria-checked={fs.personality === p} className={`persona ${fs.personality === p ? 'on' : ''}`} disabled={!can} onClick={() => fs.personality !== p && save({ personality: p })} data-testid={`persona-${p}`}>
              <b>{t(`r23.nestie.p.${p}`)}</b><small>{t(`r23.nestie.pDesc.${p}`)}</small>
            </button>
          ))}
        </div>
        <p className="persona-preview" data-testid="persona-preview"><span className="pp-name">{fs.nestieName}</span>{t(`r23.nestie.preview.${fs.personality}`)}</p>
      </div>
      {s.isOwner && (
        <SetRow title={t('r23.fam.name')}>
          <input className="input fam-name-in" value={famName} maxLength={40} onChange={(e) => setFamName(e.target.value)} onBlur={() => { const v = famName.trim(); if (v && v !== s.family.name) save({ familyName: v }); }} aria-label={t('r23.fam.name')} />
        </SetRow>
      )}
      <SetRow title={t('r23.fam.suggest')} testid="fam-suggest">{seg('suggestLevel', SUGGEST_LEVELS, t('r23.fam.suggest'))}</SetRow>
      <SetRow title={t('r23.fam.memEdit')} testid="fam-memedit">{seg('memoryEdit', MEMORY_EDIT, t('r23.fam.memEdit'))}</SetRow>
      <SetRow title={t('r23.fam.holiday')} hint={t('r23.fam.holidayHint')}><Toggle on={fs.holidayTheme} disabled={!can} onChange={(v) => save({ holidayTheme: v })} label={t('r23.fam.holiday')} /></SetRow>
      <SetRow title={t('r23.fam.quiet')} hint={t('r23.fam.quietHint')} testid="fam-quiet">
        <div className="fam-quiet">
          <div className="fam-quiet-in">
            <label className="fam-q"><small>{t('r23.fam.from')}</small><input className={`input${fs.quietStart ? '' : ' empty'}`} type="time" value={fs.quietStart} placeholder="22:00" disabled={!can} aria-label={t('r23.fam.from')} onChange={(e) => save({ quietStart: e.target.value })} /></label>
            <span className="muted fam-q-dash">–</span>
            <label className="fam-q"><small>{t('r23.fam.to')}</small><input className={`input${fs.quietEnd ? '' : ' empty'}`} type="time" value={fs.quietEnd} placeholder="07:00" disabled={!can} aria-label={t('r23.fam.to')} onChange={(e) => save({ quietEnd: e.target.value })} /></label>
          </div>
          <small className="fam-q-state" data-testid="fam-quiet-state">{fs.quietStart && fs.quietEnd ? `${fs.quietStart}–${fs.quietEnd}` : `${t('r24.famq.unset')} · ${t('r24.famq.example')}`}</small>
          {can && <div className="fam-q-btns">
            {!(fs.quietStart && fs.quietEnd) && <Button size="sm" variant="outline" onClick={() => save({ quietStart: '22:00', quietEnd: '07:00' })} data-testid="fam-quiet-use">{t('r24.famq.use')}</Button>}
            {(fs.quietStart || fs.quietEnd) && <Button size="sm" variant="ghost" onClick={() => save({ quietStart: '', quietEnd: '' })}>{t('r24.famq.clear')}</Button>}
          </div>}
        </div>
      </SetRow>
    </Reveal>
  );
}

// ---------- Run 23: member profile (role, permissions, memory, schedule, assigned reminders) ----------
function MemberSheet({ uid, onClose, onBirthday, onRemove }) {
  const { be } = useBe();
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const m = s.members.find((x) => x.uid === uid);
  const [role, setRole] = useState(normRole(m?.role));
  const [label, setLabel] = useState(m?.roleLabel || '');
  const [shares, setShares] = useState([]);
  useEffect(() => (be.watchCalendarShares ? be.watchCalendarShares(s.family.id, setShares) : undefined), [s.family.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return null;
  const fs = familySettings(s.family);
  const canRole = !!s.isOwner; // only the owner sets roles (their own included)
  const n = fs.nestieName;
  const mem = aboutMe({ ...s, user: { uid: m.uid }, me: m }).slice(0, 6);
  const now = Date.now();
  const ms = (d) => (d instanceof Date ? d.getTime() : d?.toDate ? d.toDate().getTime() : Date.parse(d));
  const assigned = (s.reminders || []).filter((r) => !r.done && r.memberId === m.uid).sort((a, b) => (ms(a.dueAt) || Infinity) - (ms(b.dueAt) || Infinity)).slice(0, 6);
  const sched = (shares.find((x) => x.uid === m.uid)?.events || []).map((e) => ({ title: e.t, ms: Date.parse(e.s) })).filter((e) => e.ms >= now - 3600e3 && e.ms < now + 7 * 864e5).sort((a, b) => a.ms - b.ms).slice(0, 6);
  const isOwnerM = m.uid === s.family.ownerId;
  const permFam = canEditFamily({ member: m, isOwner: isOwnerM });
  const permMem = canEditMemory(s.family.settings, { member: m, isOwner: isOwnerM });
  const saveRole = async () => {
    if (role === 'custom' && !label.trim()) return;
    try { await (be.setMemberRoleFull ? be.setMemberRoleFull(s.family.id, m.uid, role, role === 'custom' ? label.trim().slice(0, 20) : '') : be.setMemberRole(s.family.id, m.uid, role)); toast(t('r23.fam.roleSaved')); }
    catch { toast(t('r23.fam.saveFail'), 'err'); }
  };
  const changed = role !== normRole(m.role) || (role === 'custom' && label.trim() !== (m.roleLabel || ''));
  return (
    <Sheet open onClose={onClose} title={t('r23.fam.profile')} label={m.displayName}>
      <div className="mprof" data-testid="member-profile">
        <div className="mprof-top">
          <Avatar name={m.displayName} src={s.photoOf(m.uid)} size={52} />
          <div><b className="mprof-name"><MemberName uid={m.uid} name={m.displayName} />{m.uid === s.user.uid ? ` (${t('common.you')})` : ''}</b>{m.email && <small className="muted mprof-mail">{m.email}</small>}
            <span className="mprof-pills"><span className="pill">{roleLabel(t, m)}</span>{isOwnerM && <span className="pill dark">{t('common.owner')}</span>}</span></div>
        </div>
        <section className="mprof-sec">
          <h3>{t('r23.fam.role')}</h3>
          {canRole ? (
            <div className="stack" style={{ gap: 8 }}>
              <div className="role-chips" role="radiogroup" aria-label={t('r23.fam.role')}>
                {ROLES.map((r) => <button type="button" key={r} role="radio" aria-checked={role === r} className={role === r ? 'on' : ''} onClick={() => setRole(r)} data-testid={`role-${r}`}>{t(`roles.${r}`)}</button>)}
              </div>
              {role === 'custom' && <input className="input" value={label} maxLength={20} placeholder={t('r23.fam.roleCustomPh')} aria-label={t('r23.fam.roleCustom')} onChange={(e) => setLabel(e.target.value)} />}
              {changed && <div><Button size="sm" icon="check" onClick={saveRole} disabled={role === 'custom' && !label.trim()} data-testid="role-save">{t('common.save')}</Button></div>}
            </div>
          ) : <p className="muted small" style={{ fontWeight: 700 }}>{t('r23.fam.ownerOnlyRole')}</p>}
        </section>
        <section className="mprof-sec">
          <h3>{t('r23.fam.perms')}</h3>
          <ul className="mprof-perms">
            <li className={permFam ? 'yes' : 'no'}><Icon name={permFam ? 'check' : 'lock'} size={14} />{t('r23.fam.canFamily')}</li>
            <li className={permMem ? 'yes' : 'no'}><Icon name={permMem ? 'check' : 'lock'} size={14} />{t('r23.fam.canMemory')}</li>
          </ul>
        </section>
        <section className="mprof-sec">
          <h3>{t('r23.fam.memory', { name: n })}</h3>
          {mem.length ? <ul className="mprof-list">{mem.map((x) => <li key={x.id}>{x.kind === 'entity' ? `${x.name}${x.fields?.note ? ` · ${x.fields.note}` : ''}` : x.text}</li>)}</ul> : <p className="tc-empty">{t('r23.fam.noMemory')}</p>}
        </section>
        <section className="mprof-sec">
          <h3>{t('r23.fam.mschedule')}</h3>
          {sched.length ? <ul className="mprof-list">{sched.map((e, k) => <li key={k}><b>{fmtDate(new Date(e.ms), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b> {e.title}</li>)}</ul> : <p className="tc-empty">{t('r23.fam.noSchedule')}</p>}
        </section>
        <section className="mprof-sec">
          <h3>{t('r23.fam.assigned')}</h3>
          {assigned.length ? <ul className="mprof-list">{assigned.map((r) => <li key={r.id}>{r.title}{r.dueAt ? <small> · {fmtDate(new Date(ms(r.dueAt)), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small> : null}</li>)}</ul> : <p className="tc-empty">{t('r23.fam.noAssigned')}</p>}
        </section>
        {(s.isOwner || m.uid === s.user.uid) && (
          <div className="mprof-actions">
            <Button size="sm" variant="outline" icon="calendar" onClick={() => onBirthday?.(m)}>{t('family.setBirthday')}</Button>
            {s.isOwner && m.uid !== s.user.uid && <Button size="sm" variant="ghost" icon="trash" onClick={() => onRemove?.(m)}>{t('family.remove')}</Button>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
