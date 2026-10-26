// Run 20: light / dark for the public landing ONLY (the signed-in app keeps its own <html data-theme>).
// Source of truth: <html data-lpt="light|dark">, set before paint by LP_THEME_HEAD_SCRIPT on the home pages and by
// useLpThemeScope() on the React landing. Default = system prefers-color-scheme; a tap on the toggle is saved.
import { useEffect, useSyncExternalStore } from 'react';
import { LP_THEME_KEY } from './hero-art.js';

const subs = new Set();
const emit = () => subs.forEach((f) => f());
const sysDark = () => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } };
export function savedLpTheme() { try { const v = localStorage.getItem(LP_THEME_KEY); return v === 'dark' || v === 'light' ? v : null; } catch { return null; } }
export const initialLpTheme = () => savedLpTheme() || (sysDark() ? 'dark' : 'light');
export const reducedMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const read = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-lpt') === 'dark' ? 'dark' : 'light');

let animTimer = 0;
// Set the landing theme. animate=false (or reduced motion) swaps instantly; otherwise <html class="lpt-anim"> enables the
// sunset / moonrise transitions in styles.css for ANIM_MS.
export const ANIM_MS = 2000;
export function setLpTheme(t, { save = true, animate = true } = {}) {
  const root = document.documentElement;
  if (save) { try { localStorage.setItem(LP_THEME_KEY, t); } catch {} }
  if (animate && !reducedMotion()) {
    clearTimeout(animTimer);
    root.classList.add('lpt-anim');
    animTimer = setTimeout(() => root.classList.remove('lpt-anim'), ANIM_MS);
  } else root.classList.remove('lpt-anim');
  root.setAttribute('data-lpt', t);
  emit();
}
export function useLpTheme() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read, () => 'light');
}
// Mounted by the landing: applies the theme on <html>, follows the system while nothing is saved, clears on leave.
export function useLpThemeScope() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.hasAttribute('data-lpt')) root.setAttribute('data-lpt', initialLpTheme());
    emit();
    let mq; const onSys = () => { if (!savedLpTheme()) setLpTheme(mq.matches ? 'dark' : 'light', { save: false, animate: false }); };
    try { mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener?.('change', onSys); } catch {}
    return () => { mq?.removeEventListener?.('change', onSys); root.removeAttribute('data-lpt'); root.classList.remove('lpt-anim'); emit(); };
  }, []);
}
