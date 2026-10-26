// Shared plugin UI: rounded-square icon, badges, stars, permission list, and the install / approval sheet.
import { useState } from 'react';
import Icon from './Icon.jsx';
import Sheet from './Sheet.jsx';
import { Button, useToast } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { PLUGIN_STRINGS } from '../lib/plugins/strings.js';
import { pName } from '../lib/plugins/manifest.js';
import { permLabel, permDesc, riskLabel, sortByRisk, maxRisk, PERMS, HIGH_DATA, VERIFIED_ONLY } from '../lib/plugins/permissions.js';
import { usePlugins } from '../lib/plugins/runtime.jsx';

export const permText = (lang, p) => PLUGIN_STRINGS[lang === 'en' ? 'en' : 'zh-Hant'].plug.perm[p] || permLabel(p, lang);
export const nameOf = (p, lang) => (lang !== 'en' && p?.nameZh) || p?.name || '';
export const descOf = (p, lang) => (lang !== 'en' && (p?.descZh || p?.descriptionZh)) || p?.desc || p?.description || '';

export function PluginIcon({ src, name = '', size = 64, className = '' }) {
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.225) };
  if (src) return <img className={`plug-ic ${className}`} src={src} alt="" width={size} height={size} style={style} loading="lazy" />;
  return <span className={`plug-ic plug-ic-letter ${className}`} style={{ ...style, fontSize: size * 0.42 }} aria-hidden="true">{String(name || '?').trim().slice(0, 1).toUpperCase()}</span>;
}

