// Admin → 公告 (Run 8b): create / edit / publish / pause / delete in-app announcements, with an AI translation into the
// three app languages (agnes-3.0-flash, server-side), an image (compressed in the browser), audience + schedule, and a
// live preview (phone / iPad × light / dark) of exactly the component users see. Counts come from the server index.
import { useEffect, useRef, useState } from 'react';
import { Button, Field, Modal, Spinner, useToast } from '../../components/ui.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { AnnouncementView } from '../../components/Announcements.jsx';
import { annText, ANN_STYLES, PLAN_IDS, LANGS } from '../../lib/admin-config.js';
import { processBanner } from '../../lib/plugins/listing-img.js';
import { api, post, toLocalInput, fromLocalInput } from './adminApi.js';

const LANG_LABEL = { 'zh-Hant': '繁中', 'zh-Hans': '简中', en: 'EN' };
const blank = () => ({ id: null, status: 'draft', style: 'modal', priority: 50, dismissible: true, neverAgain: true, link: '', start: null, end: null, audience: { type: 'all' }, text: Object.fromEntries(LANGS.map((l) => [l, { title: '', body: '', cta: '' }])) });

export default function AdminAnnouncements() {
  const { t } = useI18n();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [del, setDel] = useState(null);
  const load = async () => { try { setList((await api('ann')).announcements); } catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); setList([]); } };
  useEffect(() => { load(); }, []);
  const setStatus = async (a, status) => { try { await post('ann', { op: 'status', id: a.id, status }); toast(t('adm.done')); load(); window.dispatchEvent(new Event('nest:config-reload')); } catch (e) { toast(t('adm.failed', { code: e.code }), 'err'); } };
  if (edit) return <Editor a={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); window.dispatchEvent(new Event('nest:config-reload')); }} />;
  const now = Date.now();
  return (
    <div className="card" data-testid="adm-ann">
      <div className="card-head"><h2>{t('adm2.ann.title')}</h2><Button size="sm" icon="plus" onClick={() => setEdit(blank())}>{t('adm2.ann.new')}</Button></div>
      {!list ? <Spinner /> : !list.length ? <p className="muted">{t('adm2.ann.none')}</p> : (
        <div className="adm-ann-list">
          {list.map((a) => {
            const tx = annText(a, 'zh-Hant');
            const phase = a.status === 'live' && a.start && now < a.start ? 'scheduled' : a.status === 'live' && a.end && now >= a.end ? 'ended' : null;
            return (
              <div key={a.id} className="adm-ann-row">
                <div className="adm-ann-main">
                  <b>{tx.title || annText(a, 'en').title}</b>
                  <small>{t(`adm2.ann.styles.${a.style}`)} · {t(`adm2.ann.aud.${a.audience?.type || 'all'}`)}{a.audience?.plans ? ` (${a.audience.plans.join(', ')})` : ''}{a.audience?.langs ? ` (${a.audience.langs.map((l) => LANG_LABEL[l]).join(', ')})` : ''}{a.audience?.users ? ` (${a.audience.users.length})` : ''} · P{a.priority}</small>
                  <small>{t('adm2.ann.countsLong', { s: a.stats?.seen || 0, c: a.stats?.clicked || 0, d: a.stats?.dismissed || 0, n: a.stats?.never || 0 })}</small>
                </div>
                <span className={`pill ${a.status === 'live' && !phase ? 'ok' : a.status === 'paused' ? 'warn' : ''}`}>{phase ? t(`adm2.ann.${phase}`) : t(`adm2.ann.status.${a.status}`)}</span>
                <div className="adm-actions wrap">
                  <Button size="sm" variant="secondary" onClick={() => setEdit(a)}>{t('adm2.ann.edit')}</Button>
                  {a.status !== 'live' ? <Button size="sm" onClick={() => setStatus(a, 'live')}>{a.status === 'paused' ? t('adm2.ann.resume') : t('adm2.ann.publish')}</Button>
                    : <Button size="sm" variant="secondary" onClick={() => setStatus(a, 'paused')}>{t('adm2.ann.pause')}</Button>}
                  <Button size="sm" variant="danger" onClick={() => setDel(a)}>{t('adm2.ann.del')}</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} title={t('adm2.ann.delQ')}>
        <p style={{ fontWeight: 600 }}>{t('adm2.ann.delBody')}</p>
        <div className="adm-actions"><Button variant="secondary" onClick={() => setDel(null)}>{t('common.cancel')}</Button>
          <Button variant="danger" onClick={async () => { try { await post('ann', { op: 'delete', id: del.id }); toast(t('adm.done')); setDel(null); load(); } catch (e) { toast(t('adm.failed', { code: e.code }), 'err'); } }}>{t('adm2.ann.del')}</Button></div>
      </Modal>
    </div>
  );
}

function Editor({ a: a0, onClose, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const [a, setA] = useState(() => JSON.parse(JSON.stringify(a0)));
  const [lang, setLang] = useState('zh-Hant');
  const [image, setImage] = useState(undefined); // undefined = unchanged, null = removed, string = new data URL
  const [busy, setBusy] = useState('');
  const [pv, setPv] = useState({ dev: 'phone', theme: 'light' });
  const [users, setUsers] = useState((a0.audience?.users || []).join('\n'));
  const fileRef = useRef(null);
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const setText = (k, v) => setA((x) => ({ ...x, text: { ...x.text, [lang]: { ...x.text[lang], [k]: v } } }));
  const setAud = (patch) => setA((x) => ({ ...x, audience: { ...x.audience, ...patch } }));
  const tx = a.text[lang] || { title: '', body: '', cta: '' };
  const translate = async () => {
    setBusy('tr');
    try { const r = await post('translate', { ...tx, from: lang }); setA((x) => ({ ...x, text: r.text })); toast(t('adm2.ann.translated')); }
    catch (e) { toast(t('adm.failed', { code: e.code || e.message }), 'err'); } finally { setBusy(''); }
  };
  const pick = async (f) => { if (!f) return; try { setImage(await processBanner(f)); } catch { toast(t('listing.tooLarge'), 'err'); } };
  const save = async (status) => {
    setBusy('save');
    const ann = { ...a, status: status || a.status, audience: a.audience.type === 'user' ? { ...a.audience, users: users.split(/[\s,]+/).filter(Boolean) } : a.audience };
    try { await post('ann', { op: 'save', ann, ...(image !== undefined ? { image } : {}) }); toast(t('adm2.ann.saved')); onSaved(); }
    catch (e) { toast(t(`adm2.ann.err.${e.code}`) !== `adm2.ann.err.${e.code}` ? t(`adm2.ann.err.${e.code}`) : t('adm.failed', { code: e.code }), 'err'); } finally { setBusy(''); }
  };
  const pvAnn = { ...a, imgData: image || null, img: image === null ? null : a.img };
  return (
    <div className="adm-ann-edit" data-testid="adm-ann-edit">
      <div className="card adm-ann-form">
        <div className="card-head"><h2>{a.id ? t('adm2.ann.edit') : t('adm2.ann.new')}</h2><Button size="sm" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button></div>
        <div className="seg" role="tablist" aria-label={t('adm2.ann.lang')}>
          {LANGS.map((l) => <button key={l} type="button" role="tab" aria-selected={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{LANG_LABEL[l]}{a.text[l]?.title ? '' : ' ·'}</button>)}
        </div>
        <Field label={t('adm2.ann.titleF')}><input className="input" value={tx.title} maxLength={120} onChange={(e) => setText('title', e.target.value)} /></Field>
        <Field label={t('adm2.ann.bodyF')}><textarea className="textarea" rows={6} value={tx.body} maxLength={4000} onChange={(e) => setText('body', e.target.value)} /></Field>
        <div className="adm-2col">
          <Field label={t('adm2.ann.ctaF')}><input className="input" value={tx.cta} maxLength={40} onChange={(e) => setText('cta', e.target.value)} /></Field>
          <Field label={t('adm2.ann.link')}><input className="input" value={a.link} placeholder="/app/changelog" onChange={(e) => set('link', e.target.value)} /></Field>
        </div>
        <Button size="sm" variant="outline" icon="sparkle" loading={busy === 'tr'} onClick={translate} disabled={!tx.title && !tx.body}>{busy === 'tr' ? t('adm2.ann.translating') : t('adm2.ann.translate')}</Button>
        <Field label={t('adm2.ann.image')}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>{t('adm2.ann.addImg')}</Button>
            {(image || (image === undefined && a.img)) && <Button size="sm" variant="ghost" onClick={() => setImage(null)}>{t('adm2.ann.removeImg')}</Button>}
          </div>
          <small className="muted">{t('adm2.ann.imgHint')}</small>
        </Field>
        <div className="adm-2col">
          <Field label={t('adm2.ann.style')}><select className="select" value={a.style} onChange={(e) => set('style', e.target.value)}>{ANN_STYLES.map((x) => <option key={x} value={x}>{t(`adm2.ann.styles.${x}`)}</option>)}</select></Field>
          <Field label={t('adm2.ann.priority')}><input className="input" type="number" min={0} max={100} value={a.priority} onChange={(e) => set('priority', +e.target.value)} /></Field>
        </div>
        <Field label={t('adm2.ann.audience')}>
          <select className="select" value={a.audience.type} onChange={(e) => setAud({ type: e.target.value })}>{['all', 'plan', 'lang', 'new', 'user'].map((x) => <option key={x} value={x}>{t(`adm2.ann.aud.${x}`)}</option>)}</select>
        </Field>
        {a.audience.type === 'plan' && <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>{PLAN_IDS.map((p) => <label key={p} className="adm-check"><input type="checkbox" checked={(a.audience.plans || []).includes(p)} onChange={(e) => setAud({ plans: e.target.checked ? [...(a.audience.plans || []), p] : (a.audience.plans || []).filter((x) => x !== p) })} />{t(`adm.plan.${p}`)}</label>)}</div>}
        {a.audience.type === 'lang' && <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>{LANGS.map((l) => <label key={l} className="adm-check"><input type="checkbox" checked={(a.audience.langs || []).includes(l)} onChange={(e) => setAud({ langs: e.target.checked ? [...(a.audience.langs || []), l] : (a.audience.langs || []).filter((x) => x !== l) })} />{LANG_LABEL[l]}</label>)}</div>}
        {a.audience.type === 'new' && <Field label={t('adm2.ann.days')}><input className="input" type="number" min={1} max={365} value={a.audience.days || 7} onChange={(e) => setAud({ days: +e.target.value })} /></Field>}
        {a.audience.type === 'user' && <Field label={t('adm2.ann.users')}><textarea className="textarea" rows={3} value={users} onChange={(e) => setUsers(e.target.value)} placeholder="name@example.com" /></Field>}
        <div className="adm-2col">
          <Field label={`${t('adm2.ann.start')} (HKT)`}><input className="input" type="datetime-local" value={toLocalInput(a.start)} onChange={(e) => set('start', fromLocalInput(e.target.value))} /></Field>
          <Field label={`${t('adm2.ann.end')} (HKT)`}><input className="input" type="datetime-local" value={toLocalInput(a.end)} onChange={(e) => set('end', fromLocalInput(e.target.value))} /></Field>
        </div>
        <label className="adm-check"><input type="checkbox" checked={a.dismissible} onChange={(e) => set('dismissible', e.target.checked)} />{t('adm2.ann.dismissible')}</label>
        <label className="adm-check"><input type="checkbox" checked={a.neverAgain} disabled={!a.dismissible} onChange={(e) => set('neverAgain', e.target.checked)} />{t('adm2.ann.neverAgain')}</label>
        <div className="adm-actions wrap">
          <Button variant="secondary" loading={busy === 'save'} onClick={() => save()}>{t('adm2.ann.save')}</Button>
          {a.status !== 'live' && <Button loading={busy === 'save'} onClick={() => save('live')}>{t('adm2.ann.publish')}</Button>}
        </div>
      </div>
      <div className="card adm-ann-pv">
        <div className="card-head"><h2>{t('adm2.ann.preview')}</h2>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <div className="seg sm">{['phone', 'ipad'].map((d) => <button key={d} type="button" className={pv.dev === d ? 'on' : ''} onClick={() => setPv((x) => ({ ...x, dev: d }))}>{t(`adm2.ann.${d}`)}</button>)}</div>
            <div className="seg sm">{['light', 'dark'].map((d) => <button key={d} type="button" className={pv.theme === d ? 'on' : ''} onClick={() => setPv((x) => ({ ...x, theme: d }))}>{t(`adm2.ann.${d}`)}</button>)}</div>
          </div>
        </div>
        <Frame dev={pv.dev} theme={pv.theme}><AnnouncementView a={pvAnn} lang={lang} preview inline onClose={() => {}} onNever={() => {}} onCta={() => {}} /></Frame>
      </div>
    </div>
  );
}

// Device frame: renders at the real device width (390 / 820) and scales down to fit the card.
function Frame({ dev, theme, children }) {
  const W = dev === 'ipad' ? 820 : 390; const H = dev === 'ipad' ? 1180 : 844;
  const box = useRef(null); const [k, setK] = useState(1);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setK(Math.min(1, el.clientWidth / W)));
    ro.observe(el); return () => ro.disconnect();
  }, [W]);
  return (
    <div ref={box} className="adm-frame-box" style={{ height: H * k * (dev === 'ipad' ? 0.62 : 0.86) }}>
      <div className={`adm-frame pv-${theme}`} data-pv={theme} style={{ width: W, height: H * (dev === 'ipad' ? 0.62 : 0.86), transform: `scale(${k})` }}>
        <div className="adm-frame-app"><div className="adm-frame-bar" /><div className="adm-frame-line" /><div className="adm-frame-line short" /><div className="adm-frame-line" /></div>
        {children}
      </div>
    </div>
  );
}
