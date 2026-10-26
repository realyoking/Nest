// Hidden / canned user prompts sent to the AI. Always written in the app language, so the model
// never sees an English user turn when the app is set to 繁體中文 (and vice versa).
const P = {
  'zh-Hant': {
    inboxScan: '請立即掃描我已連接的帳戶，找出需要處理的事項。請用繁體中文書面語撰寫所有文字。',
    briefing: '請為我撰寫今天的家庭簡報，用繁體中文書面語。',
    quizFromPhoto: '請根據相片中的筆記出題，所有文字用繁體中文書面語。',
    tutorHelp: '請協助我解答這道題目。',
  },
  en: {
    inboxScan: 'Scan my connected accounts now and find anything that needs action.',
    briefing: "Give me today's family briefing.",
    quizFromPhoto: 'Make a quiz from the notes in this photo.',
    tutorHelp: 'Please help me with this question.',
  },
};
export const prompt = (lang, key) => (P[lang] || P['zh-Hant'])[key];