export function SafeBadge({ small }) {
  const { t } = useI18n();
  return <span className={`plug-badge safe ${small ? 'sm' : ''}`} title={t('plug.safeLong')}><Icon name="shield" size={small ? 11 : 13} stroke={2.4} />{!small && t('plug.safe')}</span>;
}
export function VerifiedTick({ size = 14 }) {
  const { t } = useI18n();
  return (
    <svg className="plug-tick" width={size} height={size} viewBox="0 0 24 24" aria-label={t('plug.verified')} role="img">
      <path fill="currentColor" d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3 3.2.1z" />
      <path d="M8 12.3l2.6 2.6L16.2 9.3" fill="none" stroke="var(--on-ink, #fff)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
export function Stars({ value = 0, size = 13 }) {
  return (
    <span className="plug-stars" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill={value >= i - 0.25 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" opacity={value >= i - 0.75 ? 1 : 0.35} />
        </svg>
      ))}
    </span>
  );
}
export function StarPicker({ value, onChange }) {
  return (
    <span className="plug-starpick" role="radiogroup">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i}`} onClick={() => onChange(i)}>
          <svg width="30" height="30" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill={value >= i ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        </button>
      ))}
    </span>
  );
}

export function RiskBadge({ risk, small }) {
  const { lang } = useI18n();
  if (!risk) return null;
  return <span className={`plug-risk ${risk} ${small ? 'sm' : ''}`}>{riskLabel(risk, lang)}</span>;
}
const permIcon = (p) => (p.startsWith('reminders') ? 'bell' : p.startsWith('calendar') ? 'calendar' : p.startsWith('members') ? 'users' : p === 'network' || p === 'links.open' ? 'globe' : p === 'ai.use' ? 'sparkle' : p === 'location' ? 'globe' : p === 'weather.read' ? 'cloud' : 'alert');
// Capabilities + data permissions. Data permissions show a risk badge, what they allow, and the creator's reason.
// reasons: manifest.permissionReasons; domains: manifest.network.domains; denied: revoked permissions (Settings).
export function PermList({ perms: all = [], caps = [], reasons = {}, domains = [], denied = [], highlight = false }) {
  const { t, lang } = useI18n();
  // Implied permissions (look / tab / widget / storage / background) are already shown as capability rows.
  const perms = sortByRisk(all.filter((p) => !PERMS[p]?.implied));
  const top = maxRisk(perms);
  const rows = [...caps.map((c) => ({ k: `c-${c}`, icon: c === 'tab' ? 'grid' : c === 'widget' ? 'home' : c === 'automation' ? 'refresh' : 'image', text: t(`plug.capName.${c}`), data: false })),
    ...perms.map((p) => ({ k: `p-${p}`, id: p, icon: permIcon(p), text: permText(lang, p), data: true, risk: PERMS[p]?.risk, desc: permDesc(p, lang), reason: reasons?.[p] }))];
  return (
    <>
      {highlight && top === 'high' && <p className="plug-risk-sum" role="note"><Icon name="alert" size={15} stroke={2.2} />{lang === 'en' ? `${perms.filter((p) => PERMS[p]?.risk === 'high').length} high-risk permission(s) — review carefully.` : `有 ${perms.filter((p) => PERMS[p]?.risk === 'high').length} 項高風險權限，請仔細審查。`}</p>}
      <ul className="plug-perms">
        {rows.map((r) => (
          <li key={r.k} className={`${r.data ? 'data' : ''} ${r.risk ? `risk-${r.risk}` : ''} ${highlight && r.risk === 'high' ? 'hl' : ''} ${denied.includes(r.id) ? 'denied' : ''}`}>
            <Icon name={r.icon} size={17} />
            <span>
              {r.text}
              {r.data && r.desc && <small className="plug-perm-desc">{r.desc}</small>}
              {r.id === 'network' && domains.length > 0 && <small className="plug-perm-desc">{domains.join(' · ')}</small>}
              {r.reason && <small className="plug-perm-why">{lang === 'en' ? 'Why: ' : '原因：'}{r.reason}</small>}
            </span>
            {r.data && <RiskBadge risk={r.risk} small />}
          </li>
        ))}
        {!perms.length && <li className="muted"><Icon name="check" size={17} /><span>{t('plug.noPerms')}</span></li>}
      </ul>
    </>
  );
}

// Install / re-approve sheet. Safe plugins: light confirmation. Not Safe: "not verified by Nest" warning + permissions +
// an explicit acknowledgement (the server refuses the install without it).
export function InstallSheet({ plugin, open, onClose, onDone, dev = false, v, mode = 'install' }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const plug = usePlugins();
  const [ack, setAck] = useState(false);
  const [ackHigh, setAckHigh] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open || !plugin) return null;
  const safe = !!plugin.safe && !dev;
  const perms = plugin.perms || plugin.permissions || [];
  const caps = plugin.caps || plugin.capabilities || [];
  const name = nameOf(plugin, lang) || pName(plugin, lang);
  const high = perms.filter((p) => HIGH_DATA.includes(p));
  const needHigh = !safe && high.length > 0;
  const verifiedOnly = perms.filter((p) => VERIFIED_ONLY.includes(p));
  const go = async () => {
    setBusy(true);
    try {
      await plug.install(plugin.id, { granted: perms, acceptUnverified: !safe && ack, acceptHighRisk: needHigh && ackHigh, dev, v });
      toast(mode === 'approve' ? t('plug.saved') : t('plug.installed'));
      onDone?.();
      onClose();
    } catch (e) { toast(t(`plug.err.${e.code}`) !== `plug.err.${e.code}` ? t(`plug.err.${e.code}`) : `${t('common.error')} (${e.code || ''})`, 'err'); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={mode === 'approve' ? t('plug.prompt.updateTitle', { name }) : safe ? t('plug.prompt.safeTitle', { name }) : t('plug.prompt.title', { name })}
      footer={<div className="plug-sheet-foot"><Button variant="secondary" onClick={onClose}>{t('plug.prompt.cancel')}</Button><Button onClick={go} loading={busy} disabled={(!safe && !ack) || (needHigh && !ackHigh)}>{mode === 'approve' ? t('plug.prompt.approve') : safe && !perms.length ? t('plug.prompt.installSafe') : t('plug.prompt.allow')}</Button></div>}>
      <div className="plug-prompt">
        <div className="plug-prompt-top"><PluginIcon src={plugin.icon} name={name} size={56} /><div><b>{name}</b>{plugin.creator?.handle && <small>@{plugin.creator.handle}{plugin.creator.verified && <VerifiedTick size={12} />}</small>}</div></div>
        {dev && <p className="plug-dev small"><Icon name="code" size={14} />{t('plug.prompt.dev')}</p>}
        {safe ? (
          <p className="plug-safe-note"><SafeBadge small />{t('plug.prompt.safeBody')}</p>
        ) : (
          <div className="plug-warn" role="alert">
            <b><Icon name="alert" size={17} stroke={2.2} />{t('plug.prompt.unverified')}</b>
            <p>{t('plug.prompt.unverifiedBody')}</p>
          </div>
        )}
        {mode === 'approve' && <p className="muted small">{t('plug.prompt.updateBody')}</p>}
        <p className="plug-will">{t('plug.prompt.willAsk')}</p>
        <PermList highlight perms={perms} caps={caps} reasons={plugin.reasons || plugin.permissionReasons} domains={plugin.domains || plugin.network?.domains || []} />
        {verifiedOnly.length > 0 && !dev && !plugin.safe && !plugin.verified && (
          <p className="plug-dev small"><Icon name="shield" size={14} />{lang === 'en' ? 'Gmail summaries only work after Nest has checked this plugin (Safe or verified). Until then those calls are refused.' : '此插件須經 Nest 審查（安全或已認證）後才可讀取 Gmail 摘要；在此之前相關要求會被拒絕。'}</p>
        )}
        {!safe && (
          <label className="plug-ack"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /><span>{t('plug.prompt.ack')}</span></label>
        )}
        {needHigh && (
          <label className="plug-ack plug-ack-high"><input type="checkbox" checked={ackHigh} onChange={(e) => setAckHigh(e.target.checked)} />
            <span>{lang === 'en' ? `I understand this unverified plugin can ${high.map((p) => permText('en', p).toLowerCase()).join(', ')}. Nest never gives it my passwords or sign-in tokens, and I can revoke this any time in Settings.` : `我明白此未經驗證的插件可以：${high.map((p) => permText(lang, p)).join('、')}。Nest 永遠不會給它我的密碼或登入憑證，我可隨時在設定撤銷。`}</span></label>
        )}
      </div>
    </Sheet>
  );
}
