// Run 22: seasonal decor (lazy chunk — only loaded while a season is active, see src/lib/season-hook.js).
// Hero: overlay layers on the Run 21 raster day/night scene (light + dark via <html data-lpt>). App: a small monochrome
// badge next to the logo and a greeting chip on Today. All decorative layers are aria-hidden; motion is transform /
// opacity only and stops under prefers-reduced-motion (season.css).
import './season.css';
import { useI18n } from '../../lib/i18n.jsx';
import { seasonText } from '../../lib/seasons.js';

// deterministic pseudo-random (same layout on every render / device)
const rnd = (i, k = 1) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };

const BAT = 'M32 9c-1.6 0-2.7 1.6-3.2 3.1L27.2 10l-.8 3.5C22 11 15 8.6 7.6 10.2c3 1.4 4.6 3.9 4.6 6.6C8.7 15.7 4.8 16.8 1.6 19.4c5.1 0 8.7 1.2 11.2 3.6 1.5-2.1 4-3.1 6.6-2.6 2.6.5 4.6 2.6 6.1 5.2C27 24 29.1 23 32 23s5 1 6.5 2.6c1.5-2.6 3.5-4.7 6.1-5.2 2.6-.5 5.1.5 6.6 2.6 2.5-2.4 6.1-3.6 11.2-3.6-3.2-2.6-7.1-3.7-10.6-2.6 0-2.7 1.6-5.2 4.6-6.6C49 8.6 42 11 37.6 13.5l-.8-3.5-1.6 2.1C34.7 10.6 33.6 9 32 9z';
const BATS = [
  { x: 16, y: 22, s: 54, d: 0, t: 11 }, { x: 27, y: 12, s: 34, d: -3, t: 13 }, { x: 70, y: 26, s: 44, d: -6, t: 12 },
  { x: 80, y: 41, s: 30, d: -1.5, t: 10 }, { x: 9, y: 40, s: 28, d: -8, t: 14 },
];

function Pumpkins({ night }) {
  const pic = (v, cls) => (
    <picture className={cls}>
      <source type="image/avif" srcSet={`/season/pumpkins-${v}-240.avif 240w, /season/pumpkins-${v}-480.avif 480w`} sizes="(max-width: 640px) 140px, 240px" />
      <img src={`/season/pumpkins-${v}-480.webp`} srcSet={`/season/pumpkins-${v}-240.webp 240w, /season/pumpkins-${v}-480.webp 480w`} sizes="(max-width: 640px) 140px, 240px" alt="" decoding="async" width="480" height="260" />
    </picture>
  );
  return (
    <div className="sz-pumpkins" data-testid="season-pumpkins">
      {pic('day', 'sz-d')}
      {night && pic('night', 'sz-n')}
    </div>
  );
}
function Bats() {
  return (
    <div className="sz-bats">
      {BATS.map((b, i) => (
        <span key={i} className={`sz-bat sz-bat${i}`} style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, animationDelay: `${b.d}s`, animationDuration: `${b.t}s` }}>
          <svg viewBox="0 0 64 32" style={{ animationDelay: `${b.d / 7}s` }}><path d={BAT} /></svg>
        </span>
      ))}
    </div>
  );
}
function Fall({ n, kind }) {
  return (
    <div className={`sz-fall sz-${kind}`}>
      {Array.from({ length: n }, (_, i) => {
        const size = kind === 'snow' ? 4 + Math.round(rnd(i, 2) * 6) : 7 + Math.round(rnd(i, 2) * 5);
        return <span key={i} style={{ left: `${(rnd(i) * 100).toFixed(2)}%`, animationDuration: `${(9 + rnd(i, 3) * 9).toFixed(1)}s`, animationDelay: `${(-rnd(i, 4) * 18).toFixed(1)}s`, '--sway': `${Math.round((rnd(i, 5) - 0.5) * 60)}px`, '--y': `${Math.round(rnd(i, 7) * 92)}%` }}><i style={{ width: size, height: size, opacity: (0.55 + rnd(i, 6) * 0.45).toFixed(2) }} /></span>;
      })}
    </div>
  );
}
function RedLantern({ side }) {
  return (
    <span className={`sz-rl sz-rl-${side}`}>
      <svg viewBox="0 0 80 150">
        <defs>
          <radialGradient id={`rlg-${side}`} cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#ff5a45" /><stop offset=".65" stopColor="#d81e1e" /><stop offset="1" stopColor="#8f0d12" /></radialGradient>
        </defs>
        <line x1="40" y1="0" x2="40" y2="26" stroke="#7a1b14" strokeWidth="2" />
        <rect x="27" y="24" width="26" height="9" rx="2" fill="#e8b93c" />
        <ellipse cx="40" cy="70" rx="36" ry="40" fill={`url(#rlg-${side})`} />
        <path d="M40 30v80M22 34c-9 22-9 50 0 72M58 34c9 22 9 50 0 72" stroke="#a3121a" strokeWidth="1.6" fill="none" opacity=".55" />
        <rect x="27" y="106" width="26" height="9" rx="2" fill="#e8b93c" />
        <path d="M33 115v28M37 115v32M40 115v34M43 115v32M47 115v28" stroke="#e23a2c" strokeWidth="1.8" />
      </svg>
    </span>
  );
}
function PaperLanterns() {
  const L = [{ x: 9, y: 34, s: 56, d: 0 }, { x: 20, y: 54, s: 36, d: -4 }, { x: 80, y: 40, s: 48, d: -2 }, { x: 90, y: 60, s: 32, d: -6 }];
  return (
    <div className="sz-pls">
      {L.map((l, i) => (
        <span key={i} className={`sz-pl sz-pl${i}`} style={{ left: `${l.x}%`, top: `${l.y}%`, width: l.s, animationDelay: `${l.d}s` }}>
          <svg viewBox="0 0 40 52">
            <defs><radialGradient id={`plg${i}`} cx="50%" cy="55%" r="60%"><stop offset="0" stopColor="#fff2b0" /><stop offset=".55" stopColor="#ffb340" /><stop offset="1" stopColor="#e2701c" /></radialGradient></defs>
            <rect x="14" y="2" width="12" height="5" rx="1.5" fill="#6b3b12" />
            <ellipse cx="20" cy="26" rx="18" ry="19" fill={`url(#plg${i})`} />
            <path d="M20 7v38M8 12c-5 9-5 19 0 28M32 12c5 9 5 19 0 28" stroke="#c45a14" strokeWidth="1" fill="none" opacity=".45" />
            <rect x="14" y="44" width="12" height="4" rx="1.5" fill="#6b3b12" />
          </svg>
        </span>
      ))}
    </div>
  );
}

