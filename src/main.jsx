import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { I18nProvider, loadLocale, readLang } from './lib/i18n.jsx';
import { SessionProvider } from './lib/session.jsx';
import { AppConfigProvider } from './lib/appconfig.jsx';
import { ToastProvider } from './components/ui.jsx';
import './styles.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { applyIcon } from './lib/icons.js';
import { cleanDemoKeys } from './lib/demo-guard.js';
try { cleanDemoKeys(window.localStorage); cleanDemoKeys(window.sessionStorage); } catch {}

try { applyIcon(); } catch {}

const mount = () => ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
    <BrowserRouter>
      <I18nProvider>
        <SessionProvider>
          <AppConfigProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
          </AppConfigProvider>
        </SessionProvider>
      </I18nProvider>
    </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
// Run 14: an added language (ja, ko, es …) loads its dictionary first (≤1.5 s) so the first paint is already translated.
let mounted = false; const go = () => { if (!mounted) { mounted = true; mount(); } };
loadLocale(readLang()).finally(go); setTimeout(go, 1500);
