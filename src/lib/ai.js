import { detectEnv } from './env.js';
// Client side of /api/chat. The model key never reaches the browser.
import { aiLang } from './i18n.jsx';
import { isIntl } from './langs.js';
import { getIdToken, MOCK } from './backend.js';
import { createDemoAi } from './demo-ai.js';
import { reportGate } from './gate-errors.js';
import { getActiveRegion } from './regions/index.js';

export class AiError extends Error {
  constructor(code, info = {}) { super(code); this.code = code; Object.assign(this, info); }
}

// 简体中文 UI: content code passes 'zh-Hant'; the server gets the selected language so it replies in Simplified Chinese.
// Run 14: an added language (ja, ko, es …): content code passes 'en' (legacy 2-way lang) → the server gets the real one.
const wireLang = (l) => { const a = aiLang(); if ((l === 'en' || l == null) && isIntl(a)) return a; return l !== 'en' && a === 'zh-Hans' ? 'zh-Hans' : l; };
async function call(body, signal) {
  body = { ...body, lang: wireLang(body.lang), ...(body.env === undefined ? { env: detectEnv() } : {}), ...(getActiveRegion() ? { region: getActiveRegion() } : {}) };
  const token = await getIdToken();
  let r;
  try {
    r = await fetch('/api/chat', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw new AiError(signal?.reason === 'stalled' ? 'stalled' : 'aborted');
    throw new AiError('network');
  }
  // The server's effective-plan resolution rides on every answer → session.jsx syncs the shown plan (grant changes).
  try { const ph = r.headers.get('x-nest-plan'); if (ph && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nest:plan', { detail: ph })); } catch {}
  if (!r.ok) {
    let info = {}; try { info = await r.json(); } catch {}
    const err = new AiError(info.error || `http_${r.status}`, info);
    reportGate(err);
    throw err;
  }
  return r;
}

const IDLE_MS = 20000;

// Streams text deltas to onDelta; resolves with the full text. Always finishes:
// - `data: [DONE]`, end of stream or a server `{"nest":"error"}` event end it;
// - no bytes for 20 s → AiError('stalled', { partial });
// - signal aborted (Stop button) → resolves with what arrived so far (AiError('aborted') if nothing yet).
// `{"nest":"reset"}` (language retry) replaces what was shown so far.
export async function streamChat({ mode = 'chat', lang, messages, context, prefs, onDelta, onSources, onStatus, onModel, onThink, signal, attach, model, think }) {
  if (MOCK) return createDemoAi(lang).streamChat({ mode, messages, context, onDelta, onStatus, onModel, onThink, model, think });
  const ctl = new AbortController();
  const onAbort = () => ctl.abort('user');
  if (signal) { if (signal.aborted) throw new AiError('aborted'); signal.addEventListener('abort', onAbort); }
  // Waiting for the first byte counts too (the server answers within ~25 s or returns an error).
  let firstTimer = setTimeout(() => ctl.abort('stalled'), 35000);
  let acc = ''; let serverErr = null;
  try {
    const r = await call({ mode, lang, messages, context, prefs, ...(attach ? { attach } : {}), ...(model ? { model } : {}), ...(think ? { think } : {}) }, ctl.signal);
    clearTimeout(firstTimer); firstTimer = null;
    const reader = r.body.getReader(); const dec = new TextDecoder();
    let buf = ''; let finished = false;
    while (!finished) {
      let timer;
      const idle = new Promise((res) => { timer = setTimeout(() => res({ idle: true }), IDLE_MS); });
      let x;
      try { x = await Promise.race([reader.read(), idle]); }
      catch (e) { clearTimeout(timer); if (ctl.signal.aborted) break; throw new AiError('stream_failed', { partial: acc }); }
      clearTimeout(timer);
      if (x.idle) { reader.cancel().catch(() => {}); throw new AiError('stalled', { partial: acc }); }
      if (x.done) break;
      buf += dec.decode(x.value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue; // ": ping" keep-alives only reset the idle timer
        const data = l.slice(5).trim();
        if (data === '[DONE]') { finished = true; break; }
        try {
          const j = JSON.parse(data);
          if (j.nest === 'reset') { acc = ''; onDelta?.(acc); continue; }
          if (j.nest === 'sources') { onSources?.((Array.isArray(j.items) ? j.items : []).slice(0, 4).filter((x) => /^https?:\/\/[^\s]+$/i.test(String(x?.url || ''))).map((x) => ({ title: String(x.title || '').slice(0, 120), url: String(x.url) }))); continue; }
          if (j.nest === 'status') { onStatus?.({ key: String(j.key || ''), q: String(j.q || '').slice(0, 80), n: Number(j.n) || 0 }); continue; }
          if (j.nest === 'think') { onThink?.(String(j.t || '')); continue; } // Run 26c: thought summary (never stored)
          if (j.nest === 'model') { onModel?.({ id: String(j.id || '').slice(0, 80), auto: !!j.auto, fb: !!j.fb }); continue; } // Run 25: which model answered
          if (j.nest === 'timing') { if (typeof window !== 'undefined') window.__nestTiming = j; continue; }
          if (j.nest === 'error') { serverErr = j; continue; }
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) { acc += delta; onDelta?.(acc); }
        } catch {}
      }
    }
    if (finished) reader.cancel().catch(() => {});
  } catch (e) {
    if (e instanceof AiError && e.code === 'aborted' && acc) return acc;
    if (e instanceof AiError && !('partial' in e)) e.partial = acc;
    throw e;
  } finally {
    if (firstTimer) clearTimeout(firstTimer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (signal?.aborted && !acc) throw new AiError('aborted');
  // Errors found after the stream opened (usage limit race, model timeout…) carry the same fields as the old HTTP errors.
  if (serverErr) { const { nest, code, ...rest } = serverErr; throw new AiError(code || 'ai_error', { ...rest, partial: acc }); }
  return acc;
}

export async function jsonChat({ mode, lang, messages, context, prefs }) {
  if (MOCK) return createDemoAi(lang).jsonChat({ mode });
  const r = await call({ mode, lang, messages, context, prefs });
  const j = await r.json();
  return j.data;
}

// Splits a reply into display text and proposed actions (```kabo-actions [...] ```).
export function parseActions(text) {
  const m = text.match(/```kabo-actions\s*([\s\S]*?)(```|$)/);
  if (!m) return { text, actions: [] };
  let actions = [];
  try { actions = JSON.parse(m[1]); } catch {}
  return { text: text.replace(m[0], '').trim(), actions: Array.isArray(actions) ? actions : [] };
}

// Downscale an image file to a JPEG data URL (kept client-side; never uploaded to storage).
export function fileToDataUrl(file, max = 1400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Short AI title for a chat after its first exchange (/api/chat-title → api/ops.js; cheap, not counted against quota).
export async function chatTitle({ lang, user, assistant }) {
  if (MOCK) return String(user || '').replace(/\s+/g, ' ').slice(0, lang === 'en' ? 32 : 12);
  const token = await getIdToken();
  const r = await fetch('/api/chat-title', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ lang: wireLang(lang), user, assistant }) });
  if (!r.ok) { const d = await r.json().catch(() => ({})); const err = new AiError(d.error || `http_${r.status}`, d); reportGate(err); throw err; }
  return (await r.json()).title || '';
}
