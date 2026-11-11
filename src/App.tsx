import { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp, type PageId } from './state/store';
import { useSimLifecycle, simSend } from './hooks/sim';
import { LANGS } from './i18n';
import { SyntheticBadge } from './components/Badges';
import { Landing } from './pages/Landing';
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
import { TourPage } from './pages/TourPage';
import { SettingsPage } from './pages/SettingsPage';

const PAGES: { id: PageId; labelKey: string; component: React.ComponentType }[] = [
  { id: 'landing', labelKey: 'nav.landing', component: Landing },
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
  { id: 'tour', labelKey: 'nav.tour', component: TourPage },
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

  useSimLifecycle();

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
  const ActiveComponent = active.component;

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

      <main className="content">
        <ActiveComponent />
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
