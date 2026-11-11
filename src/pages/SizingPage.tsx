import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { formatNumber } from '../sim/units';

export function SizingPage() {
  const { t } = useTranslation();
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [flow, setFlow] = useState(0.1);
  const [duration, setDuration] = useState(500);
  const [target, setTarget] = useState(1.7);
  const [elevation, setElevation] = useState(10);
  const [downtime, setDowntime] = useState(4);
  const [repair, setRepair] = useState(25000);
  const [tankCost, setTankCost] = useState(150);

  const results = useMemo(() => {
    const tankVol = flow * duration * 1.2;
    const junctionHead = elevation + 2.5;
    const strokeRec = Math.max(10 * 0.08, Math.min(60, 12));
    const tankPrice = tankVol * tankCost;
    const annualAvoided = downtime * repair * 2;
    const paybackYears = annualAvoided > 0 ? tankPrice / annualAvoided : Infinity;
    return { tankVol, junctionHead, strokeRec, tankPrice, annualAvoided, paybackYears };
  }, [flow, duration, target, elevation, downtime, repair, tankCost]);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('sizing.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('sizing.note')}</p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('sizing.inputs')}</div>
          <div className="col" style={{ gap: 8 }}>
            <NumSlider label={t('sim.flow')} unit="m³/s" value={flow} min={0.02} max={0.5} step={0.005} onChange={setFlow} />
            <NumSlider label={t('sizing.eventDuration')} unit="s" value={duration} min={60} max={1800} step={30} onChange={setDuration} />
            <NumSlider label={t('controller.target')} unit="R" value={target} min={1.3} max={2.2} step={0.05} onChange={setTarget} />
            <NumSlider label={t('sim.tank')} unit="m" value={elevation} min={5} max={20} step={0.5} onChange={setElevation} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">{t('sizing.outputs')}</div>
          <div className="grid-2" style={{ gap: 8 }}>
            <div className="kpi"><span className="kpi-label">{t('sizing.tankVol')}</span><span className="kpi-value">{formatNumber(results.tankVol, { decimals: 1, locale, digitStyle: digits })} m³</span></div>
            <div className="kpi"><span className="kpi-label">{t('sizing.junctionHead')}</span><span className="kpi-value">{formatNumber(results.junctionHead, { decimals: 1, locale, digitStyle: digits })} m</span></div>
            <div className="kpi"><span className="kpi-label">{t('sizing.strokeRec')}</span><span className="kpi-value">{formatNumber(results.strokeRec, { decimals: 1, locale, digitStyle: digits })} s</span></div>
            <div className="kpi"><span className="kpi-label">{t('sizing.payback')}</span><span className="kpi-value">{formatNumber(results.paybackYears, { decimals: 1, locale, digitStyle: digits })} yr</span></div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ borderInlineStart: '3px solid var(--watch)' }}>
        <div className="panel-title">{t('sizing.payback')} — {t('sizing.assumptions')}</div>
        <div className="grid-3">
          <NumSlider label={t('sizing.avoidedDowntime')} unit="h/yr" value={downtime} min={0} max={40} step={1} onChange={setDowntime} />
          <NumSlider label={t('sizing.repairCost')} unit="$" value={repair} min={1000} max={200000} step={1000} onChange={setRepair} />
          <NumSlider label={t('sizing.tankVol')} unit="$/m³" value={tankCost} min={50} max={500} step={10} onChange={setTankCost} />
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          {t('sizing.note')} · {t('sizing.assumptions')}: {formatNumber(results.annualAvoided, { decimals: 0, locale, digitStyle: digits })} $/yr avoided.
        </div>
      </div>
    </div>
  );
}

function NumSlider({ label, unit, value, min, max, step, onChange }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const digits = useApp((s) => s.digits);
  const lang = useApp((s) => s.lang);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  return (
    <label>
      <span className="small muted">{label}</span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-value">{formatNumber(value, { decimals: step < 1 ? 2 : 0, locale, digitStyle: digits })} {unit}</span>
      </div>
    </label>
  );
}
