import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { stashPromo, PROMO_CODE } from '../lib/promo.js';

// "🎁 Beta gift: Pro free for your family until <date>" — shown to every member while the gift is unexpired.
export function GiftBanner({ style }) {
  const { t, fmtDate } = useI18n();
  const s = useSession();
  if (!s.gift) return null;
  const date = s.gift.until ? fmtDate(s.gift.until, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return (
    <div className="gift-banner" role="status" style={style}>
      <span>{s.gift.source === 'beta' ? t('promo.banner', { date }) : t('promo.bannerGrant', { date })}</span>
    </div>
  );
}

// Global: remembers ?promo=BETA from any URL as an intent to come back to /beta after sign-in / onboarding.
// It NEVER claims: the only claim is the explicit 「領取 Pro 一個月」 button on /beta (user decision 2026-10-18).
export function PromoClaimer() {
  const loc = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(loc.search).get('promo');
    if (p && p.toUpperCase() === PROMO_CODE) stashPromo(p);
  }, [loc.search]);
  return null;
}
