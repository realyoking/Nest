// Family Memory: notes · suggestions (from chats / email — nothing is kept until accepted) · knowledge (people, schools,
// tutors, doctors, contacts, allergies, sizes, medications; family or private) · insights (behavioural, editable) ·
// from your chats (private, auto, deletable; toggle in Settings) · about me (what the family remembered about you).
import { useMemo, useState } from 'react';
import { Button, Empty, Field, IconButton, Markdown, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { aiContext, useSession } from '../../lib/session.jsx';
import { aiErrorText } from './Home.jsx';
import { aiPrefs } from '../../lib/prefs.js';
import { useBe } from '../../lib/be-context.jsx';
import { plainMemories, entitiesOf, suggestionsOf, chatMemList, acceptSuggestion, dismissSuggestion, deleteChatMem, deletePrivateMem, aboutMe, ENTITY_TYPES, ENTITY_FIELDS } from '../../lib/memory.js';
import { insightsOf } from '../../lib/insights.js';
import { canEditItem, familyItem } from '../../lib/family-memory.js';

const TABS = ['notes', 'people', 'insights', 'chats', 'me'];

export default function Memory() {
  const { be, ai } = useBe();
  const { t, lang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState('notes');
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const [ask, setAsk] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [ent, setEnt] = useState(null); // entity sheet {mode, e}
  const [editIns, setEditIns] = useState(null);
  const remember = s.prefs.chatMemory !== false;
  const sugg = suggestionsOf(s.profile);

  const add = async (e) => {
    e.preventDefault(); if (!text.trim()) return;
    setBusy(true);
    try { await be.addMemory(s.family.id, { text: text.trim().slice(0, 500), tag: tag.trim().slice(0, 20) }); setText(''); setTag(''); toast(t('agent.addedOk')); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const doAsk = async (e) => {
    e.preventDefault(); if (!ask.trim()) return;
    setAsking(true); setAnswer('');
    try { await ai.streamChat({ mode: 'memory', lang, messages: [{ role: 'user', content: ask.trim() }], context: aiContext(s), prefs: aiPrefs(s.prefs), onDelta: setAnswer }); }
    catch (err) { toast(aiErrorText(err, t), 'err'); } finally { setAsking(false); }
  };
  const ql = q.trim().toLowerCase();
  const notes = plainMemories(s, remember).filter((m) => !ql || m.text.toLowerCase().includes(ql) || (m.tag || '').toLowerCase().includes(ql));
  const ents = entitiesOf(s);
  const ins = insightsOf(s);
  const chats = chatMemList(s.profile);
  const mine = useMemo(() => aboutMe(s), [s.memories, s.user.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const safe = (f) => async () => { try { await f(); } catch { toast(t('common.error'), 'err'); } };

  return (
    <>
      <PageHeader title={t('memory.title')} sub={t('memory.sub')} />
      {sugg.length > 0 && (
        <Reveal className="card mem-sugg">
          <div className="card-head"><h2><Icon name="sparkle" size={18} />{t('mem2.suggTitle', { n: sugg.length })}</h2></div>
          <p className="muted small" style={{ marginTop: -8, fontWeight: 700 }}>{t('mem2.suggHint')}</p>
          {sugg.slice(0, 5).map((x) => (
            <div className="mem-sugg-row" key={x.id}>
              <div className="mem-sugg-main">
                <b>{x.kind === 'entity' ? `${t(`mem2.type.${x.type || 'other'}`)} · ${x.name}` : x.text}</b>
                <small>{[x.about, ...Object.entries(x.fields || {}).map(([k, v]) => `${t(`mem2.f.${k}`)} ${v}`), x.exp ? t('mem2.until', { date: x.exp }) : '', t(x.src === 'email' ? 'mem2.fromEmail' : 'mem2.fromChat')].filter(Boolean).join(' · ')}</small>
              </div>
              <div className="mem-sugg-btns">
                <Button size="sm" icon="check" onClick={safe(async () => { await acceptSuggestion(be, s, x, { vis: 'family' }); toast(t('mem2.accepted')); })}>{t('mem2.keepFamily')}</Button>
                <Button size="sm" variant="outline" onClick={safe(async () => { await acceptSuggestion(be, s, x, { vis: 'private' }); toast(t('mem2.accepted')); })}>{t('mem2.keepPrivate')}</Button>
                <Button size="sm" variant="ghost" onClick={safe(() => dismissSuggestion(be, s.user.uid, x.id))}>{t('home.dismiss')}</Button>
              </div>
            </div>
          ))}
        </Reveal>
      )}
      <div className="segment mem-tabs" role="tablist">
        {TABS.map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(`mem2.tabs.${k}`)}</button>)}
      </div>

      {tab === 'notes' && (
        <div className="grid-2">
          <div>
            <Reveal className="card">
              <form className="stack" onSubmit={add}>
                <textarea className="textarea" style={{ minHeight: 96 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('memory.addPh')} maxLength={500} />
                <div className="row"><input className="input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder={t('memory.tagPh')} maxLength={20} /><Button type="submit" icon="plus" loading={busy} disabled={!text.trim()}>{t('common.add')}</Button></div>
              </form>
            </Reveal>
            <Reveal className="card" delay={60}>
              <div className="card-head"><h2><Icon name="sparkle" size={18} />{t('memory.ask')}</h2></div>
              <form className="row" onSubmit={doAsk}>
                <input className="input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder={t('memory.askPh')} />
                <Button type="submit" loading={asking} disabled={!ask.trim()} icon="arrowUp" aria-label={t('memory.ask')} />
              </form>
              {(answer || asking) && <div style={{ marginTop: 16 }}>{answer ? <Markdown text={answer} /> : <div className="typing"><i /><i /><i /></div>}</div>}
            </Reveal>
          </div>
          <Reveal className="card" delay={100}>
            <div className="row" style={{ marginBottom: 8, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, color: '#a3a3a3' }}><Icon name="search" size={18} /></span>
              <input className="input" style={{ paddingLeft: 42 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('memory.search')} />
            </div>
            {notes.length ? notes.map((m) => (
              <div className="list-row" key={m.id}>
                <div className="list-row-main">
                  <b style={{ fontWeight: 700 }}>{m.text}</b>
                  <small>{m.kind === 'chat' ? `${t('mem2.fromChat')} · ` : ''}{m.tag ? `${m.tag} · ` : ''}{m.exp ? `${t('mem2.until', { date: m.exp })} · ` : ''}{t('memory.by', { name: s.memberName(m.createdBy) || '—' })}{m.createdAt ? ` · ${fmtDate(m.createdAt)}` : ''}</small>
                </div>
                {canEditItem(s, familyItem(m)) ? <IconButton icon="trash" label={t('common.delete')} onClick={() => be.deleteMemory(s.family.id, m.id)} /> : <span className="mem-lock" title={t('r23.mem.locked')}><Icon name="lock" size={15} /></span>}
              </div>
            )) : <Empty icon="brain" text={t('memory.empty')} />}
          </Reveal>
        </div>
      )}

      {tab === 'people' && (
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="users" size={18} />{t('mem2.peopleTitle')}</h2><Button size="sm" icon="plus" onClick={() => setEnt({ mode: 'create', e: { type: 'person', name: '', about: '', fields: {}, notes: [], vis: 'family' } })}>{t('common.add')}</Button></div>
          <p className="muted small" style={{ marginTop: -8, fontWeight: 700 }}>{t('mem2.peopleHint')}</p>
          {ents.length ? ENTITY_TYPES.map((ty) => { const l = ents.filter((e) => (e.type || 'other') === ty); return l.length ? (
            <div key={ty} className="mem-group">
              <h3>{t(`mem2.type.${ty}`)}</h3>
              {l.map((e) => (
                <button className="list-row mem-ent" key={`${e.vis}-${e.id}`} onClick={() => setEnt({ mode: 'edit', e })}>
                  <div className="list-row-main">
                    <b style={{ fontWeight: 800 }}>{e.name}{e.vis === 'private' && <span className="pill" style={{ marginLeft: 8 }}><Icon name="lock" size={12} />{t('mem2.private')}</span>}</b>
                    <small>{[e.about ? s.memberName(e.about) : '', ...Object.entries(e.fields || {}).filter(([, v]) => v).map(([k, v]) => `${t(`mem2.f.${k}`)} ${v}`), (e.notes || []).slice(-1)[0]?.text].filter(Boolean).join(' · ')}</small>
                  </div>
                  <Icon name="chevronRight" size={16} />
                </button>
              ))}
            </div>
          ) : null; }) : <Empty icon="users" text={t('mem2.peopleEmpty')} />}
        </Reveal>
      )}

      {tab === 'insights' && (
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="gauge" size={18} />{t('mem2.insTitle')}</h2></div>
          <p className="muted small" style={{ marginTop: -8, fontWeight: 700 }}>{t('mem2.insHint')}</p>
          {ins.length ? ins.map((m) => (
            <div className="list-row" key={m.id}>
              <div className="list-row-main">
                <b style={{ fontWeight: 700 }}>{s.memberName(m.memberId) || '—'}：{m.text}</b>
                <small>{t('mem2.conf', { pct: Math.round((m.confidence || 0) * 100), n: m.evidence || 1 })}{m.lastSeen ? ` · ${t('mem2.lastSeen', { date: fmtDate(new Date(m.lastSeen)) })}` : ''}{m.edited ? ` · ${t('mem2.edited')}` : ''}</small>
                <span className="mem-bar"><i style={{ width: `${Math.round((m.confidence || 0) * 100)}%` }} /></span>
              </div>
{(m.memberId === s.user.uid || canEditItem(s, familyItem(m))) && <><IconButton icon="copy" label={t('common.edit')} onClick={() => setEditIns({ m, text: m.text })} />
              <IconButton icon="trash" label={t('common.delete')} onClick={safe(async () => { await be.deleteMemory(s.family.id, m.id); if (m.memberId === s.user.uid) await be.saveProfile(s.user.uid, { insightOff: { [m.key]: true } }); })} /></>}
            </div>
          )) : <Empty icon="gauge" text={t('mem2.insEmpty')} />}
        </Reveal>
      )}

      {tab === 'chats' && (
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="chat" size={18} />{t('mem2.chatTitle')}</h2><span className={`pill ${remember ? 'dark' : ''}`}>{remember ? t('mem2.on') : t('mem2.off')}</span></div>
          <p className="muted small" style={{ marginTop: -8, fontWeight: 700 }}>{t(remember ? 'mem2.chatHint' : 'mem2.chatOffHint')}</p>
          {chats.length ? chats.map((m) => (
            <div className="list-row" key={m.id}>
              <div className="list-row-main"><b style={{ fontWeight: 700 }}>{m.text}</b><small>{[m.exp ? t('mem2.until', { date: m.exp }) : '', m.at ? fmtDate(new Date(m.at)) : ''].filter(Boolean).join(' · ')}</small></div>
              <IconButton icon="trash" label={t('common.delete')} onClick={safe(() => deleteChatMem(be, s.user.uid, m.id))} />
            </div>
          )) : <Empty icon="chat" text={t('mem2.chatEmpty')} />}
          <Button size="sm" variant="outline" to="/app/settings" style={{ marginTop: 12 }}>{t('mem2.toggleIn')}</Button>
        </Reveal>
      )}

      {tab === 'me' && (
        <Reveal className="card">
          <div className="card-head"><h2><Icon name="user" size={18} />{t('mem2.meTitle')}</h2></div>
          <p className="muted small" style={{ marginTop: -8, fontWeight: 700 }}>{t('mem2.meHint')}</p>
          {mine.length ? <div className="mem-timeline">{mine.map((m) => (
            <div className="mem-tl" key={m.id}>
              <span className="mem-tl-dot" />
              <div><b>{m.kind === 'entity' ? `${t(`mem2.type.${m.type}`)} · ${m.name}` : m.text}</b><small>{[m.kind === 'insight' ? t('mem2.kindInsight') : m.kind === 'entity' ? t('mem2.kindKnowledge') : t('mem2.kindNote'), m.when ? fmtDate(new Date(m.when), { year: 'numeric', month: 'short', day: 'numeric' }) : '', m.createdBy && m.createdBy !== s.user.uid ? t('memory.by', { name: s.memberName(m.createdBy) || '—' }) : ''].filter(Boolean).join(' · ')}</small></div>
            </div>
          ))}</div> : <Empty icon="user" text={t('mem2.meEmpty')} />}
        </Reveal>
      )}

      {ent && <EntitySheet ent={ent} onClose={() => setEnt(null)} />}
      {editIns && (
        <Sheet open onClose={() => setEditIns(null)} title={t('mem2.editInsight')} footer={<div className="sheet-actions"><Button variant="ghost" onClick={() => setEditIns(null)}>{t('common.cancel')}</Button><Button onClick={safe(async () => { await be.updateMemory(s.family.id, editIns.m.id, { text: editIns.text.trim().slice(0, 200), edited: true }); setEditIns(null); toast(t('settings.saved')); })}>{t('common.save')}</Button></div>}>
          <Field label={t('mem2.insightText')} hint={t('mem2.editHint')}><input className="input" value={editIns.text} onChange={(e) => setEditIns({ ...editIns, text: e.target.value })} maxLength={200} /></Field>
        </Sheet>
      )}
    </>
  );
}

function EntitySheet({ ent, onClose }) {
  const { be } = useBe();
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [e, setE] = useState(() => ({ fields: {}, notes: [], ...ent.e }));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p) => setE((x) => ({ ...x, ...p }));
  const editable = ent.mode === 'create' || ent.e.vis === 'private' || canEditItem(s, familyItem(ent.e));
  const save = async () => {
    if (!e.name.trim()) return;
    setBusy(true);
    try {
      const notes = note.trim() ? [...(e.notes || []), { text: note.trim().slice(0, 300), at: Date.now(), by: s.user.uid }].slice(-30) : (e.notes || []);
      const doc = { kind: 'entity', type: e.type || 'other', name: e.name.trim().slice(0, 80), about: e.about || '', fields: Object.fromEntries(Object.entries(e.fields || {}).filter(([, v]) => String(v).trim()).map(([k, v]) => [k, String(v).slice(0, 200)])), notes };
      if (ent.mode === 'edit' && ent.e.vis !== e.vis) {
        if (ent.e.vis === 'private') await deletePrivateMem(be, s.user.uid, ent.e.id); else await be.deleteMemory(s.family.id, ent.e.id);
      }
      if (e.vis === 'private') await be.saveProfile(s.user.uid, { privateMem: { [ent.mode === 'edit' && ent.e.vis === 'private' ? ent.e.id : `p${Date.now().toString(36)}`]: { ...doc, at: Date.now() } } });
      else if (ent.mode === 'edit' && ent.e.vis === 'family') await be.updateMemory(s.family.id, ent.e.id, doc);
      else await be.addMemory(s.family.id, doc);
      toast(t('settings.saved')); onClose();
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const del = async () => {
    try { if (ent.e.vis === 'private') await deletePrivateMem(be, s.user.uid, ent.e.id); else await be.deleteMemory(s.family.id, ent.e.id); onClose(); } catch { toast(t('common.error'), 'err'); }
  };
  return (
    <Sheet open onClose={onClose} title={ent.mode === 'create' ? t('mem2.addEntity') : e.name} footer={(
      <div className="sheet-actions">{ent.mode === 'edit' && editable && <Button variant="ghost" icon="trash" onClick={del}>{t('common.delete')}</Button>}<Button loading={busy} disabled={!e.name?.trim() || !editable} onClick={save}>{t('common.save')}</Button></div>
    )}>
      <div className="stack">
        <div className="cal-form-2">
          <Field label={t('mem2.typeLabel')}><select className="select" value={e.type || 'other'} onChange={(x) => set({ type: x.target.value })}>{ENTITY_TYPES.map((ty) => <option key={ty} value={ty}>{t(`mem2.type.${ty}`)}</option>)}</select></Field>
          <Field label={t('mem2.about')}><select className="select" value={e.about || ''} onChange={(x) => set({ about: x.target.value })}><option value="">{t('common.everyone')}</option>{s.members.map((m) => <option key={m.uid} value={m.uid}>{m.displayName}</option>)}</select></Field>
        </div>
        <Field label={t('mem2.name')}><input className="input" value={e.name} onChange={(x) => set({ name: x.target.value })} maxLength={80} placeholder={t('mem2.namePh')} /></Field>
        {ENTITY_FIELDS.map((k) => <Field key={k} label={t(`mem2.f.${k}`)}><input className="input" value={e.fields?.[k] || ''} onChange={(x) => set({ fields: { ...(e.fields || {}), [k]: x.target.value } })} maxLength={200} /></Field>)}
        {(e.notes || []).length > 0 && (
          <div className="mem-notes"><h3>{t('mem2.notes')}</h3>{e.notes.slice().reverse().map((n, i) => <p key={i}><b>{n.text}</b><small>{n.at ? fmtDate(new Date(n.at)) : ''}{n.by ? ` · ${s.memberName(n.by)}` : ''}</small></p>)}</div>
        )}
        <Field label={t('mem2.addNote')} hint={t('mem2.noteHint')}><input className="input" value={note} onChange={(x) => setNote(x.target.value)} maxLength={300} placeholder={t('mem2.notePh')} /></Field>
        <Field label={t('mem2.visibility')}>
          <div className="ncal-chips">
            <button type="button" className={e.vis !== 'private' ? 'on' : ''} onClick={() => set({ vis: 'family' })}>{t('mem2.visFamily')}</button>
            <button type="button" className={e.vis === 'private' ? 'on' : ''} onClick={() => set({ vis: 'private' })}>{t('mem2.visPrivate')}</button>
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
