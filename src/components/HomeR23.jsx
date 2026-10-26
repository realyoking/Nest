// Run 23b Home pieces: the restrained suggestion card (0–2 a day, rule-based — no AI call) and the member's own
// small panels (countdown · shopping list · homework progress) with add / remove / reorder.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { Reveal } from './Reveal.jsx';
import { Button, Field, IconButton, Modal, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { fromLocalInput } from '../lib/dates.js';
import { inQuietHours } from '../lib/prefs.js';
import { isAdult } from '../lib/nestie.js';
import { candidates, pick, markShown, answer, hkDay } from '../lib/suggest.js';
import { cleanPanels, addPanel, removePanel, movePanel, movePanelTo, resizePanel, updatePanel, presetPanels, matchPreset, sizeOf, daysUntil, shoppingItems, shopName, homeworkProgress, PANEL_TYPES, MAX_PANELS, SHOP_PREFIXES, SIZES, PRESETS, HW_SCOPES } from '../lib/panels.js';

const shopPrefix = (lang) => (lang === 'en' ? SHOP_PREFIXES[2] : lang === 'th' ? SHOP_PREFIXES[4] : lang === 'zh-Hans' ? SHOP_PREFIXES[1] : SHOP_PREFIXES[0]);

// Writes the day's suggestion state. A new HK day drops yesterday's log first (merge would otherwise keep it).
async function saveSuggest(be, s, st) {
  if (s.profile?.suggest?.day && s.profile.suggest.day !== st.day && be.deleteProfileKeys) await be.deleteProfileKeys(s.user.uid, ['suggest.log']).catch(() => {});
  await be.saveProfile(s.user.uid, { suggest: { day: st.day, log: st.log, stats: st.stats } });
}

export function SuggestionCard({ weather, holidays, inbox }) {
  const { be } = useBe();
  const { t, uiLang } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [gone, setGone] = useState(() => new Set());
  const cands = useMemo(() => candidates({ members: s.members, reminders: s.reminders, weather, holidays, inbox, meUid: s.user.uid, lang: uiLang }),
    [s.members, s.reminders, weather, holidays, inbox, s.user.uid, uiLang]);
  const { show, state, cap } = pick({ cands, saved: s.profile?.suggest, settings: s.family?.settings, prefs: s.prefs, userQuiet: inQuietHours(s.prefs) });
  const visible = show.filter((c) => !gone.has(c.id));
  const wrote = useRef('');
  const newIds = show.map((c) => c.id).filter((id) => !state.log[id]);
  useEffect(() => {
    if (!newIds.length || !s.profile) return;
    const k = `${state.day}|${newIds.join(',')}`;
    if (wrote.current === k) return; wrote.current = k;
    saveSuggest(be, s, markShown(state, newIds)).catch(() => {});
  }, [newIds.join(','), state.day]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!visible.length) return null;

  const act = async (c, ok) => {
    setGone((g) => new Set([...g, c.id]));
    try {
      if (ok) {
        const r = c.reminder; const due = fromLocalInput(r.due);
        if (r.reschedule) await be.updateReminder(s.family.id, r.reschedule, { dueAt: due });
        else await be.addReminder(s.family.id, { title: r.title, dueAt: due, memberId: r.member === 'everyone' ? '' : s.user.uid });
      }
      await saveSuggest(be, s, answer(markShown(state, [c.id]), c, ok));
      toast(ok ? t('r23.sug.added') : t('r23.sug.ignored'));
    } catch { setGone((g) => { const x = new Set(g); x.delete(c.id); return x; }); toast(t('common.error'), 'err'); }
  };
  return (
    <Reveal className="card sg-card" data-testid="suggestion-card">
      {visible.map((c) => (
        <div className="sg-row" key={c.id} data-kind={c.kind}>
          <span className="sg-ico"><Icon name={c.kind === 'birthday' ? 'star' : c.kind === 'rain' ? 'cloud' : c.kind === 'holiday' ? 'calendar' : c.kind === 'test' ? 'book' : 'bell'} size={18} /></span>
          <div className="sg-main">
            <small className="sg-label">{t('r23.sug.title')}</small>
            <p>{c.text}</p>
            <div className="sg-btns">
              <Button size="sm" icon="check" onClick={() => act(c, true)}>{t('r23.sug.accept')}</Button>
              <Button size="sm" variant="ghost" onClick={() => act(c, false)}>{t('r23.sug.ignore')}</Button>
            </div>
          </div>
        </div>
      ))}
      <p className="sg-why">{cap === Infinity ? t('r24.sf.whyAll') : t('r24.sf.why', { n: cap })}</p>
    </Reveal>
  );
}

export function HomePanels() {
  const { be } = useBe();
  const { t, uiLang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const saved = cleanPanels(s.profile?.homePanels);
  const [local, setLocal] = useState(null); // optimistic list while a write is in flight
  const panels = local || saved;
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [setFor, setSetFor] = useState(null); // panel id whose settings sheet is open
  const [cd, setCd] = useState({ title: '', date: '' });
  const [drag, setDrag] = useState(null); // { id, over }
  const gridRef = useRef(null);
  useEffect(() => { setLocal(null); }, [JSON.stringify(s.profile?.homePanels || [])]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (next, msg, undo) => {
    setLocal(next);
    try {
      await be.saveProfile(s.user.uid, { homePanels: next });
      if (msg) toast(msg, 'ok', undo ? { action: { label: t('r24.hp.undo'), onClick: () => save(undo) } } : undefined);
    } catch { setLocal(null); toast(t('common.error'), 'err'); }
  };
  const add = (p) => { if (panels.length >= MAX_PANELS) { toast(t('r23.panels.max'), 'err'); return; } save(addPanel(panels, p)); setAdding(false); setCd({ title: '', date: '' }); };
  const has = (ty) => panels.some((p) => p.type === ty);
  const applyPreset = (name) => save(presetPanels(name, { examTitle: t('r24.hp.exam') }), t('r24.hp.applied', { name: t(`r24.hp.preset.${name}`) }), panels);
  const reset = () => save([], t('r24.hp.cleared'), panels); // no blocking confirm(): the toast offers 復原
  const current = matchPreset(panels);

  // Drag reorder with pointer events (mouse, pen and touch): the handle captures the pointer; the card under it is the drop target.
  const overAt = (x, y) => { const el = document.elementFromPoint(x, y)?.closest?.('[data-panel-id]'); return el && gridRef.current?.contains(el) ? el.getAttribute('data-panel-id') : null; };
  const onDown = (e, id) => { e.preventDefault(); try { e.currentTarget.setPointerCapture(e.pointerId); } catch {} setDrag({ id, over: id }); };
  const onMove = (e) => { if (!drag) return; const o = overAt(e.clientX, e.clientY); if (o && o !== drag.over) setDrag({ ...drag, over: o }); };
  const onUp = () => {
    if (!drag) return; const { id, over } = drag; setDrag(null);
    if (over && over !== id) save(movePanelTo(panels, id, panels.findIndex((p) => p.id === over)));
  };
  const setP = panels.find((p) => p.id === setFor);

  return (
    <section className="hp-wrap" data-testid="home-panels" aria-label={t('r24.hp.title')}>
      <div className="hp-head">
        <h2>{t('r24.hp.title')}</h2>
        <div className="hp-head-btns">
          {editing && panels.length < MAX_PANELS && <Button size="sm" variant="outline" icon="plus" onClick={() => setAdding(true)} data-testid="hp-add">{t('r24.hp.add')}</Button>}
          <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={editing ? 'check' : 'edit'} onClick={() => setEditing((v) => !v)} data-testid="hp-edit">{editing ? t('r24.hp.done') : t('r24.hp.edit')}</Button>
        </div>
      </div>
      {(editing || !panels.length) && (
        <div className="hp-bar-row">
          <div className="hp-presets" role="group" aria-label={t('r24.hp.presets')}>
            <small>{t('r24.hp.presets')}</small>
            {PRESETS.map((n) => <button type="button" key={n} className={`hp-chip${current === n ? ' on' : ''}`} aria-pressed={current === n} title={t(`r24.hp.presetDesc.${n}`)} onClick={() => applyPreset(n)} data-testid={`hp-preset-${n}`}>{t(`r24.hp.preset.${n}`)}</button>)}
            {editing && panels.length > 0 && <button type="button" className="hp-chip" onClick={reset} data-testid="hp-reset">{t('r24.hp.reset')}</button>}
          </div>
          {editing && <small className="muted" style={{ fontWeight: 700 }}>{t('r24.hp.count', { n: panels.length, max: MAX_PANELS })}</small>}
        </div>
      )}
      {!panels.length && <p className="hp-empty">{t('r24.hp.empty')}</p>}
      {editing && panels.length > 1 && <p className="hp-hint">{t('r24.hp.dragHint')}</p>}
      {panels.length > 0 && (
        <div ref={gridRef} className={`hp-grid${editing ? ' editing' : ''}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setDrag(null)}>
          {panels.map((p, i) => (
            <div className={`card hp-card hp-${p.type} sz-${sizeOf(p)}${drag?.id === p.id ? ' dragging' : ''}${drag && drag.over === p.id && drag.id !== p.id ? ' drop-target' : ''}`} key={p.id} data-panel-id={p.id} data-testid={`panel-${p.type}`} data-size={sizeOf(p)}>
              {editing && (
                <div className="hp-tools">
                  <button type="button" className="hp-drag" aria-label={t('r24.hp.drag')} title={t('r24.hp.drag')} onPointerDown={(e) => onDown(e, p.id)} data-testid="hp-drag">⠿</button>
                  <IconButton icon="arrowLeft" label={t('r24.hp.up')} disabled={i === 0} onClick={() => save(movePanel(panels, p.id, -1))} />
                  <IconButton icon="arrowRight" label={t('r24.hp.down')} disabled={i === panels.length - 1} onClick={() => save(movePanel(panels, p.id, 1))} />
                  <span className="hp-size" role="radiogroup" aria-label={t('r24.hp.size')}>
                    {SIZES.map((z) => <button type="button" key={z} role="radio" aria-checked={sizeOf(p) === z} className={sizeOf(p) === z ? 'on' : ''} onClick={() => sizeOf(p) !== z && save(resizePanel(panels, p.id, z))} data-testid={`hp-size-${z}`}>{t(`r24.hp.sizes.${z}`)}</button>)}
                  </span>
                  <span className="hp-sp" />
                  <IconButton icon="gear" label={t('r24.hp.settings')} onClick={() => setSetFor(p.id)} data-testid="hp-settings" />
                  <IconButton icon="x" label={t('r24.hp.remove')} onClick={() => save(removePanel(panels, p.id), t('r24.hp.removed'), panels)} />
                </div>
              )}
              {p.type === 'countdown' && <Countdown p={p} t={t} fmtDate={fmtDate} />}
              {p.type === 'shopping' && <Shopping p={p} t={t} lang={uiLang} />}
              {p.type === 'homework' && <Homework p={p} t={t} />}
            </div>
          ))}
        </div>
      )}
      {adding && createPortal(<Modal open onClose={() => setAdding(false)} title={t('r24.hp.add')}>
        <div className="hp-picker">
          {PANEL_TYPES.map((ty) => (
            <div className="hp-pick" key={ty}>
              <div className="hp-pick-main"><b>{t(`r23.panels.types.${ty}`)}</b><small>{t(`r23.panels.typeDesc.${ty}`)}</small></div>
              {ty === 'countdown' ? (
                <form className="hp-cd-form" onSubmit={(e) => { e.preventDefault(); if (cd.title.trim() && cd.date) add({ type: 'countdown', title: cd.title.trim(), date: cd.date }); }}>
                  <input className="input" value={cd.title} onChange={(e) => setCd({ ...cd, title: e.target.value })} placeholder={t('r23.panels.cdPh')} maxLength={40} aria-label={t('r23.panels.cdTitle')} />
                  <input className="input" type="date" value={cd.date} min={hkDay()} onChange={(e) => setCd({ ...cd, date: e.target.value })} aria-label={t('r23.panels.cdDate')} />
                  <Button size="sm" type="submit" icon="plus" disabled={!cd.title.trim() || !cd.date}>{t('common.add')}</Button>
                </form>
              ) : <Button size="sm" variant="outline" icon="plus" disabled={has(ty)} onClick={() => add({ type: ty })}>{has(ty) ? t('r23.cards.added') : t('common.add')}</Button>}
            </div>
          ))}
        </div>
      </Modal>, document.body)}
      {setP && createPortal(<PanelSettings p={setP} t={t} onClose={() => setSetFor(null)} onSave={(patch) => { save(updatePanel(panels, setP.id, patch)); setSetFor(null); }} />, document.body)}
    </section>
  );
}

function PanelSettings({ p, t, onClose, onSave }) {
  const [v, setV] = useState({ title: p.title || '', date: p.date || '', listName: p.listName || '', scope: p.scope || '', size: sizeOf(p) });
  const ok = p.type !== 'countdown' || (v.title.trim() && v.date);
  return (
    <Modal open onClose={onClose} title={`${t('r24.hp.settings')} · ${t(`r23.panels.types.${p.type}`)}`}>
      <form className="hp-set" data-testid="hp-settings-sheet" onSubmit={(e) => { e.preventDefault(); if (!ok) return; onSave(p.type === 'countdown' ? { title: v.title.trim(), date: v.date, size: v.size } : p.type === 'shopping' ? { listName: v.listName.trim(), size: v.size } : { scope: v.scope || undefined, size: v.size }); }}>
        {p.type === 'countdown' && <>
          <Field label={t('r23.panels.cdTitle')}><input className="input" value={v.title} maxLength={40} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder={t('r23.panels.cdPh')} /></Field>
          <Field label={t('r23.panels.cdDate')}><input className="input" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} /></Field>
        </>}
        {p.type === 'shopping' && <Field label={t('r24.hp.listName')}><input className="input" value={v.listName} maxLength={24} onChange={(e) => setV({ ...v, listName: e.target.value })} placeholder={t('r24.hp.listPh')} data-testid="hp-listname" /></Field>}
        {p.type === 'homework' && <Field label={t('r24.hp.scope')}>
          <div className="segment" role="radiogroup" aria-label={t('r24.hp.scope')}>
            {HW_SCOPES.map((o) => <button type="button" key={o} role="radio" aria-checked={(v.scope || '') === o} className={(v.scope || '') === o ? 'on' : ''} onClick={() => setV({ ...v, scope: o })}>{t(`r24.hp.scopes.${o}`)}</button>)}
          </div>
        </Field>}
        <Field label={t('r24.hp.size')}>
          <div className="segment" role="radiogroup" aria-label={t('r24.hp.size')}>
            {SIZES.map((z) => <button type="button" key={z} role="radio" aria-checked={v.size === z} className={v.size === z ? 'on' : ''} onClick={() => setV({ ...v, size: z })}>{t(`r24.hp.sizes.${z}`)}</button>)}
          </div>
        </Field>
        <div><Button type="submit" icon="check" disabled={!ok} data-testid="hp-settings-save">{t('r24.hp.save')}</Button></div>
      </form>
    </Modal>
  );
}

function Countdown({ p, t, fmtDate }) {
  const d = daysUntil(p.date);
  return (
    <div className="hp-cd">
      <small className="hp-label"><Icon name="clock" size={14} />{t('r23.panels.types.countdown')}</small>
      <b className="hp-title">{p.title}</b>
      <div className="hp-big">{d > 0 ? <span className="hp-days">{t('r23.panels.days', { n: d })}</span> : d === 0 ? <span className="hp-today">{t('r23.panels.today')}</span> : <small>{t('r23.panels.past', { n: -d })}</small>}</div>
      <small className="muted">{fmtDate(new Date(`${p.date}T12:00:00+08:00`), { year: 'numeric', month: 'short', day: 'numeric' })}</small>
    </div>
  );
}

function Shopping({ p = {}, t, lang }) {
  const { be } = useBe();
  const s = useSession();
  const toast = useToast();
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const items = shoppingItems(s.reminders).slice(0, p.size === 's' ? 3 : p.size === 'l' ? 12 : 6);
  const add = async (e) => {
    e.preventDefault(); const x = v.trim(); if (!x) return;
    setBusy(true);
    try { await be.addReminder(s.family.id, { title: `${shopPrefix(lang)}${x.slice(0, 60)}`, dueAt: null, memberId: '' }); setV(''); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const tick = async (r) => {
    try { await be.updateReminder(s.family.id, r.id, { done: true }); toast(t('r23.panels.bought', { t: shopName(r) }), 'ok', { action: { label: t('r23.mem.undo'), onClick: () => be.updateReminder(s.family.id, r.id, { done: false }).catch(() => {}) } }); }
    catch { toast(t('common.error'), 'err'); }
  };
  return (
    <div className="hp-shop">
      <small className="hp-label"><Icon name="receipt" size={14} />{p.listName || t('r23.panels.types.shopping')}</small>
      {items.length ? <ul className="hp-list">{items.map((r) => (
        <li key={r.id}><button type="button" className="hp-tick" aria-label={t('r23.cards.complete')} onClick={() => tick(r)}><i /></button><span>{shopName(r)}</span></li>
      ))}</ul> : <p className="hp-none">{t('r23.panels.shopEmpty')}</p>}
      <form className="hp-shop-add" onSubmit={add}>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder={t('r23.panels.shopPh')} maxLength={60} aria-label={t('r23.panels.shopAdd')} />
        <IconButton icon="plus" label={t('r23.panels.shopAdd')} type="submit" disabled={!v.trim() || busy} />
      </form>
    </div>
  );
}

function Homework({ p = {}, t }) {
  const s = useSession();
  // Parents / grandparents see the whole family's schoolwork; everyone else their own (and family-wide) items.
  const fam = p.scope ? p.scope === 'family' : isAdult(s.me);
  const hw = homeworkProgress(s.reminders, Date.now(), fam ? '' : s.user.uid);
  const pct = hw.total ? Math.round((hw.done / hw.total) * 100) : 0;
  return (
    <div className="hp-hw">
      <small className="hp-label"><Icon name="book" size={14} />{t('r23.panels.types.homework')}</small>
      {hw.total ? <>
        <b className="hp-title">{t('r23.panels.hwProgress', { done: hw.done, total: hw.total })}</b>
        <div className="hp-bar" role="progressbar" aria-valuenow={hw.done} aria-valuemax={hw.total}><i style={{ width: `${pct}%` }} /></div>
        {hw.next.length > 0 && <ul className="hp-next">{hw.next.map((r) => <li key={r.id}>{r.title}</li>)}</ul>}
      </> : <p className="hp-none">{t('r23.panels.hwEmpty')}</p>}
      <Link to="/app/reminders" className="hp-more">{t('reminders.all')}</Link>
    </div>
  );
}
