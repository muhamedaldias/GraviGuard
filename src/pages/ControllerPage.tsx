import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { simSend } from '../hooks/sim';
import { SimEngine } from '../sim/engine';
import { CTRL_STATES, type StrategyId } from '../sim/types';
import { formatNumber } from '../sim/units';
import { StateBadge, Badge } from '../components/Badges';

const STATE_COLORS: Record<string, string> = {
  IDLE: 'var(--text-2)',
  ARMED: 'var(--watch)',
  INJECTING: 'var(--accent)',
  HOLD: 'var(--safe)',
  RECOVERY: 'var(--watch)',
  REFILL: 'var(--water)',
  MANUAL: 'var(--steel)',
  FAULT_SAFE: 'var(--critical)',
};

export function ControllerPage() {
  const { t } = useTranslation();
  const params = useApp((s) => s.params);
  const setParams = useApp((s) => s.setParams);
  const snapshot = useApp((s) => s.snapshot);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  const [strategy, setStrategy] = useState<StrategyId>(params.controller.strategy);

  const comparison = useMemo(() => {
    const run = (strat: StrategyId) => {
      const p = structuredClone(params);
      p.controller.strategy = strat;
      const e = new SimEngine({ params: p, seed: 12345, recordInterval: 0.5 });
      e.setInput('mode', 'ON');
      e.setInput('z_level', -3.0);
      e.setInput('K_strainer', 40);
      e.run(600, 0.01);
      const hist = e.getHistory();
      return {
        minR: Math.min(...hist.map((h) => h.R)),
        damage: e.state.damage,
        tankUsed: Math.max(0, (p.tank.V_usable / p.tank.area - Math.min(...hist.map((h) => h.tankH))) * p.tank.area),
        surge: Math.max(...hist.map((h) => h.surge)),
        cycles: e.getController().transitions.filter((x) => x.to === 'INJECTING').length,
      };
    };
    return [
      { id: 'A' as const, ...run('A') },
      { id: 'B' as const, ...run('B') },
      { id: 'C' as const, ...run('C') },
    ];
  }, [params]);

  const applyParam = (path: string, value: number) => {
    setParams((p) => {
      const parts = path.split('.');
      let obj: unknown = p;
      for (let i = 0; i < parts.length - 1; i++) obj = (obj as Record<string, unknown>)[parts[i]];
      (obj as Record<string, unknown>)[parts[parts.length - 1]] = value;
    });
    simSend({ type: 'params', params: { ...params, controller: { ...params.controller } } });
  };

  const applyStrategy = (s: StrategyId) => {
    setStrategy(s);
    const next = { ...params, controller: { ...params.controller, strategy: s } };
    setParams((p) => {
      p.controller.strategy = s;
    });
    simSend({ type: 'params', params: next });
  };

  const current = snapshot?.controller.name ?? 'IDLE';

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('controller.title')}</h2>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('controller.stateMachine')}</div>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            {CTRL_STATES.map((s) => (
              <div
                key={s}
                className="badge"
                style={{
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '8px 10px',
                  minWidth: 74,
                  borderColor: s === current ? STATE_COLORS[s] : undefined,
                  color: s === current ? STATE_COLORS[s] : undefined,
                  boxShadow: s === current ? 'var(--glow)' : undefined,
                }}
              >
                <span style={{ fontSize: 11 }}>{t(`state.${s}`)}</span>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: STATE_COLORS[s] }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            <StateBadge name={current} />
            {snapshot?.controller.alarm && <Badge tone="critical">{snapshot.controller.alarm}</Badge>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">{t('controller.params')}</div>
          <div className="col" style={{ gap: 8 }}>
            <ParamSlider label={`${t('controller.target')} R`} value={params.controller.R_target} min={1.2} max={2.2} step={0.05}
              onChange={(v) => applyParam('controller.R_target', v)} />
            <ParamSlider label={t('controller.arm')} value={params.controller.R_arm} min={1.5} max={2.5} step={0.05}
              onChange={(v) => applyParam('controller.R_arm', v)} />
            <ParamSlider label={t('controller.inject')} value={params.controller.R_inject} min={1.0} max={2.0} step={0.05}
              onChange={(v) => applyParam('controller.R_inject', v)} />
            <ParamSlider label={t('controller.recover')} value={params.controller.R_recover} min={1.5} max={2.5} step={0.05}
              onChange={(v) => applyParam('controller.R_recover', v)} />
            <ParamSlider label={t('controller.kp')} value={params.controller.Kp} min={0} max={1} step={0.01}
              onChange={(v) => applyParam('controller.Kp', v)} />
            <ParamSlider label={t('controller.ki')} value={params.controller.Ki} min={0} max={0.05} step={0.001}
              onChange={(v) => applyParam('controller.Ki', v)} />
            <ParamSlider label={t('controller.dwell')} value={params.controller.minDwell} min={0} max={60} step={1}
              onChange={(v) => applyParam('controller.minDwell', v)} />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('controller.strategy')}</div>
        <div className="row" style={{ gap: 6 }}>
          {(['A', 'B', 'C'] as const).map((s) => (
            <button key={s} onClick={() => applyStrategy(s)}
              style={{ flex: 1, borderColor: strategy === s ? 'var(--accent)' : undefined }}>
              {t(`controller.strategy${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('controller.compare')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'start', color: 'var(--text-2)' }}>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>Strategy</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('twin.minR')}</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('twin.damage')}</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('controller.tankUse')}</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('controller.surgePk')}</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('controller.cycles')}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }}>
                  {t(`controller.strategy${c.id}`)}
                </td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="mono">{formatNumber(c.minR, { decimals: 2, locale, digitStyle: digits })}</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="mono">{formatNumber(c.damage, { decimals: 3, locale, digitStyle: digits })}</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="mono">{formatNumber(c.tankUsed, { decimals: 1, locale, digitStyle: digits })} m³</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="mono">{formatNumber(c.surge / 1000, { decimals: 0, locale, digitStyle: digits })} kPa</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="mono">{c.cycles}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParamSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const digits = useApp((s) => s.digits);
  const lang = useApp((s) => s.lang);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  return (
    <label>
      <span className="small muted">{label}</span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-value">{formatNumber(value, { decimals: step < 0.01 ? 3 : 2, locale, digitStyle: digits })}</span>
      </div>
    </label>
  );
}
