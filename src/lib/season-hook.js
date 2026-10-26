// Run 22: React side of src/lib/seasons.js. The decor itself lives in a lazy chunk (components/season/SeasonDecor.jsx +
// season.css + /season/* images) that is only requested while a season is active.
import { lazy, useEffect, useState } from 'react';
import { currentSeason, SEASON_KEY } from './seasons.js';

export const EVT = 'nest:season';
export function setSeasonalEnabled(on) {
  try { localStorage.setItem(SEASON_KEY, on ? 'on' : 'off'); } catch {}
  try { window.dispatchEvent(new Event(EVT)); } catch {}
}
export function useSeason() {
  const [s, set] = useState(() => (typeof window === 'undefined' ? null : currentSeason()));
  useEffect(() => {
    const f = () => set(currentSeason());
    window.addEventListener(EVT, f);
    window.addEventListener('storage', f);
    // re-check once an hour (a tab left open across midnight on the first / last day)
    const iv = setInterval(f, 3600e3);
    return () => { window.removeEventListener(EVT, f); window.removeEventListener('storage', f); clearInterval(iv); };
  }, []);
  return s;
}
const load = () => import('../components/season/SeasonDecor.jsx');
export const HeroDecor = lazy(() => load().then((m) => ({ default: m.HeroDecor })));
export const SeasonBadge = lazy(() => load().then((m) => ({ default: m.SeasonBadge })));
export const SeasonChip = lazy(() => load().then((m) => ({ default: m.SeasonChip })));
