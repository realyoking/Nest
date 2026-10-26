// 「編輯公開個人頁」 (/app/profile): the ONE public profile (unified identity). Photo + display name are the same as
// Settings → 個人資料; handle, banner, bio and links live only here. Saves through /api/plugins/profile-save.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProfilePhoto from '../../components/AvatarEditor.jsx';
import { BannerEditor, HandleField, ProfileHeader, validLink } from '../../components/Identity.jsx';
import { Button, Field, PageHeader, Spinner, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { PROFILE_LIMITS, normHandle } from '../../lib/profile.js';
import * as API from '../../lib/plugins/api.js';

const Block = ({ label, hint, children }) => <div className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</div>;
const ERR = { handle_taken: 'id.taken', bad_handle: 'id.bad', handle_required: 'id.required', bad_banner: 'id.tooBig' };

export default function ProfileEdit() {
  const { t } = useI18n();
  const { be } = useBe();
  const s = useSession();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [hState, setHState] = useState('idle');
  const [busy, setBusy] = useState(false);
  const loaded = s.pubProfile !== undefined;
  useEffect(() => {
    if (!loaded || p) return;
    const c = s.pubProfile || {};
    setP({ handle: c.handle || '', name: c.name || s.me?.displayName || '', bio: c.bio || '', banner: c.banner || '', links: (c.links || []).map((l) => ({ ...l })), initialHandle: c.handle || '' });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return <div className="ps-loading"><Spinner /></div>;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const setLink = (i, k, v) => setP((x) => ({ ...x, links: x.links.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const save = async () => {
    setBusy(true);
    try {
      const name = p.name.trim().slice(0, PROFILE_LIMITS.name);
      const patch = { name, bio: p.bio, banner: p.banner, links: p.links.filter(validLink) };
      if (normHandle(p.handle) !== p.initialHandle) patch.handle = p.handle;
      if (s.myPhoto && s.myPhoto !== s.pubProfile?.photo) patch.photo = s.myPhoto;
      const r = await API.profileSave(patch);
      // Display name stays ONE value: member doc (family) + owner-only profile + public profile.
      if (name && name !== (s.me?.displayName || '')) {
        await be.updateMyMember(s.family.id, s.user.uid, { displayName: name }).catch(() => {});
        await be.saveProfile(s.user.uid, { displayName: name }).catch(() => {});
      }
      s.refreshProfile(r.profile);
      setP((x) => ({ ...x, initialHandle: r.profile?.handle || x.initialHandle, links: r.profile?.links || x.links }));
      toast(t('id.saved'));
    } catch (e) { toast(t(ERR[e.code] || 'common.error'), 'err'); } finally { setBusy(false); }
  };
  const preview = { handle: normHandle(p.handle), name: p.name.trim(), photo: s.myPhoto, banner: p.banner, bio: p.bio.trim(), links: p.links.filter(validLink), verified: !!s.pubProfile?.verified };
  const blocked = hState === 'taken' || hState === 'bad' || hState === 'checking';
  return (
    <>
      <PageHeader title={t('id.editPublic')} sub={t('id.publicNote')} />
      <div className="grid-2 id-edit">
        <div className="card stack">
          <ProfilePhoto />
          <Field label={t('id.handle')} hint={t('id.handleHint')}><HandleField value={p.handle} initial={p.initialHandle} onChange={(v) => set('handle', v)} onState={setHState} /></Field>
          <Field label={t('id.name')} hint={t('id.nameHint')}><input className="input" value={p.name} maxLength={PROFILE_LIMITS.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Block label={t('id.banner')} hint={t('id.bannerHint')}><BannerEditor value={p.banner} onChange={(v) => set('banner', v)} toast={toast} /></Block>
          <Field label={t('id.bio')}><textarea className="textarea" rows={3} maxLength={PROFILE_LIMITS.bio} value={p.bio} placeholder={t('id.bioPh')} onChange={(e) => set('bio', e.target.value)} /></Field>
          <Block label={t('id.links')} hint={t('id.linksHint')}>
            <div className="id-linked">
              {p.links.map((l, i) => (
                <div className="id-linkrow" key={i}>
                  <input className="input" value={l.label} maxLength={PROFILE_LIMITS.linkLabel} placeholder={t('id.linkLabel')} onChange={(e) => setLink(i, 'label', e.target.value)} />
                  <input className="input" value={l.url} maxLength={PROFILE_LIMITS.linkUrl} placeholder={t('id.linkUrl')} inputMode="url" autoCapitalize="none" onChange={(e) => setLink(i, 'url', e.target.value.trim())} />
                  <button type="button" className="icon-btn" aria-label={t('id.removeLink')} onClick={() => setP((x) => ({ ...x, links: x.links.filter((_, j) => j !== i) }))}><Icon name="x" size={16} /></button>
                </div>
              ))}
              {p.links.length < PROFILE_LIMITS.links && <Button size="sm" variant="outline" icon="plus" onClick={() => set('links', [...p.links, { label: '', url: 'https://' }])}>{t('id.addLink')}</Button>}
            </div>
          </Block>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button loading={busy} onClick={save} disabled={blocked || !normHandle(p.handle)}>{t('id.save')}</Button>
            {p.initialHandle && <Button variant="secondary" to={`/app/u/${p.initialHandle}`}>{t('id.viewPublic')}</Button>}
          </div>
          {!normHandle(p.handle) && <small className="muted">{t('id.noProfile')}</small>}
        </div>
        <div>
          <div className="card id-preview">
            <h2 className="set-h">{t('id.preview')}</h2>
            <ProfileHeader p={preview} />
          </div>
          <p className="muted small id-privacy"><Icon name="shield" size={14} />{t('id.publicNote')} <Link to="/app/settings">{t('settings.title')}</Link></p>
        </div>
      </div>
    </>
  );
}
