// "What's new" seen-state (per device, localStorage). The dot shows on the avatar / Settings / More row while the newest
// changelog version has not been opened; one toast per new version per device (never on a fresh install).
import { useEffect, useState } from 'react';
import { APP_VERSION } from '../data/changelog.js';

const KEY = 'nest.seenVersion';
const read = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
export const hasUnseen = () => { const v = read(); return !!v && v !== APP_VERSION; };
export function markSeen() {
  try { localStorage.setItem(KEY, APP_VERSION); } catch {}
  window.dispatchEvent(new Event('nest:whatsnew'));
}
// First run on this device: record the current version silently (new users are not told about "new" things).
export function initSeen() { if (!read()) { try { localStorage.setItem(KEY, APP_VERSION); } catch {} return false; } return hasUnseen(); }
export function useWhatsNew() {
  const [unseen, setUnseen] = useState(hasUnseen);
  useEffect(() => {
    const on = () => setUnseen(hasUnseen());
    window.addEventListener('nest:whatsnew', on); window.addEventListener('storage', on);
    return () => { window.removeEventListener('nest:whatsnew', on); window.removeEventListener('storage', on); };
  }, []);
  return unseen;
}
