import './_env.mjs';
// Run 27: real web search grounding — Tavily keyless → Firecrawl keyless → Wikipedia, cache, classify gating.
import test from 'node:test';
import assert from 'node:assert/strict';
import { groundNote, classify, webLookup, tavilyRequest, firecrawlRequest, webQuery, webCacheKey, _webCache, sourcesBlock, groundLogLine, FACT_RULE } from '../src/lib/grounding.js';

const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const TAV = { results: [{ url: 'https://news.rthk.hk/a', title: 'RTHK story', content: 'Hong Kong **news** text', published_date: 'Sat, 24 Oct 2026 05:00:00 GMT' }, { url: 'https://www.scmp.com/b', title: 'SCMP', content: 'More' }] };
const FC = { success: true, data: { web: [{ url: 'https://www.info.gov.hk/x', title: 'GovHK', description: 'Population is 7.5 million' }] } };
const WIKI = async () => [{ title: 'Hong Kong', url: 'https://zh.wikipedia.org/wiki/香港', extract: 'x', updated: '' }];
// fetch stub: routes by host; behaviour per provider: number = status, 'hang' = never answers, object = 200 body
function stub(beh) {
  const calls = [];
  const f = (url, init) => {
    const p = url.includes('tavily') ? 'tavily' : url.includes('firecrawl') ? 'firecrawl' : 'other';
    calls.push({ p, url, init });
    const b = beh[p];
    if (b === 'hang') return new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('aborted'))));
    if (typeof b === 'number') return Promise.resolve(res(b, { error: 'x' }));
    return Promise.resolve(res(200, b ?? {}));
  };
  f.calls = calls; return f;
}
const fresh = () => _webCache.clear();

test('request shapes: keyless header vs Bearer (Tavily), keyless/no auth (Firecrawl)', () => {
  const k = tavilyRequest('hk news today', { latest: true });
  assert.equal(k.url, 'https://api.tavily.com/search');
  assert.equal(k.init.headers['x-tavily-access-mode'], 'keyless'); assert.equal(k.init.headers.authorization, undefined);
  const kb = JSON.parse(k.init.body); assert.equal(kb.search_depth, 'basic'); assert.equal(kb.max_results, 5); assert.equal(kb.topic, 'news'); assert.equal(kb.time_range, 'day');
  const b = tavilyRequest('Anthropic CEO', { key: 'tvly-TEST' });
  assert.equal(b.init.headers.authorization, 'Bearer tvly-TEST'); assert.equal(b.init.headers['x-tavily-access-mode'], undefined);
  assert.equal(JSON.parse(b.init.body).topic, 'general');
  assert.equal(JSON.parse(tavilyRequest('香港人口', { hk: true }).init.body).country, undefined, 'Tavily has no HK country (400)');
  assert.equal(webQuery('香港特首係'), '香港特首');
  assert.equal(webQuery('今日香港有 新聞', { latest: true }), '香港 新聞', 'news: date words dropped (time_range covers it)');
  assert.equal(JSON.parse(tavilyRequest('Claude news', { latest: true }).init.body).include_domains, undefined);
  const f = firecrawlRequest('香港人口', { hk: true });
  assert.equal(f.url, 'https://api.firecrawl.dev/v2/search'); assert.equal(f.init.headers.authorization, undefined);
  const fb = JSON.parse(f.init.body); assert.equal(fb.limit, 5); assert.equal(fb.country, 'HK');
  assert.equal(firecrawlRequest('x', { key: 'fc-T' }).init.headers.authorization, 'Bearer fc-T');
});

test('provider choice: Tavily answers first; env key switches to Bearer', async () => {
  fresh(); const f = stub({ tavily: TAV, firecrawl: FC }); const info = {};
  const r = await webLookup('香港新聞', 'zh-Hant', { fetchImpl: f, info, wiki: WIKI });
  assert.equal(info.provider, 'tavily'); assert.equal(r.length, 2); assert.equal(r[0].url, 'https://news.rthk.hk/a'); assert.equal(r[0].site, 'news.rthk.hk');
  assert.ok(!/\*\*/.test(r[0].extract)); assert.deepEqual(f.calls.map((c) => c.p), ['tavily']);
  fresh(); const f2 = stub({ tavily: TAV }); await webLookup('Anthropic CEO', 'en', { fetchImpl: f2, env: { TAVILY_API_KEY: 'tvly-X' }, wiki: WIKI });
  assert.equal(f2.calls[0].init.headers.authorization, 'Bearer tvly-X'); assert.equal(f2.calls[0].init.headers['x-tavily-access-mode'], undefined);
});

