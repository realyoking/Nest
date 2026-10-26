// Run 26c: thinking mode — a small Fast / Thinking chip next to the model picker (auto → on → off), and the collapsible
// 「思考中…」 section above a reply. Thought summaries live only in memory for this session; never saved.
import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import RichText from './RichText.jsx';
import { normModel, normThink, canThink, thinkText } from '../lib/ai-models.js';

const NEXT = { auto: 'on', on: 'off', off: 'auto' };
const Bulb = ({ on }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6M10 21.5h4M12 2.5a6.5 6.5 0 0 0-3.9 11.7c.6.5.9 1.1.9 1.8v.5h6V16c0-.7.3-1.3.9-1.8A6.5 6.5 0 0 0 12 2.5Z" fill={on ? 'currentColor' : 'none'} fillOpacity={on ? 0.18 : 0} />
  </svg>
);
const Bolt = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2.5 4.5 13.5H12l-1 8 8.5-11H12l1-8Z" /></svg>
);

export function ThinkToggle({ disabled }) {
  const { uiLang: lang } = useI18n();
  const s = useSession();
  const model = normModel(s?.prefs?.aiModel);
  const cur = normThink(s?.prefs?.aiThink);
  if (!canThink(model)) return null;
  const T = thinkText(lang);
  const flip = () => { s.savePrefs({ aiThink: NEXT[cur] }).catch(() => {}); };
  return (
    <button type="button" className={`model-chip think-chip is-${cur}`} onClick={flip} disabled={disabled} aria-label={`${T.label}: ${T[cur]} · ${T.next}`} data-testid="think-chip">
      {cur === 'off' ? <Bolt /> : <Bulb on={cur === 'on'} />}
      <span>{T[cur]}</span>
    </button>
  );
}

// think = { text, start, end } (ms). Open while thinking; collapsed once the answer starts (user can expand).
export function ThinkBlock({ think, streaming }) {
  const { uiLang: lang } = useI18n();
  const T = thinkText(lang);
  const done = !!think?.end || !streaming;
  const [open, setOpen] = useState(!done);
  const [, tick] = useState(0);
  useEffect(() => { if (done) setOpen(false); }, [done]);
  useEffect(() => { if (done) return undefined; const iv = setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(iv); }, [done]);
  if (!think) return null;
  const sec = Math.max(1, Math.round((((think.end || (done ? think.start + (think.sec || 0) * 1000 : Date.now())) - think.start) / 1000)));
  const secs = think.sec && !think.start ? think.sec : sec;
  const label = done ? T.thought.replace('{s}', String(secs)) : `${T.thinking} ${secs}s`;
  const text = String(think.text || '').replace(/<\/?(thought|think)>/g, '').replace(/\*\*([^*\n]+)\*\*\s*/g, '**$1**\n\n').trim();
  return (
    <div className={`think-block${done ? ' done' : ' live'}${open ? ' open' : ''}`} data-testid="think-block">
      <button type="button" className="think-head" onClick={() => text && setOpen((o) => !o)} aria-expanded={open} disabled={!text}>
        <Bulb on={!done} /><span>{label}</span>{text ? <svg className="think-caret" width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg> : null}
      </button>
      {open && text ? <div className="think-body"><RichText text={text} streaming={!done} /></div> : null}
    </div>
  );
}
