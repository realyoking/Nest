// Vetted renderers for ```nest-ui``` blocks (see src/lib/nestui/spec.js). Everything is drawn by Nest's own React/SVG
// code from validated numbers and short strings; text goes through React (escaped) or InlineMd (marked + DOMPurify + KaTeX).
// No model-written HTML/SVG/JS is ever inserted, and nothing is evaluated except ./expr.js trees.
import { useId, useMemo, useState } from 'react';
import { compile } from '../lib/nestui/expr.js';
import { texLabel, labelParts, mediumLabel } from '../lib/nestui/spec.js';
import DOMPurify from 'dompurify';
import { InlineMd } from './ui.jsx';
import { useI18n } from '../lib/i18n.jsx';

const T = {
  'zh-Hant': { tir: '全反射', badTitle: '未能顯示圖表', retry: '重試', badBody: '這個圖表的格式有誤，可以請 Nest 重新畫一次。', next: '下一步', all: '全部顯示', again: '重新作答', score: '得分 {a}/{b}', correct: '答對了', wrong: '答錯了，正確答案是 {x}', flip: '點按翻轉', prev: '上一張', nextCard: '下一張', loading: '正在準備互動內容…', bad: '未能顯示這個互動內容。', of: '{a} / {b}', reset: '重設', step: '第 {n} 步' },
  'zh-Hans': { tir: '全反射', badTitle: '未能显示图表', retry: '重试', badBody: '这个图表的格式有误，可以请 Nest 重新画一次。', next: '下一步', all: '全部显示', again: '重新作答', score: '得分 {a}/{b}', correct: '答对了', wrong: '答错了，正确答案是 {x}', flip: '点按翻转', prev: '上一张', nextCard: '下一张', loading: '正在准备互动内容…', bad: '未能显示这个互动内容。', of: '{a} / {b}', reset: '重设', step: '第 {n} 步' },
  en: { tir: 'Total internal reflection', badTitle: 'Couldn’t show this diagram', retry: 'Try again', badBody: 'The diagram data was malformed. Ask Nest to draw it again.', next: 'Next step', all: 'Show all', again: 'Try again', score: 'Score {a}/{b}', correct: 'Correct', wrong: 'Not quite — the answer is {x}', flip: 'Tap to flip', prev: 'Previous', nextCard: 'Next', loading: 'Preparing the interactive view…', bad: 'This interactive view could not be shown.', of: '{a} / {b}', reset: 'Reset', step: 'Step {n}' },
};
function useTx() {
  const { lang } = useI18n();
  const d = T[lang] || T['zh-Hant'];
  return (k, v = {}) => String(d[k] || k).replace(/\{(\w+)\}/g, (m, n) => (v[n] ?? m));
}

export function NestUIPending() {
  const tx = useTx();
  return <div className="nui nui-pending" data-testid="nui-pending" role="status"><span className="nui-shimmer" />{tx('loading')}</div>;
}
// Invalid / undrawable block: a friendly card (never raw JSON) + 重試 (asks Nest to draw it again) when the chat allows it.
export function NestUIBad({ text, onRetry }) {
  const tx = useTx();
  const [open, setOpen] = useState(false);
  return (
    <div className="nui nui-bad" data-testid="nui-bad" role="note">
      <div className="nui-bad-head"><b>{tx('badTitle')}</b><span className="muted small">{tx('badBody')}</span></div>
      <div className="nui-row">
        {onRetry && <button type="button" className="btn btn-secondary btn-sm" data-testid="nui-retry" onClick={onRetry}>{tx('retry')}</button>}
        {text && <button type="button" className="nui-link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '−' : '+'} {tx('all')}</button>}
      </div>
      {text && open && <div className="nui-bad-text">{text}</div>}
    </div>
  );
}

// ```nest-svg```: already rebuilt from a strict allowlist by src/lib/nestui/svg.js; DOMPurify (SVG profile, no
// foreignObject / href) runs again here as defence in depth before it is inserted.
export function NestSvg({ svg, title }) {
  const html = useMemo(() => DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, FORBID_TAGS: ['foreignObject', 'image', 'use', 'a', 'style', 'script', 'animate', 'set', 'animateTransform', 'animateMotion'], FORBID_ATTR: ['href', 'xlink:href', 'style'] }), [svg]);
  return (
    <figure className="nui nui-svgblock" data-testid="nui-svg">
      {title && <figcaption className="nui-title">{title}</figcaption>}
      <div className="nui-canvas" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}

export default function NestUI({ spec }) {
  const C = { plot: Plot, diagram: Diagram, chart: Chart, quiz: Quiz, steps: Steps, flashcards: Flashcards, timeline: Timeline, compare: Compare }[spec.type];
  if (!C) return <NestUIBad />;
  return (
    <figure className={`nui nui-${spec.type}`} data-testid={`nui-${spec.type}`}>
      {spec.title && <figcaption className="nui-title"><InlineMd text={spec.title} /></figcaption>}
      <C spec={spec} />
      {spec.caption && <p className="nui-caption"><InlineMd text={spec.caption} /></p>}
    </figure>
  );
}

