// React hook for the auth-aware CTA (auth-hint.js stays React-free: it is also bundled into the Edge function).
import { useState } from 'react';
import { readAuthHint, ctaState } from './auth-hint.js';
//  'in' | 'out' | null for the PAGE's own session (the demo's nested session never reaches this hook's caller).

export function useAuthCta(status) {
  const [hint] = useState(() => readAuthHint());
  return ctaState(status, hint);
}
