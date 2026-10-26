// Top-level error boundary (2026-10-18). Without it any render error — or a failed lazy chunk after a deploy / an
// interrupted quick reload — unmounts the whole tree and leaves a blank white page. Chunk-load failures reload once
// (sessionStorage guard); anything else shows a small recovery screen with a reload button.
import { Component } from 'react';

const CHUNK_RE = /Loading chunk|dynamically imported module|Failed to fetch dynamically|Importing a module script failed|error loading dynamically|ChunkLoadError/i;
export function reloadOnce(tag = 'chunk') {
  try {
    const k = `nest.reloadOnce.${tag}`;
    if (Date.now() - Number(sessionStorage.getItem(k) || 0) < 30e3) return false;
    sessionStorage.setItem(k, String(Date.now()));
  } catch {}
  location.reload();
  return true;
}
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (e) => { if (reloadOnce('preload')) e.preventDefault?.(); });
}

export default class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) {
    try { console.error('[nest] render error', err); } catch {}
    if (CHUNK_RE.test(String(err?.message || err))) reloadOnce('chunk');
  }
  render() {
    if (!this.state.err) return this.props.children;
    const zh = !/^en/.test((typeof localStorage !== 'undefined' && localStorage.getItem('nest.lang')) || 'zh');
    return (
      <div className="splash" style={{ flexDirection: 'column', gap: 14, textAlign: 'center', padding: 24 }} role="alert">
        <b style={{ fontSize: 18 }}>{zh ? '載入時出現問題' : 'Something went wrong loading Nest'}</b>
        <span className="muted" style={{ fontWeight: 600 }}>{zh ? '請重新載入。你的資料不會受影響。' : 'Please reload. Your data is safe.'}</span>
        <button type="button" className="btn btn-primary" onClick={() => location.reload()}>{zh ? '重新載入' : 'Reload'}</button>
      </div>
    );
  }
}
