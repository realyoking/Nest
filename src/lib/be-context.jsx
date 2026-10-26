// Which backend + AI the app tree talks to. The real app uses Firebase + /api/chat.
// The landing page's embedded demo swaps in an in-memory backend and canned AI replies,
// so the real app screens can run for signed-out visitors without touching Firebase or the model.
import { createContext, useContext } from 'react';
import * as realBe from './backend.js';
import * as realAi from './ai.js';

export const BeCtx = createContext({ be: realBe, ai: realAi, demo: false });
export const useBe = () => useContext(BeCtx);
export function BeProvider({ be, ai, demo = false, children }) {
  return <BeCtx.Provider value={{ be, ai, demo }}>{children}</BeCtx.Provider>;
}
