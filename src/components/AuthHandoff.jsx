// Shown inside the Safari sheet that an iOS home-screen app opens for Google / Apple sign-in, after the sign-in finished
// there: the account is saved for the home-screen app too (same storage), so the user only has to tap Done.
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { Button } from './ui.jsx';

export default function AuthHandoff() {
  const { lang } = useI18n();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const f = () => { try { setOn(sessionStorage.getItem('nest.authHandoff') === '1'); } catch {} };
    f(); const i = setInterval(f, 1000); return () => clearInterval(i);
  }, []);
  if (!on) return null;
  const en = lang === 'en';
  const close = () => { try { sessionStorage.removeItem('nest.authHandoff'); } catch {} setOn(false); };
  return (
    <div className="handoff" role="dialog" aria-modal="true">
      <div className="handoff-card">
        <div className="handoff-tick" aria-hidden="true">✓</div>
        <h2>{en ? 'You’re signed in' : '已登入'}</h2>
        <p>{en ? 'Tap “Done” at the top left to go back to the Nest app on your Home Screen — it opens signed in.' : '請按左上角「完成」返回主畫面上的 Nest 應用程式，它會自動以你的帳戶登入。'}</p>
        <Button variant="secondary" onClick={close}>{en ? 'Keep using Nest here' : '繼續在此使用'}</Button>
      </div>
    </div>
  );
}
