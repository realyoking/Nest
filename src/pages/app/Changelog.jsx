// /app/changelog — 最新動態 / What's new. Data: src/data/changelog.js (HKT dates, three languages).
import { useEffect } from 'react';
import { PageHeader } from '../../components/ui.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { CHANGELOG, APP_VERSION } from '../../data/changelog.js';
import { markSeen } from '../../lib/whatsnew.js';
import { zhDateStyle } from '../../lib/zhdate.js';

export function fmtDay(iso, lang) {
  const d = new Date(`${iso}T12:00:00+08:00`);
  if (lang === 'en') return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Hong_Kong', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  const s = new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
  return zhDateStyle(s);
}

export default function Changelog() {
  const { t, lang } = useI18n();
  useEffect(() => { markSeen(); }, []);
  return (
    <>
      <PageHeader title={t('changelog.title')} sub={t('changelog.sub', { v: APP_VERSION })} />
      <ol className="cl-list" data-testid="changelog">
        {CHANGELOG.map((e, i) => {
          const L = e[lang] || e['zh-Hant'];
          return (
            <Reveal as="li" key={e.version} className="card cl-entry" delay={Math.min(i, 4) * 40}>
              <div className="cl-meta"><span className="pill">{t('changelog.version', { v: e.version })}</span><time dateTime={e.date}>{fmtDay(e.date, lang)}</time>{i === 0 && <span className="cl-new">{t('changelog.latest')}</span>}</div>
              <h2 className="cl-title">{L.title}</h2>
              <ul className="cl-items">{L.items.map((x, j) => <li key={j}>{x}</li>)}</ul>
            </Reveal>
          );
        })}
      </ol>
    </>
  );
}
