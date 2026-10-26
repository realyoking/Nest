import { BRAND } from '../brand.jsx';
// The real Nest app, embedded on the landing page with in-memory sample data.
// Same AppShell + pages as the signed-in app; backend = mock-core (no Firebase), AI = canned replies (no API call).
import { useEffect, useMemo, useRef, useState } from 'react';
import { enterDemo } from '../lib/demo-guard.js';
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_LocationContext, UNSAFE_RouteContext } from 'react-router-dom';
import { BeCtx } from '../lib/be-context.jsx';
import { SessionProvider, useSession } from '../lib/session.jsx';
import { createMockBackend } from '../lib/mock-core.js';
import { createDemoAi } from '../lib/demo-ai.js';
import { useI18n } from '../lib/i18n.jsx';
import { AppMark } from '../brand.jsx';
import Icon from './Icon.jsx';
import { Button } from './ui.jsx';
import AppShell from './AppShell.jsx';
import Home from '../pages/app/Home.jsx';
import Agent from '../pages/app/Agent.jsx';
import Tutor from '../pages/app/Tutor.jsx';
import Quiz from '../pages/app/Quiz.jsx';
import Memory from '../pages/app/Memory.jsx';
import Reminders from '../pages/app/Reminders.jsx';
import Family from '../pages/app/Family.jsx';
import Connections from '../pages/app/Connections.jsx';
import Usage from '../pages/app/Usage.jsx';
import Settings from '../pages/app/Settings.jsx';
import Calendar from '../pages/app/Calendar.jsx';
import More from '../pages/app/More.jsx';

// Default (empty) route context = what a top-level router sees.
export const DEMO_ROUTE_CTX = { outlet: null, matches: [], isDataRoute: false };

function DemoRoutes({ onReset }) {
  const s = useSession();
  const { t } = useI18n();
  if (s.status === 'loading') return <div className="demo-splash"><AppMark size={40} /></div>;
  if (s.status !== 'ready') return <div className="demo-splash"><Button size="sm" icon="refresh" onClick={onReset}>{t('lp.reset')}</Button></div>;
  return (
    <Routes>
      <Route path="/app" element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="agent" element={<Agent />} />
        <Route path="agent/:cid" element={<Agent />} />
        <Route path="tutor" element={<Tutor />} />
        <Route path="quiz" element={<Quiz />} />
        <Route path="memory" element={<Memory />} />
        <Route path="reminders" element={<Reminders />} />
        <Route path="family" element={<Family />} />
        <Route path="connections" element={<Connections />} />
        <Route path="usage" element={<Usage />} />
        <Route path="settings" element={<Settings />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="more" element={<More />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default function DemoApp({ start = '/app' }) {
  const { t, lang } = useI18n();
  const [seed, setSeed] = useState(0);
  // Guard ON before any child renders or runs an effect (children's effects run before ours), OFF on unmount.
  const release = useRef(null);
  if (!release.current) release.current = enterDemo();
  useEffect(() => { if (!release.current) release.current = enterDemo(); return () => { release.current?.(); release.current = null; }; }, []);
  const value = useMemo(() => ({ be: createMockBackend({ lang, connections: {} }), ai: createDemoAi(lang), demo: true }), [lang, seed]);
  return (
    <div className="demo-frame">
      <div className="demo-bar">
        <span className="demo-dots" aria-hidden="true"><i /><i /><i /></span>
        <span className="demo-url" title={BRAND.full}><Icon name="lock" size={13} /><b className="demo-name">{BRAND.full}</b><span aria-hidden="true">·</span>{t('lp.demoUrl')}</span>
        <button className="demo-reset" onClick={() => setSeed((n) => n + 1)}><Icon name="refresh" size={14} />{t('lp.reset')}</button>
      </div>
      <div className="demo-body">
        {/* A second router inside the page's router: reset the location context so React Router allows it, AND the route
            context (Run 12 fix): on /en/ · /zh-hant/ · /zh-hans/ the outer route's pathnameBase ('/zh-hant') leaked into the inner
            <Routes>, so '/app' matched nothing and the demo rendered BLANK (only '/' worked, its base being '/'). */}
        <UNSAFE_LocationContext.Provider value={null}>
          <UNSAFE_RouteContext.Provider value={DEMO_ROUTE_CTX}>
          <MemoryRouter initialEntries={[start]} key={`${lang}-${seed}`}>
            <BeCtx.Provider value={value}>
              <SessionProvider>
                <DemoRoutes onReset={() => setSeed((n) => n + 1)} />
              </SessionProvider>
            </BeCtx.Provider>
          </MemoryRouter>
          </UNSAFE_RouteContext.Provider>
        </UNSAFE_LocationContext.Provider>
      </div>
    </div>
  );
}
