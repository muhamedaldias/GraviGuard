import { useTranslation } from 'react-i18next';
import type { SimState } from '../sim/types';

/**
 * Pump artwork (Section 7.3): external view and a cutaway with a low-pressure
 * map, bubble cloud driven by cavitation intensity, and a pit heat map driven
 * by the damage accumulator.
 */
export function PumpCutaway({ state, view = 'cutaway' }: { state: SimState | null; view?: 'external' | 'cutaway' }) {
  const { t } = useTranslation();
  const s = state;
  const ci = s ? s.CI : 0;
  const damage = s ? Math.min(1, s.damage / 3) : 0;
  const breakdown = s ? s.cavState === 'BREAKDOWN' : false;
  const speed = s ? s.vfdSpeed : 1;
  const angle = s ? s.t * speed * 180 : 0;

  if (view === 'external') {
    return (
      <svg viewBox="0 0 420 260" width="100%" role="img" aria-label={t('pump.external')}>
        <defs>
          <linearGradient id="castIron" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4b5a6b" />
            <stop offset="45%" stopColor="#2c3742" />
            <stop offset="100%" stopColor="#1a222b" />
          </linearGradient>
          <linearGradient id="motorFin" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b4a5a" />
            <stop offset="100%" stopColor="#222d38" />
          </linearGradient>
          <radialGradient id="flange" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0%" stopColor="#7d8ea1" />
            <stop offset="100%" stopColor="#3a4652" />
          </radialGradient>
        </defs>
        {/* Base plate */}
        <rect x={40} y={220} width={340} height={12} rx={3} fill="#222d38" />
        {/* Volute casing */}
        <circle cx={150} cy={150} r={66} fill="url(#castIron)" stroke="#5a6b7d" strokeWidth={2} />
        <circle cx={150} cy={150} r={50} fill="none" stroke="#5a6b7d" strokeWidth={1.5} />
        {/* Suction nozzle (axial, toward viewer) */}
        <circle cx={150} cy={150} r={26} fill="url(#flange)" stroke="#8b9bab" strokeWidth={2} />
        <circle cx={150} cy={150} r={14} fill="#101722" />
        {/* Discharge nozzle */}
        <rect x={196} y={130} width={46} height={40} rx={4} fill="url(#castIron)" stroke="#5a6b7d" />
        <ellipse cx={242} cy={150} rx={12} ry={20} fill="url(#flange)" stroke="#8b9bab" strokeWidth={1.5} />
        {/* Bearing housing + coupling + motor */}
        <rect x={216} y={126} width={34} height={48} rx={5} fill="#38434f" stroke="#5a6b7d" />
        <circle cx={262} cy={150} r={12} fill="#4a5a6a" stroke="#8b9bab" />
        <g>
          <g transform={`rotate(${angle} 300 150)`}>
            <circle cx={300} cy={150} r={7} fill="#8b9bab" />
          </g>
          <rect x={288} y={104} width={96} height={92} rx={8} fill="url(#motorFin)" stroke="#5a6b7d" strokeWidth={1.5} />
          {Array.from({ length: 8 }, (_, i) => (
            <line key={i} x1={294 + i * 12} y1={106} x2={294 + i * 12} y2={194} stroke="#1a222b" strokeWidth={3} />
          ))}
          <circle cx={384} cy={150} r={20} fill="#2c3742" stroke="#5a6b7d" />
        </g>
        {/* Name plate */}
        <rect x={118} y={206} width={64} height={18} rx={2} fill="#101722" stroke="#5a6b7d" />
        <text x={150} y={218} textAnchor="middle" fill="#8b9bab" fontSize={8} fontFamily="var(--font-mono)">
          GRAVIGUARD 100
        </text>
      </svg>
    );
  }

  // Cutaway
  const bubbleCount = Math.round(ci * 26);
  return (
    <svg viewBox="0 0 420 300" width="100%" role="img" aria-label={t('pump.cutaway')}>
      <defs>
        <radialGradient id="voluteGrad" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#0ea5e9" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a0e14" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="vaneGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#f28c28" />
        </linearGradient>
        <clipPath id="voluteClip">
          <path d="M210 150 m-96 0 a96 96 0 1 0 192 0 a96 96 0 1 0 -192 0 Z" />
        </clipPath>
      </defs>

      {/* Volute casing */}
      <path
        d="M210 150 m-104 0 a104 104 0 1 0 208 0 a104 104 0 1 0 -208 0 Z M210 150 m-92 0 a92 92 0 1 0 184 0 a92 92 0 1 0 -184 0 Z"
        fillRule="evenodd"
        fill="#2c3742"
        stroke="#5a6b7d"
        strokeWidth={2}
      />
      <circle cx={210} cy={150} r={92} fill="url(#voluteGrad)" />
      {/* Discharge tongue */}
      <path d="M210 58 L232 30 L252 44 L232 70 Z" fill="#2c3742" stroke="#5a6b7d" />

      {/* Impeller */}
      <g clipPath="url(#voluteClip)">
        <g transform={`rotate(${angle} 210 150)`}>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * 60 * Math.PI) / 180;
            const x2 = 210 + 78 * Math.cos(a);
            const y2 = 150 + 78 * Math.sin(a);
            const cx = 210 + 44 * Math.cos(a + 0.5);
            const cy = 150 + 44 * Math.sin(a + 0.5);
            return (
              <path
                key={i}
                d={`M210 150 Q ${cx} ${cy} ${x2} ${y2}`}
                fill="none"
                stroke="url(#vaneGrad)"
                strokeWidth={9}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          })}
          {/* Pit heat map on the vanes */}
          {Array.from({ length: Math.round(damage * 40) }, (_, i) => {
            const a = (i * 137.5 * Math.PI) / 180;
            const r = 26 + ((i * 7) % 52);
            return (
              <circle
                key={`p${i}`}
                cx={210 + r * Math.cos(a)}
                cy={150 + r * Math.sin(a)}
                r={1.4 + ((i % 3) * 0.5)}
                fill="var(--critical)"
                opacity={0.35 + damage * 0.5}
              />
            );
          })}
        </g>
        {/* Hub + eye */}
        <circle cx={210} cy={150} r={20} fill="#38434f" stroke="#8b9bab" strokeWidth={2} />
        <circle cx={210} cy={150} r={9} fill="#101722" />
        {/* Shaft */}
        <rect x={210} y={144} width={150} height={12} rx={6} fill="#4a5a6a" />
      </g>

      {/* Bubble cloud */}
      {Array.from({ length: bubbleCount }, (_, i) => {
        const a = (i * 211 * Math.PI) / 180;
        const r = 30 + ((i * 13) % 46);
        const bx = 210 + r * Math.cos(a);
        const by = 150 + r * Math.sin(a);
        return (
          <circle key={`b${i}`} cx={bx} cy={by} r={1.2 + ((i % 4) * 0.6)} fill="#bae6fd" opacity={0.55}>
            <animate attributeName="r" values={`${1 + (i % 3)};${2.4 + (i % 3)};${1 + (i % 3)}`} dur={`${0.9 + (i % 5) * 0.2}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0.15;0.6" dur={`${0.9 + (i % 5) * 0.2}s`} repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Breakdown pocket */}
      {breakdown && (
        <path
          d="M210 150 m-70 0 a70 70 0 1 0 140 0 a70 70 0 1 0 -140 0 Z"
          fill="#bae6fd"
          opacity={0.22}
        >
          <animate attributeName="opacity" values="0.15;0.35;0.15" dur="0.8s" repeatCount="indefinite" />
        </path>
      )}

      {/* Labels */}
      <text x={210} y={290} textAnchor="middle" fill="var(--text-2)" fontSize={10}>
        {t('pump.cutaway')} · CI {(ci * 100).toFixed(0)}% · {t('pump.damage')} {(damage * 100).toFixed(0)}%
      </text>
    </svg>
  );
}
