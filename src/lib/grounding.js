import { WHATSNEW_RE } from './whatsnew-ai.js';
// AI 助理 grounding (shared by api/chat.js and tests). Three cheap, regex-only pre-steps on the latest user message —
// no extra model call, so ordinary and homework questions pay nothing:
//   lookup → Wikipedia search + summaries (≤ 2.5 s, in parallel with the usage check) injected with title + URL
//   guide  → the compact Nest app guide (tabs, buttons, how-to, deep links) — only for questions about Nest
//   state  → the user's own live state (usage %, effective plan, settings, family, plugins…) — only when asked
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Homework / maths / language-exercise questions never trigger a lookup.
const HOMEWORK = /(\d\s*[-+×x*÷/=^]\s*\d|[=≤≥<>]\s*-?\d|\bsolve\b|\bequation|\bsimplify|\bfactori[sz]e|\bcalculate|\bderivative|\bintegral|\bgrammar\b|\bessay\b|\btranslate|功課|作業|習題|題目|解方程|方程|計算|化簡|因式|求\s*[xyz]|[xyz]\s*係幾多|[xyz]\s*是多少|默書|作文|文法|翻譯|造句|溫習|測驗|考試|閱讀理解|物理|化學|生物|數學|英文|中文科)/i;
// Questions about Nest itself (the app).
const NEST_WORD = /(\bnest\b|巢|呢個\s*app|這個\s*app|this app|插件|plugin|功課導師|溫習測驗|家庭記憶|提醒|日曆|交通|訂閱|家庭成員|家庭成员|成員|成员|邀請|邀请|family members?|add (a )?member|invite|reminders?|calendar|family memory|usage|settings|subscriptions?|transport|連接|连接|用量|設定|設置|plan\b|計劃|计划|方案|beta|圖示|图标|icon|頭像|头像|個人頁|个人页|profile|密碼|密码|password|語言|语言|language|主題|主题|dark mode|深色|通知|notification|工作室|studio|今日摘要|主頁|主页|home tab|more tab|更多)/i;
const HOW = /(點樣|點先|怎樣|怎样|怎么|怎麼|如何|在哪|喺邊|邊度|哪裡|哪里|where|how (do|can|to)|can i|可唔可以|可不可以|能不能|係咩|是什麼|是什么|是甚麼|what is|what's|what does|有咩用|有什麼用|有什么用|點用|怎用|教我)/i;
// The user's own account / live state.
const STATE = /(我(今日|今天|本週|本周|今個星期|這星期|这星期)?\s*(用咗|用了|用左|已用)|用量|幾多\s*%|几多|剩返|剩下|還剩|还剩|我係咩\s*plan|我是什麼|我是什么|我嘅\s*plan|我的\s*(plan|計劃|计划|方案)|我(係|是)咪\s*pro|my (usage|plan|settings|account|family|plugins?)|what plan|which plan|how much (have i|did i|i've|is left)|am i (on )?(pro|free|beta)|我裝咗|我安裝了|我有咩插件|我有什麼插件|我家庭有|我屋企有|我連接咗|我連接了|我的設定|我嘅設定|我而家|我現在|beta.*(幾時|何時|什麼時候|when).*(完|到期|expire)|幾時到期|何时到期|何時到期)/i;
// Factual / entity / current-events questions (look up instead of guessing).
const FACT = /(係咩|係乜|系咩|是什麼|是什么|是甚麼|什麼是|什么是|甚麼是|乜嘢係|邊個|是誰|是谁|誰是|谁是|邊間|哪間|哪家|幾時成立|何時成立|什么时候成立|創辦|创办|創立|创立|總裁|总裁|行政總裁|首席執行官|ceo|cto|founder|founded|公司|company|產品|产品|product|model|模型|who (is|was|are|founded|owns|made|created|runs)|what (is|are|was) |what's |tell me about|介紹一下|介绍一下|講下|讲下|history of|歷史|历史|最新|latest|news|新聞|新闻|recent|今年|this year|發佈|发布|release|版本|人口|population|特首|行政長官|行政长官|首都|capital of|總統|总统|president of|prime minister|首相|天氣預報|比分|score of|who won|邊隊贏|誰贏|谁赢)/i;

export function classify(text, mode = 'chat') {
  // A reply-language request (「用英文答我」) is not part of the question (and 英文 there is not the school subject).
  const q = norm(String(text || '').replace(/(請|请)?(用|以|轉用|改用)\s*(廣東話|粵語|广东话|粤语|英文|英語|中文|簡體|简体|繁體)\s*(答我|回答|回覆|回复|答)\s*[：:，,]?/g, ' ').replace(/\b(please )?(reply|answer) in (english|chinese|cantonese)[:,]?/gi, ' ')).slice(0, 400);
  const out = { lookup: '', guide: false, state: false };
  if (mode !== 'chat' || !q || q.length < 2) return out;
  const homework = HOMEWORK.test(q);
  out.state = STATE.test(q);
  const aboutNest = NEST_WORD.test(q) && (HOW.test(q) || /\bnest\b|巢/i.test(q));
  out.guide = aboutNest || out.state;
  // Questions about the assistant itself ("你係咩？", "who are you?") are not lookups.
  const aboutSelf = /(^|[：:，,\s])(你|您)\s*(係|是|系)\s*(咩|乜|誰|谁|什麼|什么|甚麼|邊個)|\b(who|what) are you\b/i.test(q);
  const whatsNew = WHATSNEW_RE.test(q); // "what's new in Nest" is answered from the changelog, never Wikipedia
  if (whatsNew) out.guide = true;
  if (!homework && !aboutNest && !out.state && !aboutSelf && !whatsNew && FACT.test(q)) out.lookup = lookupQuery(q);
  return out;
}
// Follow-ups: "佢最新嗰個呢？" / "And its CEO?" carry no topic of their own → the previous user question's topic is added.
// msgs: [{ role, text }] (oldest first). Returns the lookup query to use ('' = none).
const PRONOUN = /(佢|佢哋|它|他|她|它們|他們|這個|这个|那個|那个|呢個|嗰個|\bit\b|\bits\b|\bthey\b|\btheir\b|\bthat\b|\bthis one\b|\bthe company\b)/i;
export function followUpLookup(msgs, ground) {
  const list = (msgs || []).filter((m) => m && m.role === 'user');
  const last = norm(list[list.length - 1]?.text);
  const prev = norm(list[list.length - 2]?.text);
  if (!prev || ground.guide || ground.state || HOMEWORK.test(last)) return ground.lookup || '';
  const own = ground.lookup || '';
  const hasEntity = /[A-Za-z]{2,}/.test(own.replace(/\b(latest|newest|news|ceo|model|version|recent|current|it|its|they|and|what|about|how|who|is|the)\b/gi, '')) || (own.replace(/(最新|最近|模型|版本|公司|佢|它|他|她|個|个|嗰|呢|那|這|这)/g, '').match(/[\u3400-\u9fff]/g) || []).length >= 2;
  const followUp = PRONOUN.test(last) || (/^(and|what about|how about|咁|那|那麼|噉|仲有)/i.test(last)) || LATEST_RE.test(last);
  if (own && hasEntity) return own;
  if (!followUp && !own) return '';
  const pc = classify(prev, 'chat');
  if (!pc.lookup) return own.replace(PRONOUN, '').trim().length >= 2 ? own : '';
  return norm(`${pc.lookup} ${own.replace(PRONOUN, ' ')}`).slice(0, 80);
}

// Strip question words so the search engine gets the entity / topic.
export function lookupQuery(q) {
  let s = norm(q)
    .replace(/(請|请)?(用|以|轉用|改用)\s*(廣東話|粵語|广东话|粤语|英文|英語|中文|簡體|简体|繁體)\s*(答我|回答|回覆|回复|答)?/g, ' ')
    .replace(/\b(reply|answer) in (english|chinese|cantonese)\b/gi, ' ')
    .replace(/[?？!！。，,.、:：「」『』"'“”]/g, ' ')
    .replace(/\b(who|what|which|when|where|is|are|was|were|the|a|an|of|tell me about|please|do you know|can you|explain)\b/gi, ' ')
    .replace(/(請問|请问|你知唔知|你知道|係咩|係乜|系咩|是什麼|是什么|是甚麼|什麼是|什么是|甚麼是|乜嘢係|邊個係|邊個|是誰|是谁|誰是|谁是|介紹一下|介绍一下|講下|讲下|呀|啊|嗎|吗|呢|嘅|的|咩|乜|吖|啦|喎|吓|一下)/g, ' ');
  s = norm(s);
  return s.slice(0, 80) || norm(q).slice(0, 80);
}

// ---------- Wikipedia (server-side PRE-retrieval: runs before the model is called; no function calling) ----------
const UA = 'NestFamilyHelper/1.0 (https://nesty.cyou; contact: nest@nesty.cyou) grounding';
export const wikiLang = (lang) => (lang === 'en' ? 'en' : 'zh');
export const wikiVariant = (lang) => (lang === 'zh-Hans' ? 'zh-cn' : lang === 'en' ? '' : 'zh-hk');
// "Latest / newest / news / this year" questions: the full article is read and its most recent dated paragraphs are used.
export const LATEST_RE = /(最新|最近|新嘅|新的|新版|latest|newest|most recent|recent|current|currently|now\b|news|新聞|新闻|今年|this year|最近期|近期|現時|现时|目前)/i;
const DISAMBIG_RE = /(may refer to|most commonly refers to|can refer to|可以指|可指|可能指|可以是下列|消歧義|消歧义)/i;
// Latin entity words of a Chinese question → an English search ("Claude 最新模型" → "Claude model").
export function enQuery(q) {
  const map = [[/模型/g, ' model '], [/公司/g, ' company '], [/(行政總裁|總裁|总裁|首席執行官|首席执行官)/g, ' CEO '], [/(創辦人|创办人|創始人|创始人)/g, ' founder '], [/手機|手机/g, ' phone '], [/遊戲|游戏/g, ' game ']];
  let s = String(q || '');
  for (const [re, w] of map) s = s.replace(re, w);
  s = s.replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim();
  return /[a-z]{2,}/i.test(s) ? s.slice(0, 80) : '';
}
// Most recent dated paragraphs of an article (by the latest year mentioned; ties keep article order).
export function latestParas(text, budget = 1100) {
  const paras = String(text || '').split(/\n+/).map((x) => x.trim()).filter((x) => x.length > 30 && !/^=+/.test(x));
  const yr = (x) => Math.max(0, ...(x.match(/(?:19|20)\d\d(?=年|\b)/g) || []).map(Number));
  const top = Math.max(0, ...paras.map(yr));
  if (!top) return '';
  const pick = paras.map((x, i) => ({ x, i, y: yr(x) })).filter((p) => p.y >= top - 1);
  const out = []; let n = 0;
  for (const p of pick.slice(-6).reverse()) { if (n + p.x.length > budget && out.length) break; out.unshift(p); n += p.x.length; }
  return out.sort((a, b) => a.i - b.i).map((p) => p.x.slice(0, 500)).join('\n');
}
// fetchImpl injected for tests. → [{ title, url, extract, updated, latest, wl }] (≤ 3) or [] on timeout / nothing found.
// `info` (optional object) is filled with what ran: { queries: [...], wikis: [...], error }.
export async function wikiLookup(query, lang, { fetchImpl = fetch, timeoutMs = 3000, latest, info = {} } = {}) {
  if (!query) return [];
  const isLatest = latest ?? LATEST_RE.test(query);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const get = async (url) => {
    const r = await fetchImpl(url, { signal: ctl.signal, headers: { 'user-agent': UA, 'api-user-agent': UA, accept: 'application/json' } });
    if (!r.ok) throw new Error(`wiki ${r.status}`);
    return r.json();
  };
  const api = (wl, params) => `https://${wl}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&utf8=1&origin=*&${params}`;
  info.queries = []; info.wikis = [];
  // Search words only: "latest / 最新" and leftover copulas hurt Wikipedia search ("最新 Claude 模型係" → "Claude 模型").
  const bare = (q) => String(q || '').replace(LATEST_RE, ' ').replace(/(係|是|個|个|嘅|的|邊個|边个|哪個|哪个|which|version|版本)/gi, ' ').replace(/\s+/g, ' ').trim() || String(q || '');
  query = bare(query);
  // One request: search + intro extract + URL + last-edit time; disambiguation pages are skipped.
  const one = async (wl, variant, q) => {
    info.queries.push(`${wl}:${q}`);
    const v = variant ? `&variant=${variant}` : '';
    const j = await get(api(wl, `generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=extracts|info|revisions|pageprops&ppprop=disambiguation&rvprop=timestamp&inprop=url&explaintext=1&exintro=1&exchars=900${v}`));
    const pages = (j?.query?.pages || []).filter((p) => p.extract && !p.pageprops && !DISAMBIG_RE.test(p.extract.slice(0, 200))).sort((a, b) => a.index - b.index).slice(0, 2);
    const items = pages.map((p) => ({
      title: String(p.title || '').slice(0, 120),
      url: String(p.fullurl || `https://${wl}.wikipedia.org/wiki/${encodeURIComponent(String(p.title || '').replace(/ /g, '_'))}`),
      extract: String(p.extract || '').replace(/\s+/g, ' ').slice(0, 700),
      updated: p.revisions?.[0]?.timestamp || p.touched || '', wl,
    }));
    if (isLatest && items[0]) {
      const f = await get(api(wl, `titles=${encodeURIComponent(items[0].title)}&prop=extracts&explaintext=1${v}`)).catch(() => null);
      const lp = latestParas(f?.query?.pages?.[0]?.extract || '');
      if (lp) items[0].latest = lp;
    }
    if (items.length) info.wikis.push(wl);
    return items;
  };
  try {
    const wl = wikiLang(lang);
    const eq = wl !== 'en' && isLatest ? enQuery(query) : '';
    // Latest questions also read English Wikipedia in parallel (usually updated first).
    const [main, en] = await Promise.all([one(wl, wikiVariant(lang), query).catch((e) => { info.error = String(e?.message || e); return []; }), eq ? one('en', '', eq).catch(() => []) : []]);
    let out = main;
    if (!out.length && wl !== 'en') out = await one('en', '', enQuery(query) || query).catch((e) => { info.error = String(e?.message || e); return []; });
    if (en.length && !out.some((x) => x.wl === 'en')) out = [...out.slice(0, 2), en[0]];
    return out.slice(0, 3);
  } catch (e) { info.error = String(e?.message || e); return []; } finally { clearTimeout(timer); if (ctl.signal.aborted && !info.error) info.error = 'timeout'; }
}
// ---------- Run 27: real web search (Tavily keyless → Firecrawl keyless → Wikipedia), server-side PRE-retrieval ----------
// Only runs when classify() gave a lookup query (facts / latest / news) — never for normal chat or homework.
// Keyless quotas are shared per IP, so identical normalized queries are cached per instance for 10 minutes (small LRU).
const WEB_TTL = 10 * 60e3; const WEB_MAX = 60;
const webCache = new Map(); // key → { at, items, provider }
export const _webCache = webCache; // tests
const NEWS_RE = /(news|新聞|新闻|頭條|头条|headline|今日|今天|today|this week|本週|本周|今個星期|這星期|这星期|最近發生|最近发生|breaking)/i;
const TODAY_RE = /(今日|今天|today|tonight|今晚|this week|本週|本周|今個星期|這星期|这星期)/i;
const HK_RE = /(香港|hong ?kong|\bhk\b|港鐵|港铁|九龍|九龙|新界|特首|行政長官|立法會|天文台)/i;
export const webCacheKey = (q, lang, latest) => `${lang === 'en' ? 'en' : 'zh'}|${latest ? 1 : 0}|${norm(q).toLowerCase().replace(/[?？!！。，,.、]/g, '').replace(/\s+/g, ' ')}`;
export function webQuery(query, { now = Date.now(), latest = false } = {}) {
  let q = norm(norm(query).replace(/(係|是|系)$/, '')).slice(0, 120);
  // "today / this week" questions get the Hong Kong date so results are about today, not an old page.
  // News questions: the news topic + time range already mean "today/this week" — date words and 有/咩 only slow Tavily down.
  if (latest && /(news|新聞|新闻|頭條|头条|headline)/i.test(q)) return norm(q.replace(new RegExp(TODAY_RE.source, 'gi'), ' ').replace(/(有|咩|乜|什麼|什么|甚麼)/g, ' ')).slice(0, 160) || norm(query);
  if (TODAY_RE.test(q)) q = `${q} ${new Date(now + 8 * 3600e3).toISOString().slice(0, 10)}`;
  else if (latest && !/\b20\d\d\b/.test(q)) q = `${q} ${new Date(now + 8 * 3600e3).getUTCFullYear()}`;
  return q.slice(0, 160);
}
const clip = (s, n) => String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*_`>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const okUrl = (u) => /^https?:\/\/[^\s]+$/i.test(String(u || ''));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
async function timedFetch(fetchImpl, url, init, ms) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.max(50, ms));
  try { return await fetchImpl(url, { ...init, signal: ctl.signal }); } catch (e) { const er = new Error(ctl.signal.aborted ? 'timeout' : String(e?.message || e)); er.code = ctl.signal.aborted ? 'timeout' : 'network'; throw er; } finally { clearTimeout(t); }
}
// Request shapes (exported for tests). Tavily: keyless header unless TAVILY_API_KEY is set (then Bearer only).
export function tavilyRequest(q, { latest = false, hk = false, key = '' } = {}) {
  const news = latest && NEWS_RE.test(q); void hk;
  const body = { query: q, search_depth: 'basic', max_results: 5, include_answer: false, include_raw_content: false, topic: news ? 'news' : 'general' };
  if (news) body.time_range = TODAY_RE.test(q) ? 'day' : 'week';
  else if (latest) body.time_range = 'year';
  // (Tavily's country boost has no Hong Kong entry — 'hong kong' is a 400; include_domains made news search slow and thin.)
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`; else headers['x-tavily-access-mode'] = 'keyless';
  return { url: 'https://api.tavily.com/search', init: { method: 'POST', headers, body: JSON.stringify(body) } };
}
// Firecrawl keyless: same REST endpoint, no Authorization header (FIRECRAWL_API_KEY → Bearer if ever set).
export function firecrawlRequest(q, { latest = false, hk = false, key = '', timeoutMs = 2000 } = {}) {
  const body = { query: q, limit: 5, sources: ['web'], timeout: Math.max(1000, Math.round(timeoutMs)) };
  if (latest) body.tbs = TODAY_RE.test(q) ? 'qdr:d' : NEWS_RE.test(q) ? 'qdr:w' : 'qdr:y';
  if (hk) { body.country = 'HK'; body.location = 'Hong Kong'; }
  const headers = { 'content-type': 'application/json', accept: 'application/json' };
  if (key) headers.authorization = `Bearer ${key}`;
  return { url: 'https://api.firecrawl.dev/v2/search', init: { method: 'POST', headers, body: JSON.stringify(body) } };
}
const httpErr = (provider, r) => { const e = new Error(`${provider} ${r.status}`); e.status = r.status; e.code = r.status === 429 ? 'rate_limited' : r.status >= 500 ? 'server' : 'http'; return e; };
export async function tavilySearch(q, o = {}) {
  const { url, init } = tavilyRequest(q, o);
  const r = await timedFetch(o.fetchImpl || fetch, url, init, o.timeoutMs || 1600);
  if (!r.ok) throw httpErr('tavily', r);
  const j = await r.json();
  return (Array.isArray(j?.results) ? j.results : []).filter((x) => okUrl(x?.url)).slice(0, 5).map((x) => ({
    title: clip(x.title || hostOf(x.url), 120), url: String(x.url), extract: clip(x.content, 600), updated: String(x.published_date || ''), site: hostOf(x.url), provider: 'tavily',
  }));
}
export async function firecrawlSearch(q, o = {}) {
  const { url, init } = firecrawlRequest(q, o);
  const r = await timedFetch(o.fetchImpl || fetch, url, init, o.timeoutMs || 1200);
  if (!r.ok) throw httpErr('firecrawl', r);
  const j = await r.json();
  const list = Array.isArray(j?.data) ? j.data : [...(j?.data?.web || []), ...(j?.data?.news || [])];
  return list.filter((x) => okUrl(x?.url)).slice(0, 5).map((x) => ({
    title: clip(x.title || x.metadata?.title || hostOf(x.url), 120), url: String(x.url), extract: clip(x.description || x.snippet || x.markdown, 600), updated: String(x.date || ''), site: hostOf(x.url), provider: 'firecrawl',
  }));
}
// Tavily → Firecrawl → Wikipedia inside one budget (default 3.1 s). Each step only runs if the previous one failed
// (429 / 5xx / timeout / network / empty). info: { provider, ms, cached, tried: [...], errors: [...], error }.
export async function webLookup(query, lang, { fetchImpl = fetch, env = {}, latest, budgetMs = 3100, now = Date.now(), info = {}, wiki = wikiLookup } = {}) {
  info.tried = []; info.errors = []; info.cached = false; info.provider = ''; info.ms = 0;
  if (!query) return [];
  const t0 = Date.now(); const deadline = t0 + budgetMs; const left = () => deadline - Date.now();
  const isLatest = latest ?? LATEST_RE.test(query);
  const key = webCacheKey(query, lang, isLatest);
  const hit = webCache.get(key);
  if (hit && now - hit.at < WEB_TTL) { webCache.delete(key); webCache.set(key, hit); Object.assign(info, { provider: hit.provider, cached: true, ms: Date.now() - t0 }); return hit.items; }
  if (hit) webCache.delete(key);
  const q = webQuery(query, { now, latest: isLatest });
  const hk = HK_RE.test(query);
  const done = (items, provider) => {
    info.provider = provider; info.ms = Date.now() - t0;
    if (items.length) { webCache.set(key, { at: now, items, provider }); while (webCache.size > WEB_MAX) webCache.delete(webCache.keys().next().value); }
    return items;
  };
  const steps = [
    ['tavily', () => tavilySearch(q, { fetchImpl, latest: isLatest, hk, key: env.TAVILY_API_KEY || '', timeoutMs: Math.min(1700, left() - 1100) })],
    ['firecrawl', () => firecrawlSearch(q, { fetchImpl, latest: isLatest, hk, key: env.FIRECRAWL_API_KEY || '', timeoutMs: Math.min(1500, left() - 500) })],
  ];
  for (const [name, run] of steps) {
    if (left() < 500) break;
    info.tried.push(name);
    try { const items = await run(); if (items.length) return done(items, name); info.errors.push(`${name}:empty`); } catch (e) { info.errors.push(`${name}:${e.status || e.code || 'error'}`); }
  }
  if (left() > 250) {
    info.tried.push('wikipedia');
    const wi = {};
    const items = (await wiki(query, lang, { fetchImpl, timeoutMs: left(), latest: isLatest, info: wi }).catch(() => [])).map((x) => ({ ...x, provider: 'wikipedia' }));
    if (items.length) return done(items, 'wikipedia');
    info.errors.push(`wikipedia:${wi.error || 'empty'}`);
  }
  info.error = info.errors.some((x) => /timeout/.test(x)) ? 'timeout' : info.errors.length ? info.errors.join(',') : 'timeout';
  return done([], 'none');
}
// Final reminder (last system message) when web results exist — light models otherwise fall back to "I can't browse".
export function groundNote(items, latest = false) {
  const web = (items || []).filter((x) => x.provider && x.provider !== 'wikipedia');
  if (!web.length) return '';
  return `\nNest already searched the web for this message (WEB LOOKUP THIS TURN above, ${web.length} result(s)). Answer from those results${latest ? ' — for news, summarise the actual stories with their outlet names' : ''}. Do not say you cannot browse or access real-time information.`;
}
// One no-content log line per looked-up turn (Vercel logs): which provider answered, how long, cache, fallbacks.
export const groundLogLine = (info = {}, n = 0) => `[nest-ground] provider=${info.provider || 'none'} ms=${info.ms || 0} cached=${info.cached ? 1 : 0} n=${n} tried=${(info.tried || []).join('>') || '-'} err=${(info.errors || []).join(',') || '-'}`;
const hkWhen = (iso) => { const t = Date.parse(iso || ''); return t ? new Date(t + 8 * 3600e3).toISOString().slice(0, 10) : ''; };
// What the model is told about this turn's lookup — always truthful: what ran, what came back, what failed.
export function sourcesBlock(items, lang, { query = '', error = '', latest = false } = {}) {
  if (!query && !items?.length) return '';
  if (!items?.length) {
    return `\n\nWEB LOOKUP THIS TURN: Nest searched the web for "${query}" just now, but ${error === 'timeout' ? 'the search did not answer in time' : error ? 'the search services were busy or failed' : 'it found nothing usable'}. Say briefly that you tried searching online and found nothing usable this time, then answer only what you are sure of (or say you are not sure). Never say you are unable to search or browse.`;
  }
  const wiki = items.every((x) => !x.provider || x.provider === 'wikipedia');
  if (wiki) {
    const lines = items.map((x, i) => `[${i + 1}] ${x.title} — ${x.url}${x.updated ? ` (article last edited ${hkWhen(x.updated)})` : ''}\n${x.extract}${x.latest ? `\nMost recent part of the article:\n${x.latest}` : ''}`).join('\n\n');
    return `\n\nWEB LOOKUP THIS TURN (Wikipedia, fetched by Nest just now for "${query}" — ${items.length} article(s); live web search was unavailable):\n${lines}\nAnswer from these facts and prefer them over memory. You DID look this up: never say you cannot search or browse. Mention briefly that this is from Wikipedia (in Chinese write 維基百科). Do not paste the URLs — the app shows them as source chips under your reply.${latest ? ' The user asked for the latest/current information: give the most recent item the articles mention (with its date), and add one short note that Wikipedia may lag behind very recent announcements (article last edited on the date shown).' : ''} If they do not answer the question, say so instead of guessing.${lang === 'zh-Hans' ? ' (Write names in Simplified Chinese.)' : ''}`;
  }
  const lines = items.map((x, i) => `[${i + 1}] ${x.title} — ${x.site || hostOf(x.url)} — ${x.url}${x.updated ? ` (published ${String(x.updated).slice(0, 25)})` : ''}\n${x.extract}`).join('\n\n');
  return `\n\nWEB LOOKUP THIS TURN (live web search run by Nest just now for "${query}" — ${items.length} result(s); search snippets, not full pages):\n${lines}\nAnswer from these results and prefer them over memory. You DID search the web: never say you cannot search or browse. Mention the source sites briefly by name (e.g. 「根據 RTHK、SCMP 的報道」 / "according to Reuters"); do not paste the URLs — the app shows them as source chips under your reply. If results disagree or are old, say so and give dates when they are shown.${latest ? ' The user asked for the latest/current information: lead with the most recent item and its date. For a news question, list the main stories from these results (headline + one line each, with the outlet name). Never say you cannot access real-time or live news — these results ARE today\'s live search.' : ''} If the results do not answer the question, say so instead of guessing.${lang === 'zh-Hans' ? ' (Write names in Simplified Chinese.)' : ''}`;
}
export const FACT_RULE = `\n\nFacts and web lookups: Nest searches the web for you automatically (server-side, before you answer; Wikipedia as a backup) when the user asks about a fact, product, company, person or recent event; any results for this turn appear below as WEB LOOKUP THIS TURN. So never say you cannot search the web or browse. If no WEB LOOKUP block is given, no lookup ran for this question: answer from what you know, and if you are not certain, say briefly that you are not sure. Never guess facts about products, companies, people, prices or recent events. Example of a mistake to avoid: Claude is a family of AI models (LLMs) made by the company Anthropic — Claude is not a company.`;

// ---------- Nest app guide (deep links are rendered as in-app links by the client) ----------
const GUIDE_EN = `NEST APP GUIDE (use for questions about the app; give short steps and link pages as markdown links exactly as written, e.g. [Family](/app/family)):
- [Today](/app): daily summary (grouped by weather, notices, bills, school, calendar, family), warnings, go-out bus/MTR card, AI proactive notices, widgets from plugins. Refresh with 重新生成.
- [AI assistant](/app/agent): chat; history drawer (swipe from left / menu button), new chat, search, rename/pin/delete; attach photos/PDF/DOCX (plan limit per day); it can create reminders, memories, settings changes (with Undo).
- [Homework tutor](/app/tutor): photo or text of a question → hints step by step; Reveal answer; Similar question. The assistant and tutor show interactive graphs, diagrams, quizzes and flashcards when helpful.
- Drawing: the AI assistant and tutor CAN draw right in the chat — diagrams (physics, optics e.g. light refraction, circuits, forces, geometry), function graphs with sliders, bar/line/pie charts and simple illustrations; just ask, e.g. "Draw a light refraction diagram". They cannot make photos or realistic pictures.
- [What's new](/app/changelog): every update (Settings → About Nest, or the avatar menu).
- [Revision quiz](/app/quiz): paste notes → flashcards + multiple choice.
- [Family memory](/app/memory): notes the whole family sees; people/knowledge; private notes; remember-from-chats switch in Settings.
- [Reminders](/app/reminders): add, assign to a member, due time; push notifications if enabled.
- [Calendar](/app/calendar): day/week/month; Google + Apple calendars + Nest events + HK holidays; + to add.
- [Transport](/app/transport): saved stops, next bus/MTR, leave-time planner.
- [Subscriptions](/app/subscriptions): track services, renewal dates, decide keep/cancel.
- [Family](/app/family): members and roles; add a member = Family → Invite (share the link or code); owner can remove members; plan member limit applies.
- [Connections](/app/connections): connect Google (Gmail, Calendar, Classroom, Drive) and Apple Calendar; 檢查連接 / reconnect.
- [Plugin Store](/app/store): install themes, tabs and Home widgets; Safe/verified badges; each plugin asks for permissions; manage or revoke in [Settings](/app/settings#plugins). Build your own in [Creator Studio](/app/studio) (AI projects with version history, submit for review).
- [Usage & plan](/app/usage): today/week usage % and plan; Free 100/day·400/week, Starter 300·1,500, Pro 800·4,000; paid plans are a waitlist (no payments yet); Beta promo gives Pro for a month to the first 10 families at /beta.
- [Settings](/app/settings): profile photo, name, @handle, [public profile](/app/profile); language (繁體 / 简体 / English, also in the avatar menu); theme light/dark/system; text size; App icon picker (Settings → Appearance); notifications & quiet hours; reply style, tutor mode; change password (email accounts only); export data; sign out.
- Avatar menu (top right / sidebar bottom): profile, family, connections, usage, settings, language, help, sign out. Phone: More tab lists every page.`;
const GUIDE_ZH = `NEST 使用指南（回答有關本 app 的問題時使用；給簡短步驟，頁面連結照下面的 markdown 格式寫，例如 [家庭](/app/family)）：
- [今天](/app)：今日摘要（按天氣、通告、帳單、學校、日曆、家庭分組）、天氣警告、出門巴士／港鐵卡、AI 主動通知、插件小工具；按「重新生成」更新。
- [AI 助理](/app/agent)：聊天；對話記錄（左邊滑入或按選單鍵）、新對話、搜尋、重新命名／釘選／刪除；可附加相片、PDF、DOCX（每日上限視乎計劃）；可新增提醒、記憶、更改設定（可復原）。
- [功課導師](/app/tutor)：拍題目或輸入 → 逐步提示；可「顯示答案」及「類似題目」。AI 助理及功課導師在有需要時會顯示互動圖表、受力圖、小測、閃卡等。
- 畫圖：AI 助理及功課導師可以直接在對話中畫圖——物理及光學圖（例如光的折射）、電路、受力圖、幾何圖、可拉動滑桿的函數圖、棒形／折線／圓形圖，以及簡單插圖；直接說「畫一個光的折射圖」即可。不能生成相片或寫實圖像。
- [最新動態](/app/changelog)：每次更新的內容（設定 → 關於 Nest，或頭像選單）。
- [溫習測驗](/app/quiz)：貼上筆記 → 字卡及選擇題。
- [家庭記憶](/app/memory)：全家可見的記錄、人物資料、私人記錄；「從對話記住」開關在設定。
- [提醒](/app/reminders)：新增、指派成員、時間；開啟通知後會推送。
- [日曆](/app/calendar)：日／週／月；Google、Apple 日曆、Nest 活動及香港假期；按「+」新增。
- [交通](/app/transport)：已儲存車站、下一班巴士／港鐵、出門時間。
- [訂閱](/app/subscriptions)：記錄服務、續訂日、決定保留或取消。
- [家庭](/app/family)：成員及角色；加成員 = 家庭 → 邀請（分享連結或代碼）；擁有人可移除成員；人數上限視乎計劃。
- [連接](/app/connections)：連接 Google（Gmail、日曆、Classroom、Drive）及 Apple 日曆；「檢查連接」／重新授權。
- [插件商店](/app/store)：安裝主題、分頁及主頁小工具；有「安全」／認證標記；每個插件會先問權限，可在[設定](/app/settings#plugins)管理或撤銷。可在[創作工作室](/app/studio)自己做插件（AI 項目、版本記錄、提交審查）。
- [用量](/app/usage)：今日／本週用量百分比及計劃；Free 每日 100、每週 400；Starter 300／1,500；Pro 800／4,000；付費計劃現為輪候（未有收費）；Beta 推廣：首 10 個家庭免費用 Pro 一個月（/beta）。
- [設定](/app/settings)：頭像、名稱、@用戶名、[公開個人頁](/app/profile)；語言（繁體／简体／English，頭像選單亦可切換）；主題淺色／深色／跟隨系統；字體大小；App 圖示（設定 → 外觀）；通知及靜音時段；回覆風格、導師模式；更改密碼（只限電郵登入帳戶）；匯出資料；登出。
- 頭像選單（右上角／側欄底部）：個人資料、家庭、連接、用量、設定、語言、說明、登出。手機：「更多」分頁列出所有頁面。`;
export const nestGuide = (lang) => (lang === 'en' ? GUIDE_EN : GUIDE_ZH);

// ---------- the user's own state ----------
const pct = (n, max) => (max ? Math.min(100, Math.round((n / max) * 100)) : 0);
const hkDate = (ms) => (ms ? new Date(ms + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') + ' HKT' : '');
// server: { planId, source, until, base, betaUntil, day, week, daily, weekly }; client: compact snapshot (cleanSnapshot).
export function stateBlock(server = {}, client = {}) {
  const lines = [];
  if (server.daily) lines.push(`Usage (family, before this message): today ${pct(server.day, server.daily)}% of the daily limit, this week ${pct(server.week, server.weekly)}% (resets 00:00 HKT daily, Monday 00:00 HKT weekly). Show percentages only, never raw counts.`);
  if (server.planId) {
    const via = server.source === 'beta' ? `Beta promo (Pro free) until ${hkDate(server.until)}` : server.source === 'grant' ? `Pro granted by Nest until ${hkDate(server.until)}` : 'the family plan';
    lines.push(`Effective plan: ${server.planId} (via ${via}; family base plan: ${server.base || 'free'})${server.ended ? `; an earlier Pro gift/grant ended ${hkDate(server.ended)}` : ''}. Plans apply to the whole family. When asked which plan they are on, answer with the EFFECTIVE plan and its source + end date (e.g. 「Pro（Beta 優惠，至 2026-11-18）」 / "Pro (beta gift until 2026-11-18)"); never call an effective Pro plan Free.`);
  }
  const c = cleanSnapshot(client);
  if (c.lang || c.theme) lines.push(`Settings: language ${c.lang || '?'}, theme ${c.theme || '?'}, app icon ${c.icon || 'auto'}, push notifications ${c.push ? 'on' : 'off'}, reply style ${c.replyStyle || 'default'}.`);
  if (c.role) lines.push(`The user's role: ${c.role}${c.owner ? ' (family owner)' : ''}. Family members: ${c.members || '?'}.`);
  if (c.connected) lines.push(`Connected accounts (labels): ${c.connected}.`);
  if (c.plugins) lines.push(`Installed plugins: ${c.plugins}.`);
  if (c.reminders != null) lines.push(`Open reminders: ${c.reminders}${c.overdue ? ` (${c.overdue} overdue)` : ''}.`);
  if (c.attToday != null) lines.push(`Attachments sent today: ${c.attToday}.`);
  return lines.length ? `\n\nTHE USER'S OWN NEST ACCOUNT (live; answer questions about their account from this):\n- ${lines.join('\n- ')}` : '';
}
const cs = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
export function cleanSnapshot(x = {}) {
  if (!x || typeof x !== 'object') return {};
  const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(9999, Math.round(Number(v)))) : null);
  return {
    lang: cs(x.lang, 10), theme: cs(x.theme, 10), icon: cs(x.icon, 20), push: !!x.push, replyStyle: cs(x.replyStyle, 20),
    role: cs(x.role, 10), owner: !!x.owner, members: cs(x.members, 300), connected: cs(x.connected, 200), plugins: cs(x.plugins, 300),
    reminders: num(x.reminders), overdue: num(x.overdue), attToday: num(x.attToday),
  };
}

// ---------- fake "done" guard (api/chat.js) ----------
const DONE_RE = /(已(經|经)?\s*(正式|成功|順利|顺利)?\s*(幫你|帮你|為你|为你|同你)?\s*(設好|設定好|設置好|设好|设定好|设置好|新增|加咗|加入咗|加入了|建立|創建|创建|設立|设立|取消|刪除|删除|更改|改好|更新|記低|记下|記住|记住|安排好)|設好咗|设好咗|搞掂|搞定咗|\bi('ve| have) (set|added|created|scheduled|saved|cancelled|canceled|deleted|updated|removed)\b|\b(reminder|event) (is|has been) (set|added|created|scheduled)\b|\bdone[.!]?$)/im;
export const claimsDone = (text) => DONE_RE.test(String(text || '').replace(/```[\s\S]*?```/g, ''));
export function unclaim(text, lang = 'zh-Hant') {
  const note = lang === 'en' ? '(Not set yet — reply "yes" and I will show the card to confirm.)' : lang === 'zh-Hans' ? '（尚未设定——回复「好」，我会显示确认卡。）' : '（尚未設定——回覆「好」，我會顯示確認卡。）';
  const cleaned = String(text || '')
    .replace(/已經?\s*(幫你|為你|同你)?\s*(設好|設定好|設置好|新增|加咗|加入了|建立|安排好)/g, '可以幫你設定')
    .replace(/已经?\s*(帮你|为你)?\s*(设好|设定好|设置好|新增|加入了|建立|安排好)/g, '可以帮你设定')
    .replace(/\bi('ve| have) (set|added|created|scheduled|saved)\b/gi, 'I can set')
    .replace(/\b(reminder|event) (is|has been) (set|added|created|scheduled)\b/gi, '$1 is not set yet');
  return `${cleaned}\n\n${note}`;
}

// A pending (confirm-card) action must never read as done: "已幫你設好…" → "已準備好…，按確認即可設定".
export function softenClaim(full, lang = 'zh-Hant') {
  const parts = String(full || '').split(/(```[\s\S]*?```)/);
  let changed = false;
  const out = parts.map((p) => {
    if (p.startsWith('```') || !claimsDone(p)) return p;
    changed = true;
    return p
      .replace(/已經?\s*(正式|成功|順利)?\s*(幫你|為你|同你)?\s*(設好|設定好|設置好|新增|加咗|加入咗|加入了|建立|創建|安排好|設定)/g, '已準備好')
      .replace(/已经?\s*(正式|成功|顺利)?\s*(帮你|为你)?\s*(设好|设定好|设置好|新增|加入了|建立|创建|安排好|设定)/g, '已准备好')
      .replace(/\bi('ve| have) (set|added|created|scheduled|saved)\b/gi, "I've prepared")
      .replace(/\b(reminder|event) (is|has been) (set|added|created|scheduled)\b/gi, '$1 is ready to confirm');
  });
  if (!changed) return full;
  const note = lang === 'en' ? ' Tap Confirm to set it.' : lang === 'zh-Hans' ? '按确认即可设定。' : '按確認即可設定。';
  const i = out.findIndex((p) => p.startsWith('```'));
  if (i < 0) return out.join('') + note;
  out[i - 1] = `${String(out[i - 1] || '').trimEnd()}${note}\n`;
  return out.join('');
}
