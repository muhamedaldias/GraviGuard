import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { simSend } from '../hooks/sim';
import { PidSchematic } from '../components/PidSchematic';
import { RadialGauge } from '../components/RadialGauge';
import { StripChart, type ChartSeries } from '../components/StripChart';
import { AdvisorCard, CavityBadge, CavityStrip, StateStrip } from '../components/Badges';
import { formatNumber, formatPressureBar } from '../sim/units';
import type { Scenario } from '../sim/types';

const R_BANDS = [
  { to: 1.0, color: 'var(--critical)' },
  { to: 1.3, color: 'var(--warning)' },
  { to: 1.6, color: 'var(--watch)' },
  { to: 2.0, color: '#8fbf3f' },
  { to: 99, color: 'var(--safe)' },
];

export function Simulator() {
  const { t } = useTranslation();
  const snap = useApp((s) => s.snapshot);
  const history = useApp((s) => s.history);
  const playing = useApp((s) => s.playing);
  const setPlaying = useApp((s) => s.setPlaying);
  const speed = useApp((s) => s.speed);
  const setSpeed = useApp((s) => s.setSpeed);
  const seed = useApp((s) => s.seed);
  const setSeed = useApp((s) => s.setSeed);
  const units = useApp((s) => s.units);
  const digits = useApp((s) => s.digits);
  const lang = useApp((s) => s.lang);
  const scenario = useApp((s) => s.scenario);
  const setScenario = useApp((s) => s.setScenario);

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [mode, setMode] = useState<'OFF' | 'ON' | 'MANUAL'>('ON');
  const [injectors, setInjectors] = useState({
    z_level: 1.0,
    K_strainer: 2.0,
    T: 35,
    k_discharge: 2000,
    n: 1.0,
    z_bell: -5.0,
    noiseScale: 1.0,
  });

  useEffect(() => {
    fetch('./scenarios/index.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((ids: string[]) => Promise.all(ids.map((id) => fetch(`./scenarios/${id}.json`).then((r) => r.json()))))
      .then(setScenarios)
      .catch(() => setScenarios([]));
  }, []);

  const sendInput = useCallback((key: string, value: number | boolean) => {
    simSend({ type: 'input', key: key as never, value });
  }, []);

  const applyScenario = useCallback(
    (sc: Scenario | null) => {
      setScenario(sc);
      if (sc) simSend({ type: 'scenario', scenario: sc });
    },
    [setScenario],
  );

  const togglePlay = useCallback(() => {
    const next = !playing;
    setPlaying(next);
    simSend({ type: next ? 'play' : 'pause' });
  }, [playing, setPlaying]);

  const stepOnce = useCallback(() => {
    simSend({ type: 'step', seconds: 1 });
  }, []);

  const reset = useCallback(() => {
    simSend({ type: 'reset', seed });
  }, [seed]);

  const s = snap;
  const chart = useMemo(() => {
    const t = history.map((h) => h.t);
    return {
      t,
      R: history.map((h) => h.R),
      NPSHa: history.map((h) => h.NPSHa),
      NPSH3: history.map((h) => h.NPSH3),
      Q: history.map((h) => h.Q),
      H: history.map((h) => h.H),
      Ps: history.map((h) => h.P_suction),
      Pd: history.map((h) => h.P_discharge),
      T: history.map((h) => h.T),
      level: history.map((h) => h.level),
      tank: history.map((h) => h.tankH),
      theta: history.map((h) => h.theta),
      CI: history.map((h) => h.CI),
      dmg: history.map((h) => h.damage),
      vib: history.map((h) => h.vibration),
      n: history.map((h) => h.n),
      drop: history.map((h) => h.headDrop),
    };
  }, [history]);

  return (
    <div className="col" style={{ gap: 12 }}>
      {/* Control bar */}
      <div className="panel row" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="primary" onClick={togglePlay}>
          {playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
        </button>
        <button onClick={stepOnce}>⏭ {t('common.step')}</button>
        <button onClick={reset}>↺ {t('common.reset')}</button>
        <label style={{ minWidth: 150 }}>
          <span className="small muted">
            {t('common.speed')}: ×{speed}
          </span>
          <input
            type="range"
            min={0.25}
            max={200}
            step={0.25}
            value={speed}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSpeed(v);
              simSend({ type: 'speed', speed: v });
            }}
          />
        </label>
        <label>
          <span className="small muted">{t('common.seed')}</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </label>
        <select
          value={scenario?.id ?? ''}
          onChange={(e) => applyScenario(scenarios.find((x) => x.id === e.target.value) ?? null)}
        >
          <option value="">{t('common.scenario')}…</option>
          {scenarios.map((sc) => (
          <option key={sc.id} value={sc.id}>
            {sc.id} — {lang === 'ar' ? sc.nameAr : sc.name}
          </option>
          ))}
        </select>
        {scenario && <CavityBadge state={s?.cavState ?? 'NONE'} />}
        <span className="muted small" style={{ marginInlineStart: 'auto' }}>
          {s ? `${t('common.simTime')}: ${s.t.toFixed(1)} s` : ''}
        </span>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 300px', gap: 12, alignItems: 'start' }}>
        {/* Control rail */}
        <div className="panel col" style={{ gap: 10 }}>
          <div className="panel-title">{t('sim.injectors')}</div>
          <Slider label={t('sim.level')} unit="m" min={-5} max={2} step={0.05} value={injectors.z_level}
            onChange={(v) => { setInjectors({ ...injectors, z_level: v }); sendInput('z_level', v); }} />
          <Slider label={t('sim.fouling')} unit="K" min={0} max={100} step={1} value={injectors.K_strainer}
            onChange={(v) => { setInjectors({ ...injectors, K_strainer: v }); sendInput('K_strainer', v); }} />
          <Slider label={t('sim.temperature')} unit="°C" min={5} max={90} step={0.5} value={injectors.T}
            onChange={(v) => { setInjectors({ ...injectors, T: v }); sendInput('T', v); }} />
          <Slider label={t('sim.demand')} unit="s²/m⁵" min={200} max={8000} step={50} value={injectors.k_discharge}
            onChange={(v) => { setInjectors({ ...injectors, k_discharge: v }); sendInput('k_discharge', v); }} />
          <Slider label={t('sim.speedCtl')} unit="%" min={70} max={105} step={1} value={injectors.n * 100}
            onChange={(v) => { setInjectors({ ...injectors, n: v / 100 }); sendInput('n', v / 100); }} />
          <Slider label={t('sim.submergence')} unit="m" min={-6} max={-2} step={0.1} value={injectors.z_bell}
            onChange={(v) => { setInjectors({ ...injectors, z_bell: v }); sendInput('z_bell', v); }} />
          <Slider label={t('sim.noise')} unit="σ" min={0} max={3} step={0.1} value={injectors.noiseScale}
            onChange={(v) => { setInjectors({ ...injectors, noiseScale: v }); sendInput('noiseScale', v); }} />

          <div className="panel-title" style={{ marginTop: 6 }}>{t('sim.mode')}</div>
          <div className="row" style={{ gap: 4 }}>
            {(['OFF', 'ON', 'MANUAL'] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  simSend({ type: 'mode', mode: m });
                }}
                style={{
                  flex: 1,
                  fontSize: 11,
                  borderColor: mode === m ? 'var(--accent)' : undefined,
                  color: mode === m ? 'var(--accent)' : undefined,
                }}
              >
                {m === 'ON' ? t('common.on') : m === 'OFF' ? t('common.off') : t('common.manual')}
              </button>
            ))}
          </div>
          {s?.controller.name === 'MANUAL' && (
            <Slider label={t('sim.manualPos')} unit="%" min={0} max={100} step={1} value={s.theta * 100}
              onChange={(v) => simSend({ type: 'input', key: 'manualValve', value: v / 100 })} />
          )}

          <div className="panel-title" style={{ marginTop: 6 }}>{t('sensors.faults')}</div>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <FaultToggle label={t('transients.atValve')} active={s?.controller.name === 'FAULT_SAFE'}
              onClick={() => simSend({ type: 'input', key: 'valveStuck', value: !s?.controller.name })} />
            <FaultToggle label={t('sensors.drift')} active={false}
              onClick={() => simSend({ type: 'input', key: 'pressureDrift', value: 30000 })} />
            <FaultToggle label={t('sensors.dropout')} active={false}
              onClick={() => simSend({ type: 'input', key: 'pressureDropout', value: true })} />
            <FaultToggle label="CV leak" active={false}
              onClick={() => simSend({ type: 'input', key: 'checkValveLeak', value: true })} />
          </div>
        </div>

        {/* Schematic */}
        <div className="panel" style={{ padding: 8 }}>
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 6px' }}>
            <span className="panel-title" style={{ margin: 0 }}>{t('sim.schematic')}</span>
            <button
              style={{ fontSize: 11 }}
              onClick={() => {
                const svg = document.getElementById('pid-svg') as SVGElement | null;
                if (!svg) return;
                const clone = svg.cloneNode(true) as SVGElement;
                clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'gurue-pid.svg';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {t('reports.svg')}
            </button>
          </div>
          <PidSchematic state={s} />
          <div style={{ padding: '4px 8px' }}>
            <StateStrip current={s?.controller.name ?? 'IDLE'} />
            <div style={{ height: 6 }} />
            <CavityStrip current={s?.cavState ?? 'NONE'} />
          </div>
        </div>

        {/* Gauges */}
        <div className="panel col" style={{ gap: 10 }}>
          <div className="panel-title">{t('sim.gauges')}</div>
          <RadialGauge value={s?.R ?? 0} min={0} max={3} bands={R_BANDS} label={t('sim.margin')} decimals={2} size={140} alarm={1.6} />
          <div className="grid-2" style={{ gap: 8 }}>
            <GaugeBox label={t('sim.npsha')} value={(s?.NPSHa ?? 0).toFixed(2)} unit="m" tone="var(--water)" />
            <GaugeBox label={t('sim.npsh3')} value={(s?.NPSH3 ?? 0).toFixed(2)} unit="m" tone="var(--steel)" />
            <GaugeBox label={t('sim.flow')} value={(s ? s.Q * 3600 : 0).toFixed(0)} unit="m³/h" tone="var(--water)" />
            <GaugeBox label={t('sim.headDrop')} value={((s?.headDrop ?? 0) * 100).toFixed(1)} unit="%" tone="var(--warning)" />
            <GaugeBox label={t('sim.tank')} value={(s?.tankH ?? 0).toFixed(2)} unit="m" tone="var(--accent)" />
            <GaugeBox label={t('sim.valve')} value={((s?.theta ?? 0) * 100).toFixed(0)} unit="%" tone="var(--accent)" />
            <GaugeBox label={t('sim.damage')} value={(s?.damage ?? 0).toFixed(2)} unit="" tone="var(--critical)" />
            <GaugeBox label={t('sim.vibration')} value={(s?.sensors.vibrationRMS ?? 0).toFixed(2)} unit="m/s²" tone="var(--watch)" />
          </div>
          <div className="kpi">
            <span className="kpi-label">{t('sim.surge')}</span>
            <span className="kpi-value" style={{ color: (s?.surge.surgePeak ?? 0) > 500000 ? 'var(--critical)' : 'var(--text-0)' }}>
              {formatPressureBar(s?.surge.surgePeak ?? 0, units, digits === 'arabic-indic' ? 'ar-SA' : 'en-US', digits).value}
              <span className="kpi-unit">{units === 'SI' ? 'bar' : 'psi'}</span>
            </span>
          </div>
          <AdvisorCard advisor={s?.advisor ?? { id: 'ok', severity: 'info', evidence: {} }} />
        </div>
      </div>

      {/* Charts */}
      <div className="panel">
        <div className="panel-title">{t('sim.charts')}</div>
        <div className="col" style={{ gap: 8 }}>
          <ChartRow label={t('sim.margin') + ' / NPSH'}
            series={[
              { label: 'R', color: 'var(--accent)', data: chart.R, scale: 'y' },
              { label: 'NPSHa', color: 'var(--water)', data: chart.NPSHa, scale: 'y2' },
              { label: 'NPSH3', color: 'var(--steel)', data: chart.NPSH3, scale: 'y2' },
            ]}
            hlines={[{ y: 1.6, color: 'var(--watch)', label: 'R=1.6' }]} />
          <ChartRow label={t('sim.flow')}
            series={[
              { label: 'Q', color: 'var(--water)', data: chart.Q },
              { label: 'speed %', color: 'var(--steel)', data: chart.n.map((x) => x * 100) },
            ]} />
          <ChartRow label={t('sim.tank') + ' / ' + t('sim.valve')}
            series={[
              { label: 'tank', color: 'var(--accent)', data: chart.tank },
              { label: 'valve', color: 'var(--warning)', data: chart.theta.map((x) => x * 10) },
            ]} />
          <ChartRow label={t('sim.vibration') + ' / ' + t('sim.damage')}
            series={[
              { label: 'vib', color: 'var(--watch)', data: chart.vib },
              { label: 'damage', color: 'var(--critical)', data: chart.dmg },
              { label: 'CI', color: 'var(--water)', data: chart.CI.map((x) => x / 10) },
            ]} />
        </div>
      </div>
    </div>
  );
}

function Slider({ label, unit, min, max, step, value, onChange }: {
  label: string; unit: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void;
}) {
  const digits = useApp((s) => s.digits);
  const locale = useApp((s) => s.lang) === 'ar' ? 'ar-SA' : 'en-US';
  return (
    <label>
      <span className="small muted">
        {label}
      </span>
      <div className="slider-row">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="slider-value">
          {formatNumber(value, { decimals: step < 1 ? 2 : 0, locale, digitStyle: digits })}
          {unit}
        </span>
      </div>
    </label>
  );
}

function GaugeBox({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  return (
    <div className="kpi" style={{ borderInlineStartColor: tone }}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ fontSize: 15 }}>
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </span>
    </div>
  );
}

function ChartRow({ label, series, hlines }: { label: string; series: ChartSeries[]; hlines?: { y: number; color: string; label?: string }[] }) {
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 2 }}>{label}</div>
      <StripChart series={series} height={120} hlines={hlines} />
    </div>
  );
}

function FaultToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        flex: '1 1 45%',
        borderColor: active ? 'var(--critical)' : undefined,
        color: active ? 'var(--critical)' : undefined,
      }}
    >
      {label}
    </button>
  );
}
