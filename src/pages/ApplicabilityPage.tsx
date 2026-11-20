import { useTranslation } from 'react-i18next';
import { Badge } from '../components/Badges';

type Effectiveness = 'yes' | 'no' | 'partial' | 'out';

// Case/reason strings live in the catalogue (applicability.cases.<id>); ids are stable.
const CASES: { id: string; effective: Effectiveness }[] = [
  { id: 'variableSuction', effective: 'yes' },
  { id: 'strainerFouling', effective: 'yes' },
  { id: 'lowFlowRecirc', effective: 'no' },
  { id: 'airIngestion', effective: 'no' },
  { id: 'nearBoiling', effective: 'no' },
  { id: 'roHpp', effective: 'out' },
  { id: 'reciprocating', effective: 'out' },
  { id: 'fastPhenomena', effective: 'no' },
  { id: 'thermalDeaerator', effective: 'partial' },
];

// Log-scale timescale (seconds). Labels live in applicability.scale.<id>.
const SCALE = [
  { id: 'waterHammer', t: 0.08, kind: 'event' },
  { id: 'cavitation', t: 1, kind: 'event' },
  { id: 'airIngestion', t: 2, kind: 'event' },
  { id: 'recirculation', t: 10, kind: 'event' },
  { id: 'roRampLimit', t: 3, kind: 'event' },
  { id: 'valveStroke', t: 12, kind: 'response' },
  { id: 'vfdRamp', t: 5, kind: 'response' },
  { id: 'temperatureDrift', t: 600, kind: 'event' },
  { id: 'tideFouling', t: 7200, kind: 'event' },
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
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('applicability.caseHeader')}</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('applicability.effective')}?</th>
              <th style={{ padding: 6, borderBottom: '1px solid var(--line)' }}>{t('applicability.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {CASES.map((c) => (
              <tr key={c.id}>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)', maxWidth: 320 }}>{t(`applicability.cases.${c.id}.case`)}</td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }}>
                  <Badge tone={c.effective === 'yes' ? 'safe' : c.effective === 'partial' ? 'watch' : c.effective === 'out' ? 'info' : 'critical'}>
                    {c.effective === 'yes' ? t('applicability.effective') : c.effective === 'no' ? t('applicability.notEffective') : c.effective === 'partial' ? t('applicability.partial') : t('applicability.outOfScope')}
                  </Badge>
                </td>
                <td style={{ padding: 6, borderBottom: '1px solid var(--line-soft)' }} className="muted">{t(`applicability.cases.${c.id}.reason`)}</td>
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
          <g key={r.id}>
            <circle cx={x(r.t)} cy={y} r={5} fill={isResp ? 'var(--accent)' : 'var(--warning)'} />
            <text x={x(r.t) + 9} y={y + 4} fill="var(--text-1)" fontSize={11}>
              {t(`applicability.scale.${r.id}`)}
            </text>
            {isResp && <circle cx={x(r.t)} cy={y} r={9} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.5} />}
          </g>
        );
      })}
    </svg>
  );
}