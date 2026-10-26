// AI reply body: markdown + ```nest-ui``` interactive blocks (AI 助理 / 功課導師).
// - Plain replies (no nest-ui fence) render exactly as before through <Markdown>.
// - A fence that is still streaming shows a placeholder until its closing ``` arrives.
// - An invalid block falls back to readable text; NestUI itself is lazy-loaded the first time a block appears.
import { Component, createContext, lazy, Suspense, useContext, useMemo } from 'react';
import { Markdown } from './ui.jsx';
import { splitBlocks } from '../lib/nestui/spec.js';
import { cutLeak } from '../lib/nestui/ascii.js';

// A broken block must never take the reply (or the page) down: it degrades to its readable text.
class BlockBoundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { try { console.warn('[nest-ui] render error', e); } catch {} }
  render() { return this.state.err ? <Bad text={this.props.text} /> : this.props.children; }
}

// Chat pages provide a "draw it again" action for the 未能顯示圖表 card (Agent: sends 「請重新畫這個圖。」).
export const VisualRetry = createContext(null);
const NestSvg = lazy(() => import('./NestUI.jsx').then((m) => ({ default: m.NestSvg })));
const NestUI = lazy(() => import('./NestUI.jsx'));
const Pending = lazy(() => import('./NestUI.jsx').then((m) => ({ default: m.NestUIPending })));
const Bad = lazy(() => import('./NestUI.jsx').then((m) => ({ default: m.NestUIBad })));

export const hasUi = (text) => typeof text === 'string' && /```(nest-ui|nest-svg)\b/.test(text);

export default function RichText({ text: raw, streaming = false }) {
  const text = useMemo(() => cutLeak(raw), [raw]);
  const onRetry = useContext(VisualRetry);
  const parts = useMemo(() => (hasUi(text) ? splitBlocks(text, { final: !streaming }) : null), [text, streaming]);
  if (!parts) return <Markdown text={text} />;
  return (
    <div className="rich">
      {parts.map((p, i) => (p.kind === 'md' ? <Markdown key={i} text={p.text} />
        : (
          <Suspense key={i} fallback={<div className="nui nui-pending"><span className="nui-shimmer" /></div>}>
            <BlockBoundary text={p.text || ''}>
              {p.kind === 'ui' ? <NestUI spec={p.spec} /> : p.kind === 'svg' ? <NestSvg svg={p.svg} title={p.title} /> : p.kind === 'ui-pending' ? <Pending /> : <Bad text={p.text} onRetry={streaming ? null : onRetry} />}
            </BlockBoundary>
          </Suspense>
        )))}
    </div>
  );
}
