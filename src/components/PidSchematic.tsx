import { useTranslation } from 'react-i18next';
import type { SimState } from '../sim/types';

/**
 * ISA-5.1-inspired P&ID schematic (Section 7.2). Flow direction is physical
 * and is never mirrored in RTL. Particles are SMIL-animated and their speed
 * scales with the branch flow.
 */
export function PidSchematic({ state }: { state: SimState | null }) {
  const { t } = useTranslation();
  const s = state;
  const z = s ? s.H_S - 10.08 : 1.0;
  const seaY = 150 - z * 12;
  const tankH = s ? s.tankH : 5;
  const tankY = 150 - tankH * 12;
  const theta = s ? s.theta : 0;
  const qNorm = s ? Math.min(1, s.Q / 0.15) : 0;
  const qtNorm = s ? Math.min(1, s.Q_T / 0.15) : 0;
  const pressureColor = pressureTone(s ? s.sensors.P_suction_gauge : 0);
  const fouling = s ? Math.min(1, Math.max(0, (s.sensors.strainerDP - 200) / 4000)) : 0;

  return (
    <svg id="pid-svg" viewBox="0 0 960 440" width="100%" role="img" aria-label={t('sim.schematic')} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--water)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="tankGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--water)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.2" />
        </linearGradient>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--text-2)" />
        </marker>
      </defs>

      {/* Sea / source */}
      <rect x={20} y={seaY} width={140} height={300 - seaY} fill="url(#waterGrad)" />
      <path
        d={`M20 ${seaY} ` + Array.from({ length: 15 }, () => `q 5 -6 10 0`).join(' ') + ' L160 ' + seaY}
        fill="none"
        stroke="var(--water)"
        strokeWidth={2}
      >
        <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
      </path>
      <text x={90} y={seaY - 10} textAnchor="middle" fill="var(--text-1)" fontSize={11}>
        {t('sim.level')}: {(z >= 0 ? '+' : '') + z.toFixed(2)} m
      </text>

      {/* Suction bell + strainer */}
      <path d="M105 300 L135 300 L128 330 L112 330 Z" fill="var(--bg-3)" stroke="var(--steel)" strokeWidth={1.5} />
      <rect x={108} y={292} width={24} height={8} fill={fouling > 0 ? `color-mix(in srgb, var(--warning) ${20 + fouling * 70}%, var(--bg-3))` : 'var(--bg-3)'} stroke="var(--steel)" />
      <text x={120} y={345} textAnchor="middle" fill="var(--text-2)" fontSize={10}>
        {t('pump.eye')}
      </text>

      {/* Suction line */}
      <path d="M120 330 L120 260 L300 260" fill="none" stroke={pressureColor} strokeWidth={5} />
      <path d="M120 330 L120 260 L300 260" fill="none" stroke="var(--text-2)" strokeWidth={1} markerEnd="url(#arrow)" />
      {s && s.Q_S > 0.001 && (
        <circle r={3.5} fill="var(--water)">
          <animateMotion dur={`${Math.max(0.4, 2.4 - qNorm * 2)}s`} repeatCount="indefinite" path="M120 330 L120 260 L300 260" />
        </circle>
      )}

      {/* Check valve */}
      <g transform="translate(190 260)">
        <path d="M-12 8 L0 -8 L12 8 Z" fill="var(--bg-2)" stroke="var(--text-1)" strokeWidth={1.5} />
        <line x1={12} y1={-8} x2={12} y2={8} stroke="var(--text-1)" strokeWidth={1.5} />
        <text y={22} textAnchor="middle" fill="var(--text-2)" fontSize={9}>CV</text>
      </g>

      {/* Junction J */}
      <circle cx={320} cy={260} r={6} fill="var(--bg-1)" stroke="var(--accent)" strokeWidth={2} />
      <text x={320} y={245} textAnchor="middle" fill="var(--accent)" fontSize={11} fontFamily="var(--font-mono)">J</text>

      {/* Tank branch */}
      <path d="M320 260 L320 180 L470 180 L470 150" fill="none" stroke={qtNorm > 0.02 ? 'var(--water)' : 'var(--line)'} strokeWidth={5} />
      {s && s.Q_T > 0.001 && (
        <circle r={3.5} fill="var(--water)">
          <animateMotion dur={`${Math.max(0.4, 2.4 - qtNorm * 2)}s`} repeatCount="indefinite" path="M320 260 L320 180 L470 180 L470 150" />
        </circle>
      )}
      {/* Motorized valve */}
      <g transform="translate(400 180)">
        <path d="M-14 -10 L14 10 M-14 10 L14 -10" stroke="var(--text-0)" strokeWidth={2} />
        <rect x={-8} y={-22 - theta * 8} width={16} height={12} fill="var(--accent)" opacity={0.7} />
        <text y={24} textAnchor="middle" fill="var(--text-2)" fontSize={9}>GV · {(theta * 100).toFixed(0)}%</text>
      </g>

      {/* Elevated tank */}
      <rect x={470} y={60} width={110} height={90} fill="var(--bg-2)" stroke="var(--steel)" strokeWidth={1.5} />
      <rect x={472} y={tankY} width={106} height={150 - tankY} fill="url(#tankGrad)" />
      <line x1={470} y1={150 - 0.5 * 12} x2={580} y2={150 - 0.5 * 12} stroke="var(--critical)" strokeDasharray="4 3" strokeWidth={1} />
      <text x={525} y={52} textAnchor="middle" fill="var(--text-1)" fontSize={10}>
        {t('sim.tank')}: {tankH.toFixed(2)} m
      </text>
      <text x={525} y={165} textAnchor="middle" fill="var(--text-2)" fontSize={9}>
        {t('sim.tank')}: {(tankH * 10).toFixed(0)} m³
      </text>

      {/* Pump */}
      <g transform="translate(380 320)">
        <circle r={34} fill="var(--bg-2)" stroke="var(--steel)" strokeWidth={2} />
        <circle r={22} fill="none" stroke="var(--accent)" strokeWidth={2} opacity={0.6} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * 60 * Math.PI) / 180 + (s ? s.t * 8 : 0);
          return (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={22 * Math.cos(a)}
              y2={22 * Math.sin(a)}
              stroke="var(--accent)"
              strokeWidth={2}
              opacity={0.7}
            />
          );
        })}
        <text y={52} textAnchor="middle" fill="var(--text-2)" fontSize={10}>P-101</text>
      </g>
      {/* Motor */}
      <rect x={424} y={292} width={62} height={56} rx={6} fill="var(--bg-3)" stroke="var(--steel)" strokeWidth={1.5} />
      <text x={455} y={324} textAnchor="middle" fill="var(--text-1)" fontSize={11}>M</text>
      <text x={455} y={285} textAnchor="middle" fill="var(--text-2)" fontSize={9}>
        {(s ? s.vfdSpeed * 100 : 100).toFixed(0)}%
      </text>

      {/* Discharge line */}
      <path d="M414 320 L470 320 L470 260 L860 260" fill="none" stroke="var(--warning)" strokeWidth={5} opacity={0.75} />
      <path d="M414 320 L470 320 L470 260 L860 260" fill="none" stroke="var(--text-2)" strokeWidth={1} markerEnd="url(#arrow)" />
      {s && s.Q > 0.001 && (
        <circle r={3.5} fill="var(--warning)">
          <animateMotion dur={`${Math.max(0.4, 2.4 - qNorm * 2)}s`} repeatCount="indefinite" path="M414 320 L470 320 L470 260 L860 260" />
        </circle>
      )}

      {/* Instrument bubbles */}
      <InstrumentTag x={520} y={240} tag="PT" value={s ? (s.sensors.P_discharge / 1000).toFixed(0) + ' kPa' : ''} />
      <InstrumentTag x={590} y={240} tag="FT" value={s ? (s.Q * 3600).toFixed(0) + ' m³/h' : ''} />
      <InstrumentTag x={660} y={240} tag="TT" value={s ? s.sensors.T.toFixed(1) + ' °C' : ''} />
      <InstrumentTag x={730} y={240} tag="VT" value={s ? s.sensors.vibrationRMS.toFixed(2) + ' m/s²' : ''} />
      <InstrumentTag x={250} y={290} tag="LT" value={s ? s.sensors.level.toFixed(2) + ' m' : ''} />

      {/* Header */}
      <rect x={860} y={230} width={70} height={60} fill="var(--bg-2)" stroke="var(--steel)" strokeWidth={1.5} />
      <text x={895} y={265} textAnchor="middle" fill="var(--text-1)" fontSize={10}>HDR</text>
    </svg>
  );
}

function InstrumentTag({ x, y, tag, value }: { x: number; y: number; tag: string; value: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={12} fill="var(--bg-1)" stroke="var(--accent)" strokeWidth={1.2} />
      <text x={x} y={y + 4} textAnchor="middle" fill="var(--accent)" fontSize={10} fontFamily="var(--font-mono)">
        {tag}
      </text>
      <text x={x} y={y + 26} textAnchor="middle" fill="var(--text-1)" fontSize={9} fontFamily="var(--font-mono)">
        {value}
      </text>
    </g>
  );
}

function pressureTone(pGaugePa: number): string {
  // Low pressure = blue-violet, high = orange-red.
  const m = Math.max(-50000, Math.min(150000, pGaugePa));
  const f = (m + 50000) / 200000;
  const r = Math.round(90 + f * 165);
  const g = Math.round(120 - f * 60);
  const b = Math.round(220 - f * 140);
  return `rgb(${r},${g},${b})`;
}
