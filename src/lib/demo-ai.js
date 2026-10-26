import { fromTemplate } from './plugins/templates.js';
// Canned "AI" for the landing page's live demo. No network, no model, no usage.
const hk = (days, hm = '09:00') => new Date(Date.now() + 8 * 3600e3 + days * 864e5).toISOString().slice(0, 10) + 'T' + hm;
const lastUser = (messages) => {
  const m = [...(messages || [])].reverse().find((x) => x.role === 'user');
  if (!m) return '';
  return Array.isArray(m.content) ? m.content.map((p) => p.text || '').join(' ') : String(m.content || '');
};

const T = {
  'zh-Hant': {
    remind: (title) => `已加入提醒「${title}」，明天上午九時提醒你。\n\n` + '```nest-actions\n' + JSON.stringify([{ type: 'reminder.create', title, dueAt: hk(1), member: '' }]) + '\n```',
    remember: (text) => `已記下，全家都可以查到。\n\n` + '```nest-actions\n' + JSON.stringify([{ type: 'memory.create', text, tag: '' }]) + '\n```',
    week: '本週需要留意：\n\n1. **明天傍晚**前繳交十月份午膳費。\n2. **星期一** Ethan 有中文默書（第三課）。\n3. **星期三**前簽署秋季旅行回條。\n\n需要我設定溫習提醒嗎？',
    weekend: '可以考慮以下親子活動：\n\n- **大埔海濱公園**踏單車及放風箏\n- **香港科學館**的互動展覽\n- 到**西貢**行一段輕鬆的海岸路線\n\n需要我把其中一項加入提醒嗎？',
    other: '這是示範版本，回覆為預設內容。登入後，Nest 會根據你家的提醒、記憶及已連接帳戶回答，並可直接替你新增提醒、記下事項或更改設定。',
    tutor: ['我們先看題目：**3x + 5 = 20**。\n\n**提示一**：要找出 x，先把 +5 移走。兩邊同時減去甚麼數字最方便？試試寫出下一步。', '做得好。現在是 **3x = 15**。\n\n**提示二**：要求 x，兩邊應同時除以甚麼？', '**提示三**：把答案代回原式檢查：3 × ? + 5 是否等於 20？'],
    reveal: '**答案：x = 5**\n\n1. 3x + 5 − 5 = 20 − 5 → 3x = 15\n2. 3x ÷ 3 = 15 ÷ 3 → x = 5\n3. 檢查：3 × 5 + 5 = 20 ✓',
    similar: '**練習題**：4x − 7 = 21，求 x。\n\n先自己試一試，需要時按「下一個提示」。',
    memNone: '家庭記憶中未有相關資料。可以在上方新增一條。',
    memFrom: (t) => `根據家庭記憶：**${t}**`,
    pack: '秋季旅行建議帶以下物品，我整理成清單，逐項剔選就可以：\n\n' + '```nest-cards\n' + JSON.stringify([{ type: 'checklist', title: '秋季旅行物品', items: ['水樽', '帽子', '防曬用品', '小毛巾', '午餐及小食', '已簽署的回條'] }, { type: 'reminder', title: '交回秋季旅行回條', due: hk(2, '08:00'), member: 'Ethan' }]) + '\n```',
    plan: '這是週末的安排建議，按「＋」即可加入行事曆：\n\n' + '```nest-cards\n' + JSON.stringify([{ type: 'schedule', title: '週末安排', items: [{ date: hk(2).slice(0, 10), time: '10:00', title: '鋼琴課（沙田）' }, { date: hk(2).slice(0, 10), time: '15:00', title: '香港科學館' }, { date: hk(3).slice(0, 10), time: '09:30', title: '西貢海岸步行' }] }]) + '\n```',
    summary: '- **明天傍晚**前繳交十月份午膳費。\n- Ethan **星期一**有中文默書（第三課），今晚宜溫習生字。\n- 秋季旅行回條須於**星期三**前交回。',
  },
  en: {
    remind: (title) => `Added "${title}" — I'll remind you tomorrow at 9am.\n\n` + '```nest-actions\n' + JSON.stringify([{ type: 'reminder.create', title, dueAt: hk(1), member: '' }]) + '\n```',
    remember: (text) => `Saved. Everyone in the family can find it now.\n\n` + '```nest-actions\n' + JSON.stringify([{ type: 'memory.create', text, tag: '' }]) + '\n```',
    week: 'This week:\n\n1. Pay the October lunch fee by **tomorrow evening**.\n2. Ethan has Chinese dictation (Lesson 3) on **Monday**.\n3. Sign the autumn trip slip by **Wednesday**.\n\nShall I set a revision reminder?',
    weekend: 'A few family ideas:\n\n- Cycling and kite flying at **Tai Po Waterfront Park**\n- Hands-on exhibits at the **Science Museum**\n- An easy coastal walk in **Sai Kung**\n\nWant me to add one as a reminder?',
    other: 'This is the demo, so replies are pre-written. Once you sign in, Nest answers from your family\'s reminders, memory and connected accounts, and can add reminders, save details or change settings for you.',
    tutor: ['Let\'s look at **3x + 5 = 20**.\n\n**Hint 1:** to find x, first get rid of the +5. What could you subtract from both sides? Try the next step.', 'Nice. Now you have **3x = 15**.\n\n**Hint 2:** what should you divide both sides by?', '**Hint 3:** check by substituting back: does 3 × ? + 5 equal 20?'],
    reveal: '**Answer: x = 5**\n\n1. 3x + 5 − 5 = 20 − 5 → 3x = 15\n2. 3x ÷ 3 = 15 ÷ 3 → x = 5\n3. Check: 3 × 5 + 5 = 20 ✓',
    similar: '**Practice:** solve 4x − 7 = 21.\n\nGive it a go, then tap "Next hint" if you need one.',
    memNone: 'Nothing in family memory about that yet. Add it above.',
    memFrom: (t) => `From family memory: **${t}**`,
    pack: 'Here’s what to pack for the autumn trip — tick things off as you go:\n\n' + '```nest-cards\n' + JSON.stringify([{ type: 'checklist', title: 'Autumn trip packing', items: ['Water bottle', 'Hat', 'Sunscreen', 'Small towel', 'Lunch and snacks', 'Signed reply slip'] }, { type: 'reminder', title: 'Return the autumn trip slip', due: hk(2, '08:00'), member: 'Ethan' }]) + '\n```',
    plan: 'Here’s a plan for the weekend — tap + to add any of it to the calendar:\n\n' + '```nest-cards\n' + JSON.stringify([{ type: 'schedule', title: 'Weekend plan', items: [{ date: hk(2).slice(0, 10), time: '10:00', title: 'Piano lesson (Sha Tin)' }, { date: hk(2).slice(0, 10), time: '15:00', title: 'Science Museum' }, { date: hk(3).slice(0, 10), time: '09:30', title: 'Sai Kung coastal walk' }] }]) + '\n```',
    summary: '- Pay the October lunch fee by **tomorrow evening**.\n- Ethan has Chinese dictation (Lesson 3) on **Monday** — revise tonight.\n- The autumn trip slip is due **Wednesday**.',
  },
};

