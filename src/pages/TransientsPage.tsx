import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { simSend } from '../hooks/sim';
import { formatNumber, formatPressureBar } from '../sim/units';
import { Badge } from '../components/Badges';

export function TransientsPage() {
  const { t } = useTranslation();
  const snap = useApp((s) => s.snapshot);
  const params = useApp((s) => s.params);
  const setParams = useApp((s) => s.setParams);
  const units = useApp((s) => s.units);
  const digits = useApp((s) => s.digits);
  const lang = useApp((s) => s.lang);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [stroke, setStroke] = useState(params.valve.strokeTime);
  const [roRamp, setRoRamp] = useState(2.0);
  const [roFeed] = useState(65);
  const [roLift] = useState(0.4);
  const roLimit = 0.7; // [VERIFY] vendor ramp limit

  const surge = snap?.surge;
  const T = surge?.T_wave ?? 0.08;
  const safeStroke = Math.max(10 * T, 0.8);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('transients.title')}</h2>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('transients.profiles')}</div>
          <label>
            <span className="small muted">
              {t('transients.safeStroke')}: {formatNumber(stroke, { decimals: 2, locale, digitStyle: digits })} s
            </span>
            <input type="range" min={0.05} max={60} step={0.05} value={stroke}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStroke(v);
                setParams((p) => { p.valve.strokeTime = v; });
                simSend({ type: 'params', params: { ...params, valve: { ...params.valve, strokeTime: v } } });
              }} />
          </label>
          <div className="grid-2" style={{ gap: 8, marginTop: 8 }}>
            <div className="kpi"><span className="kpi-label">2L/a</span><span className="kpi-value">{formatNumber(T, { decimals: 3, locale, digitStyle: digits })} s</span></div>
            <div className="kpi"><span className="kpi-label">{t('transients.joukowsky')}</span><span className="kpi-value" style={{ color: 'var(--critical)' }}>{formatNumber((surge?.dP_joukowsky ?? 0) / 1e6, { decimals: 2, locale, digitStyle: digits })} MPa</span></div>
            <div className="kpi"><span className="kpi-label">{t('transients.slowClosure')}</span><span className="kpi-value">{formatNumber(surge?.dH_slow ?? 0, { decimals: 2, locale, digitStyle: digits })} m</span></div>
            <div className="kpi"><span className="kpi-label">{t('transients.atJunction')}</span><span className="kpi-value" style={{ color: (surge?.surgePeak ?? 0) > 500000 ? 'var(--critical)' : 'var(--safe)' }}>
              {formatPressureBar(surge?.surgePeak ?? 0, units, locale, digits).value} {units === 'SI' ? 'bar' : 'psi'}
            </span></div>
          </div>
          <div style={{ marginTop: 8 }}>
            {(surge?.surgePeak ?? 0) > 500000 ? (
              <Badge tone="critical">{t('transients.joukowsky')} — {t('transients.safeStroke')} ≥ {formatNumber(safeStroke, { decimals: 1, locale, digitStyle: digits })} s</Badge>
            ) : (
              <Badge tone="safe">{t('transients.slowClosure')} — {t('common.pass')}</Badge>
            )}
          </div>
        </div>

        <div className="panel" style={{ borderInlineStart: '3px solid var(--watch)' }}>
          <div className="panel-title">{t('transients.roPanel')}</div>
          <div className="small muted" style={{ marginBottom: 8 }}>{t('transients.roNote')}</div>
          <div className="grid-2" style={{ gap: 8 }}>
            <div className="kpi"><span className="kpi-label">{t('transients.roMagnitude')}</span><span className="kpi-value">{formatNumber((roLift / roFeed) * 100, { decimals: 2, locale, digitStyle: digits })}%</span></div>
            <div className="kpi"><span className="kpi-label">{t('transients.roRamp')}</span><span className="kpi-value" style={{ color: roRamp > roLimit ? 'var(--critical)' : 'var(--safe)' }}>{formatNumber(roRamp, { decimals: 1, locale, digitStyle: digits })} bar/s</span></div>
          </div>
          <label style={{ marginTop: 8 }}>
            <span className="small muted">{t('transients.roRamp')} (bar/s)</span>
            <input type="range" min={0.1} max={5} step={0.1} value={roRamp} onChange={(e) => setRoRamp(Number(e.target.value))} />
          </label>
          <div style={{ marginTop: 8 }}>
            {roRamp > roLimit ? <Badge tone="critical">{t('transients.roLimit')} ≈ {roLimit} bar/s — {t('common.fail')}</Badge> : <Badge tone="safe">{t('transients.roLimit')} — {t('common.pass')}</Badge>}
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            {roFeed} bar feed · +{roLift} bar lift · magnitude &lt; 1 % · ramp governs the valve stroke.
          </p>
        </div>
      </div>
    </div>
  );
}
