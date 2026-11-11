import { formatNumber } from '../sim/units';

export interface Band {
  /** Upper bound of this band (value units). */
  to: number;
  color: string;
}

interface RadialGaugeProps {
  value: number;
  min: number;
  max: number;
  bands: Band[];
  label: string;
  unit?: string;
  decimals?: number;
  size?: number;
  /** Optional alert pointer value. */
  alarm?: number;
}

const START = -210;
const SWEEP = 240;

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function RadialGauge({
  value,
  min,
  max,
  bands,
  label,
  unit,
  decimals = 2,
  size = 150,
  alarm,
}: RadialGaugeProps) {
  const { lang, digits } = useAppHelpers();
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  const span = max - min || 1;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const angle = (v: number) => START + ((clamp(v) - min) / span) * SWEEP;
  const needle = angle(value);

  // Build band arcs.
  let cursor = min;
  const arcs: { d: string; color: string }[] = [];
  for (const b of bands) {
    const from = cursor;
    const to = Math.min(b.to, max);
    if (to <= from) continue;
    arcs.push({
      d: arcPath(cx, cy, r, angle(from) + 1.2, angle(to) - 1.2),
      color: b.color,
    });
    cursor = to;
  }

  const [nx, ny] = polar(cx, cy, r - 16, needle);
  const [tx0, ty0] = polar(cx, cy, 6, needle + 90);
  const [tx1, ty1] = polar(cx, cy, 6, needle - 90);

  return (
    <div className="gauge-wrap">
      <svg width={size} height={size} role="img" aria-label={label}>
        <circle cx={cx} cy={cy} r={r + 6} fill="none" stroke="var(--line-soft)" strokeWidth={10} />
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={10} strokeLinecap="round" opacity={0.85} />
        ))}
        {alarm !== undefined && (
          <line
            x1={polar(cx, cy, r - 4, angle(alarm))[0]}
            y1={polar(cx, cy, r - 4, angle(alarm))[1]}
            x2={polar(cx, cy, r + 8, angle(alarm))[0]}
            y2={polar(cx, cy, r + 8, angle(alarm))[1]}
            stroke="var(--text-0)"
            strokeWidth={2}
          />
        )}
        <line x1={tx0} y1={ty0} x2={tx1} y2={ty1} stroke="var(--text-2)" strokeWidth={2} />
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="var(--text-0)"
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transition: 'all 120ms cubic-bezier(.2,.8,.2,1)' }}
        />
        <circle cx={cx} cy={cy} r={4} fill="var(--accent)" />
        <text x={cx} y={cy + r * 0.55} textAnchor="middle" fill="var(--text-0)" fontSize={size * 0.16} fontWeight={650} fontFamily="var(--font-mono)">
          {formatNumber(value, { decimals, locale: lang === 'ar' ? 'ar-SA' : 'en-US', digitStyle: digits })}
        </text>
        {unit && (
          <text x={cx} y={cy + r * 0.55 + size * 0.09} textAnchor="middle" fill="var(--text-2)" fontSize={size * 0.07}>
            {unit}
          </text>
        )}
      </svg>
      <div className="gauge-label">{label}</div>
    </div>
  );
}

// Local hook shim to avoid importing the store in every gauge (keeps SSR/simple).
import { useApp } from '../state/store';
import type { LangCode } from '../i18n';
function useAppHelpers(): { lang: LangCode; digits: 'western' | 'arabic-indic' } {
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  return { lang, digits };
}
