// Admin → 網誌 (Run 12): list + editor for blog posts in EN / 繁 / 简. Markdown editor with a toolbar and a live preview
// (same renderer + sanitizer as the public page), cover upload with crop (1200×630 = og:image), inline images with alt +
// caption, YouTube / Vimeo / Loom embeds (allowlisted), full-page preview (server-rendered, noindex), publish / unpublish /
// schedule (HKT) / delete. Every call goes to /api/app/blog-admin, which re-checks the admin allowlist (403 otherwise).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Field, Modal, Spinner, useToast } from '../../components/ui.jsx';
import { useI18n } from '../../lib/i18n.jsx';
import * as be from '../../lib/backend.js';
import { toHans } from '../../lib/hans.js';
import { BLOG_LANGS, LANG_SEG, LIMITS, renderMarkdown, slugProblem, slugify, embedSrc, statusOf } from '../../lib/blog-core.js';
import { loadImage, cropCover, coverRect, processInline, COVER_W, COVER_H } from '../../lib/blog-img.js';
import { toLocalInput, fromLocalInput } from './adminApi.js';
import { BLOG_ORIGIN } from '../../site.js';

const LL = { en: 'EN', 'zh-Hant': '繁', 'zh-Hans': '简' };
// zh-Hant = HK 書面語; zh-Hans generated with toHans.
const T = {
  'zh-Hant': {
    title: '網誌', new: '新文章', none: '尚未有文章。', edit: '編輯', view: '查看', back: '返回列表', save: '儲存草稿', saved: '已儲存', preview: '預覽',
    publish: '立即發佈', unpublish: '取消發佈', schedule: '排程發佈', scheduleAt: '發佈時間（香港時間）', del: '刪除', delQ: '刪除這篇文章？', delBody: '文章及其內容會被永久刪除，公開網址亦會失效。此操作無法復原。',
    status: { draft: '草稿', scheduled: '已排程', published: '已發佈' }, updated: '更新於', langs: '語言', store: '儲存空間',
    f: { title: '標題', slug: '網址代號', slugHint: '只可使用小寫英文字母、數字及連字號，同一語言內不可重複。', slugAuto: '由標題產生', excerpt: '摘要', seoTitle: 'SEO 標題', seoDesc: 'SEO 描述', coverAlt: '封面替代文字（無障礙及搜尋引擎）', body: '內容（Markdown）' },
    cover: '封面圖片', coverHint: '1200×630，同時用作社交分享圖片。', upload: '上載圖片', change: '更換', remove: '移除', crop: '裁剪封面', zoom: '縮放', posX: '水平位置', posY: '垂直位置', useCrop: '使用此封面',
    tb: { h2: '標題', h3: '小標題', b: '粗體', i: '斜體', link: '連結', ul: '項目', ol: '編號', quote: '引述', img: '圖片', video: '影片' },
    img: { title: '插入圖片', alt: '替代文字（必填）', caption: '圖片說明（選填）', insert: '插入' },
    video: { title: '嵌入影片', url: 'YouTube、Vimeo 或 Loom 連結', insert: '嵌入', bad: '只支援 YouTube、Vimeo 及 Loom 的連結。', note: '影片上載已停用：Nest 沒有檔案儲存空間（只有 Firestore，每份文件上限 1 MiB），影片請先上載至 YouTube、Vimeo 或 Loom 再嵌入。嵌入影片不會自動播放。' },
    livePreview: '即時預覽', previewTitle: '預覽（只有你看到，不會被搜尋引擎收錄）', phone: '手機', desktop: '電腦', needLang: '請先填寫此語言的標題及網址代號。',
    err: { title_empty: '請填寫標題', slug_empty: '請填寫網址代號', slug_short: '網址代號最少 3 個字元', slug_long: '網址代號太長', slug_chars: '網址代號只可使用小寫英文字母、數字及連字號', slug_reserved: '這個網址代號已被保留', slug_taken: '這個網址代號已被另一篇文章使用', bad_embed: '影片連結不在允許名單內', empty: '請最少填寫一種語言', incomplete: '最少一種語言需要標題、網址代號及內容才可發佈', bad_time: '發佈時間必須在將來（一年內）', media_missing: '找不到圖片，請重新上載', image_too_large: '圖片太大', bad_image_type: '只接受 PNG、JPEG 或 WebP 圖片', image_mismatch: '圖片格式不符', store_full: '儲存空間已滿', forbidden: '只有管理員可以使用', generic: '操作失敗' },
    unsaved: '有未儲存的變更', publicUrl: '公開網址', coverage: '已填寫',
  },
  en: {
    title: 'Blog', new: 'New post', none: 'No posts yet.', edit: 'Edit', view: 'View', back: 'Back to list', save: 'Save draft', saved: 'Saved', preview: 'Preview',
    publish: 'Publish now', unpublish: 'Unpublish', schedule: 'Schedule', scheduleAt: 'Publish at (Hong Kong time)', del: 'Delete', delQ: 'Delete this post?', delBody: 'The post and its content are deleted permanently and its public URL stops working. This cannot be undone.',
    status: { draft: 'Draft', scheduled: 'Scheduled', published: 'Published' }, updated: 'Updated', langs: 'Languages', store: 'Storage',
    f: { title: 'Title', slug: 'Slug', slugHint: 'Lowercase letters, digits and hyphens; unique within the language.', slugAuto: 'From title', excerpt: 'Excerpt', seoTitle: 'SEO title', seoDesc: 'SEO description', coverAlt: 'Cover alt text (accessibility + search)', body: 'Body (Markdown)' },
    cover: 'Cover image', coverHint: '1200×630, also used as the social share image.', upload: 'Upload image', change: 'Change', remove: 'Remove', crop: 'Crop cover', zoom: 'Zoom', posX: 'Horizontal', posY: 'Vertical', useCrop: 'Use this cover',
    tb: { h2: 'Heading', h3: 'Subheading', b: 'Bold', i: 'Italic', link: 'Link', ul: 'List', ol: 'Numbered', quote: 'Quote', img: 'Image', video: 'Video' },
    img: { title: 'Insert image', alt: 'Alt text (required)', caption: 'Caption (optional)', insert: 'Insert' },
    video: { title: 'Embed video', url: 'YouTube, Vimeo or Loom link', insert: 'Embed', bad: 'Only YouTube, Vimeo and Loom links are supported.', note: 'Video upload is disabled: Nest has no file storage (Firestore only, 1 MiB per document). Upload videos to YouTube, Vimeo or Loom and embed them. Embeds never autoplay.' },
    livePreview: 'Live preview', previewTitle: 'Preview (only you can see this; not indexed)', phone: 'Phone', desktop: 'Desktop', needLang: 'Add a title and slug for this language first.',
    err: { title_empty: 'Add a title', slug_empty: 'Add a slug', slug_short: 'Slug needs at least 3 characters', slug_long: 'Slug is too long', slug_chars: 'Use lowercase letters, digits and hyphens only', slug_reserved: 'This slug is reserved', slug_taken: 'Another post already uses this slug', bad_embed: 'This video link is not on the allowlist', empty: 'Fill in at least one language', incomplete: 'At least one language needs a title, slug and body before publishing', bad_time: 'Pick a time in the future (within a year)', media_missing: 'Image not found — upload it again', image_too_large: 'Image is too large', bad_image_type: 'PNG, JPEG or WebP only', image_mismatch: 'Image type does not match', store_full: 'Storage is full', forbidden: 'Admins only', generic: 'Something went wrong' },
    unsaved: 'Unsaved changes', publicUrl: 'Public URL', coverage: 'Filled',
  },
};
const hansOf = (o) => (typeof o === 'string' ? toHans(o) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hansOf(v)])));
let HANS = null;
const useT = () => { const { lang } = useI18n(); if (lang === 'zh-Hans') { HANS ||= hansOf(T['zh-Hant']); return HANS; } return T[lang === 'en' ? 'en' : 'zh-Hant']; };

