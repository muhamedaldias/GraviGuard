import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { PumpCutaway } from '../components/PumpCutaway';
import { RadialGauge } from '../components/RadialGauge';
import { Badge } from '../components/Badges';
import { headDropFraction, cavitationIntensity } from '../sim/cavitation';
import { formatNumber } from '../sim/units';

const MECHANISMS = ['vapor', 'recirc', 'air'] as const;

export function PumpPage() {
  const { t } = useTranslation();
  const snap = useApp((s) => s.snapshot);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [view, setView] = useState<'external' | 'cutaway'>('cutaway');
  const [mech, setMech] = useState<(typeof MECHANISMS)[number]>('vapor');
  const [previewR, setPreviewR] = useState(1.7);

  const ci = cavitationIntensity(previewR, 2.0, 0.6);
  const drop = headDropFraction(previewR);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('pump.title')}</h2>
        <div className="row" style={{ gap: 4 }}>
          <button onClick={() => setView('external')} style={{ borderColor: view === 'external' ? 'var(--accent)' : undefined }}>
            {t('pump.external')}
          </button>
          <button onClick={() => setView('cutaway')} style={{ borderColor: view === 'cutaway' ? 'var(--accent)' : undefined }}>
            {t('pump.cutaway')}
          </button>
        </div>
        <div className="row" style={{ gap: 4 }}>
          {MECHANISMS.map((m) => (
            <button key={m} onClick={() => setMech(m)} style={{ borderColor: mech === m ? 'var(--accent)' : undefined }}>
              {t(`pump.${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 12, alignItems: 'start' }}>
        <div className="panel">
          <PumpCutaway state={snap} view={view} />
          <div className="small muted" style={{ marginTop: 6 }}>
            {mech === 'vapor' && t('advisor.npsh-acting')}
            {mech === 'recirc' && t('advisor.recirculation')}
            {mech === 'air' && t('advisor.air-ingestion')}
          </div>
        </div>
        <div className="panel col" style={{ gap: 10 }}>
          <div className="panel-title">{t('pump.sliderR')}</div>
          <RadialGauge
            value={previewR}
            min={0.2}
            max={3}
            bands={[
              { to: 0.6, color: 'var(--critical)' },
              { to: 1.0, color: 'var(--warning)' },
              { to: 1.6, color: 'var(--watch)' },
              { to: 2.0, color: '#8fbf3f' },
              { to: 3, color: 'var(--safe)' },
            ]}
            label={t('sim.margin')}
            size={150}
          />
          <input type="range" min={0.2} max={3} step={0.01} value={previewR} onChange={(e) => setPreviewR(Number(e.target.value))} />
          <div className="grid-2" style={{ gap: 8 }}>
            <div className="kpi"><span className="kpi-label">CI</span><span className="kpi-value">{formatNumber(ci, { decimals: 2, locale, digitStyle: digits })}</span></div>
            <div className="kpi"><span className="kpi-label">{t('sim.headDrop')}</span><span className="kpi-value">{formatNumber(drop * 100, { decimals: 1, locale, digitStyle: digits })}%</span></div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <Badge tone={previewR >= 2 ? 'safe' : previewR >= 1.6 ? 'watch' : previewR >= 1 ? 'warning' : 'critical'}>
              {previewR >= 2 ? 'NONE' : previewR >= 1.6 ? 'INCIPIENT' : previewR >= 1 ? 'DEVELOPED' : 'SEVERE'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
