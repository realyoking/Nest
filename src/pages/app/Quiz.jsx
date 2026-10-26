import { useEffect, useState } from 'react';
import { Button, Empty, PageHeader, Progress, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { BlurText, Reveal } from '../../components/Reveal.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { aiErrorText } from './Home.jsx';
import { aiPrefs } from '../../lib/prefs.js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBe } from '../../lib/be-context.jsx';
import { prompt } from '../../lib/prompts.js';

function Flash({ c }) {
  const [f, setF] = useState(false);
  return (
    <div className={`flash ${f ? 'flipped' : ''}`} onClick={() => setF(!f)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setF(!f)}>
      <div className="flash-in"><div className="flash-face">{c.front}</div><div className="flash-face back">{c.back}</div></div>
    </div>
  );
}

export default function Quiz() {
  const { be, ai } = useBe();
  const { t, lang, fmtDate } = useI18n();
  const s = useSession();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [tab, setTab] = useState('cards');
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState([]);
  useEffect(() => be.watchQuizResults(s.family.id, s.user.uid, setResults), [s.family.id]);
  // Opened from an agent action: notes arrive in router state and the quiz starts by itself.
  const loc = useLocation(); const nav = useNavigate();
  useEffect(() => {
    const st = loc.state;
    if (st?.notes) { setNotes(st.notes); nav(loc.pathname, { replace: true, state: null }); if (st.auto) generate(st.notes); }
  }, []);

  const generate = async (notesArg) => {
    setBusy(true);
    try {
      const text = (typeof notesArg === 'string' ? notesArg : notes).trim() || prompt(lang, 'quizFromPhoto');
      const content = image ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }] : text;
      const data = await ai.jsonChat({ mode: 'quiz', lang, messages: [{ role: 'user', content }], prefs: aiPrefs(s.prefs) });
      const questions = (data?.questions || []).filter((q) => q?.q && Array.isArray(q.options) && q.options.length >= 2);
      if (!questions.length) throw new Error('empty');
      setQuiz({ topic: data.topic || '', flashcards: data.flashcards || [], questions });
      setTab('cards'); setQi(0); setPicked(null); setAnswers([]);
    } catch (e) { toast(aiErrorText(e, t), 'err'); } finally { setBusy(false); }
  };
  const nextQ = async () => {
    const ans = [...answers, picked];
    setAnswers(ans); setPicked(null);
    if (qi + 1 < quiz.questions.length) { setQi(qi + 1); return; }
    setQi(quiz.questions.length);
    const score = ans.filter((a, i) => a === Number(quiz.questions[i].answer)).length;
    const weak = [...new Set(quiz.questions.filter((q, i) => ans[i] !== Number(q.answer)).map((q) => q.concept).filter(Boolean))];
    be.addQuizResult(s.family.id, { topic: quiz.topic, score, total: quiz.questions.length, weakAreas: weak }).catch(() => {});
  };
  const retake = () => { setQi(0); setPicked(null); setAnswers([]); setTab('quiz'); };

  if (!quiz) {
    return (
      <>
        <PageHeader title={t('quiz.title')} sub={t('quiz.sub')} />
        <div className="grid-2">
          <Reveal className="card stack">
            <textarea className="textarea" style={{ minHeight: 180 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('quiz.notesPh')} />
            <PhotoPicker value={image} onChange={setImage} />
            <Button size="lg" icon="sparkle" loading={busy} onClick={generate} disabled={!notes.trim() && !image}>{busy ? t('quiz.generating') : t('quiz.generate')}</Button>
          </Reveal>
          <Reveal className="card" delay={80}>
            <div className="card-head"><h2>{t('quiz.history')}</h2></div>
            {results.length ? results.slice(0, 8).map((r) => (
              <div className="list-row" key={r.id}>
                <div className="list-row-main">
                  <b>{r.topic || '—'}</b>
                  <small>{fmtDate(r.createdAt)}{r.weakAreas?.length ? ` · ${t('quiz.weak')}: ${r.weakAreas.join('、')}` : ''}</small>
                </div>
                <span className="pill dark">{r.score}{t('quiz.of')}{r.total}</span>
              </div>
            )) : <Empty icon="cards" text={t('quiz.noHistory')} />}
          </Reveal>
        </div>
      </>
    );
  }

  const total = quiz.questions.length;
  const finished = qi >= total;
  const q = quiz.questions[qi];
  const score = answers.filter((a, i) => a === Number(quiz.questions[i].answer)).length;
  const weak = [...new Set(quiz.questions.filter((qq, i) => answers[i] !== Number(qq.answer)).map((qq) => qq.concept).filter(Boolean))];

  return (
    <>
      <PageHeader title={quiz.topic || t('quiz.title')} actions={<Button variant="secondary" size="sm" icon="plus" onClick={() => setQuiz(null)}>{t('quiz.newQuiz')}</Button>} />
      <div className="segment" style={{ marginBottom: 20 }}>
        <button className={tab === 'cards' ? 'on' : ''} onClick={() => setTab('cards')}><Icon name="cards" size={16} />{t('quiz.flashcards')}</button>
        <button className={tab === 'quiz' ? 'on' : ''} onClick={() => setTab('quiz')}><Icon name="check" size={16} />{t('quiz.test')}</button>
      </div>
      {tab === 'cards' ? (
        <>
          <p className="muted small" style={{ fontWeight: 700, marginTop: 0 }}>{t('quiz.flip')}</p>
          <div className="flash-grid">{quiz.flashcards.map((c, i) => <Flash key={i} c={c} />)}</div>
          <div style={{ marginTop: 20 }}><Button iconRight="arrowRight" onClick={() => setTab('quiz')}>{t('quiz.test')}</Button></div>
        </>
      ) : finished ? (
        <Reveal className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div className="muted" style={{ fontWeight: 800 }}>{t('quiz.score')}</div>
          <div className="score-big">{score}<span style={{ color: '#c4c4c4' }}>{t('quiz.of')}{total}</span></div>
          {weak.length > 0 && <div style={{ marginTop: 22 }}><div className="muted small" style={{ fontWeight: 800, marginBottom: 10 }}>{t('quiz.weak')}</div><div className="chips" style={{ justifyContent: 'center' }}>{weak.map((w) => <span key={w} className="pill">{w}</span>)}</div></div>}
          <div className="row" style={{ justifyContent: 'center', marginTop: 28, gap: 10 }}>
            <Button variant="secondary" icon="refresh" onClick={retake}>{t('quiz.retake')}</Button>
            <Button icon="plus" onClick={() => setQuiz(null)}>{t('quiz.newQuiz')}</Button>
          </div>
        </Reveal>
      ) : (
        <div className="card q-card" key={qi}>
          <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small" style={{ fontWeight: 800 }}>{qi + 1} {t('quiz.of')} {total}</span></div>
          <div style={{ margin: '10px 0 4px' }}><Progress value={qi} max={total} /></div>
          <BlurText as="h3" text={q.q} step={18} />
          {q.options.map((o, i) => {
            const correct = Number(q.answer);
            const cls = picked === null ? '' : i === correct ? 'right' : i === picked ? 'wrong' : '';
            return <button key={i} className={`opt ${cls}`} disabled={picked !== null} onClick={() => setPicked(i)}><span className="k">{'ABCD'[i]}</span>{o}</button>;
          })}
          {picked !== null && (
            <>
              <div className="explain"><b>{picked === Number(q.answer) ? t('quiz.correct') : t('quiz.wrong')}</b>{q.explanation ? ` · ${q.explanation}` : ''}</div>
              <div style={{ marginTop: 16 }}><Button iconRight="arrowRight" onClick={nextQ}>{qi + 1 < total ? t('quiz.check') : t('quiz.finish')}</Button></div>
            </>
          )}
        </div>
      )}
    </>
  );
}