async function api(method, body, query = '') {
  const token = await be.getIdToken();
  const r = await fetch(`/api/app/blog-admin${query}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'generic'), { status: r.status, code: d.error || 'generic', lang: d.lang });
  return d;
}
const fmt = (ms, lang) => (ms ? new Date(ms).toLocaleString(lang === 'en' ? 'en-HK' : 'zh-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }) : '—');
const blankPost = () => ({ id: null, cover: null, langs: {}, status: 'draft', publishAt: null });

export default function AdminBlog() {
  const L = useT(); const { lang } = useI18n(); const toast = useToast();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const load = async () => { try { setData(await api('GET')); } catch (e) { toast(L.err[e.code] || L.err.generic, 'err'); setData({ posts: [] }); } };
  useEffect(() => { load(); }, []);
  if (editing) return <Editor id={editing === 'new' ? null : editing} onClose={() => { setEditing(null); load(); }} />;
  return (
    <div className="card" data-testid="adm-blog">
      <div className="card-head"><h2>{L.title}</h2><Button size="sm" icon="plus" onClick={() => setEditing('new')} data-testid="blog-new">{L.new}</Button></div>
      {!data ? <Spinner /> : !data.posts.length ? <p className="muted">{L.none}</p> : (
        <div className="adm-ann-list blog-list">
          {data.posts.map((p) => {
            const st = p.status; const main = p.langs['zh-Hant'] || p.langs.en || Object.values(p.langs)[0] || {};
            const pubLang = BLOG_LANGS.find((l) => p.langs[l]?.has) || 'en';
            return (
              <div key={p.id} className="adm-ann-row" data-testid="blog-row">
                <div className="adm-ann-main">
                  <b>{main.title || p.id}</b>
                  <small>
                    <span className="blog-cov">{BLOG_LANGS.map((l) => <i key={l} className={p.langs[l]?.has ? 'on' : p.langs[l] ? 'half' : ''} title={l}>{LL[l]}</i>)}</span>
                    {' · '}{st === 'scheduled' ? `${L.status.scheduled} ${fmt(p.publishAt, lang)}` : st === 'published' ? fmt(p.publishAt, lang) : `${L.updated} ${fmt(p.updatedAt, lang)}`}
                  </small>
                </div>
                <span className={`pill ${st === 'published' ? 'ok' : st === 'scheduled' ? 'warn' : ''}`}>{L.status[st]}</span>
                <div className="adm-actions wrap">
                  <Button size="sm" variant="secondary" onClick={() => setEditing(p.id)}>{L.edit}</Button>
                  {st === 'published' && <Button size="sm" variant="outline" href={`${BLOG_ORIGIN}/${LANG_SEG[pubLang]}/${p.langs[pubLang].slug}`} target="_blank" rel="noopener">{L.view}</Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data?.store && (
        <p className="muted small blog-store">{L.store}: {data.store.posts} · {data.store.media} img · {data.store.shards.map((s) => `#${s.s} ${Math.round(s.bytes / 1024)}/${Math.round(s.cap / 1024)} KB`).join(' · ') || '0 KB'}</p>
      )}
      <p className="muted small">{L.video.note}</p>
    </div>
  );
}

