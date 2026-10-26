// Run 25: AI models for the AI 助理 (mode 'chat'). Shared by the server (api/chat.js) and the client (picker + label).
// OrcaRouter (OpenAI-compatible, https://api.orcarouter.ai/v1, key in ORCAROUTER_API_KEY) serves the free models the
// owner chose (2026-10-24) — ONLY these, never a paid one. Agnes agnes-3.0-flash stays as an option and the last fallback.
// Measurements behind the routing: work/run25/models.md (time to first token with the real Nest system prompt, HK prompts).
import { estTokens } from './attach-core.js';

export const AGNES = 'agnes-3.0-flash';
export const ORCA_BASE = 'https://api.orcarouter.ai/v1';
export const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
// Run 26: Google AI Studio (free tier only) through its OpenAI-compatible endpoint; key in Vercel env GEMINI_API_KEY.
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
// Run 26b: Mistral La Plateforme (free tier; ~1 req/s per key, throttled per instance). Small/Medium answer 429 with a
// 0 req/min limit on this key's tier → not offered. Key in Vercel env MISTRAL_API_KEY.
export const MISTRAL_BASE = 'https://api.mistral.ai/v1';
// Thinking on, with thought SUMMARIES streamed (never raw thoughts).
const gthinkOn = (level) => ({ extra_body: { google: { thinking_config: { thinking_level: level, include_thoughts: true } } } });
const gthink = (level) => ({ extra_body: { google: { thinking_config: { thinking_level: level, include_thoughts: false } } } });

// OrcaRouter free tier caps a single prompt at ~122K tokens (catalog says 1M) → stay under it; above → Agnes (512K).
const FREE_PROMPT = 110_000;

