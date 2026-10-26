import { CONTACT_EMAIL } from '../contact.js';
// Native-style account menu anchored to the avatar (top-right on mobile, sidebar footer on desktop).
// iOS context-menu feel: a solid rounded panel that scales out of its anchor, grouped rows, destructive sign-out in red.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, Flag } from './ui.jsx';
import { VerifiedBadge } from './Identity.jsx';
import { useI18n, LANGS, langInfo } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { useWhatsNew } from '../lib/whatsnew.js';
import { APP_VERSION } from '../data/changelog.js';

export const HELP_URL = `mailto:${CONTACT_EMAIL}?subject=Nest%20%E5%B7%A2%20feedback`;

export default function AccountMenu({ name, email, onSignOut, placement = 'down', children, className = '' }) {
  const { t, uiLang, setLang } = useI18n();
  const nav = useNavigate();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { demo } = useBe();
  const unseen = useWhatsNew() && !demo;
  const ref = useRef(null);
  const menuRef = useRef(null);
  // The menu is portalled to <body> with fixed coordinates from the trigger, so a narrow sidebar (overflow / transforms)
  // can never clip it (iPad: the EN pill was cut off at the sidebar edge).
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!open) return undefined;
    if (demo) { setPos({}); return undefined; }
    const place = () => {
      const r = ref.current?.getBoundingClientRect(); if (!r) return;
      const vw = window.innerWidth; const vh = window.innerHeight; const w = Math.min(272, vw - 16);
      const cap = Math.round(vh * 0.72); // Run 12: compact popover — never taller than ~72% of the screen (scrolls inside)
      if (placement === 'up') setPos({ left: Math.max(8, Math.min(r.left, vw - w - 8)), bottom: Math.max(8, vh - r.top + 8), width: w, maxHeight: Math.min(cap, Math.max(200, r.top - 16)) });
      else setPos({ right: Math.max(8, vw - r.right), top: r.bottom + 8, width: w, maxHeight: Math.min(cap, Math.max(200, vh - r.bottom - 16)) });
    };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, placement, demo]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target) && !(menuRef.current && menuRef.current.contains(e.target))) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down); window.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open]);
  const go = (to) => { setOpen(false); nav(to); };
  // Run 12: ChatGPT-style compact rows — one line each; a short secondary value sits on the right (`aside`).
  const Row = ({ icon, label, sub, aside, onClick, danger, href, dot }) => {
    const inner = <><Icon name={icon} size={16} /><span className="am-label">{label}{sub && <small>{sub}</small>}</span>{aside && <span className="am-aside">{aside}</span>}{dot && <i className="wn-dot" aria-label={t('changelog.newDot')} />}</>;
    return href
      ? <a role="menuitem" className="am-row" href={href} onClick={() => setOpen(false)}>{inner}</a>
      : <button role="menuitem" type="button" className={`am-row ${danger ? 'danger' : ''}`} onClick={onClick}>{inner}</button>;
  };
  return (
    <div className={`am-wrap ${className}`} ref={ref}>
      <button type="button" className="am-trigger" aria-haspopup="menu" aria-expanded={open} aria-label={t('acct.menu')} onClick={() => setOpen((o) => !o)}>
        {children || <Avatar name={name} src={s?.myPhoto} size={32} />}
        {unseen && <i className="wn-dot wn-badge" data-testid="wn-dot" aria-hidden="true" />}
      </button>
      {open && pos && (demo ? (x) => x : (x) => createPortal(x, document.body))(
        <div ref={menuRef} className={`am-menu ${demo ? '' : 'am-fixed'} am-${placement}`} role="menu" style={demo ? undefined : pos}>
          <button type="button" className="am-head" onClick={() => go('/app/settings')}>
            <Avatar name={name} src={s?.myPhoto} size={32} />
            <span><b>{name}<VerifiedBadge size={12} on={!!s?.pubProfile?.verified} /></b>{s?.pubProfile?.handle ? <small>@{s.pubProfile.handle}</small> : email && <small>{email}</small>}</span>
          </button>
          <div className="am-group">
            <Row icon="user" label={t('acct.profile')} onClick={() => go('/app/settings')} />
            <Row icon="edit" label={t('id.editPublic')} onClick={() => go('/app/profile')} />
            <Row icon="users" label={t('acct.family')} onClick={() => go('/app/family')} />
            <Row icon="plug" label={t('acct.connections')} onClick={() => go('/app/connections')} />
            <Row icon="gauge" label={t('acct.usage')} aside={s?.planLabel ? s.planLabel(t).name : ''} onClick={() => go('/app/usage')} />
            <Row icon="gear" label={t('acct.settings')} onClick={() => go('/app/settings')} />
          </div>
          {s?.isAdmin && (
            <div className="am-group">
              <Row icon="shield" label={t('admin.entry')} onClick={() => go('/admin')} />
            </div>
          )}
          <div className="am-group">
            {/* Run 14: 12 languages → the row opens an inline list (flag + native name) inside the scrolling menu. */}
            <button type="button" className="am-row am-lang" aria-expanded={langOpen} aria-label={`${t('acct.language')}: ${langInfo(uiLang).label}`} onClick={() => setLangOpen((o) => !o)} data-testid="am-lang">
              <Icon name="globe" size={16} /><span className="am-label">{t('acct.language')}</span>
              <span className="am-aside am-lang-cur" data-noconv><Flag code={langInfo(uiLang).flag} size={11} /> {langInfo(uiLang).label}</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {langOpen && (
              <div className="am-langlist" role="group" aria-label={t('acct.language')} data-noconv>
                {LANGS.map(({ id: l, flag: c, label, html }) => (
                  <button key={l} type="button" lang={html} className={uiLang === l ? 'on' : ''} aria-pressed={uiLang === l} onClick={() => { setLang(l); setLangOpen(false); }}>
                    <Flag code={c} size={11} /><span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            <Row icon="sparkle" label={t('changelog.title')} aside={unseen ? '' : APP_VERSION} dot={unseen} onClick={() => go('/app/changelog')} />
            <Row icon="mail" label={t('acct.help')} href={HELP_URL} />
          </div>
          <div className="am-group">
            <Row icon="logout" label={t('acct.signOut')} danger onClick={() => { setOpen(false); onSignOut?.(); }} />
          </div>
        </div>,
      )}
    </div>
  );
}