function reply(mode, lang, messages, context) {
  // Mock build only: tests inject a fixed reply (nest-ui renderer checks). Never active in production.
  if (import.meta.env?.MODE === 'mock' && typeof window !== 'undefined' && typeof window.__nestMockReply === 'function') { const r = window.__nestMockReply(mode, lastUser(messages)); if (r) return r; }
  const L = T[lang] || T['zh-Hant'];
  const q = lastUser(messages).trim();
  // Run 22 multi-send (demo): a batch [1]…[n] gets one short answer per message, quoting each.
  if (mode === 'chat' && context?.batch > 1) {
    const parts = q.split(/\n\n(?=\[\d+\] )/).map((x) => x.replace(/^\[\d+\] /, ''));
    return parts.map((x) => `> ${x.slice(0, 40)}\n\n${lang === 'en' ? 'Got it — noted.' : '收到，已記下。'}`).join('\n\n');
  }
  if (mode === 'tutor') {
    if (/REVEAL_ANSWER/.test(q)) return L.reveal;
    if (/SIMILAR_QUESTION/.test(q)) return L.similar;
    // Mock only: a reply with real formulas (KaTeX rendering checks).
    if (/MATH_DEMO/.test(q)) return '先看不等式：3y + 6 ≥ 216，所以 $3y \\ge 210$，即 $y \\ge 70$。學費是 HK$50 和 $60（不是數學）。\n\n二次公式：\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\n長式子測試：\\[\\sum_{k=1}^{n} k^2 = \\frac{n(n+1)(2n+1)}{6} + \\int_0^1 x^2\\,dx + \\frac{a_1 + a_2 + a_3 + a_4 + a_5 + a_6}{b_1 b_2 b_3 b_4}\\]';
    const n = (messages || []).filter((m) => m.role === 'assistant').length;
    return L.tutor[Math.min(n, L.tutor.length - 1)];
  }
  if (mode === 'summary') return L.summary;
  if (mode === 'memory') {
    const words = q.toLowerCase().split(/[\s，。？?、,.!]+/).filter((w) => w.length > 1);
    const chars = Array.from(q).filter((c) => /[\u3400-\u9fff]/.test(c));
    const scored = (context?.memories || []).map((m) => {
      const low = m.toLowerCase();
      return [m, words.filter((w) => low.includes(w)).length * 3 + chars.filter((c) => m.includes(c)).length];
    }).sort((a, b) => b[1] - a[1]);
    return scored[0] && scored[0][1] >= 2 ? L.memFrom(scored[0][0]) : L.memNone;
  }
  // chat
  const strip = (s) => s.replace(/^(請)?(幫我)?(提醒我|提醒|記下|記住|remind me to|remind me|remember( that)?|save)[:：\s]*/i, '').replace(/[。.!！]$/, '').trim();
  if (/清單|帶甚麼|帶什麼|執拾|checklist|pack/i.test(q)) return L.pack;
  if (/時間表|行程|安排|schedule|timetable|plan/i.test(q)) return L.plan;
  if (/提醒|remind/i.test(q)) return L.remind(strip(q).slice(0, 60) || q.slice(0, 60));
  if (/記下|記住|remember|save/i.test(q)) return L.remember(strip(q).slice(0, 200) || q.slice(0, 200));
  if (/週末|weekend|活動|activity/i.test(q)) return L.weekend;
  if (/星期|準備|week|prepare/i.test(q)) return L.week;
  return L.other;
}

