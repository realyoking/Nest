// iOS Settings-style "More" page (mobile tab): large title, grouped inset lists, chevron rows, red sign-out row.
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { useSession } from '../../lib/session.jsx';
import { usePluginTabs } from '../../components/PluginSettings.jsx';
import { useAppConfig, PATH_FLAG } from '../../lib/appconfig.jsx';
import { hkFeatures, normRegion } from '../../lib/regions/index.js';

const GROUPS = [
  ['daily', [['transport', 'train', 'transport'], ['calendar', 'calendar', 'calendar'], ['subscriptions', 'receipt', 'subs']]],
  ['study', [['quiz', 'cards', 'quiz'], ['memory', 'brain', 'memory'], ['files', 'folder', 'files']]],
  ['family', [['family', 'users', 'family'], ['connections', 'plug', 'connections']]],
  ['account', [['usage', 'gauge', 'usage'], ['settings', 'gear', 'settings'], ['changelog', 'sparkle', 'changelog']]],
];

export default function More() {
  const { t } = useI18n();
  const { be } = useBe();
  const s = useSession();
  const ptabs = usePluginTabs();
  const ac = useAppConfig();
  const on = (p) => (!PATH_FLAG[p] || ac.flag(PATH_FLAG[p])) && (p !== 'transport' || hkFeatures(normRegion(s.profile?.region)));
  return (
    <div className="more-page">
      <h1 className="more-title">{t('more.title')}</h1>
      {GROUPS.map(([g, rows]) => (
        <section key={g} className="ios-group" aria-label={t(`more.${g}`)}>
          <h2 className="ios-group-h">{t(`more.${g}`)}</h2>
          <div className="ios-list">
            {rows.filter(([p]) => on(p)).map(([p, icon, k]) => (
              <Link key={k} to={`/app/${p}`} state={{ fromMore: true }} className="ios-row">
                <span className="ios-ic"><Icon name={icon} size={17} /></span>
                <span className="ios-label">{t(`app.nav.${k}`)}</span>
                <Icon name="chevronRight" size={16} className="ios-chev" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <section className="ios-group" aria-label={t('more.plugins')}>
        <h2 className="ios-group-h">{t('more.plugins')}</h2>
        <div className="ios-list">
          {ptabs.map((x) => (
            <Link key={x.id} to={`/app/${x.path}`} state={{ fromMore: true }} className="ios-row">
              <span className="ios-ic"><Icon name={x.icon} size={17} /></span><span className="ios-label">{x.label}</span><Icon name="chevronRight" size={16} className="ios-chev" />
            </Link>
          ))}
          {[['store', 'puzzle', 'store'], ['studio', 'code', 'studio']].map(([p, icon, k]) => (
            <Link key={k} to={`/app/${p}`} state={{ fromMore: true }} className="ios-row">
              <span className="ios-ic"><Icon name={icon} size={17} /></span><span className="ios-label">{t(`app.nav.${k}`)}</span><Icon name="chevronRight" size={16} className="ios-chev" />
            </Link>
          ))}
        </div>
      </section>
      {s.isAdmin && (
        <section className="ios-group" aria-label={t('admin.entry')}>
          <div className="ios-list">
            <Link to="/admin" className="ios-row">
              <span className="ios-ic"><Icon name="shield" size={17} /></span>
              <span className="ios-label">{t('admin.entry')}</span>
              <Icon name="chevronRight" size={16} className="ios-chev" />
            </Link>
          </div>
        </section>
      )}
      <section className="ios-group">
        <div className="ios-list">
          <button type="button" className="ios-row danger" onClick={() => be.signOut()}><span className="ios-label">{t('common.signOut')}</span></button>
        </div>
      </section>
    </div>
  );
}
