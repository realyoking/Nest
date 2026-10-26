// Hong Kong transport knowledge shared by the Transport tab, the Home go-out card and /api/chat:
// MTR station lookup (繁中 / English / common spellings), shortest MTR route with interchanges, direction-aware train
// filtering for getSchedule.php, and transport-question detection for the chat.
import { SEQS, ST } from './mtr-data.js';

export const LINE_NAMES = {
  AEL: ['機場快綫', 'Airport Express'], TCL: ['東涌綫', 'Tung Chung Line'], TML: ['屯馬綫', 'Tuen Ma Line'], TKL: ['將軍澳綫', 'Tseung Kwan O Line'],
  EAL: ['東鐵綫', 'East Rail Line'], SIL: ['南港島綫', 'South Island Line'], TWL: ['荃灣綫', 'Tsuen Wan Line'], ISL: ['港島綫', 'Island Line'],
  KTL: ['觀塘綫', 'Kwun Tong Line'], DRL: ['迪士尼綫', 'Disneyland Resort Line'],
};
export const LINE_COLORS = { AEL: '#00888a', TCL: '#f7943e', TML: '#923011', TKL: '#7d499d', EAL: '#53b7e8', SIL: '#bac429', TWL: '#e2231a', ISL: '#0075c2', KTL: '#00a040', DRL: '#f173ac' };
export const ST_CODES = Object.keys(ST);
export const SEQ_OF = (line) => SEQS[line] || {};
export const stationName = (code, lang = 'zh-Hant') => (ST[code] ? ST[code][lang === 'en' ? 1 : 0] : code);
export const lineName = (line, lang = 'zh-Hant') => (line === 'WALK' ? (lang === 'en' ? 'Walk (interchange)' : '步行轉乘') : LINE_NAMES[line] ? LINE_NAMES[line][lang === 'en' ? 1 : 0] : line);
export const allStations = () => Object.entries(ST).map(([code, [tc, en]]) => ({ code, tc, en, lines: linesAt(code) }));
export function linesAt(code) { return Object.keys(SEQS).filter((l) => Object.values(SEQS[l]).some((s) => s.includes(code))); }

