// Run 25: try the AI 助理's models in order (src/lib/ai-models.js modelChain) — OrcaRouter free models first, Agnes last.
// Not a Vercel function (leading underscore); used by api/chat.js. fetch-free so tests can drive it with fakes.
import { AGNES, modelInfo, shouldFallback } from '../src/lib/ai-models.js';

// OrcaRouter streams: wait (≤ ms) for the first real delta (text or reasoning) so a stalled / erroring model can still
// hand over to the next one; the bytes read so far are replayed in front of the rest of the stream. null = no words.
export async function peekStream(r, ms, ctl) {
  const reader = r.body.getReader(); const dec = new TextDecoder(); const held = []; let txt = '';
  const tmr = setTimeout(() => { ctl?.abort('peek'); reader.cancel().catch(() => {}); }, ms);
  try {
    while (true) {
      const x = await reader.read();
      if (x.done) return null;
      held.push(x.value); txt += dec.decode(x.value, { stream: true });
      for (const line of txt.split('\n')) {
        const l = line.trim(); if (!l.startsWith('data:')) continue;
        const d = l.slice(5).trim();
        if (d === '[DONE]') return null; // finished without a word
        let j; try { j = JSON.parse(d); } catch { continue; }
        if (j.error) return null;
        const dl = j.choices?.[0]?.delta || {};
        if (dl.content || dl.reasoning_content || dl.reasoning) {
          clearTimeout(tmr);
          const body = new ReadableStream({
            start(c) { for (const b of held) c.enqueue(b); },
            async pull(c) { try { const y = await reader.read(); if (y.done) c.close(); else c.enqueue(y.value); } catch (e) { c.error(e); } },
            cancel() { reader.cancel().catch(() => {}); },
          });
          return new Response(body, { status: 200, headers: r.headers });
        }
      }
    }
  } catch { return null; } finally { clearTimeout(tmr); }
}

// → { r: Response, answered: { id, auto, fb } }. orca(id, signal) → fetch Response; agnes() → Response (Agnes with its own
// retries). tried collects "<model>:<outcome>" for the log line (never content).
export async function runChain({ throttle, chain, kind = 'chat', auto = true, choice = 'auto', stream = true, signal, busy, tried = [], docChars = 0, orca, agnes, caps = {} }) {
  for (const id of chain) {
    if (signal?.aborted) throw new Error('aborted');
    const info = modelInfo(id);
    if (!info || (info.provider !== 'orca' && info.provider !== 'gemini' && info.provider !== 'mistral')) { // Run 26: Gemini uses the same OpenAI-compatible path
      const r = await agnes();
      tried.push(`${AGNES}:${r.status}`);
      return { r, answered: { id: AGNES, auto, fb: !auto && choice !== AGNES } };
    }
    if (busy?.busy(id)) { tried.push(`${id}:busy`); continue; }
    // Per-attempt controller (linked to the caller's): a stalled model is abandoned for the next one.
    const ctl = new AbortController(); const link = () => ctl.abort('outer');
    signal?.addEventListener('abort', link);
    if (info.provider === 'mistral' && throttle) await throttle(); // ≤ 1 req/s per instance
    const t0 = Date.now();
    const capMs = stream ? (docChars > 30000 ? caps.doc ?? 20000 : kind === 'reason' ? caps.reason ?? 12000 : caps.chat ?? 9000) : caps.nostream ?? 16000;
    const hard = setTimeout(() => ctl.abort('slow'), capMs);
    try {
      const r = await orca(id, ctl.signal);
      if (!r.ok) {
        tried.push(`${id}:${r.status}`);
        if (r.status === 429) { let b = ''; if (info.provider === 'gemini') { try { b = (await r.text()).slice(0, 4000); } catch {} } busy?.mark(id, r.headers.get('retry-after'), b); if (b) continue; }
        if (shouldFallback(r.status)) { try { await r.body?.cancel(); } catch {} continue; }
        return { r, answered: { id, auto, fb: !auto && id !== choice } };
      }
      let out = r;
      if (stream) {
        clearTimeout(hard);
        out = await peekStream(r, Math.max(500, capMs - (Date.now() - t0)), ctl);
        if (!out) { tried.push(`${id}:${ctl.signal.aborted ? 'timeout' : 'empty'}`); continue; }
      }
      tried.push(`${id}:ok:${Date.now() - t0}ms`);
      signal?.removeEventListener('abort', link);
      return { r: out, answered: { id, auto, fb: !auto && id !== choice } };
    } catch (e) {
      if (signal?.aborted) throw e;
      tried.push(`${id}:${ctl.signal.aborted ? 'timeout' : 'net'}`);
    } finally { clearTimeout(hard); }
  }
  // modelChain always ends with Agnes, so this is only reached by a chain without it.
  const r = await agnes(); tried.push(`${AGNES}:${r.status}`);
  return { r, answered: { id: AGNES, auto, fb: true } };
}
