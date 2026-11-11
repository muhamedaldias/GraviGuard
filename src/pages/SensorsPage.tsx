import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { simSend } from '../hooks/sim';
import { StripChart } from '../components/StripChart';
import { Badge } from '../components/Badges';
import { formatNumber } from '../sim/units';

export function SensorsPage() {
  const { t } = useTranslation();
  const snap = useApp((s) => s.snapshot);
  const history = useApp((s) => s.history);
  const params = useApp((s) => s.params);
  const setParams = useApp((s) => s.setParams);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const truth = useMemo(() => history.map((h) => h.NPSHa), [history]);
  const measured = useMemo(() => history.map((h) => h.NPSHa), [history]);
  const tArr = useMemo(() => history.map((h) => h.t), [history]);

  const setNoise = (scale: number) => {
    setParams((p) => { p.sensors.noiseScale = scale; });
    simSend({ type: 'params', params: { ...params, sensors: { ...params.sensors } } });
  };

  const voting = snap?.sensors.voting ?? [0, 0, 0];
  const voted = snap?.sensors.P_suction_abs ?? 0;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('sensors.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          {t('sensors.truth')} vs {t('sensors.measured')} · NPSHa
        </p>
      </div>

      <div className="panel">
        <div className="panel-title">NPSHa — {t('sensors.truth')} / {t('sensors.measured')}</div>
        <StripChart
          series={[
            { label: t('sensors.truth'), color: 'var(--water)', data: truth },
            { label: t('sensors.measured'), color: 'var(--warning)', data: measured },
          ]}
          height={200}
          yLabel="m"
        />
        <div className="small muted">t = {tArr.length > 0 ? tArr[tArr.length - 1].toFixed(0) : 0} s</div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('sensors.voting')}</div>
          <div className="row" style={{ gap: 8 }}>
            {voting.map((v, i) => {
              const isVoted = Math.abs(v - voted) < 1;
              return (
                <div key={i} className="kpi" style={{ borderInlineStartColor: isVoted ? 'var(--safe)' : 'var(--line)' }}>
                  <span className="kpi-label">PT-{i + 1}</span>
                  <span className="kpi-value" style={{ fontSize: 14 }}>
                    {formatNumber(v / 1000, { decimals: 1, locale, digitStyle: digits })} kPa
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <Badge tone={snap?.sensors.healthy ? 'safe' : 'critical'}>
              {t('sensors.healthy')}: {snap?.sensors.healthy ? t('common.pass') : t('common.fail')}
            </Badge>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">{t('sensors.noise')} / {t('sensors.lag')} / {t('sensors.quant')}</div>
          <div className="col" style={{ gap: 8 }}>
            <label>
              <span className="small muted">{t('sensors.noise')} (σ)</span>
              <div className="slider-row">
                <input type="range" min={0} max={3} step={0.1} value={params.sensors.noiseScale}
                  onChange={(e) => setNoise(Number(e.target.value))} />
                <span className="slider-value">{formatNumber(params.sensors.noiseScale, { decimals: 1, locale, digitStyle: digits })}×</span>
              </div>
            </label>
            <label>
              <span className="small muted">{t('sensors.lag')} (s)</span>
              <div className="slider-row">
                <input type="range" min={0} max={2} step={0.05} value={params.sensors.lagP}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setParams((p) => { p.sensors.lagP = v; });
                    simSend({ type: 'params', params: { ...params, sensors: { ...params.sensors } } });
                  }} />
                <span className="slider-value">{formatNumber(params.sensors.lagP, { decimals: 2, locale, digitStyle: digits })} s</span>
              </div>
            </label>
            <label>
              <span className="small muted">{t('sensors.quant')} (bits)</span>
              <div className="slider-row">
                <input type="range" min={8} max={16} step={1} value={params.sensors.quantBits}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setParams((p) => { p.sensors.quantBits = v; });
                    simSend({ type: 'params', params: { ...params, sensors: { ...params.sensors } } });
                  }} />
                <span className="slider-value">{params.sensors.quantBits} bit</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('sensors.faults')}</div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => simSend({ type: 'input', key: 'pressureDrift', value: 30000 })}>{t('sensors.drift')} +30 kPa</button>
          <button onClick={() => simSend({ type: 'input', key: 'pressureStuck', value: true })}>{t('sensors.stuck')}</button>
          <button onClick={() => simSend({ type: 'input', key: 'pressureDropout', value: true })}>{t('sensors.dropout')}</button>
          <button onClick={() => simSend({ type: 'input', key: 'checkValveLeak', value: true })}>CV leak</button>
          <button onClick={() => {
            simSend({ type: 'input', key: 'pressureDrift', value: 0 });
            simSend({ type: 'input', key: 'pressureStuck', value: false });
            simSend({ type: 'input', key: 'pressureDropout', value: false });
            simSend({ type: 'input', key: 'checkValveLeak', value: false });
          }}>{t('common.reset')}</button>
        </div>
      </div>
    </div>
  );
}
