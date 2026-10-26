// Run 23b: Settings → 「Nestie 記得的事」 — what the AI remembers, grouped per family member (plus 全家).
// Edit / delete follow the family rule 「誰可以修改家庭記憶」 (family-memory.js canEditItem); private chat memories are
// only ever shown to their owner. Deletes wait for the undo window before they are written.
import { useMemo, useState } from 'react';
import { Avatar, Button, Empty, IconButton, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { useNestie } from '../../components/ProgressCard.jsx';
import { memoryByMember, canEditItem, canAddMemory, MEM_CATS } from '../../lib/family-memory.js';
import { deleteChatMem } from '../../lib/memory.js';

export default function NestieMemory() {
  const { be } = useBe();
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const n = useNestie();
  const [hide, setHide] = useState(() => new Set());
  const [edit, setEdit] = useState(null); // { item, text, cat }
  const [adding, setAdding] = useState(null); // { uid, text, cat }
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => memoryByMember(s), [s.memories, s.members, s.profile?.chatMem]); // eslint-disable-line react-hooks/exhaustive-deps
  const remember = s.prefs.chatMemory !== false;
  const canAdd = canAddMemory(s);
  const level = t(`r23.fam.memEditOpt.${n.memoryEdit}`);
  const who = (uid) => (uid ? s.memberName(uid) || '—' : t('r23.mem.family'));

  const del = (it) => {
    setHide((h) => new Set([...h, it.id]));
    let undone = false;
    toast(t('r23.mem.deleted'), 'ok', {
      action: { label: t('r23.mem.undo'), onClick: () => { undone = true; setHide((h) => { const x = new Set(h); x.delete(it.id); return x; }); } },
      onExpire: () => {
        if (undone) return;
        const p = it.src === 'private' ? deleteChatMem(be, s.user.uid, it.id) : be.deleteMemory(s.family.id, it.id);
        Promise.resolve(p).catch(() => { toast(t('common.error'), 'err'); setHide((h) => { const x = new Set(h); x.delete(it.id); return x; }); });
      },
    });
  };
  const saveEdit = async () => {
    const text = edit.text.trim().slice(0, 500); if (!text) return;
    setBusy(true);
    try {
      if (edit.item.src === 'private') await be.saveProfile(s.user.uid, { chatMem: { [edit.item.id]: { ...edit.item.raw, text, cat: edit.cat } } });
      else await be.updateMemory(s.family.id, edit.item.id, { text, cat: edit.cat, updatedBy: s.user.uid });
      toast(t('r23.mem.saved')); setEdit(null);
    } catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };
  const saveAdd = async (e) => {
    e.preventDefault();
    const text = adding.text.trim().slice(0, 500); if (!text || !canAdd) return;
    setBusy(true);
    try { await be.addMemory(s.family.id, { text, tag: '', about: adding.uid, cat: adding.cat }); toast(t('r23.mem.saved')); setAdding(null); }
    catch { toast(t('common.error'), 'err'); } finally { setBusy(false); }
  };

  return (
    <div className="fm-page" data-testid="nestie-memory">
      <PageHeader title={t('r23.mem.title', { name: n.nestieName })} sub={t('r23.mem.sub', { name: n.nestieName })} />
      <Reveal className="card fm-control">
        <div className="fm-control-row">
          <span className="fm-shield"><Icon name="shield" size={20} /></span>
          <div><b>{t('r23.mem.control')}</b><small>{t('r23.mem.level', { level })}</small></div>
        </div>
        <label className="fm-toggle">
          <span><b>{t('r23.mem.fromChats')}</b><small>{t('r23.mem.fromChatsHint', { name: n.nestieName })}</small></span>
          <button type="button" role="switch" aria-checked={remember} className={`fm-switch${remember ? ' on' : ''}`} onClick={() => s.savePrefs({ chatMemory: !remember }).catch(() => toast(t('common.error'), 'err'))}><i /></button>
        </label>
      </Reveal>
      {!canAdd && <p className="muted small fm-note">{t('r23.mem.cantAdd')}</p>}
      {groups.map(({ uid, items }, gi) => {
        const list = items.filter((x) => !hide.has(x.id));
        return (
          <Reveal className="card fm-group" key={uid || 'family'} delay={Math.min(gi * 40, 200)} data-testid="fm-group">
            <div className="card-head">
              <h2 className="fm-who">{uid ? <Avatar name={who(uid)} src={s.photoOf(uid)} size={28} /> : <span className="fm-fam"><Icon name="users" size={16} /></span>}{who(uid)}{uid === s.user.uid && <span className="pill">{t('r23.fam.you')}</span>}</h2>
              {canAdd && <Button size="sm" variant="outline" icon="plus" onClick={() => setAdding({ uid, text: '', cat: 'preference' })}>{t('r23.mem.add')}</Button>}
            </div>
            {adding?.uid === uid && (
              <form className="fm-edit" onSubmit={saveAdd}>
                <input className="input" autoFocus value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} placeholder={t('r23.mem.addPh')} maxLength={500} aria-label={t('r23.mem.add')} />
                <CatChips value={adding.cat} onChange={(cat) => setAdding({ ...adding, cat })} />
                <div className="fm-edit-btns"><Button size="sm" variant="ghost" type="button" onClick={() => setAdding(null)}>{t('common.cancel')}</Button><Button size="sm" type="submit" loading={busy} disabled={!adding.text.trim()}>{t('common.save')}</Button></div>
              </form>
            )}
            {list.length ? list.map((it) => {
              const ok = canEditItem(s, it);
              if (edit?.item.id === it.id) return (
                <div className="fm-edit" key={it.id}>
                  <input className="input" autoFocus value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} maxLength={500} aria-label={t('r23.mem.edit')} />
                  <CatChips value={edit.cat} onChange={(cat) => setEdit({ ...edit, cat })} />
                  <div className="fm-edit-btns"><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button size="sm" loading={busy} disabled={!edit.text.trim()} onClick={saveEdit}>{t('common.save')}</Button></div>
                </div>
              );
              return (
                <div className="list-row fm-item" key={it.id} data-testid="fm-item">
                  <div className="list-row-main">
                    <b>{it.text}</b>
                    <small><span className={`fm-cat c-${it.cat}`}>{t(`r23.mem.cats.${it.cat}`)}</span>{it.src === 'private' ? <span className="fm-priv"><Icon name="lock" size={11} />{t('r23.mem.private')}</span> : it.createdBy ? <span>{t('memory.by', { name: s.memberName(it.createdBy) || '—' })}</span> : null}{it.exp ? <span>{t('mem2.until', { date: it.exp })}</span> : null}</small>
                  </div>
                  {ok ? (
                    <div className="fm-acts">
                      {it.kind !== 'entity' && <IconButton icon="edit" label={t('r23.mem.edit')} onClick={() => setEdit({ item: it, text: it.text, cat: it.cat })} />}
                      <IconButton icon="trash" label={t('r23.mem.del')} onClick={() => del(it)} />
                    </div>
                  ) : <span className="mem-lock" title={t('r23.mem.locked')} aria-label={t('r23.mem.locked')}><Icon name="lock" size={15} /></span>}
                </div>
              );
            }) : <Empty icon="brain" text={t('r23.mem.empty')} />}
          </Reveal>
        );
      })}
    </div>
  );
}

function CatChips({ value, onChange }) {
  const { t } = useI18n();
  return <div className="ncal-chips fm-cats">{MEM_CATS.map((c) => <button type="button" key={c} className={value === c ? 'on' : ''} aria-pressed={value === c} onClick={() => onChange(c)}>{t(`r23.mem.cats.${c}`)}</button>)}</div>;
}