// ---------- SVG helpers ----------
function SvgLabel({ x, y, text, anchor = 'middle', size = 15, cls = '', dy = 0 }) {
  const parts = labelParts(texLabel(text));
  if (!parts.length) return null;
  return (
    <text x={x} y={y} dy={dy} textAnchor={anchor} fontSize={size} className={`nui-svgtext ${cls}`}>
      {parts.map((p, i) => (p.sub ? <tspan key={i} baselineShift="sub" fontSize={size * 0.72}>{p.t}</tspan> : <tspan key={i}>{p.t}</tspan>))}
    </text>
  );
}
const colorVar = (c) => `var(--nui-${c || 'ink'})`;
function niceTicks(lo, hi, n = 6) {
  const span = hi - lo; if (!(span > 0)) return [lo];
  const raw = span / n; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
  const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9 && out.length < 30; v += step) out.push(+v.toFixed(10));
  return out;
}
const fmt = (v) => { const a = Math.abs(v); return a >= 1e4 || (a > 0 && a < 1e-3) ? v.toExponential(1) : String(+v.toFixed(a < 1 ? 3 : a < 10 ? 2 : 1)); };

// ---------- plot ----------
function Plot({ spec }) {
  const tx = useTx();
  const init = Object.fromEntries(spec.sliders.map((s) => [s.name, s.value]));
  const [vals, setVals] = useState(init);
  const names = spec.sliders.map((s) => s.name);
  const fns = useMemo(() => spec.fns.map((f) => (f.kind === 'y'
    ? { ...f, y: compile(f.expr, ['x', ...names]).fn }
    : { ...f, fx: compile(f.x, ['t', ...names]).fn, fy: compile(f.y, ['t', ...names]).fn, ft: f.tMax ? compile(f.tMax, names).fn : null })), [spec]); // eslint-disable-line
  const pts = useMemo(() => spec.points.map((p) => ({ ...p, fx: compile(p.at[0], names).fn, fy: compile(p.at[1], names).fn })), [spec]); // eslint-disable-line
  const W = 440, H = 290, P = { l: 40, r: 12, t: 12, b: 30 };
  const sample = (vals, N = 260) => {
    const [x0, x1] = spec.domain;
    const series = fns.map((f) => {
      const out = [];
      if (f.kind === 'y') for (let i = 0; i <= N; i++) { const x = x0 + ((x1 - x0) * i) / N; out.push([x, f.y({ ...vals, x })]); }
      else {
        let t1 = f.t[1];
        if (f.ft) { const v = f.ft(vals); if (Number.isFinite(v) && v > f.t[0]) t1 = Math.min(v, 1e5); }
        for (let i = 0; i <= N; i++) { const t = f.t[0] + ((t1 - f.t[0]) * i) / N; out.push([f.fx({ ...vals, t }), f.fy({ ...vals, t })]); }
      }
      return out;
    });
    const marks = pts.map((p) => ({ x: p.fx(vals), y: p.fy(vals), label: p.label })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    return { series, marks };
  };
  const data = useMemo(() => sample(vals), [fns, pts, vals, spec.domain]); // eslint-disable-line
  // Axes stay FIXED while sliders move (otherwise auto-scaling hides the change, e.g. a trajectory that only grows):
  // ranges come from the initial values plus every slider at its min / max (≤ 2^4 corner combinations).
  const allParam = fns.every((f) => f.kind === 'param');
  const finite = (a) => a.filter(Number.isFinite);
  const [xa, xb, ya, yb] = useMemo(() => {
    const combos = [init];
    const sl = spec.sliders;
    for (let m = 0; m < (1 << sl.length); m++) combos.push(Object.fromEntries(sl.map((x, i) => [x.name, (m >> i) & 1 ? x.max : x.min])));
    const runs = combos.map((c) => sample(c, 90));
    let x0 = spec.domain[0], x1 = spec.domain[1];
    if (allParam && !spec.domainGiven) {
      const xs = finite(runs.flatMap((r) => r.series.flatMap((s) => s.map((p) => p[0]))));
      if (xs.length) { x0 = Math.min(0, ...xs); x1 = Math.max(...xs); if (x1 - x0 < 1e-9) x1 = x0 + 1; }
    }
    if (spec.range) return [x0, x1, spec.range[0], spec.range[1]];
    const q = (ys, k) => ys[Math.min(ys.length - 1, Math.max(0, Math.round(k * (ys.length - 1))))];
    const lows = [], highs = [];
    for (const r of runs) {
      const ys = finite(r.series.flatMap((s) => s.map((p) => p[1]))).concat(r.marks.map((m) => m.y)).sort((a, c) => a - c);
      if (ys.length) { lows.push(q(ys, 0.02)); highs.push(q(ys, 0.98)); }
    }
    if (!lows.length) return [x0, x1, -1, 1];
    let y0 = Math.min(0, ...lows), y1 = Math.max(0, ...highs);
    if (y1 - y0 < 1e-9) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.08;
    return [x0, x1, y0 < 0 ? y0 - pad : y0, y1 + pad];
  }, [fns, pts, spec]); // eslint-disable-line
  const sx = (x) => P.l + ((x - xa) / (xb - xa)) * (W - P.l - P.r);
  const sy = (y) => H - P.b - ((y - ya) / (yb - ya)) * (H - P.t - P.b);
  const path = (s) => {
    let d = ''; let pen = false;
    for (const [x, y] of s) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || y < ya - (yb - ya) * 3 || y > yb + (yb - ya) * 3) { pen = false; continue; }
      d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(Math.max(ya - (yb - ya), Math.min(yb + (yb - ya), y))).toFixed(1)}`; pen = true;
    }
    return d;
  };
  const cid = useId().replace(/:/g, '');
  const xt = niceTicks(xa, xb, 7), yt = niceTicks(ya, yb, 5);
  return (
    <>
      <div className="nui-canvas">
        <svg viewBox={`0 0 ${W} ${H}`} className="nui-svg" role="img" aria-label={spec.title || 'plot'}>
          <defs><clipPath id={`c${cid}`}><rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} /></clipPath></defs>
          {xt.map((v) => <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={P.t} y2={H - P.b} className="nui-grid" />)}
          {yt.map((v) => <line key={`gy${v}`} y1={sy(v)} y2={sy(v)} x1={P.l} x2={W - P.r} className="nui-grid" />)}
          {ya <= 0 && yb >= 0 && <line x1={P.l} x2={W - P.r} y1={sy(0)} y2={sy(0)} className="nui-axis" />}
          {xa <= 0 && xb >= 0 && <line y1={P.t} y2={H - P.b} x1={sx(0)} x2={sx(0)} className="nui-axis" />}
          {xt.map((v) => <text key={`tx${v}`} x={sx(v)} y={H - P.b + 16} textAnchor="middle" className="nui-tick">{fmt(v)}</text>)}
          {yt.map((v) => <text key={`ty${v}`} x={P.l - 6} y={sy(v) + 4} textAnchor="end" className="nui-tick">{fmt(v)}</text>)}
          <g clipPath={`url(#c${cid})`}>
            {data.series.map((s, i) => <path key={i} d={path(s)} fill="none" stroke={colorVar(fns[i].color)} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />)}
            {data.marks.map((m, i) => <circle key={i} cx={sx(m.x)} cy={sy(m.y)} r="4.5" fill={colorVar('ink')} />)}
          </g>
          {data.marks.map((m, i) => m.label && (sx(m.x) > W - 90 ? <SvgLabel key={i} x={sx(m.x) - 7} y={sy(m.y) - 10} text={m.label} anchor="end" size={14} /> : <SvgLabel key={i} x={sx(m.x) + 7} y={sy(m.y) - 10} text={m.label} anchor="start" size={14} />))}
          {spec.xLabel && <SvgLabel x={W - P.r} y={H - 4} text={spec.xLabel} anchor="end" size={13} cls="nui-axislabel" />}
          {spec.yLabel && <SvgLabel x={P.l + 4} y={P.t + 12} text={spec.yLabel} anchor="start" size={13} cls="nui-axislabel" />}
        </svg>
      </div>
      {fns.some((f) => f.label) && <div className="nui-legend">{fns.map((f, i) => f.label && <span key={i}><i style={{ background: colorVar(f.color) }} /><InlineMd text={f.label} /></span>)}</div>}
      {spec.sliders.length > 0 && (
        <div className="nui-sliders">
          {spec.sliders.map((s) => (
            <label key={s.name} className="nui-slider">
              <span className="nui-slider-l"><InlineMd text={s.label} /></span>
              <input type="range" min={s.min} max={s.max} step={s.step} value={vals[s.name]} aria-label={texLabel(s.label)}
                onChange={(e) => setVals((v) => ({ ...v, [s.name]: +e.target.value }))} />
              <output>{fmt(vals[s.name])}{s.unit ? ` ${s.unit}` : ''}</output>
            </label>
          ))}
          <button type="button" className="nui-link" onClick={() => setVals(init)}>{tx('reset')}</button>
        </div>
      )}
    </>
  );
}

