// "加到主畫面" guide. iOS (not yet standalone): step-by-step Share → 加至主畫面 sheet, with why it matters for
// notifications. Android / desktop: the browser's own install prompt (beforeinstallprompt), else manual steps.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBe } from '../lib/be-context.jsx';
import { APP_ICON } from '../brand.jsx';
import Icon from './Icon.jsx';
import { Button, Modal } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { canPromptInstall, onInstallAvailable, platform, promptInstall } from '../lib/push.js';

export function useInstallState() {
  const [can, setCan] = useState(canPromptInstall());
  useEffect(() => onInstallAvailable(setCan), []);
  const pf = platform();
  return { pf, canPrompt: can, installed: !!pf.standalone, showable: !pf.standalone && (pf.ios || can) };
}

function IosMock({ step }) {
  const { t } = useI18n();
  if (step === 0) return (
    <div className="ig-mock" aria-hidden="true">
      <div className="ig-bar">
        <Icon name="chevronRight" size={18} className="ig-flip" /><Icon name="chevronRight" size={18} />
        <span className="ig-hit"><Icon name="share" size={20} /></span>
        <Icon name="book" size={18} /><Icon name="copy" size={18} />
      </div>
    </div>
  );
  if (step === 1) return (
    <div className="ig-mock" aria-hidden="true">
      <div className="ig-sheet">
        <div className="ig-sheet-row"><span>{t('common.copy')}</span><Icon name="copy" size={17} /></div>
        <div className="ig-sheet-row ig-hit-row"><span>{t('install.addLabel')}</span><Icon name="plusSquare" size={17} /></div>
      </div>
    </div>
  );
  if (step === 2) return (
    <div className="ig-mock" aria-hidden="true">
      <div className="ig-add">
        <span className="ig-icon"><img className="app-icon-img" src={APP_ICON} alt="" /></span>
        <b>Nest</b>
        <span className="ig-hit-text">{t('install.addBtn')}</span>
      </div>
    </div>
  );
  return (
    <div className="ig-mock" aria-hidden="true">
      <div className="ig-home">
        {[0, 1, 2].map((i) => <span key={i} className="ig-app" />)}
        <span className="ig-app ig-nest"><img className="app-icon-img" src={APP_ICON} alt="" /></span>
      </div>
    </div>
  );
}

export function InstallGuideBody({ onDone }) {
  const { t } = useI18n();
  const { pf, canPrompt, installed } = useInstallState();
  if (installed) return <p className="ig-p"><Icon name="check" size={18} /> {t('install.installed')}</p>;
  if (pf.ios) {
    const steps = t('install.iosSteps');
    return (
      <div className="ig">
        <div className="ig-why"><Icon name="bell" size={18} /><span>{pf.iosVersion && pf.iosVersion < 1604 ? t('install.iosOld') : t('install.iosWhy')}</span></div>
        {!pf.iosSafari && <p className="muted small ig-note">{t('install.iosOther')}</p>}
        <ol className="ig-steps">
          {steps.map((txt, i) => (
            <li key={i}>
              <span className="ig-num">{i + 1}</span>
              <div className="ig-step-main"><p>{txt}</p><IosMock step={i} /></div>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className="ig">
      <div className="ig-app-card"><span className="ig-icon lg"><img className="app-icon-img" src={APP_ICON} alt="" /></span><div><b>Nest 巢</b><small>{t('install.rowHint')}</small></div></div>
      <p className="ig-p muted">{canPrompt ? t('install.androidBody') : t('install.manual')}</p>
      {canPrompt && <Button icon="download" onClick={async () => { await promptInstall(); onDone?.(); }}>{t('install.installBtn')}</Button>}
    </div>
  );
}

// Portalled to <body>: .route-in's transform animation would otherwise make the fixed overlay relative to the page
// content (the landing demo keeps it in its frame on purpose).
export default function InstallGuide({ open, onClose }) {
  const { t } = useI18n();
  const { demo } = useBe();
  if (!open) return null;
  const m = (
    <Modal open={open} onClose={onClose} title={t('install.title')}>
      <InstallGuideBody onDone={onClose} />
    </Modal>
  );
  return demo ? m : createPortal(m, document.body);
}

// Slim, dismissible prompt shown inside the app (once dismissed, hidden for 14 days).
export function InstallBanner() {
  const { t } = useI18n();
  const { pf, canPrompt, showable } = useInstallState();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(() => { try { return Date.now() - (+localStorage.getItem('nest.installDismissed') || 0) < 14 * 864e5; } catch { return true; } });
  if (!showable || hidden) return null;
  const dismiss = () => { try { localStorage.setItem('nest.installDismissed', String(Date.now())); } catch {} setHidden(true); };
  return (
    <>
      <div className="install-banner" role="region" aria-label={t('install.title')}>
        <span className="ig-icon"><img className="app-icon-img" src={APP_ICON} alt="" /></span>
        <span className="install-banner-text">{pf.ios ? t('install.banner') : t('install.bannerInstall')}</span>
        <Button size="sm" onClick={() => (pf.ios || !canPrompt ? setOpen(true) : promptInstall())}>{pf.ios ? t('install.open') : t('install.installBtn')}</Button>
        <button className="install-banner-x" onClick={dismiss} aria-label={t('install.later')}><Icon name="x" size={16} /></button>
      </div>
      <InstallGuide open={open} onClose={() => setOpen(false)} />
    </>
  );
}