// Extra spellings people use (lower-case, spaces removed).
const ALIAS = { shatin: 'SHT', 沙田站: 'SHT', taiwai: 'TAW', 大圍站: 'TAW', tst: 'TST', 尖沙嘴: 'TST', tsimshatsui: 'TST', mongkok: 'MOK', 旺角站: 'MOK', central: 'CEN', admiralty: 'ADM', causewaybay: 'CAB', 銅鑼灣站: 'CAB', airport: 'AIR', 機場站: 'AIR', hunghom: 'HUH', kowloontong: 'KOT', mongkokeast: 'MKK', shatinwai: 'STW', chekungtemple: 'CKT', 車公廟站: 'CKT', ustation: 'UNI', 中大: 'UNI', cuhk: 'UNI', 港大: 'HKU', hku: 'HKU', 迪士尼: 'DIS', disney: 'DIS', disneyland: 'DIS', lohas: 'LHP', 康城: 'LHP', 沙田圍站: 'STW', 第一城: 'CIO', cityone: 'CIO', 大學站: 'UNI' };
const norm = (s) => String(s || '').toLowerCase().replace(/[\s'’.\-]/g, '');
let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  const names = [];
  Object.entries(ST).forEach(([code, [tc, en]]) => { names.push([tc, code]); names.push([norm(en), code]); });
  Object.entries(ALIAS).forEach(([k, code]) => names.push([norm(k), code]));
  INDEX = names.filter(([k]) => k.length >= 2).sort((a, b) => b[0].length - a[0].length); // longest first: 沙田圍 before 沙田
  return INDEX;
}
// All station mentions in the text, in order of appearance: [{ code, at, name }]
export function findStations(text) {
  const raw = String(text || '');
  // Normalised copy with a position map back to the raw text (so "from tai wai to sha tin" keeps its order).
  let n = ''; const pos = [];
  for (let i = 0; i < raw.length; i++) { const c = raw[i].toLowerCase(); if (/[\s'’.\-]/.test(c)) continue; n += c; pos.push(i); }
  const taken = new Array(n.length).fill(false); const out = [];
  for (const [k, code] of index()) {
    let from = 0;
    for (;;) {
      const i = n.indexOf(k, from); if (i < 0) break; from = i + 1;
      if (taken.slice(i, i + k.length).some(Boolean)) continue;
      // Latin names must not be part of a longer word ("central" in "centralised" is fine to skip).
      if (/^[a-z]/.test(k)) {
        const s0 = pos[i]; const e0 = pos[i + k.length - 1] + 1;
        if (/[a-z]/i.test(raw[s0 - 1] || '') || /[a-z]/i.test(raw[e0] || '')) continue;
      }
      for (let j = i; j < i + k.length; j++) taken[j] = true;
      out.push({ code, at: pos[i], name: k });
    }
  }
  return out.sort((a, b) => a.at - b.at).filter((x, i, a) => i === 0 || a[i - 1].code !== x.code);
}
export function stationByText(text) { return findStations(text)[0]?.code || ''; }

// ---------- routing ----------
const PER_STOP = { AEL: 8, DRL: 4 }; // minutes per stop (approx.); default 2.5
const TRANSFER = 7; // minutes per interchange (also discourages zig-zag routes)
let GRAPH = null;
function graph() {
  if (GRAPH) return GRAPH;
  const g = new Map();
  const add = (a, b, line, variant, w) => { if (!g.has(a)) g.set(a, []); g.get(a).push({ to: b, line, variant, w }); };
  Object.entries(SEQS).forEach(([line, vs]) => Object.entries(vs).forEach(([variant, seq]) => {
    for (let i = 0; i + 1 < seq.length; i++) { const w = PER_STOP[line] || 2.5; add(seq[i], seq[i + 1], line, variant, w); add(seq[i + 1], seq[i], line, variant, w); }
  }));
  // Walking interchanges (paid-area links): Central ↔ Hong Kong, Tsim Sha Tsui ↔ East Tsim Sha Tsui.
  [['CEN', 'HOK'], ['TST', 'ETS']].forEach(([a, b]) => { add(a, b, 'WALK', 'walk', 6); add(b, a, 'WALK', 'walk', 6); });
  GRAPH = g; return g;
}
// Shortest route (Dijkstra over (station, line) states). → { legs:[{ line, variant, from, to, stops, dir: 'fwd'|'back' }], minutes } | null
export function planMtr(from, to) {
  if (!ST[from] || !ST[to] || from === to) return null;
  const g = graph();
  const key = (s, l) => `${s}|${l}`;
  const dist = new Map(); const prev = new Map(); const q = [];
  linesAt(from).forEach((l) => { dist.set(key(from, l), 0); q.push([0, from, l]); });
  let best = null;
  while (q.length) {
    q.sort((a, b) => a[0] - b[0]);
    const [d, s, l] = q.shift();
    if (d > (dist.get(key(s, l)) ?? Infinity)) continue;
    if (s === to) { best = [s, l]; break; }
    for (const e of g.get(s) || []) {
      const nd = d + e.w + (e.line !== l && e.line !== 'WALK' && l !== 'WALK' ? TRANSFER : 0);
      const k = key(e.to, e.line);
      if (nd < (dist.get(k) ?? Infinity)) { dist.set(k, nd); prev.set(k, [s, l, e.variant]); q.push([nd, e.to, e.line]); }
    }
  }
  if (!best) return null;
  const path = []; let cur = key(best[0], best[1]);
  while (prev.has(cur)) { const [s, l, v] = prev.get(cur); const [cs, cl] = cur.split('|'); path.unshift({ from: s, to: cs, line: cl, variant: v, prevLine: l }); cur = key(s, l); }
  const legs = [];
  for (const step of path) {
    const last = legs[legs.length - 1];
    if (last && last.line === step.line) { last.to = step.to; last.stops++; last.variants.add(step.variant); } else legs.push({ line: step.line, from: step.from, to: step.to, stops: 1, variants: new Set([step.variant]) });
  }
  const out = legs.map((L) => {
    if (L.line === 'WALK') return { line: 'WALK', variant: 'walk', from: L.from, to: L.to, stops: 0, dir: 'walk', minutes: 6 };
    const variant = [...L.variants].find((v) => { const s = SEQS[L.line][v]; return s.includes(L.from) && s.includes(L.to); }) || [...L.variants][0];
    const seq = SEQS[L.line][variant];
    return { line: L.line, variant, from: L.from, to: L.to, stops: L.stops, dir: seq.indexOf(L.to) > seq.indexOf(L.from) ? 'fwd' : 'back', minutes: Math.round(L.stops * (PER_STOP[L.line] || 2.5)) };
  });
  return { legs: out, minutes: Math.round(out.reduce((a, l) => a + l.minutes, 0) + out.filter((l, i) => i > 0 && l.line !== 'WALK' && out[i - 1].line !== 'WALK').length * TRANSFER) };
}
// Does a train terminating at `dest` take you from leg.from to leg.to? (Handles branches: a Lo Wu train never reaches Lok Ma Chau.)
export function trainServes(leg, dest) {
  return Object.values(SEQS[leg.line] || {}).some((seq) => {
    const a = seq.indexOf(leg.from); const b = seq.indexOf(leg.to); const d = seq.indexOf(dest);
    if (a < 0 || b < 0 || d < 0) return false;
    return b > a ? d >= b : d <= b;
  });
}
// getSchedule normalised rows ({ UP:[{t,dest,plat}], DOWN:[…] }) → the next trains for this leg, soonest first.
export function trainsForLeg(mtr, leg, now = Date.now()) {
  return [...(mtr?.UP || []), ...(mtr?.DOWN || [])].filter((x) => x.t >= now - 30e3 && trainServes(leg, x.dest)).sort((a, b) => a.t - b.t);
}

// ---------- chat: transport questions ----------
const TRANSPORT_RE = /港鐵|地鐵|鐵路|火車|列車|班車|巴士|小巴|九巴|城巴|下一班|尾班|幾時有車|到站|車程|點去|怎樣去|怎麼去|搭車|轉車|\bmtr\b|\btrain\b|\bbus\b|\bminibus\b|next (train|bus)|how (do|can) i get|how to get|get to|commute|\beta\b|kmb|citybus|which line|platform/i;
const BUS_ROUTE = /(?:^|[^A-Za-z0-9])((?:[ABEKNPRSX]?\d{1,3}[A-Z]?))(?:號)?(?:\s*(?:號?巴士|bus|路線|線))/i;
// → null | { kind: 'mtr', from, to } | { kind: 'station', at } | { kind: 'bus', route, near }
export function transportQuery(text) {
  const t = String(text || '');
  const st = findStations(t);
  const isQ = TRANSPORT_RE.test(t) || (st.length >= 2 && /(去|到|往|返|→|->|\bto\b|from)/i.test(t));
  if (!isQ) return null;
  const bus = BUS_ROUTE.exec(t) || /(?:bus|巴士|route|路線)\s*([ABEKNPRSX]?\d{1,3}[A-Z]?)\b/i.exec(t);
  if (bus) return { kind: 'bus', route: bus[1].toUpperCase(), near: st[0]?.code || '', to: st[1]?.code || '' };
  if (st.length >= 2) {
    // "to X from Y" / 「由Y去X」 → order by the from/to words, else first mention = origin.
    let [a, b] = st;
    const lower = t.toLowerCase();
    const fromIdx = Math.max(lower.lastIndexOf('from '), t.lastIndexOf('由'), t.lastIndexOf('從'));
    if (fromIdx >= 0 && b.at > fromIdx && a.at < fromIdx) [a, b] = [b, a];
    return { kind: 'mtr', from: a.code, to: b.code };
  }
  if (st.length === 1) return { kind: 'station', at: st[0].code };
  return { kind: 'general' };
}
const HK = 8 * 3600e3;
const hm = (ms) => new Date(ms + HK).toISOString().slice(11, 16);
// Plain-text block for the model (English labels; the model answers in the app language).
export function transportContext(q, data, now = Date.now()) {
  if (!q || !data) return '';
  const L = (code) => `${stationName(code)} ${stationName(code, 'en')}`;
  const lines = [`LIVE Hong Kong transport data fetched just now (${hm(now)} HKT). Use these real minutes; never say you lack real-time access.`];
  if (data.plan) {
    const p = data.plan;
    lines.push(`MTR route ${L(q.from)} → ${L(q.to)}: ${p.legs.map((l) => `${lineName(l.line)} ${lineName(l.line, 'en')} from ${L(l.from)} to ${L(l.to)} (${l.stops} stop${l.stops > 1 ? 's' : ''}, ~${l.minutes} min, towards ${l.towards ? L(l.towards) : '?'})`).join(' then change to ')}. Estimated ride ~${p.minutes} min.`);
    const first = p.legs[0];
    if (data.trains?.length) lines.push(`Next trains at ${L(first.from)} on the ${lineName(first.line, 'en')} going your way: ${data.trains.slice(0, 4).map((x) => `${hm(x.t)} (in ${Math.max(0, Math.round((x.t - now) / 60e3))} min, to ${L(x.dest)}${x.plat ? `, platform ${x.plat}` : ''})`).join('; ')}.`);
    else lines.push(`No live train times came back for ${L(first.from)} right now (service may have ended or the feed is down).`);
    if (data.status && data.status !== 'green') lines.push(`Line status: ${data.status}${data.statusMsg ? ` — ${data.statusMsg}` : ''}.`);
  }
  if (data.station) lines.push(`Next trains at ${L(data.station.code)}: ${data.station.rows.map((r) => `${lineName(r.line, 'en')} to ${L(r.dest)} ${hm(r.t)} (in ${Math.max(0, Math.round((r.t - now) / 60e3))} min)`).slice(0, 8).join('; ') || 'none returned'}.`);
  if (data.buses?.length) lines.push(`Bus ETAs: ${data.buses.slice(0, 6).map((b) => `${b.co.toUpperCase()} ${b.route} at ${b.stop} towards ${b.dest}: ${b.etas.slice(0, 3).map((t) => `${hm(t)} (in ${Math.max(0, Math.round((t - now) / 60e3))} min)`).join(', ') || 'no ETA'}`).join(' | ')}.`);
  if (data.note) lines.push(data.note);
  return lines.join('\n');
}