export function createDemoAi(lang) {
  return {
    async streamChat({ mode = 'chat', messages, context, onDelta, onStatus, onModel, onThink, model, think }) {
      // Run 25: the label under the reply (mock: auto → DeepSeek V4.1 Flash, otherwise the chosen model).
      if (mode === 'chat' && onThink && (think === 'on' || (think !== 'off' && /解|數學|math|solve|plan|計劃/i.test(String(messages?.at?.(-1)?.content || ''))))) { for (const t of ['Identifying the equation type. ', 'Factoring the quadratic: (2x+1)(x−3). ', 'Checking both roots.']) { onThink(t); await new Promise((r) => setTimeout(r, 300)); } }
      if (mode === 'chat' && onModel) onModel(!model || model === 'auto' ? { id: 'deepseek/deepseek-v4.1-flash-free', auto: true, fb: false } : { id: model, auto: false, fb: false });
      // Mock build only (screenshots / tests): server-style status events before the first text (progress card).
      if (import.meta.env?.MODE === 'mock' && typeof window !== 'undefined' && Array.isArray(window.__nestMockSteps)) {
        for (const [key, ms] of window.__nestMockSteps) { onStatus?.({ key }); await new Promise((r) => setTimeout(r, ms)); }
      }
      if (import.meta.env?.MODE === 'mock' && typeof window !== 'undefined') (window.__nestChatCalls = window.__nestChatCalls || []).push({ mode, batch: context?.batch || 0, last: lastUser(messages) });
      if (import.meta.env?.MODE === 'mock' && typeof window !== 'undefined' && window.__nestMockFail > 0) { window.__nestMockFail -= 1; await new Promise((r) => setTimeout(r, 1500)); const e = new Error('mock failure'); e.code = 'http_400'; throw e; }
      // Studio follow-ups (current code in the context) answer with an edit, like the real model may.
      const iter = mode === 'plugin' && /CURRENT PLUGIN/.test(String(messages?.[0]?.content || ''));
      // Mock build only: tests inject plugin replies too (Studio retry / error-text checks).
      const injected = mode === 'plugin' && import.meta.env?.MODE === 'mock' && typeof window !== 'undefined' && typeof window.__nestMockReply === 'function' ? window.__nestMockReply(mode, lastUser(messages)) : null;
      const text = injected != null ? injected : iter ? JSON.stringify({ edits: [{ file: 'css', find: '', replace: 'body{--accent:#2563eb} p,b,strong{color:#2563eb}' }], notes: lang === 'en' ? 'Changed the text colour to blue; everything else is unchanged.' : '已把文字改成藍色，其他部分保持不變。' }) : mode === 'plugin' ? JSON.stringify({ ...fromTemplate('widget', { name: 'Homework Progress', nameZh: '功課進度', type: 'note', text: lang === 'en' ? '3 of 5 done — keep going!' : '完成 3／5 份，繼續加油！' }), notes: lang === 'en' ? 'A Home widget that shows your homework progress.' : '一個在主頁顯示功課進度的小工具。' }) : reply(mode, lang, messages, context);
      let acc = '';
      for (const ch of text.match(/[\s\S]{1,3}/g)) { acc += ch; onDelta?.(acc); await new Promise((r) => setTimeout(r, (import.meta.env?.MODE === 'mock' && typeof window !== 'undefined' && window.__nestMockDelay) || 12)); }
      return acc;
    },
    async jsonChat({ mode }) {
      await new Promise((r) => setTimeout(r, 500));
      if (mode === 'inbox') return { items: [] };
      return lang === 'en' ? {
        topic: 'Photosynthesis',
        flashcards: [{ front: 'What are the raw materials of photosynthesis?', back: 'Carbon dioxide and water, using light energy.' }, { front: 'Where does it happen?', back: 'In the chloroplasts.' }, { front: 'What does chlorophyll do?', back: 'Absorbs light, mainly red and blue.' }],
        questions: [{ q: 'Which structure carries out photosynthesis?', options: ['Nucleus', 'Chloroplast', 'Mitochondrion', 'Cell wall'], answer: 1, explanation: 'Chloroplasts contain chlorophyll.', concept: 'Chloroplast' }, { q: 'Which gas is released?', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], answer: 2, explanation: 'Water is split, releasing oxygen.', concept: 'Products' }],
      } : {
        topic: '光合作用',
        flashcards: [{ front: '光合作用的原料是甚麼？', back: '二氧化碳和水，並需要光能。' }, { front: '光合作用在細胞哪個部分進行？', back: '葉綠體。' }, { front: '葉綠素的作用？', back: '吸收光能，主要吸收紅光和藍光。' }],
        questions: [{ q: '光合作用主要在植物細胞的哪個結構進行？', options: ['細胞核', '葉綠體', '線粒體', '細胞壁'], answer: 1, explanation: '葉綠體含葉綠素，是光合作用的場所。', concept: '葉綠體' }, { q: '光合作用會釋放哪種氣體？', options: ['二氧化碳', '氮氣', '氧氣', '氫氣'], answer: 2, explanation: '水分子被分解並釋放氧氣。', concept: '產物' }],
      };
    },
  };
}
