// Run 11: ONE public nav for the landing and every public page (same keys, labels and language switch as the static
// pages in seo/build.js): 示範 · 功能 · 價格 · 常見問題 · 插件 · 更新日誌 · 網誌, one language dropdown (links to the localized
// URL) and one call to action. Sub-page links go to the pre-rendered static pages of the current language.
import { useEffect, useState } from 'react';
import { useLpTheme, setLpTheme } from '../lib/lp-theme.js';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo, BRAND } from '../brand.jsx';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { IconButton, LangSwitch, Flag } from './ui.jsx';
import { LANGS } from '../lib/langs.js';
import { useAuthCta } from '../lib/auth-cta.js';
import { SITE_NAV, FOOT_NAV, navHref, homePath, switchHref, isLocalHome } from '../lib/sitenav.js';

// Run 14: the one language dropdown (flag + native name) — options are links to the localized URL; the pick is saved.
export function LangMenu(props) {
  const loc = useLocation();
  return <LangSwitch responsive hrefFor={(id) => switchHref(loc.pathname, id)} {...props} />;
}
// Inside the mobile menu: every language as a link (2 columns), current one marked.
function LangList() {
  const { uiLang, setLang, t } = useI18n();
  const loc = useLocation();
  return (
    <div className="snav-langs" role="group" aria-label={t('lang.label')} data-noconv>
      <span className="snav-langs-h">{t('lang.label')}</span>
      <div className="snav-langs-g">
        {LANGS.map((l) => (
          <a key={l.id} href={switchHref(loc.pathname, l.id)} hrefLang={l.hreflang} lang={l.html} aria-current={uiLang === l.id ? 'true' : undefined} onClick={() => setLang(l.id)}>
            <Flag code={l.flag} size={12} /><span>{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// Run 20: sun / moon toggle for the landing's light / dark (next to the language switch). Hover / focus preloads the
// night art so the crossfade has its images.
export function ThemeToggle() {
  const { t } = useI18n();
  const theme = useLpTheme();
  const dark = theme === 'dark';
  const preload = () => window.dispatchEvent(new Event('nest:lp-night-preload'));
  return (
    <button type="button" className="theme-tg" data-testid="theme-toggle" aria-pressed={dark} aria-label={t(dark ? 'lp.themeLight' : 'lp.themeDark')} title={t(dark ? 'lp.themeLight' : 'lp.themeDark')}
      onPointerEnter={preload} onFocus={preload} onClick={() => { preload(); setLpTheme(dark ? 'light' : 'dark'); }}>
      <svg className="tg-sun" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor" /><g stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></g></svg>
      <svg className="tg-moon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" fill="currentColor" /></svg>
    </button>
  );
}

export function PublicNav({ hero = false }) {
  const { t, lang, uiLang } = useI18n();
  const s = useSession();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname, loc.hash]);
  // Run 20: over the hero the nav is transparent (white text on the sky) until the page scrolls.
  const [top, setTop] = useState(true);
  useEffect(() => {
    if (!hero) return undefined;
    const f = () => setTop(window.scrollY < 24);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, [hero]);
  const auth = useAuthCta(s.status); // Run 12: 'in' → 進入應用 (/app), 'out' → 免費開始, null → invisible placeholder (no flash)
  const onHome = isLocalHome(loc.pathname);
  const links = SITE_NAV.map((k) => [k === 'demo' && onHome ? '#demo' : navHref(uiLang, k), t(`nav.${k}`), k]);
  const cta = auth === 'in' ? <Link className="snav-cta" to="/app" data-auth-cta="in">{t('common.openApp')}</Link>
    : auth === 'out' ? <Link className="snav-cta" to="/auth?mode=up" data-auth-cta="out">{t('common.start')}</Link>
      : <span className="snav-cta cta-wait" aria-hidden="true" data-auth-cta="wait">{t('common.start')}</span>;
  return (
    <header className={`snav${hero ? ' snav-lp' : ''}${hero && top && !open ? ' snav-hero' : ''}`} data-testid="public-nav">
      <div className="snav-in">
        <a href={homePath(uiLang)} aria-label={BRAND.full} className="snav-home"><BrandLogo lang={lang} /></a>
        <nav className="snav-links" aria-label="Main">{links.map(([h, l, k]) => <a key={k} href={h}>{l}</a>)}</nav>
        <div className="snav-right">
          <LangMenu />
          {hero && <ThemeToggle />}
          {cta}
          <IconButton icon={open ? 'x' : 'menu'} label={t('nav.menu')} className="snav-mbtn" onClick={() => setOpen((o) => !o)} />
        </div>
      </div>
      {open && (
        <div className="snav-panel open" data-testid="mobile-menu">
          {links.map(([h, l, k]) => <a key={k} href={h} onClick={() => setOpen(false)}>{l}</a>)}
          {cta}
          <LangList />
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t, lang, uiLang } = useI18n();
  return (
    <footer className="footer">
      <div className="wrap footer-in">
        <BrandLogo size={22} lang={lang} />
        <span>© 2026 {BRAND.full} · {t('footer.made')}</span>
        <div className="footer-links">
          {FOOT_NAV.map((k) => <a key={k} href={navHref(uiLang, k)}>{t(`nav.${k}`)}</a>)}
          <Link to="/terms">{t('footer.terms')}</Link>
          <Link to="/privacy">{t('footer.privacy')}</Link>
        </div>
        <a className="footer-badge" href="https://nicklaunches.com/products/nest/" target="_blank" rel="noopener"><img src="https://nicklaunches.com/badges/featured.png" alt="Nest on Nick Launches" width="244" height="56" loading="lazy" decoding="async" /></a>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children, hero = false }) {
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [loc]);
  return (
    <>
      <PublicNav hero={hero} />
      <main className="route-in" key={loc.pathname}>{children}</main>
      <Footer />
    </>
  );
}