// nothink: request fields that switch reasoning off (verified 2026-10-24: 0 reasoning tokens). think: the limited
// reasoning used for maths / homework (DeepSeek V4.1 Flash supports effort low / high / max).
export const MODELS = [
  {
    id: 'deepseek/deepseek-v4.1-flash-free', thinks: true, name: 'DeepSeek V4.1 Flash', provider: 'orca', icon: 'deepseek', ctx: 1_000_000, prompt: FREE_PROMPT, vision: true, ttft: 1.05,
    nothink: { thinking: { type: 'disabled' } }, think: { reasoning_effort: 'low' },
    desc: { 'zh-Hant': '最快，擅長數學、功課及看圖', 'zh-Hans': '最快，擅长数学、功课及看图', en: 'Fastest; great at maths, homework and photos', th: 'เร็วที่สุด เก่งคณิต การบ้าน และอ่านรูปภาพ' },
  },
  {
    id: 'tencent/hy4-preview-free', name: 'Hunyuan Hy4 Preview', provider: 'orca', icon: 'hunyuan', ctx: 1_000_000, prompt: FREE_PROMPT, vision: false, ttft: 1.75,
    nothink: { reasoning_effort: 'none' },
    desc: { 'zh-Hant': '騰訊旗艦模型，適合寫作及整理資料', 'zh-Hans': '腾讯旗舰模型，适合写作及整理资料', en: "Tencent's flagship; good for writing and organising", th: 'โมเดลเรือธงของ Tencent เหมาะกับการเขียนและจัดระเบียบข้อมูล' },
  },
  {
    id: 'tencent/hy3-free', name: 'Hunyuan Hy3', provider: 'orca', icon: 'hunyuan', ctx: 256_000, prompt: FREE_PROMPT, vision: false, ttft: 1.7,
    nothink: { thinking: { type: 'disabled' } },
    desc: { 'zh-Hant': '回應快而穩定，適合日常問答', 'zh-Hans': '回应快而稳定，适合日常问答', en: 'Quick and steady for everyday questions', th: 'ตอบเร็วและสม่ำเสมอ เหมาะกับคำถามทั่วไป' },
  },
  {
    id: 'deepseek/deepseek-v4-flash-free', name: 'DeepSeek V4 Flash', provider: 'orca', icon: 'deepseek', ctx: 1_000_000, prompt: FREE_PROMPT, vision: false, ttft: 2.0,
    nothink: { thinking: { type: 'disabled' } },
    desc: { 'zh-Hant': '上一代 DeepSeek，適合長文件', 'zh-Hans': '上一代 DeepSeek，适合长文件', en: 'Previous DeepSeek; handles long documents', th: 'DeepSeek รุ่นก่อน รองรับเอกสารยาว' },
  },
  {
    id: 'z-ai/glm-5.3-flash-free', name: 'GLM 5.3 Flash', provider: 'orca', icon: 'glm', ctx: 1_000_000, prompt: FREE_PROMPT, vision: true, ttft: 2.05,
    nothink: { reasoning_effort: 'low' },
    desc: { 'zh-Hant': '智譜模型，擅長編程及看圖', 'zh-Hans': '智谱模型，擅长编程及看图', en: 'Z.ai model; good at code and photos', th: 'โมเดลของ Z.ai เก่งเขียนโค้ดและอ่านรูปภาพ' },
  },
  // ---- Run 26: Google AI Studio free tier (verified in GET /v1beta/models 2026-10-24; Pacific-midnight daily reset) ----
  {
    id: 'gemini-3.5-flash-lite', thinks: true, name: 'Gemini 3.5 Flash-Lite', provider: 'gemini', icon: 'gemini', ctx: 1_048_576, prompt: 200_000, vision: true, ttft: 0.5,
    nothink: gthink('minimal'),
    desc: { 'zh-Hant': 'Google 快速模型，適合日常對話', 'zh-Hans': 'Google 快速模型，适合日常对话', en: 'Fast Google model for everyday chat', th: 'โมเดลเร็วของ Google เหมาะกับการคุยทั่วไป' },
  },
  {
    id: 'gemini-3.1-flash-lite', thinks: true, name: 'Gemini 3.1 Flash-Lite', provider: 'gemini', icon: 'gemini', ctx: 1_048_576, prompt: 200_000, vision: true, ttft: 0.55,
    nothink: gthink('minimal'),
    desc: { 'zh-Hant': '輕巧快速，適合簡單問題及清單', 'zh-Hans': '轻巧快速，适合简单问题及清单', en: 'Light and quick for simple questions and lists', th: 'เบาและเร็ว เหมาะกับคำถามง่ายๆ และรายการ' },
  },
  {
    id: 'gemini-3.6-flash', thinks: true, name: 'Gemini 3.6 Flash', provider: 'gemini', icon: 'gemini', ctx: 1_048_576, prompt: 200_000, vision: true, ttft: 0.8, daily: 20,
    nothink: gthink('minimal'),
    desc: { 'zh-Hant': '較強的 Google 模型，擅長數學、看圖及長文件', 'zh-Hans': '较强的 Google 模型，擅长数学、看图及长文件', en: 'Stronger Google model; maths, photos and long files', th: 'โมเดล Google ที่เก่งขึ้น ด้านคณิต รูปภาพ และไฟล์ยาว' },
  },
  {
    id: 'gemini-3.8-flash', thinks: true, name: 'Gemini 3.8 Flash', provider: 'gemini', icon: 'gemini', ctx: 1_048_576, prompt: 200_000, vision: true, ttft: 3, daily: 20,
    nothink: gthink('low'), // MINIMAL is refused by this model (400)
    desc: { 'zh-Hant': '最新 Google 模型，適合較難的問題（每日次數有限）', 'zh-Hans': '最新 Google 模型，适合较难的问题（每日次数有限）', en: 'Newest Google model for harder questions (limited per day)', th: 'โมเดล Google ล่าสุด สำหรับคำถามยาก (จำกัดต่อวัน)' },
  },
  {
    id: 'gemma-4-26b-a4b-it', name: 'Gemma 4', provider: 'gemini', icon: 'gemma', ctx: 262_144, prompt: 12_000, vision: false, ttft: 0.8,
    nothink: gthink('minimal'), // without it Gemma streams <thought> text for ~20 s
    desc: { 'zh-Hant': 'Google 開放模型，適合簡短問題', 'zh-Hans': 'Google 开放模型，适合简短问题', en: "Google's open model for short questions", th: 'โมเดลเปิดของ Google เหมาะกับคำถามสั้นๆ' },
  },
  // ---- Run 26b: Mistral free tier (ids verified in GET /v1/models 2026-10-24; each answered once from the sandbox) ----
  {
    id: 'ministral-14b-2512', name: 'Ministral 3 14B', provider: 'mistral', icon: 'mistral', ctx: 262_144, prompt: 200_000, vision: true, ttft: 0.5,
    nothink: {},
    desc: { 'zh-Hant': 'Mistral 均衡模型，適合日常對話及看圖', 'zh-Hans': 'Mistral 均衡模型，适合日常对话及看图', en: 'Balanced Mistral model for chat and photos', th: 'โมเดลสมดุลของ Mistral เหมาะกับการคุยและรูปภาพ' },
  },
  {
    id: 'ministral-8b-2512', name: 'Ministral 3 8B', provider: 'mistral', icon: 'mistral', ctx: 262_144, prompt: 200_000, vision: true, ttft: 0.6,
    nothink: {},
    desc: { 'zh-Hant': '輕量 Mistral 模型，適合簡單任務', 'zh-Hans': '轻量 Mistral 模型，适合简单任务', en: 'Light Mistral model for simple tasks', th: 'โมเดล Mistral ขนาดเบา เหมาะกับงานง่ายๆ' },
  },
  {
    id: 'ministral-3b-2512', name: 'Ministral 3 3B', provider: 'mistral', icon: 'mistral', ctx: 131_072, prompt: 100_000, vision: true, ttft: 0.4,
    nothink: {},
    desc: { 'zh-Hant': '最細最快，適合問候及很短的問題', 'zh-Hans': '最小最快，适合问候及很短的问题', en: 'Tiniest and fastest; greetings and very short questions', th: 'เล็กและเร็วที่สุด เหมาะกับคำทักทายและคำถามสั้นมาก' },
  },
  {
    id: 'codestral-2508', name: 'Codestral', provider: 'mistral', icon: 'mistral', ctx: 256_000, prompt: 200_000, vision: false, ttft: 0.5,
    nothink: {},
    desc: { 'zh-Hant': 'Mistral 編程模型，適合寫程式及 GitHub', 'zh-Hans': 'Mistral 编程模型，适合写程序及 GitHub', en: 'Mistral coding model for code and GitHub', th: 'โมเดลเขียนโค้ดของ Mistral สำหรับโค้ดและ GitHub' },
  },
  {
    id: AGNES, name: 'Agnes 3.0 Flash', provider: 'agnes', icon: 'agnes', ctx: 512_000, prompt: 500_000, vision: true, ttft: 0.9,
    nothink: {},
    desc: { 'zh-Hant': 'Nest 原有模型，最穩定', 'zh-Hans': 'Nest 原有模型，最稳定', en: "Nest's original model; the most reliable", th: 'โมเดลดั้งเดิมของ Nest เสถียรที่สุด' },
  },
];
export const MODEL_IDS = MODELS.map((m) => m.id);
// ---- Run 26c: thinking mode. 'auto' (on for hard requests only), 'on', 'off'. Models with thinks:true can show a
// thought summary (Gemini includeThoughts summaries; DeepSeek V4.1 reasoning text). Mistral (Magistral = Small/Medium,
// 0 req/min on this tier), Gemma, Hunyuan, GLM and Agnes run without thinking.
export const THINK_CHOICES = ['auto', 'on', 'off'];
export const normThink = (v) => (THINK_CHOICES.includes(String(v)) ? String(v) : 'auto');
export const canThink = (id) => id === 'auto' || !!modelInfo(id)?.thinks;
const PLAN_RE = /(計劃|计划|規劃|规划|行程|安排.*(步驟|步骤)|一步一步|逐步|分析|比較|比较|利弊|策略|itinerary|\bplan\b|planning|step[- ]by[- ]step|analy[sz]e|analysis|compare|pros and cons|strategy|วางแผน|วิเคราะห์)/i;
// Auto: thinking ON for maths / homework / long documents / multi-step planning; OFF for casual chat (saves quota).
export function wantThink(pref, kind, text = '') {
  const p = normThink(pref);
  if (p !== 'auto') return p === 'on';
  return kind === 'reason' || kind === 'doc' || PLAN_RE.test(String(text || ''));
}
export const THINK_TEXT = {
  'zh-Hant': { auto: '思考：自動', on: '思考', off: '快速', label: '思考模式', thinking: '思考中…', thought: '已思考 {s} 秒', next: '按一下切換' },
  'zh-Hans': { auto: '思考：自动', on: '思考', off: '快速', label: '思考模式', thinking: '思考中…', thought: '已思考 {s} 秒', next: '点按切换' },
  en: { auto: 'Thinking: Auto', on: 'Thinking', off: 'Fast', label: 'Thinking mode', thinking: 'Thinking…', thought: 'Thought for {s}s', next: 'Tap to switch' },
  th: { auto: 'คิด: อัตโนมัติ', on: 'คิด', off: 'เร็ว', label: 'โหมดคิด', thinking: 'กำลังคิด…', thought: 'คิดแล้ว {s} วินาที', next: 'แตะเพื่อสลับ' },
};
// Picker groups (brand names, not translated). Run 26b.
export const GROUPS = [
  { key: 'google', title: 'Google', ids: MODELS.filter((m) => m.provider === 'gemini').map((m) => m.id) },
  { key: 'mistral', title: 'Mistral AI', ids: MODELS.filter((m) => m.provider === 'mistral').map((m) => m.id) },
  { key: 'orca', title: 'DeepSeek · Hunyuan · GLM', ids: MODELS.filter((m) => m.provider === 'orca').map((m) => m.id) },
  { key: 'nest', title: 'Nest', ids: MODELS.filter((m) => m.provider === 'agnes').map((m) => m.id) },
];
export const MODEL_CHOICES = ['auto', ...MODEL_IDS];
export const modelInfo = (id) => MODELS.find((m) => m.id === id) || null;
export const normModel = (v) => (MODEL_CHOICES.includes(String(v)) ? String(v) : 'auto');

