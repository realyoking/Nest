// Landing: meadow hero with a real app screenshot (Run 20) → features with real screenshots → the live demo (sample data) → FAQ → CTA.
// Motion is limited to the blur slide-up on headings.
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlanCards } from './Pricing.jsx';
import { navHref } from '../../lib/sitenav.js';
import PublicLayout from '../../components/PublicLayout.jsx';
import { BlurText } from '../../components/Reveal.jsx';
import { Button } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { AppMark } from '../../brand.jsx';
import { useAuthCta } from '../../lib/auth-cta.js';
import { isIntl } from '../../lib/langs.js';
import { HERO_IMG, SHOT_SIZES, appShot, starsSvg, BUTTERFLIES, FIREFLIES } from '../../lib/hero-art.js';
import { useLpTheme, useLpThemeScope } from '../../lib/lp-theme.js';
import { useSeason, HeroDecor } from '../../lib/season-hook.js';

const DemoApp = lazy(() => import('../../components/DemoApp.jsx'));
const FEATS = ['tutor', 'memory', 'agent', 'connections', 'parent', 'usage'];

// Run 20: the meadow hero — day sky + rolling grass / moonlit night (theme from src/lib/lp-theme.js), the headline as
// text (LCP), the auth-aware CTAs, and a REAL static screenshot of the app in a window sinking into the grass.
// Decorative layers are aria-hidden; night images are only requested once the night is shown (or the toggle is hovered).
function useNightAssets(theme) {
  const [want, setWant] = useState(theme === 'dark');
  useEffect(() => { if (theme === 'dark') setWant(true); }, [theme]);
  useEffect(() => { const f = () => setWant(true); window.addEventListener('nest:lp-night-preload', f); return () => window.removeEventListener('nest:lp-night-preload', f); }, []);
  return want;
}
// Run 21: one raster layer as <picture> (AVIF → WebP, phone crop first). Same markup as pictureHtml() in hero-art.js.
function HeroPic({ p, className, high }) {
  return (
    <picture className={className}>
      {p.sources.map((x) => <source key={x.type + (x.media || '')} media={x.media} type={x.type} srcSet={x.srcset} sizes={p.sizes} />)}
      <img src={p.src} srcSet={p.srcset} sizes={p.sizes} alt="" decoding="async" fetchpriority={high ? 'high' : undefined} />
    </picture>
  );
}
function HeroArt({ night }) {
  const stars = useMemo(() => ({ __html: starsSvg() }), []);
  return (
    <div className="hz-sky" aria-hidden="true">
      <HeroPic p={HERO_IMG.scene.day} className="hz-scene hz-d" high />
      {night && <HeroPic p={HERO_IMG.scene.night} className="hz-scene hz-n" />}
      <div className="hz-stars-w" dangerouslySetInnerHTML={stars} />
      <img className="hz-sun" src={HERO_IMG.sun} alt="" decoding="async" />
      {night ? <img className="hz-moon" src={HERO_IMG.moon} alt="" decoding="async" /> : <span className="hz-moon" />}
      <div className="hz-bfs">{BUTTERFLIES.map((b, i) => <span key={i} className={`hz-bf hz-bf${i}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, '--r': `${b.r}deg`, animationDelay: `${b.d}s` }}><i className={`bfv${b.v}`} /></span>)}</div>
      <div className="hz-ffs">{FIREFLIES.map(([x, y, d], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }} />)}</div>
    </div>
  );
}
function HeroShot({ lang, night, alt }) {
  const day = appShot(lang, 'light');
  const dark = appShot(lang, 'dark');
  const pic = (s, cls, eager) => (
    <picture className={cls}>
      <source media="(max-width: 640px)" srcSet={s.mob} />
      <img src={s.deskSrc} srcSet={s.desk} sizes={SHOT_SIZES} alt={cls === 'hz-d' ? alt : ''} width="1280" height="800" decoding="async" loading={eager ? 'eager' : 'lazy'} />
    </picture>
  );
  return (
    <figure className="hz-win" data-testid="hero-shot">
      <div className="hz-win-bar" aria-hidden="true"><i /><i /><i /></div>
      <div className="hz-win-body">
        {pic(day, 'hz-d', true)}
        {night && pic(dark, 'hz-n', true)}
      </div>
    </figure>
  );
}
function HeroGrass({ night }) {
  return (
    <div className="hz-fg" aria-hidden="true">
      <HeroPic p={HERO_IMG.grass.day} className="hz-d" />
      {night && <HeroPic p={HERO_IMG.grass.night} className="hz-n" />}
    </div>
  );
}
function Hero() {
  const { t, lang, uiLang } = useI18n();
  const s = useSession();
  const auth = useAuthCta(s.status);
  const theme = useLpTheme();
  const night = useNightAssets(theme);
  const season = useSeason();
  return (
    <section className={`hz${season ? ` hz-season-${season}` : ''}`} data-testid="hero">
      <HeroArt night={night} />
      <div className="hz-copy wrap">
        <span className="lp-eyebrow">{t('lp.eyebrow')}</span>
        <BlurText as="h1" className="lp-h1" lines={t('lp.h1')} key={uiLang} />
        <p className="lp-sub">{t('lp.sub')}</p>
        <div className={`lp-cta${auth ? '' : ' cta-wait'}`} data-auth-cta={auth || 'wait'}>
          {auth === 'in' ? <Button to="/app" size="lg" iconRight="arrowRight">{t('common.openApp')}</Button> : (
            <>
              <Button to="/auth?mode=up" size="lg" iconRight="arrowRight">{t('common.start')}</Button>
              <Button to="/auth" size="lg" variant="outline">{t('common.signIn')}</Button>
            </>
          )}
        </div>
      </div>
      <div className="hz-stage">
        <HeroShot lang={lang === 'en' || isIntl(uiLang) ? 'en' : 'zh'} night={night} alt={t('lp.heroShotAlt')} />
        <HeroGrass night={night} />
        {season && <Suspense fallback={null}><HeroDecor season={season} night={night} part="ground" /></Suspense>}
      </div>
      {season && <Suspense fallback={null}><HeroDecor season={season} night={night} /></Suspense>}
      <div className="hz-fade" aria-hidden="true" />
    </section>
  );
}

// The live, isolated demo (sample data). Run 20: moved out of the hero (the hero shows a static screenshot) to below the
// features, and only loaded when it comes near the viewport.
function Demo() {
  const { t } = useI18n();
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    if (location.hash === '#demo' || !('IntersectionObserver' in window)) { setNear(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const splash = <div className="demo-frame"><div className="demo-bar" /><div className="demo-body demo-splash"><AppMark size={40} /></div></div>;
  return (
    <section className="lp-demo" id="demo" ref={ref}>
      <div className="lp-demo-in">
        {near ? <Suspense fallback={splash}><DemoApp /></Suspense> : splash}
        <p className="lp-demo-note"><span className="pill dark">{t('lp.demoTag')}</span>{t('lp.demoNote')}</p>
      </div>
    </section>
  );
}

function Features() {
  const { t, lang, uiLang } = useI18n();
  return (
    <section className="lp-feats wrap" id="features">
      <div className="lp-sec-head">
        <span className="lp-eyebrow">{t('lp.featLabel')}</span>
        <BlurText as="h2" className="lp-h2" text={t('lp.featTitle')} key={uiLang} />
      </div>
      {FEATS.map((k, i) => {
        const [label, title, body] = t(`lp.feats.${k}`);
        return (
          <article className={`lp-feat ${i % 2 ? 'lp-alt' : ''}`} key={k} id={`f-${k}`}>
            <div className="lp-feat-text">
              <span className="lp-feat-label">{label}</span>
              <BlurText as="h3" className="lp-h3" text={title} key={uiLang + k} />
              <p>{body}</p>
              {k === 'usage' && <Link to="/pricing" className="lp-link">{t('lp.pricingLink')}<Icon name="arrowRight" size={16} /></Link>}
            </div>
            <figure className="lp-shot">
              <img src={`/shots/${k}-${lang === 'en' ? 'en' : 'zh'}.png`} alt={t('lp.shotAlt', { name: label })} loading="lazy" decoding="async" width="1023" height="720" />
            </figure>
          </article>
        );
      })}
    </section>
  );
}

// Run 11 (one landing): the static pages' "What Nest does" cards + pricing + the blog, merged into the interactive landing.
// Run 14: the public copy (seo/content.js, lazy) in the page language — added languages read their own translation.
function useSeoCopy() {
  const { lang, uiLang } = useI18n();
  const key = isIntl(uiLang) ? uiLang : lang === 'en' ? 'en' : 'zh-Hant';
  const [copy, setCopy] = useState(null);
  useEffect(() => { let live = true; import('../../../seo/content.js').then((m) => { if (live) setCopy(m.COPY[key] || m.COPY.en); }).catch(() => {}); return () => { live = false; }; }, [key]);
  return copy;
}
function Cards() {
  const { t, lang, uiLang } = useI18n();
  const copy = useSeoCopy();
  const cards = copy?.pages?.['']?.sections?.[0]?.cards;
  if (!cards) return null;
  return (
    <section className="wrap lp-block" id="what">
      <BlurText as="h2" className="lp-h2" text={t('lp.cardsTitle')} key={uiLang} />
      <div className="lp-cards">{cards.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p></article>)}</div>
    </section>
  );
}
function Plans() {
  const { t, lang, uiLang } = useI18n();
  const nav = useNavigate();
  return (
    <section className="wrap lp-block" id="pricing">
      <BlurText as="h2" className="lp-h2" text={t('lp.pricingTitle')} key={uiLang} />
      <div style={{ marginTop: 24 }}><PlanCards current={null} onChoose={() => nav('/auth?mode=up')} compact /></div>
      <p className="lp-blog muted" style={{ marginTop: 18 }}><a href={navHref(uiLang, 'pricing')}>{t('lp.pricingLink')}</a> · <a href={navHref(uiLang, 'blog')}>{t('lp.blogTitle')}</a></p>
    </section>
  );
}

function Faq() {
  const { t, lang, uiLang } = useI18n();
  const copy = useSeoCopy();
  // Added languages: the translated FAQ of the public pages (landing.faq exists only in en / zh).
  const items = isIntl(uiLang) ? (copy?.pages?.faq?.sections || []).flatMap((x) => x.faq || []).slice(0, 8).map(([q, a]) => [q, a.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')]) : t('landing.faq');
  return (
    <section className="lp-faq wrap" id="faq">
      <BlurText as="h2" className="lp-h2" text={t('landing.faqTitle')} key={lang + uiLang} />
      <div className="faq">
        {(Array.isArray(items) ? items : []).map(([q, a]) => (
          <details key={q}><summary>{q}<Icon name="plus" size={22} /></summary><p>{a}</p></details>
        ))}
      </div>
    </section>
  );
}

function Final() {
  const { t, lang, uiLang } = useI18n();
  const f = t('landing.final');
  const auth = useAuthCta(useSession().status);
  return (
    <section className="lp-final">
      <div className="wrap">
        <BlurText as="h2" className="lp-h2" lines={f.title} key={uiLang} />
        <p className="lp-sub">{f.sub}</p>
        <div className={`lp-cta${auth ? '' : ' cta-wait'}`} data-auth-cta={auth || 'wait'}>{auth === 'in'
          ? <Button to="/app" size="lg" iconRight="arrowRight">{t('common.openApp')}</Button>
          : <Button to="/auth?mode=up" size="lg" iconRight="arrowRight">{t('common.start')}</Button>}</div>
      </div>
    </section>
  );
}

export default function Landing() {
  useLpThemeScope();
  return (
    <PublicLayout hero>
      <div className="lp">
        <Hero />
        <Features />
        <Demo />
        <Cards />
        <Plans />
        <Faq />
        <Final />
      </div>
    </PublicLayout>
  );
}