function Editor({ id, onClose }) {
  const L = useT(); const { lang: uiLang } = useI18n(); const toast = useToast();
  const [post, setPost] = useState(id ? null : blankPost());
  const [bodies, setBodies] = useState({ en: '', 'zh-Hant': '', 'zh-Hans': '' });
  const [media, setMedia] = useState({});
  const [cur, setCur] = useState(uiLang === 'en' ? 'en' : uiLang);
  const [busy, setBusy] = useState('');
  const [dirty, setDirty] = useState(false);
  const [errs, setErrs] = useState({});
  const [cropFile, setCropFile] = useState(null);
  const [imgModal, setImgModal] = useState(null);
  const [vidModal, setVidModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [pvW, setPvW] = useState(390);
  const [del, setDel] = useState(false);
  const [when, setWhen] = useState('');
  const ta = useRef(null);
  const coverIn = useRef(null); // real <button> → input.click(): works with automation, keyboard and iOS Safari
  const imgIn = useRef(null);
  useEffect(() => {
    if (!id) return;
    api('GET', null, `?id=${encodeURIComponent(id)}`).then((d) => { setPost({ ...d.post, status: d.post.status }); setBodies({ en: '', 'zh-Hant': '', 'zh-Hans': '', ...d.bodies }); setMedia(d.media || {}); setWhen(toLocalInput(d.post.publishAt && d.post.publishAt > Date.now() ? d.post.publishAt : Date.now() + 3600e3)); })
      .catch((e) => { toast(L.err[e.code] || L.err.generic, 'err'); onClose(); });
  }, [id]);
  useEffect(() => { if (!id) setWhen(toLocalInput(Date.now() + 3600e3)); }, []);
  const x = post?.langs?.[cur] || {};
  const setX = (k, v) => { setDirty(true); setPost((p) => ({ ...p, langs: { ...p.langs, [cur]: { ...p.langs[cur], [k]: v } } })); };
  const setBody = (v) => { setDirty(true); setBodies((b) => ({ ...b, [cur]: v })); };
  const live = useMemo(() => renderMarkdown(bodies[cur] || '', { media }), [bodies, cur, media]);
  const slugErr = x.slug ? slugProblem(x.slug) : '';
  const payload = () => ({ post: { cover: post.cover, langs: post.langs }, bodies });
  const fail = (e) => { setErrs(e.lang ? { [e.lang]: e.code } : {}); if (e.lang) setCur(e.lang); toast(L.err[e.code] || `${L.err.generic} (${e.code})`, 'err'); };
  const save = async () => {
    setBusy('save');
    try { const d = await api('POST', { op: 'save', id: post.id, ...payload() }); setPost((p) => ({ ...p, id: d.id, status: d.post.status, publishAt: d.post.publishAt })); setDirty(false); setErrs({}); toast(L.saved); return d.id; } catch (e) { fail(e); return null; } finally { setBusy(''); }
  };
  const act = async (op, extra = {}) => {
    const pid = dirty || !post.id ? await save() : post.id; if (!pid) return;
    setBusy(op);
    try {
      const d = await api('POST', { op, id: pid, ...extra });
      if (op === 'delete') { toast(L.saved); onClose(); return; }
      setPost((p) => ({ ...p, status: d.post.status === 'draft' ? 'draft' : 'published', publishAt: d.post.publishAt })); toast(L.status[d.post.status]);
    } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const preview = async () => {
    if (!x.title || !x.slug) { toast(L.needLang, 'err'); return; }
    setBusy('preview');
    try { const d = await api('POST', { op: 'preview', lang: cur, status: post.status, publishAt: post.publishAt, ...payload() }); setPreviewHtml(d.html); } catch (e) { fail(e); } finally { setBusy(''); }
  };
  // toolbar: wrap / prefix the selection in the textarea
  const edit = (fn) => { const el = ta.current; if (!el) return; const a = el.selectionStart; const b = el.selectionEnd; const v = bodies[cur] || ''; const { text, sel = [a, a] } = fn(v.slice(a, b), v, a, b); const next = v.slice(0, a) + text + v.slice(b); setBody(next); requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + sel[0], a + sel[1]); }); };
  const wrap = (l, r = l, ph = '') => edit((s) => { const t = s || ph; return { text: l + t + r, sel: [l.length, l.length + t.length] }; });
  const linePrefix = (pre) => edit((s, v, a) => { const atStart = a === 0 || v[a - 1] === '\n'; const lines = (s || '').split('\n').map((ln, i) => (typeof pre === 'function' ? pre(i) : pre) + ln); const t = (atStart ? '' : '\n') + lines.join('\n'); return { text: t, sel: [t.length, t.length] }; });
  const insertBlock = (block) => edit((s, v, a) => { const pre = a === 0 || v[a - 1] === '\n' ? (a === 0 || v[a - 2] === '\n' ? '' : '\n') : '\n\n'; const t = `${pre}${block}\n\n`; return { text: t, sel: [t.length, t.length] }; });
  const upload = async (dataUrl, w, h, kind) => {
    const d = await api('POST', { op: 'upload', image: dataUrl, w, h, kind });
    setMedia((m) => ({ ...m, [d.id]: { w: d.w, h: d.h, mime: d.mime } })); return d.id;
  };
  if (!post) return <div className="card"><Spinner /></div>;
  const st = post.id ? statusOf(post) : 'draft';
  const covered = (l) => post.langs[l]?.title && post.langs[l]?.slug && (bodies[l] || '').trim();
  return (
    <div className="card blog-editor" data-testid="blog-editor">
      <div className="blog-ed-top">
        <Button size="sm" variant="ghost" icon="arrowLeft" onClick={() => { if (!dirty || window.confirm(L.unsaved)) onClose(); }}>{L.back}</Button>
        <span className={`pill ${st === 'published' ? 'ok' : st === 'scheduled' ? 'warn' : ''}`} data-testid="blog-status">{L.status[st]}{st === 'scheduled' ? ` · ${fmt(post.publishAt, uiLang)}` : ''}</span>
        {dirty && <span className="muted small">{L.unsaved}</span>}
      </div>
      <div className="blog-langtabs" role="tablist">
        {BLOG_LANGS.map((l) => <button key={l} role="tab" aria-selected={cur === l} className={`${cur === l ? 'on' : ''} ${errs[l] ? 'err' : ''}`} onClick={() => setCur(l)}>{LL[l]}<i className={covered(l) ? 'dot on' : post.langs[l] ? 'dot half' : 'dot'} /></button>)}
      </div>
      <div className="blog-fields">
        <Field label={L.f.title}><input className="input" value={x.title || ''} maxLength={LIMITS.title} onChange={(e) => setX('title', e.target.value)} data-testid="blog-title" /></Field>
        <Field label={L.f.slug} hint={slugErr ? L.err[slugErr] : L.f.slugHint}>
          <div className="blog-slug"><span className="muted small">/{LANG_SEG[cur]}/blog/</span><input className={`input ${slugErr ? 'bad' : ''}`} value={x.slug || ''} maxLength={LIMITS.slug} onChange={(e) => setX('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} data-testid="blog-slug" />
            <Button size="sm" variant="secondary" onClick={() => setX('slug', slugify(x.title || post.langs.en?.title || '') || x.slug || '')}>{L.f.slugAuto}</Button></div>
        </Field>
        <Field label={`${L.f.excerpt} (${(x.excerpt || '').length}/${LIMITS.excerpt})`}><textarea className="input" rows={2} maxLength={LIMITS.excerpt} value={x.excerpt || ''} onChange={(e) => setX('excerpt', e.target.value)} /></Field>
        <div className="blog-2col">
          <Field label={`${L.f.seoTitle} (${(x.seoTitle || '').length}/${LIMITS.seoTitle})`}><input className="input" maxLength={LIMITS.seoTitle} value={x.seoTitle || ''} onChange={(e) => setX('seoTitle', e.target.value)} placeholder={x.title ? `${x.title} | Nest` : ''} /></Field>
          <Field label={`${L.f.seoDesc} (${(x.seoDesc || '').length}/${LIMITS.seoDesc})`}><input className="input" maxLength={LIMITS.seoDesc} value={x.seoDesc || ''} onChange={(e) => setX('seoDesc', e.target.value)} placeholder={x.excerpt || ''} /></Field>
        </div>
      </div>
      <div className="blog-cover">
        <div className="blog-cover-l"><b>{L.cover}</b><small className="muted">{L.coverHint}</small></div>
        {post.cover ? <img src={`/blog-media/${post.cover}`} alt={x.coverAlt || ''} width={COVER_W} height={COVER_H} /> : <div className="blog-cover-ph" aria-hidden="true">1200 × 630</div>}
        <div className="adm-actions wrap" style={{ marginTop: 0 }}>
          <Button type="button" size="sm" variant="secondary" onClick={() => coverIn.current?.click()} data-testid="blog-cover-upload">{post.cover ? L.change : L.upload}</Button>
          <input ref={coverIn} id="blog-cover-file" className="file-offscreen" type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-label={L.upload} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCropFile(f); }} data-testid="blog-cover-file" />
          {post.cover && <Button size="sm" variant="ghost" onClick={() => { setDirty(true); setPost((p) => ({ ...p, cover: null })); }}>{L.remove}</Button>}
        </div>
        {post.cover && <Field label={L.f.coverAlt}><input className="input" maxLength={LIMITS.alt} value={x.coverAlt || ''} onChange={(e) => setX('coverAlt', e.target.value)} /></Field>}
      </div>
      <div className="blog-tb" role="toolbar" aria-label={L.f.body}>
        <button type="button" onClick={() => linePrefix('## ')}>{L.tb.h2}</button>
        <button type="button" onClick={() => linePrefix('### ')}>{L.tb.h3}</button>
        <button type="button" onClick={() => wrap('**', '**', L.tb.b)}><b>B</b></button>
        <button type="button" onClick={() => wrap('*', '*', L.tb.i)}><i>I</i></button>
        <button type="button" onClick={() => edit((s) => { const t = `[${s || L.tb.link}](https://)`; return { text: t, sel: [t.length - 9, t.length - 1] }; })}>{L.tb.link}</button>
        <button type="button" onClick={() => linePrefix('- ')}>{L.tb.ul}</button>
        <button type="button" onClick={() => linePrefix((i) => `${i + 1}. `)}>{L.tb.ol}</button>
        <button type="button" onClick={() => linePrefix('> ')}>{L.tb.quote}</button>
        <button type="button" onClick={() => imgIn.current?.click()} data-testid="blog-img-upload">{L.tb.img}</button>
          <input ref={imgIn} className="file-offscreen" type="file" accept="image/png,image/jpeg,image/webp" tabIndex={-1} aria-label={L.tb.img} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImgModal({ file: f, alt: '', caption: '' }); }} data-testid="blog-img-file" />
        <button type="button" onClick={() => setVidModal({ url: '' })}>{L.tb.video}</button>
      </div>
      <div className="blog-split">
        <Field label={`${L.f.body} · ${(bodies[cur] || '').length}/${LIMITS.body}`}><textarea ref={ta} className="input blog-md" value={bodies[cur] || ''} maxLength={LIMITS.body} onChange={(e) => setBody(e.target.value)} spellCheck data-testid="blog-body" /></Field>
        <div className="blog-live"><div className="blog-live-h">{L.livePreview}</div><div className="post-body" data-testid="blog-live" dangerouslySetInnerHTML={{ __html: live }} /></div>
      </div>
      <div className="blog-actions">
        <Button variant="secondary" loading={busy === 'save'} onClick={save} data-testid="blog-save">{L.save}</Button>
        <Button variant="outline" loading={busy === 'preview'} onClick={preview} data-testid="blog-preview">{L.preview}</Button>
        {st !== 'published' && <Button loading={busy === 'publish'} onClick={() => act('publish')} data-testid="blog-publish">{L.publish}</Button>}
        {st !== 'draft' && <Button variant="secondary" loading={busy === 'unpublish'} onClick={() => act('unpublish')} data-testid="blog-unpublish">{L.unpublish}</Button>}
        <span className="blog-sched"><input type="datetime-local" className="input" value={when} onChange={(e) => setWhen(e.target.value)} aria-label={L.scheduleAt} /><Button variant="outline" loading={busy === 'schedule'} onClick={() => act('schedule', { at: fromLocalInput(when) })}>{L.schedule}</Button></span>
        {post.id && <Button variant="danger" onClick={() => setDel(true)} data-testid="blog-delete">{L.del}</Button>}
      </div>
      {st === 'published' && post.langs[cur]?.slug && <p className="small muted">{L.publicUrl}: <a href={`${BLOG_ORIGIN}/${LANG_SEG[cur]}/${post.langs[cur].slug}`} target="_blank" rel="noopener">blog.nesty.cyou/{LANG_SEG[cur]}/{post.langs[cur].slug}</a></p>}

      {cropFile && <CropModal file={cropFile} L={L} onClose={() => setCropFile(null)} onDone={async (r) => { try { const mid = await upload(r.img, r.w, r.h, 'cover'); setDirty(true); setPost((p) => ({ ...p, cover: mid })); setCropFile(null); } catch (e) { fail(e); } }} />}
      <Modal open={!!imgModal} onClose={() => setImgModal(null)} title={L.img.title}>
        {imgModal && <div className="blog-modal">
          <Field label={L.img.alt}><input className="input" maxLength={LIMITS.alt} value={imgModal.alt} onChange={(e) => setImgModal((m) => ({ ...m, alt: e.target.value }))} data-testid="blog-img-alt" /></Field>
          <Field label={L.img.caption}><input className="input" maxLength={LIMITS.caption} value={imgModal.caption} onChange={(e) => setImgModal((m) => ({ ...m, caption: e.target.value }))} /></Field>
          <div className="adm-actions"><Button variant="secondary" onClick={() => setImgModal(null)}>✕</Button>
            <Button disabled={!imgModal.alt.trim()} loading={busy === 'img'} onClick={async () => { setBusy('img'); try { const r = await processInline(imgModal.file); const mid = await upload(r.img, r.w, r.h, 'inline'); const alt = imgModal.alt.replace(/[[\]\n]/g, ' ').trim(); const cap = imgModal.caption.replace(/["\n]/g, ' ').trim(); insertBlock(`![${alt}](media:${mid}${cap ? ` "${cap}"` : ''})`); setImgModal(null); } catch (e) { fail(e.code ? e : { code: e.message === 'bad_type' ? 'bad_image_type' : e.message === 'too_large' ? 'image_too_large' : 'generic' }); } finally { setBusy(''); } }} data-testid="blog-img-insert">{L.img.insert}</Button></div>
        </div>}
      </Modal>
      <Modal open={!!vidModal} onClose={() => setVidModal(false)} title={L.video.title}>
        {vidModal && <div className="blog-modal">
          <Field label={L.video.url} hint={vidModal.url && !embedSrc(vidModal.url) ? L.video.bad : ''}><input className="input" type="url" value={vidModal.url} onChange={(e) => setVidModal({ url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" data-testid="blog-video-url" /></Field>
          <p className="muted small">{L.video.note}</p>
          <div className="adm-actions"><Button variant="secondary" onClick={() => setVidModal(false)}>✕</Button><Button disabled={!embedSrc(vidModal.url)} onClick={() => { insertBlock(`@[video](${vidModal.url.trim()})`); setVidModal(false); }}>{L.video.insert}</Button></div>
        </div>}
      </Modal>
      <Modal open={!!previewHtml} onClose={() => setPreviewHtml('')} title={L.previewTitle}>
        <div className="blog-pv-bar"><button className={pvW === 390 ? 'on' : ''} onClick={() => setPvW(390)}>{L.phone}</button><button className={pvW === 1024 ? 'on' : ''} onClick={() => setPvW(1024)}>{L.desktop}</button></div>
        <div className="blog-pv-wrap"><iframe title={L.preview} sandbox="" srcDoc={previewHtml} style={{ width: pvW }} data-testid="blog-preview-frame" /></div>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title={L.delQ}>
        <p style={{ fontWeight: 600 }}>{L.delBody}</p>
        <div className="adm-actions"><Button variant="secondary" onClick={() => setDel(false)}>✕</Button><Button variant="danger" loading={busy === 'delete'} onClick={() => act('delete')} data-testid="blog-delete-confirm">{L.del}</Button></div>
      </Modal>
    </div>
  );
}

function CropModal({ file, L, onClose, onDone }) {
  const [img, setImg] = useState(null); const [url, setUrl] = useState('');
  const [crop, setCrop] = useState({ zoom: 1, x: 0.5, y: 0.5 }); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  useEffect(() => { let u = ''; loadImage(file).then((im) => { setImg(im); u = im.src; setUrl(im.src); }).catch((e) => setErr(e.message === 'bad_type' ? L.err.bad_image_type : L.err.image_too_large)); return () => {}; }, [file]);
  const r = img ? coverRect(img.naturalWidth, img.naturalHeight, crop) : null;
  // Preview: the crop rectangle shown with CSS background (same math as the canvas crop).
  const style = r ? { backgroundImage: `url(${url})`, backgroundSize: `${(img.naturalWidth / r.sw) * 100}% auto`, backgroundPosition: `${r.sw >= img.naturalWidth ? 50 : (r.sx / (img.naturalWidth - r.sw)) * 100}% ${r.sh >= img.naturalHeight ? 50 : (r.sy / (img.naturalHeight - r.sh)) * 100}%` } : {};
  return (
    <Modal open onClose={onClose} title={L.crop}>
      <div className="blog-modal">
        {err ? <p className="error-text">{err}</p> : !img ? <Spinner /> : <>
          <div className="blog-crop" style={style} role="img" aria-label={L.crop} data-testid="blog-crop" />
          <label className="blog-range">{L.zoom}<input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(e) => setCrop((c) => ({ ...c, zoom: +e.target.value }))} /></label>
          <label className="blog-range">{L.posX}<input type="range" min="0" max="1" step="0.01" value={crop.x} onChange={(e) => setCrop((c) => ({ ...c, x: +e.target.value }))} /></label>
          <label className="blog-range">{L.posY}<input type="range" min="0" max="1" step="0.01" value={crop.y} onChange={(e) => setCrop((c) => ({ ...c, y: +e.target.value }))} /></label>
        </>}
        <div className="adm-actions"><Button variant="secondary" onClick={onClose}>✕</Button>
          <Button disabled={!img} loading={busy} onClick={async () => { setBusy(true); try { await onDone(await cropCover(img, crop)); } catch { setErr(L.err.image_too_large); } finally { setBusy(false); } }} data-testid="blog-crop-ok">{L.useCrop}</Button></div>
      </div>
    </Modal>
  );
}