const L4 = (lang) => (lang === 'zh-Hans' ? 'zh-Hans' : lang === 'en' ? 'en' : lang === 'th' ? 'th' : lang === 'zh-Hant' || !lang ? 'zh-Hant' : 'en');
export const PICKER_TEXT = {
  'zh-Hant': { title: 'AI 模型', auto: '自動', autoDesc: '按問題自動選擇最合適、最快的模型', fallback: '後備', free: '全部免費', note: '選擇會儲存在你的帳戶。如所選模型繁忙，會自動改用其他模型。', label: '選擇 AI 模型', current: '目前：{name}' },
  'zh-Hans': { title: 'AI 模型', auto: '自动', autoDesc: '按问题自动选择最合适、最快的模型', fallback: '后备', free: '全部免费', note: '选择会保存在你的账户。如所选模型繁忙，会自动改用其他模型。', label: '选择 AI 模型', current: '当前：{name}' },
  en: { title: 'AI model', auto: 'Auto', autoDesc: 'Picks the best, fastest model for each question', fallback: 'Fallback', free: 'All free', note: 'Saved to your account. If the chosen model is busy, another one answers.', label: 'Choose AI model', current: 'Current: {name}' },
  th: { title: 'โมเดล AI', auto: 'อัตโนมัติ', autoDesc: 'เลือกโมเดลที่เหมาะและเร็วที่สุดให้แต่ละคำถาม', fallback: 'สำรอง', free: 'ฟรีทั้งหมด', note: 'บันทึกไว้ในบัญชีของคุณ หากโมเดลที่เลือกไม่ว่าง จะใช้โมเดลอื่นตอบแทน', label: 'เลือกโมเดล AI', current: 'ปัจจุบัน: {name}' },
};
export const pickerText = (lang) => PICKER_TEXT[L4(lang)];
export const thinkText = (lang) => THINK_TEXT[L4(lang)];
export const modelDesc = (id, lang) => (id === 'auto' ? pickerText(lang).autoDesc : modelInfo(id)?.desc[L4(lang)] || '');
export const modelName = (id, lang) => (id === 'auto' ? pickerText(lang).auto : modelInfo(id)?.name || String(id || ''));
// Label under a reply: "DeepSeek V4.1 Flash · 自動" (auto), "… · 後備" (the chosen model was busy), or just the name.
export function modelLabel(meta, lang) {
  if (!meta || !meta.id) return '';
  const name = modelInfo(meta.id)?.name; if (!name) return '';
  const T = pickerText(lang);
  return meta.auto ? `${name} · ${T.auto}` : meta.fb ? `${name} · ${T.fallback}` : name;
}

