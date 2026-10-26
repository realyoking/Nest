import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { BrandLogo } from '../../brand.jsx';
import { BlurText } from '../../components/Reveal.jsx';
import { Button, Field, LangSwitch, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import * as be from '../../lib/backend.js';
import { profileView } from '../../lib/plugins/api.js';
import { Avatar } from '../../components/ui.jsx';
import { VerifiedBadge } from '../../components/Identity.jsx';

export default function Join() {
  const { token } = useParams();
  const { t, lang } = useI18n();
  const s = useSession();
  const nav = useNavigate();
  const [inv, setInv] = useState(undefined);
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token || !s.user) return;
    be.getInvite(token).then((i) => setInv(i || null)).catch(() => setInv(null));
  }, [token, s.user?.uid]);
  // Inviter's PUBLIC profile only (name / photo / @handle / verified) — shown when they have one.
  const [by, setBy] = useState(null);
  useEffect(() => { if (s.user && inv?.createdBy) profileView({ uid: inv.createdBy }).then((d) => setBy(d.profile)).catch(() => setBy(null)); }, [inv?.createdBy, s.user?.uid]);
  useEffect(() => { if (s.user && !name) setName(s.profile?.displayName || s.user.displayName || ''); }, [s.user, s.profile]);

  if (!token) return <Navigate to="/onboarding" replace />;
  if (s.status === 'out') return <Navigate to={`/auth?mode=up&next=/join/${token}`} replace />;

  const already = inv && s.family?.id === inv.familyId;
  const other = inv && s.family && s.family.id !== inv.familyId;
  const accept = async () => {
    setBusy(true); setErr('');
    try {
      if (other) await be.exitFamily(s.family);
      await be.joinFamily(inv, { displayName: name.trim() || 'Member', role });
      await be.saveProfile(s.user.uid, { onboarded: true });
      nav('/app', { replace: true });
    } catch (e) {
      setErr(e.code === 'owner_with_members' ? t('join.otherFamily') : e.code === 'permission-denied' ? t('onboarding.full') : t('common.error'));
    } finally { setBusy(false); }
  };

  return (
    <div className="ob">
      <div className="ob-top"><Link to="/"><BrandLogo lang={lang} /></Link><LangSwitch /></div>
      <div className="ob-body route-in">
        {inv === undefined ? <div className="splash" style={{ minHeight: 300 }}><Spinner /></div> : !inv ? (
          <>
            <BlurText as="h1" text={t('join.invalid')} />
            <div className="ob-actions"><Button to="/onboarding">{t('common.back')}</Button></div>
          </>
        ) : (
          <>
            <div className="ob-step">{t('join.invitedTo')}</div>
            <BlurText as="h1" text={inv.familyName} />
            {by && <p className="join-by"><Avatar name={by.name || by.handle} src={by.photo} size={26} /><span>{t('id.invitedBy')} <b>{by.name || `@${by.handle}`}</b><VerifiedBadge size={14} on={by.verified} />{by.handle && by.name ? <small> @{by.handle}</small> : null}</span></p>}
            {already ? (
              <>
                <p>{t('join.already')}</p>
                <div className="ob-actions"><Button to="/app">{t('common.openApp')}</Button></div>
              </>
            ) : (
              <div className="stack" style={{ marginTop: 24 }}>
                {other && <div className="notice">{t('join.otherFamily')}</div>}
                <Field label={t('onboarding.displayName')}><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('onboarding.displayNamePh')} /></Field>
                <div className="roles">
                  {['student', 'parent'].map((r) => (
                    <button key={r} className={`choice ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>
                      <span className="choice-icon"><Icon name={r === 'student' ? 'book' : 'user'} /></span><b>{t(`common.${r}`)}</b>
                    </button>
                  ))}
                </div>
                {err && <div className="error-text">{err}</div>}
                <Button size="lg" loading={busy} onClick={accept} disabled={!name.trim()}>{t('join.accept')}</Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
