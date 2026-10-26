// Invite links always use the domain the user is on right now (nesty.cyou is canonical; the old *.vercel.app hosts 301 there).
import { SITE } from '../site.js';
const origin = () => (typeof window !== 'undefined' && window.location?.origin) || SITE;
export const inviteLink = (token) => `${origin()}/join/${token}`;
// Links saved earlier (e.g. in an agent result) are re-based onto the current domain.
export const rebaseLink = (link) => {
  const m = String(link || '').match(/\/join\/([^/?#\s]+)/);
  return m ? inviteLink(m[1]) : link;
};
