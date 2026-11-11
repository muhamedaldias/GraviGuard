import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { StripChart } from '../components/StripChart';
import { pumpHead, pumpNPSH3, pumpEfficiency, pumpPower, suctionSpecificSpeedMetric, suctionSpecificSpeedUS } from '../sim/pump';
import { formatNumber } from '../sim/units';
import type { PumpParams } from '../sim/types';

export function Curves() {
  const { t } = useTranslation();
  const params = useApp((s) => s.params);
  const snap = useApp((s) => s.snapshot);
  const units = useApp((s) => s.units);
  const digits = useApp((s) => s.digits);
  const lang = useApp((s) => s.lang);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [showSpeed, setShowSpeed] = useState(true);
  const [showGhost, setShowGhost] = useState(false);
  const [timeFrac, setTimeFrac] = useState(1);

  const pump: PumpParams = params.pump;
  const qMax = 0.22;
  const nPts = 80;
  const qs = useMemo(() => Array.from({ length: nPts }, (_, i) => (i / (nPts - 1)) * qMax), []);

  const curves = useMemo(() => {
    const n = pump.n;
    const H = qs.map((q) => pumpHead(q, { ...pump, n }));
    const eta = qs.map((q) => pumpEfficiency(q, { ...pump, n }) * 100);
    const P = qs.map((q) => (pumpPower(q, Math.max(1, pumpHead(q, { ...pump, n })), { ...pump, n }, params.fluid.rho) / 1000));
    const NPSH3 = qs.map((q) => pumpNPSH3(q, { ...pump, n }));
    const sys = qs.map((q) => params.discharge.H_static + params.discharge.k * q * q);
    const speedCurves = showSpeed
      ? [0.8, 0.9, 1.0, 1.05].map((nn) => ({ n: nn, data: qs.map((q) => pumpHead(q, { ...pump, n: nn })) }))
      : [];
    const ghosts = showGhost
      ? [0.8, 0.9].map((nn) => ({ n: nn, data: qs.map((_q, i) => H[i] * nn * nn) }))
      : [];
    // 3% head-drop contour: R = 1 line in the NPSH chart.
    const dropLine = NPSH3;
    return { H, eta, P, NPSH3, sys, speedCurves, ghosts, dropLine };
  }, [qs, pump, params, showSpeed, showGhost]);

  const op = useMemo(() => {
    // Solve pump vs system by bisection.
    const n = pump.n;
    const residual = (q: number) => pumpHead(q, { ...pump, n }) - (params.discharge.H_static + params.discharge.k * q * q);
    let lo = 0;
    let hi = qMax;
    for (let i = 0; i < 60; i++) {
      const mid = 0.5 * (lo + hi);
      if (residual(mid) > 0) lo = mid;
      else hi = mid;
    }
    const q = 0.5 * (lo + hi);
    return { q, h: pumpHead(q, { ...pump, n }), eta: pumpEfficiency(q, { ...pump, n }) };
  }, [pump, params, qMax]);

  const nssMetric = suctionSpecificSpeedMetric(pump.N0, op.q, pumpNPSH3(op.q, pump));
  const nssUS = suctionSpecificSpeedUS(pump.N0, op.q * 15850.32314, pumpNPSH3(op.q, pump) * 3.280839895);
  const npshAtOp = pumpNPSH3(op.q, pump);
  const npshaAtOp = snap ? snap.NPSHa : 10.4;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel row" style={{ alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('curves.title')}</h2>
        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showSpeed} onChange={(e) => setShowSpeed(e.target.checked)} />
          <span className="small">{t('curves.overlaySpeed')}</span>
        </label>
        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={showGhost} onChange={(e) => setShowGhost(e.target.checked)} />
          <span className="small">{t('curves.overlayGhost')}</span>
        </label>
        <span className="badge info">Nss ≈ {formatNumber(nssMetric, { decimals: 0, locale, digitStyle: digits })} (metric) · {formatNumber(nssUS, { decimals: 0, locale, digitStyle: digits })} (US)</span>
        <span className="muted small">{t('pump.title')} · {formatNumber(op.q * 3600, { decimals: 0, locale, digitStyle: digits })} m³/h · {formatNumber(op.h, { decimals: 1, locale, digitStyle: digits })} m · η {formatNumber(op.eta * 100, { decimals: 1, locale, digitStyle: digits })}%</span>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('curves.hq')}</div>
          <StripChart
            series={[
              { label: 'H', color: 'var(--accent)', data: curves.H },
              { label: t('curves.sysCurve'), color: 'var(--warning)', data: curves.sys },
              ...curves.speedCurves.map((s) => ({ label: `n=${s.n}`, color: `var(--steel)`, data: s.data })),
              ...curves.ghosts.map((s) => ({ label: `ghost ${s.n}`, color: `var(--water)`, data: s.data })),
            ]}
            height={200}
            yLabel={units === 'SI' ? 'm' : 'ft'}
          />
        </div>
        <div className="panel">
          <div className="panel-title">{t('curves.npsh')}</div>
          <StripChart
            series={[
              { label: 'NPSHa', color: 'var(--water)', data: qs.map(() => npshaAtOp) },
              { label: 'NPSH3', color: 'var(--critical)', data: curves.NPSH3 },
              { label: '3%', color: 'var(--watch)', data: curves.dropLine },
            ]}
            height={200}
            yLabel="m"
            hlines={[{ y: npshAtOp, color: 'var(--water)', label: 'NPSHa' }]}
          />
        </div>
        <div className="panel">
          <div className="panel-title">{t('curves.etaq')}</div>
          <StripChart series={[{ label: 'η %', color: 'var(--safe)', data: curves.eta }]} height={160} yLabel="%" />
        </div>
        <div className="panel">
          <div className="panel-title">{t('curves.pq')}</div>
          <StripChart series={[{ label: 'P', color: 'var(--warning)', data: curves.P }]} height={160} yLabel={units === 'SI' ? 'kW' : 'hp'} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('curves.timeSlider')}</div>
        <input type="range" min={0} max={1} step={0.01} value={timeFrac} onChange={(e) => setTimeFrac(Number(e.target.value))} />
        <div className="small muted">
          {t('sim.level')}: {formatNumber(snap ? snap.sensors.level : 1, { decimals: 2, locale, digitStyle: digits })} m ·{' '}
          {t('sim.margin')}: {formatNumber(snap ? snap.R : 0, { decimals: 2, locale, digitStyle: digits })} ·{' '}
          {t('sim.npsha')}: {formatNumber(snap ? snap.NPSHa : 0, { decimals: 2, locale, digitStyle: digits })} m
        </div>
      </div>
    </div>
  );
}
