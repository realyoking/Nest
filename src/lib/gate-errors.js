// Friendly messages for the server's admin-config gate (Run 8b wrap-up, 2026-10-19). Every gated endpoint
// (chat / tutor / quiz / titles / memory / plugins / promo / calendar / push / Google) answers with one of these codes
// (src/lib/admin-config.js gateCaller). The client shows a clear zh-Hant (書面語) / zh-Hans (generated) / en line instead
// of 「發生錯誤」, and reports the event once on window 'nest:gate' so AppConfigProvider can react:
//   session_revoked → sign out on this device + show the reason on the sign-in page;
//   maintenance / account_disabled / signup_closed / feature_disabled → reload the config (block screen / hidden nav).
import { FLAGS } from './admin-config.js';

export const GATE_CODES = new Set(['maintenance', 'feature_disabled', 'session_revoked', 'signup_closed', 'account_disabled']);
export const isGateError = (e) => !!e && GATE_CODES.has(String(e.code || e.error || ''));

const isEn = (t) => t('common.send') === 'Send';
// Returns the friendly line for a gate error, or null when `e` is not one.
export function gateErrorText(e, t) {
  const code = String(e?.code || e?.error || '');
  if (!GATE_CODES.has(code)) return null;
  if (code === 'maintenance') {
    const m = String(e.gateMessage || (e.message && e.message !== code ? e.message : '')).trim();
    return m ? `${t('acfg.gate.maintenance')} ${m}` : t('acfg.gate.maintenance');
  }
  if (code === 'feature_disabled') {
    const f = FLAGS[e.feature];
    return f ? t('acfg.gate.featureNamed', { name: isEn(t) ? f.en : f.zh }) : t('acfg.gate.feature_disabled');
  }
  return t(`acfg.gate.${code}`);
}

// Fire once per code per 5 s (several parallel calls can fail together).
const last = {};
export function reportGate(e) {
  const code = String(e?.code || e?.error || '');
  if (!GATE_CODES.has(code) || typeof window === 'undefined') return;
  const now = Date.now();
  if (last[code] && now - last[code] < 5000) return;
  last[code] = now;
  try { window.dispatchEvent(new CustomEvent('nest:gate', { detail: { code, feature: e.feature || null, message: e.gateMessage || (typeof e.message === 'string' && e.message !== code ? e.message : '') } })); } catch {}
}

// Message shown on the sign-in page after a forced sign-out (session_revoked). Device-only, read once.
export const SIGNED_OUT_KEY = 'nest.signedOutWhy';
export function takeSignedOutReason() {
  try { const v = sessionStorage.getItem(SIGNED_OUT_KEY); if (v) sessionStorage.removeItem(SIGNED_OUT_KEY); return v || ''; } catch { return ''; }
}
