// ONE place for the app's name and symbol. To rebrand, edit this file
// (plus index.html <title>/meta, public/favicon.svg, public/manifest.webmanifest,
// and re-run scripts/render-icons.mjs for apple-touch-icon/og images).
export const BRAND = {
  nameZh: '巢',
  nameEn: 'Nest',
  full: 'Nest 巢',
  domain: 'nesty.cyou',
  url: 'https://nesty.cyou',
};

// Feature switches for sign-in providers.
// Apple: disabled — live test on 2026-10-17 returned auth/operation-not-allowed (no Services ID / key configured).
export const AUTH_PROVIDERS = { google: true, apple: false, email: true };

// Symbol: an egg resting in a soft, rounded nest.
export const MARK_PATHS = [
  'M32 8c-7.6 0-12.5 9.6-12.5 17.6C19.5 33 25 38 32 38s12.5-5 12.5-12.4C44.5 17.6 39.6 8 32 8z',
  'M7 34.5c0-1.4 1.1-2.5 2.5-2.5 2.6 0 4.3 2 6 4.6C18.6 41.3 24 44 32 44s13.4-2.7 16.5-7.4c1.7-2.6 3.4-4.6 6-4.6 1.4 0 2.5 1.1 2.5 2.5C57 47 46 56 32 56S7 47 7 34.5z',
];

// Icon artwork version: bump with the PWA icons (scripts/render-icons.mjs) so installed apps refetch.
export const ICON_V = 4;
export const APP_ICON = `/apple-touch-icon.png?v=${ICON_V}`;

export function BrandMark({ size = 28, color = 'currentColor', title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill={color} role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      {MARK_PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

// Large in-UI mark: the flat original (no glass, gradients or colour). Black on light; WHITE in the dark app theme,
// inside any `.on-dark` / `.auth-side` container, via the CSS var --mark (see styles.css).
export function AppMark({ size = 56, title }) {
  return (
    <svg className="app-mark" width={size} height={size} viewBox="0 0 64 64" role={title ? 'img' : undefined} aria-hidden={title ? undefined : 'true'}>
      {title && <title>{title}</title>}
      {MARK_PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

// `tile` = the user's chosen app icon (src/lib/icons.js) instead of the flat glyph — used inside the signed-in app.
export function BrandLogo({ size = 26, lang, tile }) {
  return (
    <span className="brand-logo">
      {tile ? <img className="brand-tile" src={tile} alt="" width={size + 4} height={size + 4} /> : <BrandMark size={size} />}
      <span className="brand-word">{BRAND.nameEn}{lang !== 'en' && <em>{BRAND.nameZh}</em>}</span>
    </span>
  );
}