// ---- Auto routing: instant rules (no model call, 0 ms). Owner's rule: never use a model to choose the model. ----
const MATH_RE = /(數學|数学|算式|方程|方程式|解方程|計算|计算|求[解值證证]|證明|证明|幾何|几何|代數|代数|三角|微積分|微积分|機率|概率|概率|統計|统计|分數|分数|百分比|因式|根號|根号|面積|面积|體積|体积|數列|数列|函數|函数|導數|导数|積分|积分|邏輯題|逻辑题|推理|功課|功课|作業|作业|習題|习题|練習|练习|題目|题目|物理|化學|化学|奧數|奥数|\bmaths?\b|\bmathematics\b|\bequation|\bsolve\b|\bcalculate|\bprove\b|\bproof\b|\balgebra|\bgeometry|\bcalculus|\bderivative|\bintegral|\bprobability|\bfraction|\bhomework|\bworksheet|\bphysics\b|\bchemistry\b|\blogic puzzle|\breason(ing)? (it )?(out|through)|step[- ]by[- ]step|เลข|คณิต|การบ้าน|สมการ)/i;
const FORMULA_RE = /(\d\s*[x×*÷/^+−-]\s*[\dx(]|[a-z]\s*[²³^]|\b\d+\s*[x-z]\b|[=≤≥≠]\s*[-−]?\d|√|∫|∑|π|sin|cos|tan|log)/i;
export const ROUTES = {
  // kind → [primary, …fallbacks] (Agnes is always appended last). Run 26: Gemini Flash-Lite (500/day, ~0.5 s) first for
  // everyday chat; Gemma for trivial one-liners; the 20-a-day Flash models only for maths / photos / long documents.
  // Run 26b: + Mistral (Ministral for tiny / everyday, Codestral for code); 3.8 Flash only as a late fallback.
  light: ['ministral-3b-2512', 'gemma-4-26b-a4b-it', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'tencent/hy4-preview-free'],
  chat: ['gemini-3.5-flash-lite', 'ministral-14b-2512', 'gemini-3.1-flash-lite', 'deepseek/deepseek-v4.1-flash-free', 'tencent/hy4-preview-free', 'tencent/hy3-free'],
  code: ['codestral-2508', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'deepseek/deepseek-v4.1-flash-free', 'z-ai/glm-5.3-flash-free'],
  reason: ['gemini-3.6-flash', 'ministral-14b-2512', 'deepseek/deepseek-v4.1-flash-free', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'tencent/hy4-preview-free', 'deepseek/deepseek-v4-flash-free'],
  image: ['gemini-3.6-flash', 'ministral-14b-2512', 'gemini-3.5-flash-lite', 'deepseek/deepseek-v4.1-flash-free', 'gemini-3.8-flash', 'gemini-3.1-flash-lite', 'z-ai/glm-5.3-flash-free'],
  doc: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'ministral-14b-2512', 'deepseek/deepseek-v4.1-flash-free', 'gemini-3.8-flash', 'tencent/hy4-preview-free', 'deepseek/deepseek-v4-flash-free'],
};
const CODE_RE = /(```|\bcode\b|\bcoding\b|\bjavascript\b|\btypescript\b|\bpython\b|\bjava\b|\bc\+\+|\bhtml\b|\bcss\b|\bsql\b|\bregex\b|\bgithub\b|\bgit\b|\bnpm\b|\bapi\b|\bbug\b|\bdebug|\bfunction\b|\bscript\b|程式|程序|編程|编程|寫code|代碼|代码|源碼|源码|函數寫|函数写|โค้ด|เขียนโปรแกรม)/i;
// Trivial messages (greetings, thanks, a few words) → Gemma; never spend the 20-a-day models on them.
const LIGHT_RE = /^\s*(hi|hello|hey|thanks?|thank you|ok(ay)?|good (morning|night|afternoon)|你好|您好|哈囉|早晨|早安|午安|晚安|多謝|謝謝|谢谢|唔該|好的|好啊|ok|สวัสดี|ขอบคุณ)[\s!！。.~，,?？]*$/i;
// What kind of request this is (from the user's own words + what is attached).
export function routeKind({ text = '', images = 0, docTokens = 0 } = {}) {
  if (images > 0) return 'image';
  if (docTokens > 8_000) return 'doc';
  const t = String(text || '');
  if (CODE_RE.test(t)) return 'code';
  if (MATH_RE.test(t) || (FORMULA_RE.test(t) && /\d/.test(t))) return 'reason';
  if (LIGHT_RE.test(t) || (t.trim().length <= 6 && !/[?？]/.test(t))) return 'light';
  return 'chat';
}
export const routeAuto = (req) => { const kind = routeKind(req); return { kind, model: ROUTES[kind][0] }; };

// The ordered list of models to try. choice: 'auto' | a model id. promptTokens: estimate of the whole request.
// Models that cannot take the request (no vision for photos, prompt over their cap) are skipped; Agnes is always last.
export function modelChain(choice, req = {}) {
  const kind = routeKind(req);
  const off = req.off || {}; // providers without a key on this server (e.g. { gemini: true })
  const fits = (id) => { const m = modelInfo(id); return !!m && !off[m.provider] && (!(req.images > 0) || m.vision) && (req.promptTokens || 0) <= m.prompt; };
  let route = ROUTES[kind];
  // Everyday chat: spread the load between the two first models (req.spread odd → second model first).
  if (kind === 'chat' && (req.spread | 0) % 2 === 1) route = [route[1], route[0], ...route.slice(2)];
  const base = choice === 'auto' || !modelInfo(choice) ? route : [choice, ...route.filter((x) => x !== choice)];
  const out = [];
  for (const id of [...base, AGNES]) if (!out.includes(id) && fits(id)) out.push(id);
  if (!out.includes(AGNES)) out.push(AGNES);
  return { kind, chain: out, auto: choice === 'auto' || !modelInfo(choice) };
}
// Rough token count of a chat request (text parts; each image ≈ 1,000 tokens).
export function requestTokens(messages = [], sys = '') {
  let n = estTokens(sys);
  for (const m of messages) {
    if (Array.isArray(m.content)) for (const p of m.content) n += p.type === 'image_url' ? 1000 : estTokens(p.text || '');
    else n += estTokens(m.content || '');
  }
  return n;
}
// Extra request fields for a model: reasoning off for speed; limited reasoning for maths on the model that supports it.
export function modelParams(id, kind, think = false) {
  const m = modelInfo(id); if (!m) return {};
  if (m.provider === 'gemini' && think && m.thinks) return { ...gthinkOn(id === 'gemini-3.6-flash' || id === 'gemini-3.8-flash' ? 'medium' : 'low'), max_tokens: 16384 };
  if (m.provider === 'gemini' || m.provider === 'mistral') return { ...m.nothink, max_tokens: 8192 };
  if (m.provider === 'orca' && think && m.think) return { ...m.think, max_tokens: 8192 };
  if (m.provider !== 'orca') return {};
  return { ...(kind === 'reason' && m.think ? m.think : m.nothink), max_tokens: 8192 };
}

// ---- Rate limits: OrcaRouter free tier (10 RPM / 50 RPD shared by the default-tier free models; Hy4 has its own
// 50 RPM / 250 RPD; day resets 00:00 UTC). A 429 marks the model (and, for a day-long Retry-After, every model in the
// same bucket) as busy in this isolate, so the next requests skip straight to the next model instead of waiting.
const BUCKET = (id) => (id === 'tencent/hy4-preview-free' ? 'hy4' : modelInfo(id)?.provider === 'orca' ? 'std' : id);
// Google AI Studio daily quotas reset at midnight US Pacific (America/Los_Angeles, DST-aware) → ms timestamp.
export function nextPacificMidnight(t = Date.now()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  const sinceMid = ((+p.hour % 24) * 3600 + +p.minute * 60 + +p.second) * 1000 + (t % 1000);
  let next = t - sinceMid + 86400e3;
  // DST change days: nudge until the Pacific clock reads 00:00.
  for (let i = 0; i < 2; i++) { const q = Object.fromEntries(f.formatToParts(new Date(next)).map((x) => [x.type, x.value])); const h = +q.hour % 24; if (h === 0) break; next += (h >= 12 ? 24 - h : -h) * 3600e3; }
  return next;
}
// Mistral free tier ≈ 1 request / second per key → space calls ≥ minMs apart in this instance (waits at most minMs).
export function createThrottle(minMs = 1000, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let next = 0;
  return async () => { const t = now(); const wait = Math.max(0, next - t); next = Math.max(t, next) + minMs; if (wait) await sleep(wait); return wait; };
}
// A Gemini 429 body naming a per-day quota (e.g. GenerateRequestsPerDayPerProjectPerModel-FreeTier) = done for the day.
export const isDailyQuota = (body) => /PerDay|per day|daily/i.test(String(body || ''));
export function createBusyTracker(now = () => Date.now()) {
  const until = new Map();
  return {
    mark(id, retryAfterSec, body) {
      if (modelInfo(id)?.provider === 'gemini') {
        if (isDailyQuota(body)) { until.set(`m:${id}`, nextPacificMidnight(now())); return; }
        const s = Number(retryAfterSec) || Number((String(body || '').match(/retry in ([\d.]+)s|"retryDelay":\s*"(\d+)/i) || []).slice(1).find(Boolean)) || 30;
        until.set(`m:${id}`, now() + Math.min(120e3, Math.max(10e3, s * 1000))); return;
      }
      const ra = Number(retryAfterSec);
      const long = Number.isFinite(ra) && ra > 600; // day bucket → the whole bucket, re-probe after 15 min at most
      const ms = long ? 15 * 60e3 : Math.min(120e3, Math.max(20e3, (Number.isFinite(ra) ? ra : 30) * 1000));
      until.set(long ? `b:${BUCKET(id)}` : `m:${id}`, now() + ms);
    },
    busy(id) {
      if (id === AGNES) return false;
      const t = now();
      return (until.get(`m:${id}`) || 0) > t || (until.get(`b:${BUCKET(id)}`) || 0) > t;
    },
    clear() { until.clear(); },
  };
}
// HTTP outcomes that move on to the next model (rate limit, server trouble, a model that does not take these params).
export const shouldFallback = (status) => status === 429 || status >= 500 || status === 400 || status === 404 || status === 408 || status === 413 || status === 422 || status === 402 || status === 403;

// Some reasoning models put their thinking inside <think>…</think> in the content: strip it from what users see.
export function createThinkStripper() {
  let buf = ''; let state = 'start'; let OPEN = '<think>'; let CLOSE = '</think>'; // also Gemma's <thought>…</thought>
  return (delta) => {
    if (state === 'pass') return delta;
    if (state === 'after') { const t = delta.replace(/^\s+/, ''); if (t) state = 'pass'; return t; }
    buf += delta;
    if (state === 'start') {
      const t = buf.trimStart();
      if (!t) return '';
      if (t.length < 9 && ('<think>'.startsWith(t) || '<thought>'.startsWith(t))) return '';
      if (t.startsWith('<thought>')) { OPEN = '<thought>'; CLOSE = '</thought>'; }
      if (!t.startsWith(OPEN)) { state = 'pass'; const o = buf; buf = ''; return o; }
      state = 'think';
    }
    const end = buf.indexOf(CLOSE);
    if (end < 0) return '';
    const rest = buf.slice(end + CLOSE.length).replace(/^\s+/, ''); buf = ''; state = rest ? 'pass' : 'after';
    return rest;
  };
}

// Run 26c: split a stream into answer text and thought summary. Handles reasoning_content / reasoning deltas, Gemini's
// OpenAI-compatible thought parts (extra_content.google.thought) and <thought>/<think> tags at the start of the content.
export function createThoughtSplitter() {
  const tags = createTagSplitter();
  return (dl = {}) => {
    const out = { text: '', thought: '' };
    const rc = dl.reasoning_content || dl.reasoning || '';
    if (typeof rc === 'string' && rc) out.thought += rc;
    let c = dl.content;
    if (Array.isArray(c)) { // Mistral-style parts
      for (const p of c) { if (p?.type === 'thinking') out.thought += (p.thinking || []).map((x) => x.text || '').join(''); else if (p?.text) out.text += p.text; }
      c = '';
    }
    if (typeof c === 'string' && c) {
      if (dl.extra_content?.google?.thought === true || dl.thought === true) out.thought += c;
      else { const r = tags(c); out.text += r.text; out.thought += r.thought; }
    }
    return out;
  };
}
function createTagSplitter() {
  let buf = ''; let state = 'start'; let CLOSE = '</think>';
  return (delta) => {
    if (state === 'pass') return { text: delta, thought: '' };
    buf += delta;
    if (state === 'start') {
      const t = buf.trimStart();
      if (!t) return { text: '', thought: '' };
      if (t.length < 9 && ('<think>'.startsWith(t) || '<thought>'.startsWith(t))) return { text: '', thought: '' };
      const open = t.startsWith('<thought>') ? '<thought>' : t.startsWith('<think>') ? '<think>' : '';
      if (!open) { state = 'pass'; const o = buf; buf = ''; return { text: o, thought: '' }; }
      CLOSE = open === '<thought>' ? '</thought>' : '</think>';
      buf = t.slice(open.length); state = 'in';
    }
    if (state === 'in') {
      const end = buf.indexOf(CLOSE);
      if (end < 0) { const keep = Math.max(0, buf.length - CLOSE.length); const th = buf.slice(0, keep); buf = buf.slice(keep); return { text: '', thought: th }; }
      const th = buf.slice(0, end); const rest = buf.slice(end + CLOSE.length).replace(/^\s+/, ''); buf = ''; state = 'pass';
      return { text: rest, thought: th };
    }
    return { text: '', thought: '' };
  };
}
