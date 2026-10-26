// Run 23b: the Files tab — photos, documents and lists the member shared or got in AI 助理 chats, in one place.
// No new storage: it reads what each chat message already keeps (attachment thumbnails + extracted text on the message,
// the same approach as attachments since Run 12; reply checklists from ```nest-cards```).
import { parseCards } from './chat-cards.js';
import { countWords } from './attach-core.js';
export const FILE_KINDS = ['image', 'file', 'list'];
const msOf = (d) => (d instanceof Date ? d.getTime() : d?.toDate ? d.toDate().getTime() : typeof d === 'number' ? d : Date.parse(d) || 0);

export function collectFiles(convs = [], byConv = {}) {
  const out = [];
  for (const c of convs) {
    for (const m of byConv[c.id] || []) {
      const at = msOf(m.createdAt);
      if (m.role === 'user' && Array.isArray(m.atts)) {
        for (const a of m.atts) {
          const kind = a.kind === 'image' ? 'image' : a.kind === 'video' ? 'image' : 'file';
                    // The FULL extracted text (never a preview) — the same word count as the chat chip.
          const text = String(a.text || '');
          out.push({ id: `${c.id}/${m.id}/${a.id || a.name}`, kind, video: a.kind === 'video', name: String(a.name || ''), thumb: a.thumb || '', text, words: text ? a.words || countWords(text) : 0, ...(a.sentWords ? { sentWords: a.sentWords } : {}), ...(a.pagesRead ? { pagesRead: a.pagesRead } : {}), ...(a.partial || a.split ? { partial: true } : {}), size: a.size || 0, pages: a.pages || 0, at, cid: c.id, chat: c.title || '' });
        }
      }
      if (m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('```nest-cards')) {
        parseCards(m.content).cards.forEach((card, i) => {
          if (card.type === 'reminder') return;
          const items = card.type === 'checklist' ? card.items : card.items.map((x) => `${x.date ? `${+x.date.slice(5, 7)}/${+x.date.slice(8, 10)} ` : ''}${x.time ? `${x.time} ` : ''}${x.title}`);
          const st = m.cardState?.[i] || {};
          out.push({ id: `${c.id}/${m.id}/c${i}`, kind: 'list', list: card.type, name: card.title || items[0] || '', items, done: card.type === 'checklist' ? Object.values(st.done || {}).filter(Boolean).length : 0, at, cid: c.id, chat: c.title || '' });
        });
      }
    }
  }
  return out.sort((a, b) => b.at - a.at);
}
export const filterFiles = (items, kind = 'all', q = '') => {
  const ql = String(q).trim().toLowerCase();
  return items.filter((x) => (kind === 'all' || x.kind === kind) && (!ql || `${x.name} ${x.chat} ${(x.items || []).join(' ')} ${x.text || ''}`.toLowerCase().includes(ql)));
};
