// Reads configuration from the environment. In the browser bundle Vite inlines import.meta.env (VITE_* only);
// in Node (serverless functions, the SEO build, tests) the same names are read from process.env.
// Every deployment — including forks — supplies its own values (see .env.example). Nothing here falls back to the
// upstream project's Firebase or OAuth credentials.
let viteEnv = {};
try { viteEnv = import.meta.env || {}; } catch { viteEnv = {}; }
const nodeEnv = typeof process !== 'undefined' && process && process.env ? process.env : {};
export function env(name) {
  const v = viteEnv[name] ?? nodeEnv[name];
  return typeof v === 'string' ? v.trim() : '';
}
export const envList = (name) => env(name).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
