import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp, type PageId } from './state/store';
import { useSimLifecycle, simSend } from './hooks/sim';
import { LANGS } from './i18n';
import { SyntheticBadge } from './components/Badges';
import { useHashRoute } from './state/hashRoute';
import { Landing } from './pages/Landing';
import { StationsMapPage } from './pages/StationsMapPage';
import { Simulator } from './pages/Simulator';
import { Curves } from './pages/Curves';
import { Twin } from './pages/Twin';
import { PumpPage } from './pages/PumpPage';
import { ControllerPage } from './pages/ControllerPage';
import { SensorsPage } from './pages/SensorsPage';
import { TransientsPage } from './pages/TransientsPage';
import { SizingPage } from './pages/SizingPage';
import { ApplicabilityPage } from './pages/ApplicabilityPage';
import { MonteCarloPage } from './pages/MonteCarloPage';
import { ScenariosPage } from './pages/ScenariosPage';
import { ReportsPage } from './pages/ReportsPage';
import { MethodologyPage } from './pages/MethodologyPage';
import { TourPage, TOUR_STEPS } from './pages/TourPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGES: { id: PageId; labelKey: string; component: React.ComponentType | null }[] = [
  { id: 'landing', labelKey: 'nav.landing', component: Landing },
  { id: 'map', labelKey: 'nav.map', component: StationsMapPage },
  { id: 'simulator', labelKey: 'nav.simulator', component: Simulator },
  { id: 'curves', labelKey: 'nav.curves', component: Curves },
  { id: 'twin', labelKey: 'nav.twin', component: Twin },
  { id: 'pump', labelKey: 'nav.pump', component: PumpPage },
  { id: 'controller', labelKey: 'nav.controller', component: ControllerPage },
  { id: 'sensors', labelKey: 'nav.sensors', component: SensorsPage },
  { id: 'transients', labelKey: 'nav.transients', component: TransientsPage },
  { id: 'sizing', labelKey: 'nav.sizing', component: SizingPage },
  { id: 'applicability', labelKey: 'nav.applicability', component: ApplicabilityPage },
  { id: 'montecarlo', labelKey: 'nav.montecarlo', component: MonteCarloPage },
  { id: 'scenarios', labelKey: 'nav.scenarios', component: ScenariosPage },
  { id: 'reports', labelKey: 'nav.reports', component: ReportsPage },
  { id: 'methodology', labelKey: 'nav.methodology', component: MethodologyPage },
  { id: 'tour', labelKey: 'nav.tour', component: null },
  { id: 'settings', labelKey: 'nav.settings', component: SettingsPage },
];

export default function App() {
  const { t, i18n } = useTranslation();
  const page = useApp((s) => s.page);
  const setPage = useApp((s) => s.setPage);
  const lang = useApp((s) => s.lang);
  const setLang = useApp((s) => s.setLang);
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const units = useApp((s) => s.units);
  const setUnits = useApp((s) => s.setUnits);
  const seed = useApp((s) => s.seed);
  const snapshot = useApp((s) => s.snapshot);
  const quality = useApp((s) => s.quality);
  const workerError = useApp((s) => s.workerError);

  useSimLifecycle();
  useHashRoute(setPage);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.lang = lang;
    document.documentElement.dataset.quality = quality;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    void i18n.changeLanguage(lang);
  }, [theme, lang, quality, i18n]);

  const toggleLang = useCallback(() => {
    const idx = LANGS.findIndex((l) => l.code === lang);
    setLang(LANGS[(idx + 1) % LANGS.length].code);
  }, [lang, setLang]);

  const active = useMemo(() => PAGES.find((p) => p.id === page) ?? PAGES[0], [page]);
  // While touring, the tour panel overlays the step's target page; the tour
  // itself never navigates away (store.page stays 'tour').
  const [tourIdx, setTourIdx] = useState(0);
  const [tourPlaying, setTourPlaying] = useState(false);
  useEffect(() => {
    if (page === 'tour') {
      setTourIdx(0);
      setTourPlaying(false);
    }
  }, [page]);
  const exitTour = useCallback(() => {
    setTourPlaying(false);
    setTourIdx(0);
    setPage('landing');
  }, [setPage]);
  const targetId = page === 'tour' ? TOUR_STEPS[tourIdx].page : active.id;
  const ActiveComponent = (PAGES.find((p) => p.id === targetId) ?? PAGES[0]).component ?? Landing;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <span>{t('common.appName')}</span>
          <span className="muted small" style={{ fontWeight: 400 }}>
            {t('common.tagline')}
          </span>
        </div>
        <nav className="nav-rail" aria-label="pages">
          {PAGES.map((p) => (
            <button
              key={p.id}
              className={`nav-link ${p.id === page ? 'active' : ''}`}
              aria-current={p.id === page ? 'page' : undefined}
              onClick={() => setPage(p.id)}
            >
              {t(p.labelKey)}
            </button>
          ))}
        </nav>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <SyntheticBadge />
          <button onClick={toggleLang} title={t('common.language')}>
            {lang === 'en' ? 'ع' : 'EN'}
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title={t('common.theme')}>
            {theme === 'dark' ? '☾' : '☀'}
          </button>
          <button onClick={() => setUnits(units === 'SI' ? 'US' : 'SI')} title={t('common.units')}>
            {units}
          </button>
        </div>
      </header>

      {workerError !== null && (
        <div
          role="alert"
          style={{ padding: '8px 16px', background: 'var(--critical)', color: '#fff', fontSize: 13 }}
        >
          Simulation worker error: {workerError}
        </div>
      )}

      <main className="content">
        <ActiveComponent />
        {page === 'tour' && (
          <TourPage
            idx={tourIdx}
            playing={tourPlaying}
            onIdx={setTourIdx}
            onPlaying={setTourPlaying}
            onExit={exitTour}
          />
        )}
      </main>

      <footer className="footer">
        <span>{t('common.synthetic')}</span>
        <span>
          {t('common.seed')}: <span className="mono">{seed}</span>
        </span>
        <span>{t('common.model')}</span>
        <span style={{ marginInlineStart: 'auto' }}>{t('common.disclaimer')}</span>
        <span className="muted">
          {t('common.simTime')}:{' '}
          <span className="mono">
            {snapshot ? snapshot.t.toFixed(1) : '0.0'} s
          </span>
        </span>
      </footer>
    </div>
  );
}

export { simSend };