// Hero overlay. `night` = night assets may be requested (same flag the Run 20/21 hero uses).
// part 'sky' = layers over the scene (behind the headline); part 'ground' = things standing in the grass next to the
// app window (rendered inside .hz-stage so they sit in front of the grass, near the window, in the first screen).
export function HeroDecor({ season, night, part = 'sky' }) {
  if (!season) return null;
  if (part === 'ground') {
    if (season !== 'halloween') return null;
    return <div className="sz-ground" aria-hidden="true"><Pumpkins night={night} /></div>;
  }
  return (
    <div className={`sz sz-${season}`} aria-hidden="true" data-testid="season-decor" data-season={season}>
      {season === 'halloween' && <Bats />}
      {season === 'christmas' && <Fall n={44} kind="snow" />}
      {season === 'lunarNewYear' && <><RedLantern side="l" /><RedLantern side="r" /><Fall n={16} kind="petal" /></>}
      {season === 'midAutumn' && <PaperLanterns />}
    </div>
  );
}

// Monochrome line icons (currentColor) for the app's B&W chrome.
export function SeasonIcon({ season, size = 18 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (season === 'halloween') return <svg {...p}><path d="M12 6.5c-.2-1.6.4-2.8 1.8-3.5" /><path d="M12 6.5c-4.8 0-8 2.9-8 6.8S7.2 20 12 20s8-2.8 8-6.7-3.2-6.8-8-6.8z" /><path d="M8.6 11.2l1.3 1.3-1.3.4zM15.4 11.2l-1.3 1.3 1.3.4zM8.5 15.4c2.2 1.4 4.8 1.4 7 0" /></svg>;
  if (season === 'christmas') return <svg {...p}><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" /><path d="M9.6 3.8L12 6.2l2.4-2.4M9.6 20.2L12 17.8l2.4 2.4M3.2 10.6l3.3.9-.9-3.3M20.8 13.4l-3.3-.9.9 3.3M3.2 13.4l3.3-.9-.9 3.3M20.8 10.6l-3.3.9.9-3.3" /></svg>;
  if (season === 'lunarNewYear') return <svg {...p}><path d="M12 2v2.5M9 4.5h6M9 19h6M12 19v3" /><ellipse cx="12" cy="11.8" rx="7" ry="7.3" /><path d="M12 4.5v14.6M8 6.2c-1.8 3.6-1.8 7.6 0 11.2M16 6.2c1.8 3.6 1.8 7.6 0 11.2" /></svg>;
  if (season === 'midAutumn') return <svg {...p}><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" /><path d="M16.5 3.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></svg>;
  return null;
}
export function SeasonBadge({ season }) {
  const { uiLang } = useI18n();
  if (!season) return null;
  const label = seasonText(season, uiLang);
  return <span className="sz-badge" title={label} data-testid="season-badge"><SeasonIcon season={season} size={17} /><span className="sr-only">{label}</span></span>;
}
export function SeasonChip({ season }) {
  const { uiLang } = useI18n();
  if (!season) return null;
  return <span className={`sz-chip sz-chip-${season}`} data-testid="season-chip"><SeasonIcon season={season} size={16} />{seasonText(season, uiLang)}</span>;
}
