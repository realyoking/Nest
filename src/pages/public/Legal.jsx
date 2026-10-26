// Run 16: text lives in src/data/legal.js (same source as the static /privacy + /terms pages, seo/legal.js).
import PublicLayout from '../../components/PublicLayout.jsx';
import { BlurText } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { hansDict } from '../../lib/hans.js';
import { PRIVACY, TERMS, LEGAL_UPDATED } from '../../data/legal.js';

const docFor = (d, lang) => (lang === 'zh-Hans' ? hansDict(d['zh-Hant']) : d[lang] || d.en);
const UPDATED = { en: 'Last updated', 'zh-Hant': '最後更新', 'zh-Hans': '最后更新' };

// **bold** and [label](href) → React nodes (no HTML injection).
function Inline({ text }) {
  const out = []; const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g; let last = 0; let m; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++}>{m[1]}</strong>);
    else { const ext = /^https?:/.test(m[3]); out.push(<a key={i++} href={m[3]} {...(ext ? { target: '_blank', rel: 'noopener' } : {})}>{m[2]}</a>); }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function LegalPage({ data }) {
  const { lang } = useI18n();
  const own = lang === 'en' || lang === 'zh-Hant' || lang === 'zh-Hans';
  const D = docFor(data, own ? lang : 'en');
  return (
    <PublicLayout>
      <article className="legal wrap" lang={own ? undefined : 'en'}>
        <BlurText as="h1" text={D.title} key={D.title} />
        <p className="updated">{UPDATED[own ? lang : 'en']}: {LEGAL_UPDATED}</p>
        <p><Inline text={D.lead} /></p>
        {D.sections.map(([h, ps]) => (<section key={h}><h2>{h}</h2>{(Array.isArray(ps) ? ps : [ps]).map((p, i) => <p key={i}><Inline text={p} /></p>)}</section>))}
      </article>
    </PublicLayout>
  );
}
export const Terms = () => <LegalPage data={TERMS} />;
export const Privacy = () => <LegalPage data={PRIVACY} />;