// ---------- diagram ----------
const rad = (d) => (d * Math.PI) / 180;
function inclineGeom(it) {
  const [x0, y0] = it.at; const a = rad(it.angle); const L = it.length;
  const A = [x0, y0], B = [x0 + L * Math.cos(a), y0], C = [x0 + L * Math.cos(a), y0 + L * Math.sin(a)];
  const s = it.size; const d = it.pos * L;
  const n = [-Math.sin(a), Math.cos(a)];
  const center = [x0 + d * Math.cos(a) + n[0] * s / 2, y0 + d * Math.sin(a) + n[1] * s / 2];
  const dirAngle = (f) => (f.dir === 'weight' ? -90 : f.dir === 'normal' ? it.angle + 90 : f.dir === 'down-slope' ? it.angle + 180 : f.dir === 'angle' ? f.angle : f.angle != null ? f.angle : it.angle);
  return { A, B, C, center, dirAngle };
}
function bounds(items) {
  const xs = [], ys = [];
  const add = (p, r = 0) => { xs.push(p[0] - r, p[0] + r); ys.push(p[1] - r, p[1] + r); };
  for (const it of items) {
    if (Array.isArray(it.from)) add(it.from); if (Array.isArray(it.to)) add(it.to);
    if (it.points) it.points.forEach((p) => add(p));
    if (it.type === 'force') { add(it.at); add([it.at[0] + it.length * Math.cos(rad(it.angle)), it.at[1] + it.length * Math.sin(rad(it.angle))], 0.5); }
    else if (it.type === 'rect') add(it.at, Math.hypot(it.w, it.h) / 2);
    else if (it.type === 'circle' || it.type === 'angle' || it.type === 'arc') add(it.at, it.r);
    else if (it.type === 'boundary') { const d = [it.to[0] - it.from[0], it.to[1] - it.from[1]]; const l = Math.hypot(d[0], d[1]) || 1; const nR = [d[1] / l, -d[0] / l]; add([it.from[0] + nR[0] * it.depth, it.from[1] + nR[1] * it.depth]); add([it.to[0] + nR[0] * it.depth, it.to[1] + nR[1] * it.depth]); add([it.from[0] - nR[0] * 0.9, it.from[1] - nR[1] * 0.9]); }
    else if (it.type === 'axes') { add([it.x[0], it.at[1]]); add([it.x[1] + 0.4, it.at[1]]); add([it.at[0], it.y[0]]); add([it.at[0], it.y[1] + 0.4]); }
    else if (it.type === 'mirror' && it.curved) { add([it.at[0] - (it.f ? Math.abs(it.f) : 0), it.at[1]]); add([it.at[0] + it.h * 0.3, it.at[1]]); }
    else if (it.type === 'lens') add(it.at, it.h / 2 + 0.3), it.f && (add([it.at[0] - Math.abs(it.f), it.at[1]]), add([it.at[0] + Math.abs(it.f), it.at[1]]));
    else if (it.type === 'incline') {
      const g = inclineGeom(it); add(g.A); add(g.B); add(g.C);
      it.forces.forEach((f) => add([g.center[0] + f.length * Math.cos(rad(g.dirAngle(f))), g.center[1] + f.length * Math.sin(rad(g.dirAngle(f)))], 0.6));
    } else if (it.at) add(it.at, 0.3);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function Diagram({ spec }) {
  const tx = useTx();
  const mid = useId().replace(/:/g, '');
  const b = bounds(spec.items);
  if (spec.size) { b.x0 = Math.min(b.x0, 0); b.y0 = Math.min(b.y0, 0); b.x1 = Math.max(b.x1, spec.size[0]); b.y1 = Math.max(b.y1, spec.size[1]); }
  const pad = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.08 + 0.4;
  const wx = b.x1 - b.x0 + pad * 2, wy = b.y1 - b.y0 + pad * 2;
  const W = 440; const k = W / wx; const H = Math.min(420, Math.max(140, wy * k)); const kk = Math.min(k, H / wy);
  const ox = (W - wx * kk) / 2, oy = (H - wy * kk) / 2;
  const X = (x) => ox + (x - b.x0 + pad) * kk; const Y = (y) => H - oy - (y - b.y0 + pad) * kk;
  const P = (p) => [X(p[0]), Y(p[1])];
  const sw = 2.4;
  const arrow = (from, to, c, key, label, dashed) => {
    const [x1, y1] = P(from), [x2, y2] = P(to);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    return (
      <g key={key}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorVar(c)} strokeWidth={sw + 0.4} markerEnd={`url(#a${mid}-${c})`} strokeDasharray={dashed ? '6 5' : undefined} />
        {label && <SvgLabel x={x2 + Math.cos(ang) * 14} y={y2 + Math.sin(ang) * 14 + 4} text={label} anchor={Math.cos(ang) > 0.3 ? 'start' : Math.cos(ang) < -0.3 ? 'end' : 'middle'} cls="nui-flabel" />}
      </g>
    );
  };
  // Optics convention: arrowhead half-way along the ray.
  const cxMid = X((b.x0 + b.x1) / 2);
  const cyMid = Y((b.y0 + b.y1) / 2);
  const midRay = (it, key) => {
    const [x1, y1] = P(it.from), [x2, y2] = P(it.to); const xm = (x1 + x2) / 2, ym = (y1 + y2) / 2;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    // label near the outer end (the one farther from the diagram centre), offset sideways away from the centre
    const far1 = Math.hypot(x1 - cxMid, y1 - cyMid) > Math.hypot(x2 - cxMid, y2 - cyMid);
    const k = far1 ? 0.2 : 0.8; const lx = x1 + (x2 - x1) * k, ly = y1 + (y2 - y1) * k;
    let nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
    if (Math.abs(nx) > 0.25 ? nx * (lx - cxMid) < 0 : ny > 0) { nx = -nx; ny = -ny; } // sideways: away from the centre line; flat rays: above
    return (
      <g key={key}>
        <polyline points={`${x1},${y1} ${xm},${ym} ${x2},${y2}`} fill="none" stroke={colorVar(it.color)} strokeWidth={sw + 0.4} strokeLinecap="round" markerMid={it.head === 'none' ? undefined : `url(#a${mid}-${it.color})`} strokeDasharray={it.dashed ? '6 5' : undefined} />
        {it.label && <SvgLabel x={lx + nx * 14} y={ly + ny * 14 + 5} text={it.label} anchor={nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle'} cls="nui-flabel" size={14} />}
      </g>
    );
  };
  const colors = [...new Set(spec.items.flatMap((it) => [it.color, ...(it.forces || []).map((f) => f.color)]))];
  const along = (it, key, draw) => { // circuit part in local coords: length L along +x, centred
    const [x1, y1] = P(it.from), [x2, y2] = P(it.to); const L = Math.hypot(x2 - x1, y2 - y1); const a = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    const m = [(x1 + x2) / 2, (y1 + y2) / 2];
    return (
      <g key={key}>
        <g transform={`translate(${x1} ${y1}) rotate(${a})`} stroke={colorVar(it.color)} strokeWidth={sw} fill="none">{draw(L)}</g>
        {it.label && (Math.abs(x2 - x1) >= Math.abs(y2 - y1)
          ? <SvgLabel x={m[0]} y={m[1] - 20} text={it.label} />
          : m[0] < W * 0.3 ? <SvgLabel x={m[0] + 24} y={m[1] + 5} text={it.label} anchor="start" />
            : <SvgLabel x={m[0] - 22} y={m[1] + 5} text={it.label} anchor="end" />)}
      </g>
    );
  };
  const comp = (L, w, inner) => (<><line x1="0" y1="0" x2={(L - w) / 2} y2="0" /><line x1={(L + w) / 2} y1="0" x2={L} y2="0" /><g transform={`translate(${L / 2} 0)`}>{inner}</g></>);
  const els = spec.items.map((it, i) => {
    const c = colorVar(it.color); const dash = it.dashed ? '6 5' : undefined;
    switch (it.type) {
      case 'mirror': if (it.curved || it.hatch) {
        if (it.curved) {
          const [cx, cy] = P(it.at); const h = (it.h * kk) / 2; const bulge = (it.kind === 'concave' ? 1 : -1) * h * 0.45; const fx = it.f ? Math.abs(it.f) * kk : 0;
          return <g key={i}><path d={`M${cx},${cy - h} Q${cx + bulge},${cy} ${cx},${cy + h}`} fill="none" stroke={c} strokeWidth={4.5} strokeLinecap="round" />
            {fx > 0 && <><circle cx={cx - fx} cy={cy} r="3.5" fill={c} /><SvgLabel x={cx - fx} y={cy + 20} text="F" /></>}
            {it.label && <SvgLabel x={cx} y={cy - h - 10} text={it.label} />}</g>;
        }
        const [x1, y1] = P(it.from), [x2, y2] = P(it.to); const L = Math.hypot(x2 - x1, y2 - y1) || 1; const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
        const ticks = []; for (let d = 6; d < L - 4 && ticks.length < 60; d += 12) ticks.push(d);
        return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={4.5} strokeLinecap="round" />
          {ticks.map((d) => { const px = x1 + ux * d, py = y1 + uy * d; return <line key={d} x1={px} y1={py} x2={px - uy * 9 - ux * 6} y2={py + ux * 9 - uy * 6} stroke={c} strokeWidth="1.4" />; })}
          {it.label && <SvgLabel x={x2 - 4} y={y2 + 26} text={it.label} anchor="end" size={13} />}</g>;
      }
      // falls through (plain mirror line)
      case 'line': case 'wire': {
        const [x1, y1] = P(it.from), [x2, y2] = P(it.to);
        return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={it.type === 'mirror' ? 5 : sw} strokeDasharray={dash} strokeLinecap="round" />{it.label && <SvgLabel x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} text={it.label} />}</g>;
      }
      case 'ray': return it.head === 'end' ? arrow(it.from, it.to, it.color, i, it.label, it.dashed) : midRay(it, i);
      case 'arrow': return arrow(it.from, it.to, it.color, i, it.label, it.dashed);
      case 'boundary': {
        const [x1, y1] = P(it.from), [x2, y2] = P(it.to); const L = Math.hypot(x2 - x1, y2 - y1) || 1; const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
        const nx = -uy, ny = ux; // screen right-hand normal (= below for a left→right line)
        const dpx = it.depth * kk;
        const topTxt = mediumLabel(it.top, it.n1), botTxt = mediumLabel(it.bottom, it.n2);
        return (
          <g key={i}>
            <polygon points={`${x1},${y1} ${x2},${y2} ${x2 + nx * dpx},${y2 + ny * dpx} ${x1 + nx * dpx},${y1 + ny * dpx}`} fill={colorVar(it.fillColor)} className="nui-medium" stroke="none" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorVar(it.color)} strokeWidth={sw} strokeLinecap="round" />
            {topTxt && <SvgLabel x={x1 + ux * 8 - nx * 12} y={y1 + uy * 8 - ny * 12} text={topTxt} anchor="start" size={14} />}
            {botTxt && <SvgLabel x={x1 + ux * 8 + nx * 24} y={y1 + uy * 8 + ny * 24} text={botTxt} anchor="start" size={14} />}
          </g>
        );
      }
      case 'normal': {
        const [x1, y1] = P(it.from), [x2, y2] = P(it.to); const top = y1 < y2 ? [x1, y1] : [x2, y2];
        return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorVar(it.color)} strokeWidth={sw - 0.6} strokeDasharray={it.dashed ? '7 6' : undefined} />{it.label && <SvgLabel x={top[0] + 7} y={top[1] + 12} text={it.label} anchor="start" size={13} cls="nui-axislabel" />}</g>;
      }
      case 'axes': {
        const o0 = it.at; const xa0 = [it.x[0], o0[1]], xa1 = [it.x[1], o0[1]], ya0 = [o0[0], it.y[0]], ya1 = [o0[0], it.y[1]];
        return (
          <g key={i}>
            {arrow(xa0, xa1, it.color, 'x', '')}{arrow(ya0, ya1, it.color, 'y', '')}
            {it.xLabel && <SvgLabel x={P(xa1)[0] - 2} y={P(xa1)[1] + 20} text={it.xLabel} anchor="end" size={14} />}
            {it.yLabel && <SvgLabel x={P(ya1)[0] + 9} y={P(ya1)[1] + 10} text={it.yLabel} anchor="start" size={14} />}
          </g>
        );
      }
      case 'polyline': {
        const pts = it.points.map(P);
        return <g key={i}><polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} markerEnd={it.arrow ? `url(#a${mid}-${it.color})` : undefined} />{it.label && <SvgLabel x={pts[pts.length - 1][0] + 6} y={pts[pts.length - 1][1] - 8} text={it.label} anchor="start" />}</g>;
      }
      case 'force': return arrow(it.at, [it.at[0] + it.length * Math.cos(rad(it.angle)), it.at[1] + it.length * Math.sin(rad(it.angle))], it.color, i, it.label, it.dashed);
      case 'rect': {
        const [cx, cy] = P(it.at); const w = it.w * kk, h = it.h * kk;
        return <g key={i} transform={`rotate(${-it.rotate} ${cx} ${cy})`}><rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx="3" fill="var(--nui-fill)" stroke={c} strokeWidth={sw} />{it.label && <SvgLabel x={cx} y={cy + 5} text={it.label} />}</g>;
      }
      case 'circle': { const [cx, cy] = P(it.at); return <g key={i}><circle cx={cx} cy={cy} r={it.r * kk} fill={it.fill ? 'var(--nui-fill)' : 'none'} stroke={c} strokeWidth={sw} strokeDasharray={dash} />{it.label && <SvgLabel x={cx} y={cy + 5} text={it.label} />}</g>; }
      case 'polygon': {
        const pts = it.points.map(P); const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        return <g key={i}><polygon points={pts.map((p) => p.join(',')).join(' ')} fill={it.fill ? 'var(--nui-fill)' : 'none'} stroke={c} strokeWidth={sw} strokeLinejoin="round" strokeDasharray={dash} />{it.label && <SvgLabel x={cx} y={cy + 5} text={it.label} />}</g>;
      }
      case 'angle': case 'arc': {
        const [cx, cy] = P(it.at); const r = it.r * kk; const a0 = rad(it.from), a1 = rad(it.to);
        const p0 = [cx + r * Math.cos(a0), cy - r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy - r * Math.sin(a1)];
        const large = Math.abs(it.to - it.from) % 360 > 180 ? 1 : 0; const sweep = it.to > it.from ? 0 : 1; const am = (a0 + a1) / 2;
        return <g key={i}><path d={`M${p0[0]},${p0[1]} A${r},${r} 0 ${large} ${sweep} ${p1[0]},${p1[1]}`} fill="none" stroke={c} strokeWidth={sw - 0.6} />{it.label && <SvgLabel x={cx + (r + 14) * Math.cos(am)} y={cy - (r + 14) * Math.sin(am) + 4} text={it.label} size={14} />}</g>;
      }
      case 'point': { const [cx, cy] = P(it.at); return <g key={i}><circle cx={cx} cy={cy} r="4.5" fill={c} />{it.label && <SvgLabel x={cx + 8} y={cy - 8} text={it.label} anchor="start" />}</g>; }
      case 'text': { const [cx, cy] = P(it.at); return <SvgLabel key={i} x={cx} y={cy} text={it.text || (it.tKey ? tx(it.tKey) : '')} anchor={it.anchor || 'middle'} size={it.size || 15} cls={it.color && it.color !== 'ink' ? `nui-c-${it.color}` : ''} />; }
      case 'resistor': return along(it, i, (L) => comp(L, 44, <rect x="-22" y="-9" width="44" height="18" rx="2" fill="var(--nui-bg)" />));
      case 'battery': return along(it, i, (L) => comp(L, 14, <><line x1="-7" y1="-16" x2="-7" y2="16" /><line x1="7" y1="-8" x2="7" y2="8" strokeWidth={sw + 2} /></>));
      case 'bulb': return along(it, i, (L) => comp(L, 30, <><circle r="15" fill="var(--nui-bg)" /><line x1="-10.6" y1="-10.6" x2="10.6" y2="10.6" /><line x1="-10.6" y1="10.6" x2="10.6" y2="-10.6" /></>));
      case 'ammeter': case 'voltmeter': return along(it, i, (L) => comp(L, 30, <><circle r="15" fill="var(--nui-bg)" /><text x="0" y="0" dy="5.5" textAnchor="middle" fontSize="15" fontWeight="800" fill={c} stroke="none" transform={`rotate(${-Math.round((Math.atan2(P(it.to)[1] - P(it.from)[1], P(it.to)[0] - P(it.from)[0]) * 180) / Math.PI)})`}>{it.type === 'ammeter' ? 'A' : 'V'}</text></>));
      case 'switch': return along(it, i, (L) => comp(L, 36, <><circle cx="-18" r="3" fill={c} /><circle cx="18" r="3" fill={c} /><line x1="-18" y1="0" x2={it.open ? 14 : 18} y2={it.open ? -16 : 0} /></>));
      case 'lens': {
        const [cx, cy] = P(it.at); const h = (it.h * kk) / 2; const inward = it.kind === 'concave';
        const head = (y, up) => { const s = (up ? -1 : 1) * (inward ? -1 : 1); return `M${cx - 8},${y - s * 9} L${cx},${y} L${cx + 8},${y - s * 9}`; };
        const fx = it.f ? Math.abs(it.f) * kk : 0;
        return <g key={i} stroke={c} strokeWidth={sw} fill="none"><line x1={cx} y1={cy - h} x2={cx} y2={cy + h} /><path d={head(cy - h, true)} /><path d={head(cy + h, false)} />
          {fx > 0 && <><circle cx={cx - fx} cy={cy} r="3.5" fill={c} /><circle cx={cx + fx} cy={cy} r="3.5" fill={c} /><SvgLabel x={cx - fx} y={cy + 20} text="F" /><SvgLabel x={cx + fx} y={cy + 20} text="F" /></>}
          {it.label && <SvgLabel x={cx} y={cy - h - 10} text={it.label} />}</g>;
      }
      case 'incline': {
        const g = inclineGeom(it); const [A, B, Cc] = [P(g.A), P(g.B), P(g.C)];
        const r = Math.min(1.4, it.length * 0.18) * kk;
        const s = it.size * kk; const [bx, by] = P(g.center);
        return (
          <g key={i}>
            <polygon points={`${A} ${B} ${Cc}`} fill="var(--nui-fill)" stroke={c} strokeWidth={sw} strokeLinejoin="round" />
            {it.showAngle && <><path d={`M${A[0] + r},${A[1]} A${r},${r} 0 0 0 ${A[0] + r * Math.cos(rad(it.angle))},${A[1] - r * Math.sin(rad(it.angle))}`} fill="none" stroke={c} strokeWidth={sw - 0.8} />
              <SvgLabel x={A[0] + (r + 12) * Math.cos(rad(it.angle / 2))} y={A[1] - (r + 12) * Math.sin(rad(it.angle / 2)) + 5} text={`θ = ${it.angle}°`} anchor="start" size={14} /></>}
            {it.block && <rect x={bx - s / 2} y={by - s / 2} width={s} height={s} rx="3" fill="var(--nui-bg)" stroke={colorVar('ink')} strokeWidth={sw} transform={`rotate(${-it.angle} ${bx} ${by})`} />}
            {it.label && <SvgLabel x={bx} y={by + 4} text={it.label} size={14} />}
            {it.forces.map((f, j) => { const a = rad(g.dirAngle(f)); return arrow(g.center, [g.center[0] + f.length * Math.cos(a), g.center[1] + f.length * Math.sin(a)], f.color, `f${j}`, f.label); })}
          </g>
        );
      }
      default: return null;
    }
  });
  return (
    <div className="nui-canvas">
      <svg viewBox={`0 0 ${W} ${H.toFixed(0)}`} className="nui-svg" role="img" aria-label={spec.title || 'diagram'}>
        <defs>{colors.map((cl) => <marker key={cl} id={`a${mid}-${cl}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={colorVar(cl)} /></marker>)}</defs>
        {els}
      </svg>
    </div>
  );
}

// ---------- chart ----------
function Chart({ spec }) {
  const W = Math.max(440, spec.kind === 'bar' ? spec.labels.length * spec.series.length * 26 + 80 : 440), H = 260, P = { l: 46, r: 14, t: 16, b: 46 };
  if (spec.kind === 'pie') {
    const d = spec.series[0].data.map((v) => Math.max(0, v)); const tot = d.reduce((a, b) => a + b, 0) || 1;
    const cx = 150, cy = 150, r = 120; let a = -Math.PI / 2;
    const pal = ['accent', 'orange', 'green', 'purple', 'red', 'teal', 'pink', 'muted'];
    return (
      <div className="nui-pie">
        <svg viewBox="0 0 300 300" className="nui-svg nui-pie-svg" role="img" aria-label={spec.title || 'chart'}>
          {d.map((v, i) => {
            const a0 = a; const a1 = a + (v / tot) * Math.PI * 2; a = a1;
            if (v / tot >= 0.9999) return <circle key={i} cx={cx} cy={cy} r={r} fill={colorVar(pal[i % 8])} />;
            const large = a1 - a0 > Math.PI ? 1 : 0;
            return <path key={i} d={`M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} z`} fill={colorVar(pal[i % 8])} stroke="var(--nui-bg)" strokeWidth="2" />;
          })}
        </svg>
        <ul className="nui-legend nui-legend-col">{spec.labels.map((l, i) => <li key={i}><i style={{ background: colorVar(pal[i % 8]) }} />{l}<b>{Math.round((d[i] / tot) * 100)}%</b></li>)}</ul>
      </div>
    );
  }
  const all = spec.series.flatMap((s) => s.data);
  const lo = Math.min(0, ...all), hi = Math.max(0, ...all) || 1;
  const yt = niceTicks(lo, hi, 5); const ya = Math.min(lo, yt[0]), yb = Math.max(hi, yt[yt.length - 1]);
  const sy = (v) => H - P.b - ((v - ya) / (yb - ya || 1)) * (H - P.t - P.b);
  const n = spec.labels.length; const bw = (W - P.l - P.r) / n;
  return (
    <>
      <div className="nui-canvas nui-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="nui-svg" style={{ minWidth: W > 440 ? W * 0.75 : undefined }} role="img" aria-label={spec.title || 'chart'}>
          {yt.map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={sy(v)} y2={sy(v)} className={v === 0 ? 'nui-axis' : 'nui-grid'} /><text x={P.l - 6} y={sy(v) + 4} textAnchor="end" className="nui-tick">{fmt(v)}</text></g>)}
          {spec.labels.map((l, i) => <text key={i} x={P.l + bw * (i + 0.5)} y={H - P.b + 18} textAnchor="middle" className="nui-tick">{l.length > 10 ? l.slice(0, 9) + '…' : l}</text>)}
          {spec.kind === 'bar' && spec.series.map((s, k) => s.data.map((v, i) => {
            const gw = bw * 0.72; const w = gw / spec.series.length; const x = P.l + bw * i + (bw - gw) / 2 + w * k;
            return <g key={`${k}-${i}`}><rect x={x + 1} y={Math.min(sy(v), sy(0))} width={Math.max(1, w - 2)} height={Math.abs(sy(v) - sy(0))} rx="4" fill={colorVar(s.color)} />
              {spec.series.length === 1 && <text x={x + w / 2} y={sy(v) - 5} textAnchor="middle" className="nui-tick nui-val">{fmt(v)}{spec.unit}</text>}</g>;
          }))}
          {spec.kind === 'line' && spec.series.map((s, k) => (
            <g key={k}><path d={s.data.map((v, i) => `${i ? 'L' : 'M'}${P.l + bw * (i + 0.5)},${sy(v)}`).join('')} fill="none" stroke={colorVar(s.color)} strokeWidth="2.6" strokeLinejoin="round" />
              {s.data.map((v, i) => <circle key={i} cx={P.l + bw * (i + 0.5)} cy={sy(v)} r="3.5" fill={colorVar(s.color)} />)}</g>
          ))}
          {spec.yLabel && <SvgLabel x={P.l} y={10} text={spec.yLabel} anchor="start" size={13} cls="nui-axislabel" />}
          {spec.xLabel && <SvgLabel x={W - P.r} y={H - 6} text={spec.xLabel} anchor="end" size={13} cls="nui-axislabel" />}
        </svg>
      </div>
      {spec.series.length > 1 && <div className="nui-legend">{spec.series.map((s, i) => <span key={i}><i style={{ background: colorVar(s.color) }} />{s.name}</span>)}</div>}
    </>
  );
}

// ---------- quiz ----------
function Quiz({ spec }) {
  const tx = useTx();
  const [pick, setPick] = useState({});
  const done = Object.keys(pick).length === spec.questions.length;
  const score = spec.questions.filter((q, i) => pick[i] === q.answer).length;
  return (
    <div className="nui-quiz">
      {spec.questions.map((q, i) => {
        const p = pick[i];
        return (
          <div key={i} className="nui-q">
            <div className="nui-q-text"><b>{i + 1}.</b> <InlineMd text={q.q} /></div>
            <div className="nui-opts" role="group">
              {q.options.map((o, j) => {
                const st = p == null ? '' : j === q.answer ? 'right' : j === p ? 'wrong' : 'dim';
                return <button key={j} type="button" className={`nui-opt ${st}`} disabled={p != null} aria-pressed={p === j} onClick={() => setPick((x) => ({ ...x, [i]: j }))}><span className="nui-opt-k">{'ABCDEF'[j]}</span><InlineMd text={o} /></button>;
              })}
            </div>
            {p != null && <div className={`nui-fb ${p === q.answer ? 'right' : 'wrong'}`} role="status">{p === q.answer ? tx('correct') : tx('wrong', { x: 'ABCDEF'[q.answer] })}{q.explain && <> · <InlineMd text={q.explain} /></>}</div>}
          </div>
        );
      })}
      {done && <div className="nui-score"><b>{tx('score', { a: score, b: spec.questions.length })}</b><button type="button" className="nui-link" onClick={() => setPick({})}>{tx('again')}</button></div>}
    </div>
  );
}

// ---------- steps (tap to reveal) ----------
function Steps({ spec }) {
  const tx = useTx();
  const [n, setN] = useState(1);
  return (
    <div className="nui-steps">
      <ol>
        {spec.steps.slice(0, n).map((s, i) => <li key={i} className="nui-step"><span className="nui-step-n">{i + 1}</span><div>{s.title && <b><InlineMd text={s.title} /></b>}{s.body && <div><InlineMd text={s.body} /></div>}</div></li>)}
      </ol>
      {n < spec.steps.length && <div className="nui-row"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setN(n + 1)}>{tx('next')} · {tx('of', { a: n + 1, b: spec.steps.length })}</button><button type="button" className="nui-link" onClick={() => setN(spec.steps.length)}>{tx('all')}</button></div>}
    </div>
  );
}

// ---------- flashcards ----------
function Flashcards({ spec }) {
  const tx = useTx();
  const [i, setI] = useState(0); const [back, setBack] = useState(false);
  const c = spec.cards[i];
  const go = (d) => { setBack(false); setI((x) => (x + d + spec.cards.length) % spec.cards.length); };
  return (
    <div className="nui-flash">
      <button type="button" className={`nui-card ${back ? 'is-back' : ''}`} onClick={() => setBack(!back)} aria-label={tx('flip')} aria-pressed={back}>
        {/* one face at a time (WebKit flattens 3D transforms inside <button>, so no backface tricks) */}
        <span key={`${i}-${back}`} className={`nui-face ${back ? 'back' : 'front'}`}><InlineMd text={back ? c.back : c.front} /></span>
      </button>
      <div className="nui-row nui-center">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(-1)} disabled={spec.cards.length < 2}>{tx('prev')}</button>
        <span className="muted small">{tx('of', { a: i + 1, b: spec.cards.length })} · {tx('flip')}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => go(1)} disabled={spec.cards.length < 2}>{tx('nextCard')}</button>
      </div>
    </div>
  );
}

function Timeline({ spec }) {
  return (
    <ol className="nui-timeline">
      {spec.events.map((e, i) => <li key={i}><span className="nui-dot" /><div>{e.date && <small>{e.date}</small>}<b><InlineMd text={e.title} /></b>{e.body && <div className="nui-tl-body"><InlineMd text={e.body} /></div>}</div></li>)}
    </ol>
  );
}

function Compare({ spec }) {
  const hasLabels = spec.rows.some((r) => r.label);
  return (
    <div className="nui-scroll">
      <table className="nui-table">
        <thead><tr>{hasLabels && <th />}{spec.columns.map((c, i) => <th key={i}><InlineMd text={c} /></th>)}</tr></thead>
        <tbody>{spec.rows.map((r, i) => <tr key={i}>{hasLabels && <th scope="row"><InlineMd text={r.label} /></th>}{spec.columns.map((c, j) => <td key={j}><InlineMd text={r.values[j] || ''} /></td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
