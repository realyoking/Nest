// 檔案 — Run 24 step 2b: two tabs. 全家檔案 (family drive: folders, in-app documents, uploads; components/drive/) and
// 對話中的檔案 (Run 23b: photos, documents and lists from the member's own AI 助理 chats, read from what each chat
// message already keeps — thumbnails + extracted text since Run 12, ```nest-cards``` lists since Run 23a).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DriveView from '../../components/drive/DriveView.jsx';
import { Button, Empty, PageHeader } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import Sheet from '../../components/Sheet.jsx';
import { Reveal } from '../../components/Reveal.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import { useSession } from '../../lib/session.jsx';
import { useBe } from '../../lib/be-context.jsx';
import { collectFiles, filterFiles, FILE_KINDS } from '../../lib/files.js';
import { fmtSize } from '../../lib/attach-core.js';

const MAX_CONVS = 40;

export default function Files() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'chat' ? 'chat' : 'drive';
  return (
    <div className="fl-page" data-testid="files-page">
      <PageHeader title={t('r23.files.title')} sub={t('r23.files.sub')} actions={<Button icon="camera" variant="outline" to="/app/files/scan" data-testid="files-scan">{t('r24.scan.open')}</Button>} />
      <div className="segment fl-main-tabs" role="tablist">
        {['drive', 'chat'].map((k) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setSp(k === 'chat' ? { tab: 'chat' } : {})} data-testid={`files-tab-${k}`}>{t(k === 'drive' ? 'r24.drive.tabDrive' : 'r24.drive.tabChat')}</button>)}
      </div>
      {tab === 'drive' ? <DriveView /> : <ChatFiles />}
    </div>
  );
}

function ChatFiles() {
  const { be } = useBe();
  const { t, fmtDate } = useI18n();
  const s = useSession();
  const [convs, setConvs] = useState(null);
  const [byConv, setByConv] = useState({});
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  useEffect(() => be.watchConversations(s.family.id, s.user.uid, setConvs), [s.family.id, s.user.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const ids = (convs || []).slice(0, MAX_CONVS).map((c) => c.id).join(',');
  useEffect(() => {
    if (convs === null) return undefined;
    let live = true;
    const list = convs.slice(0, MAX_CONVS);
    setLoading(true);
    Promise.all(list.map((c) => (byConv[c.id] ? Promise.resolve([c.id, byConv[c.id]]) : be.listMessages(s.family.id, c.id).then((m) => [c.id, m]).catch(() => [c.id, []]))))
      .then((rows) => { if (live) setByConv(Object.fromEntries(rows)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => collectFiles((convs || []).slice(0, MAX_CONVS), byConv), [convs, byConv]);
  const items = filterFiles(all, kind, q);
  const count = (k) => (k === 'all' ? all.length : all.filter((x) => x.kind === k).length);

  return (
    <div className="fl-chat" data-testid="files-chat">
      <div className="fl-bar">
        <div className="segment fl-tabs" role="tablist">
          {['all', ...FILE_KINDS].map((k) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{t(`r23.files.${k}`)}<span className="fl-n">{count(k)}</span></button>)}
        </div>
        <label className="fl-search"><Icon name="search" size={17} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('r23.files.search')} aria-label={t('r23.files.search')} /></label>
      </div>
      {loading && !all.length ? <p className="muted small fl-loading">{t('r23.files.loading')}</p> : items.length ? (
        <Reveal className="fl-grid">
          {items.map((x) => (
            <button type="button" className={`fl-item fl-${x.kind}`} key={x.id} onClick={() => setOpen(x)} data-testid="file-item">
              <span className="fl-thumb">
                {x.thumb ? <img src={x.thumb} alt="" loading="lazy" /> : <Icon name={x.kind === 'list' ? 'check' : x.kind === 'image' ? 'image' : 'file'} size={26} />}
                {x.video && <span className="fl-badge"><Icon name="play" size={12} /></span>}
              </span>
              <span className="fl-meta">
                <b>{x.name || t(`r23.files.${x.kind}`)}</b>
                <small>{[x.kind === 'list' ? t('r23.files.items', { n: x.items.length }) : x.size ? fmtSize(x.size) : '', x.words ? t('r24.chatdoc.words', { n: x.words.toLocaleString('en') }) : '', x.at ? fmtDate(new Date(x.at), { month: 'short', day: 'numeric' }) : ''].filter(Boolean).join(' · ')}</small>
              </span>
            </button>
          ))}
        </Reveal>
      ) : <Empty icon="folder" text={t('r23.files.empty')} />}
      <p className="muted small fl-note"><Icon name="lock" size={12} />{t('r23.files.note')}</p>
      {open && (
        <Sheet open onClose={() => setOpen(null)} title={open.name || t(`r23.files.${open.kind}`)} footer={<div className="sheet-actions"><Button variant="outline" icon="chat" to={`/app/agent/${open.cid}`}>{t('r23.files.open')}</Button></div>}>
          <div className="fl-detail">
            {open.thumb && <img className="fl-big" src={open.thumb} alt={open.name} />}
            {open.kind === 'list' && <><small className="hp-label">{t(`r23.files.${open.list === 'schedule' ? 'schedule' : 'checklist'}`)}</small><ul className="fl-lines">{open.items.map((it, i) => <li key={i}>{it}</li>)}</ul></>}
            {open.kind === 'file' && open.words > 0 && (
              <small className="muted fl-words" data-testid="file-words">{[open.pages ? t('r24.chatdoc.pages', { n: open.pages }) : '', t('r24.chatdoc.words', { n: open.words.toLocaleString('en') }), open.pagesRead ? t('r24.chatdoc.pagesCut', { n: open.pagesRead }) : ''].filter(Boolean).join(' · ')}</small>
            )}
            {open.kind === 'file' && open.words > 0 && <small className="muted" data-testid="file-ai-read">{open.sentWords && open.sentWords < open.words ? t('r24.chatdoc.aiUsed', { used: open.sentWords.toLocaleString('en'), total: open.words.toLocaleString('en') }) : t('r24.chatdoc.aiRead')}</small>}
            {open.partial && <small className="muted">{t('r24.chatdoc.partial')}</small>}
            {open.text && <><small className="hp-label">{t('r24.chatdoc.fullText')}</small><div className="fl-text full" data-testid="file-full-text">{open.text}</div></>}
            <small className="muted">{[open.chat, open.at ? fmtDate(new Date(open.at)) : ''].filter(Boolean).join(' · ')}</small>
          </div>
        </Sheet>
      )}
    </div>
  );
}
