// Run 23: AI turns that keep running when the user leaves the chat screen. Module-level (survives route changes):
// the Agent page shows a progress card for a running turn of the open conversation, and when a turn finishes while the
// user is somewhere else, AppShell shows a toast with "View" (event 'nest:bg-done').
const RUN = new Map(); // cid → { startedAt, steps: [] }
export const EVT_CHANGE = 'nest:bg-change';
export const EVT_DONE = 'nest:bg-done';
const emit = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {} };
export function bgStart(cid) { if (!cid) return; RUN.set(cid, { startedAt: Date.now(), steps: [] }); emit(EVT_CHANGE, { cid }); }
export function bgStep(cid, key) { const r = RUN.get(cid); if (r && key && !r.steps.includes(key)) { r.steps.push(key); emit(EVT_CHANGE, { cid }); } }
export const bgRunning = (cid) => RUN.get(cid) || null;
// here = the path the user is on when the turn ends; the toast only shows when they are not looking at that chat.
export function bgFinish(cid, { ok = true, title = '', here = (typeof location !== 'undefined' ? location.pathname : '') } = {}) {
  if (!cid || !RUN.has(cid)) return false;
  RUN.delete(cid); emit(EVT_CHANGE, { cid });
  const away = ok && !String(here).endsWith(`/app/agent/${cid}`);
  if (away) emit(EVT_DONE, { cid, title });
  return away;
}
export const _reset = () => RUN.clear();
