// Settings → 外觀 → App 圖示 (2026-10-18). Registry in src/lib/icons.js; saves per device + on the profile.
import { ICONS, AUTO, iconPath, saveChoice, useAppIcon } from '../lib/icons.js';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useToast } from './ui.jsx';
import Icon from './Icon.jsx';

export default function IconPicker() {
  const { t } = useI18n();
  const s = useSession();
  const toast = useToast();
  const { choice } = useAppIcon();
  const pick = (c) => {
    if (c === choice) return;
    saveChoice(c);
    s?.savePrefs?.({ appIcon: c }).catch(() => {});
    toast(t('icon.saved'));
  };
  const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);
  return (
    <div className="icp">
      <div className="set-text"><b>{t('icon.title')}</b><small>{t('icon.hint')}</small></div>
      <div className="icp-grid" role="radiogroup" aria-label={t('icon.title')}>
        <button type="button" role="radio" aria-checked={choice === AUTO} className={`icp-item ${choice === AUTO ? 'on' : ''}`} onClick={() => pick(AUTO)} title={t('icon.autoHint')}>
          <span className="icp-auto"><img src={iconPath('sky', 'icon-192.png')} alt="" /><img src={iconPath('night', 'icon-192.png')} alt="" /></span>
          <span className="icp-name">{t('icon.auto')}</span>
          {choice === AUTO && <span className="icp-check"><Icon name="check" size={12} stroke={3} /></span>}
        </button>
        {ICONS.map((i) => (
          <button key={i.id} type="button" role="radio" aria-checked={choice === i.id} className={`icp-item ${choice === i.id ? 'on' : ''}`} onClick={() => pick(i.id)}>
            <img src={iconPath(i.id, 'icon-192.png')} alt="" width={56} height={56} loading="lazy" />
            <span className="icp-name">{t(`icon.names.${i.id}`)}</span>
            {choice === i.id && <span className="icp-check"><Icon name="check" size={12} stroke={3} /></span>}
          </button>
        ))}
      </div>
      {choice === AUTO && <small className="muted icp-note">{t('icon.autoHint')}</small>}
      {isIOS && <small className="muted icp-note">{t('icon.iosNote')}</small>}
    </div>
  );
}