test('fallback order: 429 / 5xx / timeout / empty → Firecrawl → Wikipedia', async () => {
  for (const tb of [429, 503, 'hang', { results: [] }]) {
    fresh(); const f = stub({ tavily: tb, firecrawl: FC }); const info = {};
    const t0 = Date.now();
    const r = await webLookup('香港人口', 'zh-Hant', { fetchImpl: f, info, wiki: WIKI });
    assert.equal(info.provider, 'firecrawl', String(tb)); assert.equal(r[0].url, 'https://www.info.gov.hk/x');
    assert.deepEqual(info.tried, ['tavily', 'firecrawl']); assert.ok(Date.now() - t0 < 3200);
  }
  fresh(); const f = stub({ tavily: 429, firecrawl: 500 }); const info = {};
  const r = await webLookup('香港人口', 'zh-Hant', { fetchImpl: f, info, wiki: WIKI });
  assert.equal(info.provider, 'wikipedia'); assert.equal(r[0].provider, 'wikipedia'); assert.deepEqual(info.tried, ['tavily', 'firecrawl', 'wikipedia']);
  assert.match(info.errors.join(','), /tavily:429,firecrawl:500/);
  // both hang → Wikipedia still gets time inside the budget
  fresh(); const f3 = stub({ tavily: 'hang', firecrawl: 'hang' }); const i3 = {}; const t0 = Date.now();
  const r3 = await webLookup('香港人口', 'zh-Hant', { fetchImpl: f3, info: i3, wiki: WIKI });
  assert.equal(i3.provider, 'wikipedia'); assert.equal(r3.length, 1); assert.ok(Date.now() - t0 < 3300, `${Date.now() - t0}ms`);
  // everything fails → [] + truthful block
  fresh(); const i4 = {}; const r4 = await webLookup('x y', 'en', { fetchImpl: stub({ tavily: 500, firecrawl: 500 }), info: i4, wiki: async () => [] });
  assert.deepEqual(r4, []); assert.equal(i4.provider, 'none'); assert.match(sourcesBlock(r4, 'en', { query: 'x y', error: i4.error }), /tried searching online/);
});

test('cache: identical normalized query is served from memory (no fetch), LRU-bounded, keyed by lang/latest', async () => {
  fresh(); const f = stub({ tavily: TAV }); const now = Date.now();
  await webLookup('Hong Kong news', 'en', { fetchImpl: f, wiki: WIKI, now });
  const info = {}; const r = await webLookup('  hong kong NEWS? ', 'en', { fetchImpl: f, wiki: WIKI, info, now: now + 60e3 });
  assert.equal(info.cached, true); assert.equal(info.provider, 'tavily'); assert.equal(r.length, 2); assert.equal(f.calls.length, 1);
  const i2 = {}; await webLookup('Hong Kong news', 'en', { fetchImpl: f, wiki: WIKI, info: i2, now: now + 11 * 60e3 });
  assert.equal(i2.cached, false, 'expired after 10 min'); assert.equal(f.calls.length, 2);
  assert.notEqual(webCacheKey('a', 'en', true), webCacheKey('a', 'en', false));
  for (let i = 0; i < 80; i++) await webLookup(`q${i}`, 'en', { fetchImpl: stub({ tavily: TAV }), wiki: WIKI });
  assert.ok(_webCache.size <= 60);
  // empty results are not cached
  fresh(); await webLookup('nothing', 'en', { fetchImpl: stub({ tavily: { results: [] }, firecrawl: { data: { web: [] } } }), wiki: async () => [] });
  assert.equal(_webCache.size, 0);
});

test('classify gating: facts / latest / HK facts search; normal chat, homework and app questions never do', () => {
  for (const q of ['今日香港有咩新聞？', 'What is the latest news about Anthropic?', '香港特首係邊個？', '香港人口有幾多？', 'Who is the CEO of Nvidia?']) assert.ok(classify(q).lookup, q);
  for (const q of ['你好呀', '早晨！今日好攰', '幫我寫一首關於貓的詩', 'Thanks!', '3x+5=20', '點樣加家庭成員？', '提醒我聽日八點交功課', '你係咩？']) assert.equal(classify(q).lookup, '', q);
});

test('queries use the HK date for today/latest; block + log line carry no content', () => {
  const now = Date.parse('2026-10-24T06:00:00Z');
  assert.equal(webQuery('香港 天氣 今日', { now }), '香港 天氣 今日 2026-10-24');
  assert.equal(webQuery('Claude latest model', { now, latest: true }), 'Claude latest model 2026');
  assert.equal(webQuery('Anthropic CEO', { now }), 'Anthropic CEO');
  const items = [{ title: 'RTHK story', url: 'https://news.rthk.hk/a', site: 'news.rthk.hk', extract: 'x', provider: 'tavily', updated: 'Sat, 24 Oct 2026' }];
  const b = sourcesBlock(items, 'zh-Hant', { query: '香港新聞', latest: true });
  assert.match(b, /live web search/); assert.match(b, /news\.rthk\.hk/); assert.match(b, /never say you cannot search/); assert.ok(!/Wikipedia/.test(b)); assert.match(b, /Never say you cannot access real-time/);
  assert.match(sourcesBlock([{ title: 'HK', url: 'https://zh.wikipedia.org/wiki/x', extract: 'e', provider: 'wikipedia' }], 'zh-Hant', { query: 'q' }), /維基百科/);
  const line = groundLogLine({ provider: 'firecrawl', ms: 812, cached: false, tried: ['tavily', 'firecrawl'], errors: ['tavily:429'] }, 5);
  assert.equal(line, '[nest-ground] provider=firecrawl ms=812 cached=0 n=5 tried=tavily>firecrawl err=tavily:429');
  assert.match(FACT_RULE, /searches the web/);
});

test('final grounding reminder only when web results exist', () => {
  assert.equal(groundNote([]), ''); assert.equal(groundNote([{ provider: 'wikipedia', url: 'https://zh.wikipedia.org/x' }]), '');
  assert.match(groundNote([{ provider: 'tavily', url: 'https://a' }], true), /summarise the actual stories/);
  assert.match(groundNote([{ provider: 'firecrawl', url: 'https://a' }]), /Do not say you cannot browse/);
});
