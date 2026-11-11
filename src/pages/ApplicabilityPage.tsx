import { useTranslation } from 'react-i18next';
import { Badge } from '../components/Badges';

type Effectiveness = 'yes' | 'no' | 'partial' | 'out';

const CASES: { case: string; effective: Effectiveness; reason: string }[] = [
  { case: 'Centrifugal pump, variable suction (seawater intake, lift stations, irrigation, filter feed)', effective: 'yes', reason: 'NPSHa is the limiting variable and can be raised' },
  { case: 'Suction strainer fouling, low source level, rising temperature', effective: 'yes', reason: 'Raises NPSHa during the event' },
  { case: 'Low-flow recirculation (Q below about 0.6 Q_BEP) / throttled discharge', effective: 'no', reason: 'Root cause is internal recirculation; raising suction pressure does not fix it' },
  { case: 'Air ingestion / intake vortices', effective: 'no', reason: 'Needs intake design (HI 9.8 submergence, vortex suppressors)' },
  { case: 'Fluids near boiling (LPG, refrigerants, hot condensate)', effective: 'no', reason: 'Needs inducers / low-NPSH impellers / lower-set tanks' },
  { case: 'RO high-pressure pump (HPP)', effective: 'out', reason: 'Stable-state risk is low; the real risk is the rate of pressure change on membranes' },
  { case: 'Reciprocating pumps', effective: 'out', reason: 'Governed by NPIPa (NPSHa minus acceleration head), not NPSHa' },
  { case: 'Fast phenomena (injectors, wet liners, control valves)', effective: 'no', reason: 'Valve + tank response is far slower than the events' },
  { case: 'Thermal plants with deaerators', effective: 'partial', reason: 'Elevation already used statically; only dynamic activation is new' },
];

// Log-scale timescale (seconds).
const SCALE = [
  { label: 'Water hammer', t: 0.08, kind: 'event' },
  { label: 'Cavitation', t: 1, kind: 'event' },
  { label: 'Air ingestion', t: 2, kind: 'event' },
  { label: 'Recirculation', t: 10, kind: 'event' },
  { label: 'RO ramp limit', t: 3, kind: 'event' },
  { label: 'Valve stroke', t: 12, kind: 'response' },
  { label: 'VFD ramp', t: 5, kind: 'response' },
  { label: 'Temperature drift', t: 600, kind: 'event' },
  { label: 'Tide / fouling', t: 7200, kind: 'event' },
];

export function ApplicabilityPage() {
  const { t } = useTranslation();
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('applicability.title')}</h2>
      </div>

      <div className="panel">
        <div className="panel-title">{t('applicability.matrix')}</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'start', color: 'var(--text-2)' }}>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>Case</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('applicability.effective')}?</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('applicability.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => (
              <tr key={c.case}>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)', maxWidth: 320 }}>{c.case}</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }}>
                  <Badge tone={c.effective === 'yes' ? 'safe' : c.effective === 'partial' ? 'watch' : c.effective === 'out' ? 'info' : 'critical'}>
                    {c.effective === 'yes' ? t('applicability.effective') : c.effective === 'no' ? t('applicability.notEffective') : c.effective === 'partial' ? t('applicability.partial') : 'Out of scope'}
                  </Badge>
                </td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="muted">{c.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-title">{t('applicability.timescale')}</div>
        <Timescale />
      </div>
    </div>
  );
}

function Timescale() {
  const { t } = useTranslation();
  const W = 800;
  const H = 260;
  const logMin = Math.log10(0.01);
  const logMax = Math.log10(20000);
  const x = (t: number) => ((Math.log10(t) - logMin) / (logMax - logMin)) * (W - 60) + 50;
  const rows = SCALE;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('applicability.timescale')}>
      {[0.01, 0.1, 1, 10, 100, 1000, 10000].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={20} x2={x(v)} y2={H - 30} stroke="var(--line-soft)" strokeWidth={1} />
          <text x={x(v)} y={H - 14} textAnchor="middle" fill="var(--text-2)" fontSize={10}>
            {v < 1 ? `${v * 1000} ms` : v < 60 ? `${v} s` : v < 3600 ? `${v / 60} min` : `${v / 3600} h`}
          </text>
        </g>
      ))}
      {rows.map((r, i) => {
        const y = 30 + i * 24;
        const isResp = r.kind === 'response';
        return (
          <g key={r.label}>
            <circle cx={x(r.t)} cy={y} r={5} fill={isResp ? 'var(--accent)' : 'var(--warning)'} />
            <text x={x(r.t) + 9} y={y + 4} fill="var(--text-1)" fontSize={11}>
              {r.label}
            </text>
            {isResp && <circle cx={x(r.t)} cy={y} r={9} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.5} />}
          </g>
        );
      })}
    </svg>
  );
}
