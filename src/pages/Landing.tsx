import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { SyntheticBadge } from '../components/Badges';

const STEPS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

export function Landing() {
  const { t } = useTranslation();
  const setPage = useApp((s) => s.setPage);

  return (
    <div className="col" style={{ gap: 32, maxWidth: 1100, margin: '0 auto', width: '100%' }}>
      <section className="panel" style={{ padding: '40px 36px', background: 'linear-gradient(160deg, var(--bg-1), var(--bg-2))' }}>
        <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2, letterSpacing: '-0.02em', maxWidth: 640 }}>
            {t('landing.heroTitle')}
          </h1>
          <SyntheticBadge />
        </div>
        <p className="muted" style={{ maxWidth: 620, marginTop: 12 }}>
          {t('landing.heroSub')}
        </p>
        <p style={{ marginTop: 16, paddingInlineStart: 14, borderInlineStart: '3px solid var(--accent)', maxWidth: 720 }}>
          {t('landing.positioning')}
        </p>
        <div className="row" style={{ marginTop: 22 }}>
          <button className="primary" onClick={() => setPage('simulator')}>
            {t('landing.cta')} →
          </button>
          <button onClick={() => setPage('scenarios')}>{t('nav.scenarios')}</button>
          <button onClick={() => setPage('methodology')}>{t('nav.methodology')}</button>
        </div>
        <div className="row" style={{ marginTop: 26, gap: 24 }}>
          {['stat1', 'stat2', 'stat3'].map((k) => (
            <div key={k} className="kpi" style={{ borderInlineStartColor: 'var(--accent)' }}>
              <span className="kpi-value" style={{ fontSize: 15 }}>
                {t(`landing.${k}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {STEPS.map((key, i) => (
        <section key={key} className="panel" style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              fontSize: 18,
            }}
          >
            {i + 1}
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px' }}>{t(`landing.${key}t`)}</h3>
            <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
              {t(`landing.${key}b`)}
            </p>
          </div>
        </section>
      ))}

      <section className="panel" style={{ textAlign: 'center', padding: '28px' }}>
        <button className="primary" style={{ fontSize: 15, padding: '10px 22px' }} onClick={() => setPage('simulator')}>
          {t('landing.cta')} →
        </button>
      </section>
    </div>
  );
}
