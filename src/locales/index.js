// Run 14: every added language's in-app dictionary (static imports — used by seo/render.js for the prerendered pages and
// the Edge blog pages). The app itself loads one file at a time (src/lib/i18n.jsx loadLocale).
import ja from './ja.js';
import ko from './ko.js';
import es from './es.js';
import fr from './fr.js';
import de from './de.js';
import ptBR from './pt-BR.js';
import idn from './id.js';
import vi from './vi.js';
import th from './th.js';
export default { ja, ko, es, fr, de, 'pt-BR': ptBR, id: idn, vi, th };
