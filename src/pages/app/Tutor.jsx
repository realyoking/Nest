import { VisualRetry } from '../../components/RichText.jsx';
import { useEffect, useRef, useState } from 'react';
import { Button, PageHeader, useToast } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import PhotoPicker from '../../components/PhotoPicker.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { Message, useAutosize } from './Agent.jsx';
import { aiErrorText } from './Home.jsx';
import { aiPrefs } from '../../lib/prefs.js';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { prompt } from '../../lib/prompts.js';

export default function Tutor() {
  const { ai } = useBe();
  const s = useSession();
  const { t, lang } = useI18n();
  const toast = useToast();
  const [image, setImage] = useState(null);
  const [question, setQuestion] = useState('');
  const [thread, setThread] = useState([]); // {role, content (api), display, image}
  const [streaming, setStreaming] = useState(null);
  const [reply, setReply] = useState('');
  const ta = useRef(null); const end = useRef(null);
  useAutosize(ta, reply);
  useEffect(() => {
    const el = end.current; if (!el || (!thread.length && streaming === null)) return;
    // Scroll the nearest scrolling container (the embedded demo has its own); fall back to the page.
    let p = el.parentElement;
    while (p && p !== document.body) { const o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) break; p = p.parentElement; }
    if (p && p !== document.body) p.scrollTo({ top: p.scrollHeight, behavior: 'smooth' }); else el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.length, streaming]);

  const ask = async (userMsg, display) => {
    const next = [...thread, { ...userMsg, display }];
    setThread(next); setStreaming('');
    try {
      const msgs = next.map((m) => ({ role: m.role, content: m.content }));
      const full = await ai.streamChat({ mode: 'tutor', lang, messages: msgs, prefs: aiPrefs(s.prefs), onDelta: setStreaming });
      setThread((l) => [...l, { role: 'assistant', content: full }]);
    } catch (e) { toast(aiErrorText(e, t), 'err'); setThread(thread); } finally { setStreaming(null); }
  };
  const start = () => {
    const text = question.trim() || prompt(lang, 'tutorHelp');
    const content = image ? [{ type: 'text', text }, { type: 'image_url', image_url: { url: image } }] : text;
    ask({ role: 'user', content, image }, question.trim() || (image ? '' : text));
  };
  const follow = (text, display) => ask({ role: 'user', content: text }, display ?? text);
  const reset = () => { setThread([]); setImage(null); setQuestion(''); setReply(''); };
  const view = streaming !== null ? [...thread, { role: 'assistant', content: streaming, streaming: true }] : thread;

  return (
    <>
      <PageHeader title={t('tutor.title')} sub={t('tutor.sub')} actions={thread.length > 0 && <Button variant="secondary" size="sm" icon="plus" onClick={reset}>{t('tutor.newQ')}</Button>} />
      {thread.length === 0 ? (
        <Reveal className="card stack">
          <PhotoPicker value={image} onChange={setImage} />
          <textarea className="textarea" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('tutor.typePh')} />
          <Button size="lg" icon="lightbulb" onClick={start} disabled={!image && !question.trim()}>{t('tutor.start')}</Button>
        </Reveal>
      ) : (
        <div className="card">
          <VisualRetry.Provider value={streaming === null ? () => follow(lang === 'en' ? 'Please draw that diagram again.' : lang === 'zh-Hans' ? '请重新画这个图。' : '請重新畫這個圖。') : null}>
          {view.map((m, i) => <Message key={i} m={{ ...m, id: 't' + i, content: m.role === 'user' ? (Array.isArray(m.content) ? '' : m.content) : m.content }} />)}
          </VisualRetry.Provider>
          <div ref={end} />
          {streaming === null && (
            <>
              <div className="tutor-tools">
                <Button size="sm" variant="outline" icon="lightbulb" onClick={() => follow(t('tutor.hintMsg'), t('tutor.nextHint'))}>{t('tutor.nextHint')}</Button>
                <Button size="sm" variant="outline" icon="eye" onClick={() => follow(t('tutor.revealMsg'), t('tutor.reveal'))}>{t('tutor.reveal')}</Button>
                <Button size="sm" variant="outline" icon="shuffle" onClick={() => follow(t('tutor.similarMsg'), t('tutor.similar'))}>{t('tutor.similar')}</Button>
              </div>
              <form className="composer" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) { follow(reply.trim()); setReply(''); } }}>
                <textarea ref={ta} rows={1} value={reply} placeholder={t('tutor.replyPh')} onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (reply.trim()) { follow(reply.trim()); setReply(''); } } }} />
                <button className="send-btn" disabled={!reply.trim()} aria-label={t('common.send')}><Icon name="arrowUp" size={20} stroke={2.25} /></button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
