import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { runMonteCarlo, runContour, type MCResult } from '../sim/sweep';
import { formatNumber } from '../sim/units';

export function MonteCarloPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [mc, setMc] = useState<MCResult | null>(null);
  const [contour, setContour] = useState<ReturnType<typeof renderContour> | null>(null);

  const start = async () => {
    setRunning(true);
    setProgress(0);
    setMc(null);
    try {
      const result = await runMonteCarlo({ runs: 300, duration: 400 }, setProgress);
      setMc(result);
    } finally {
      setRunning(false);
    }
  };

  const startContour = async () => {
    setRunning(true);
    const r = await runContour(setProgress);
    setContour(renderContour(r));
    setRunning(false);
  };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('montecarlo.title')}</h2>
        <button className="primary" onClick={start} disabled={running}>{running ? t('common.loading') : `${t('montecarlo.run')} S14`}</button>
        <button onClick={startContour} disabled={running}>{t('montecarlo.run')} S15</button>
        {running && (
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3 }}>
              <div style={{ height: 6, width: `${(progress * 100).toFixed(0)}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 120ms' }} />
            </div>
          </div>
        )}
        <span className="muted small">{t('montecarlo.progress')}: {(progress * 100).toFixed(0)}%</span>
      </div>

      {mc && (
        <>
          <div className="grid-2">
            <div className="panel">
              <div className="panel-title">ON — {t('montecarlo.summary')}</div>
              <div className="grid-2" style={{ gap: 8 }}>
                <Stat label={t('montecarlo.pRBelow')} value={formatNumber(mc.onStats.pRBelow15 * 100, { decimals: 1, locale, digitStyle: digits })} unit="%" />
                <Stat label={t('montecarlo.meanDamage')} value={formatNumber(mc.onStats.meanDamage, { decimals: 3, locale, digitStyle: digits })} />
                <Stat label={t('montecarlo.p95Tank')} value={formatNumber(mc.onStats.p95Tank, { decimals: 1, locale, digitStyle: digits })} unit="m³" />
              </div>
            </div>
            <div className="panel">
              <div className="panel-title">OFF — {t('montecarlo.summary')}</div>
              <div className="grid-2" style={{ gap: 8 }}>
                <Stat label={t('montecarlo.pRBelow')} value={formatNumber(mc.offStats.pRBelow15 * 100, { decimals: 1, locale, digitStyle: digits })} unit="%" />
                <Stat label={t('montecarlo.meanDamage')} value={formatNumber(mc.offStats.meanDamage, { decimals: 3, locale, digitStyle: digits })} />
                <Stat label={t('montecarlo.p95Tank')} value={formatNumber(mc.offStats.p95Tank, { decimals: 1, locale, digitStyle: digits })} unit="m³" />
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-title">{t('montecarlo.histogram')} — min R</div>
            <Histogram data={mc.minR} bins={24} />
          </div>
        </>
      )}

      {contour && (
        <div className="grid-2">
          <div className="panel">
            <div className="panel-title">{t('montecarlo.contour')} — min R</div>
            <ContourGrid values={contour.minR.values} xs={contour.minR.xs} ys={contour.minR.ys} />
          </div>
          <div className="panel">
            <div className="panel-title">{t('montecarlo.contour')} — {t('controller.surgePk')}</div>
            <ContourGrid values={contour.surge.values} xs={contour.surge.xs} ys={contour.surge.ys} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}{unit && <span className="kpi-unit">{unit}</span>}</span>
    </div>
  );
}

function Histogram({ data, bins }: { data: number[]; bins: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const step = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const v of data) counts[Math.min(bins - 1, Math.floor((v - min) / step))]++;
  const peak = Math.max(...counts, 1);
  const W = 600;
  const H = 140;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%">
      {counts.map((c, i) => {
        const h = (c / peak) * (H - 20);
        return (
          <rect key={i} x={i * (W / bins) + 1} y={H - h} width={W / bins - 2} height={h} fill="var(--accent)" opacity={0.75} />
        );
      })}
      <line x1={0} y1={H} x2={W} y2={H} stroke="var(--line)" />
    </svg>
  );
}

function renderContour(r: Awaited<ReturnType<typeof runContour>>) {
  return r;
}

function ContourGrid({ values, xs, ys }: { values: number[][]; xs: number[]; ys: number[] }) {
  const flat = values.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const cell = 60;
  return (
    <svg viewBox={`0 0 ${xs.length * cell} ${ys.length * cell + 20}`} width="100%">
      {values.map((row, j) =>
        row.map((v, i) => {
          const f = (v - min) / (max - min || 1);
          const color = `color-mix(in srgb, var(--critical) ${(f * 100).toFixed(0)}%, var(--safe))`;
          return (
            <g key={`${i}-${j}`}>
              <rect x={i * cell} y={j * cell} width={cell - 2} height={cell - 2} fill={color} rx={4} />
              <text x={i * cell + (cell - 2) / 2} y={j * cell + (cell - 2) / 2 + 4} textAnchor="middle" fontSize={9} fill="#0a0e14" fontFamily="var(--font-mono)">
                {v.toFixed(1)}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}
