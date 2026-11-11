import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Badge } from '../components/Badges';

interface Eq {
  id: string;
  formula: string;
  vars: { symbol: string; name: string; unit: string }[];
}

const EQUATIONS: Eq[] = [
  {
    id: 'E1',
    formula: 'NPSH_a = \\dfrac{P_{surface} - P_v}{\\rho g} + \\Delta z - h_{loss}',
    vars: [
      { symbol: 'P_surface', name: 'Surface pressure', unit: 'Pa' },
      { symbol: 'P_v', name: 'Vapour pressure', unit: 'Pa' },
      { symbol: 'rho', name: 'Density', unit: 'kg/m³' },
      { symbol: 'g', name: 'Gravity', unit: 'm/s²' },
      { symbol: 'Delta z', name: 'Static lift', unit: 'm' },
      { symbol: 'h_loss', name: 'Suction line loss', unit: 'm' },
    ],
  },
  {
    id: 'E2',
    formula: 'h_{loss} = \\left(K_{pipe} + K_{fittings} + K_{strainer}(t)\\right)\\dfrac{V^2}{2g}',
    vars: [
      { symbol: 'K', name: 'Loss coefficients', unit: '—' },
      { symbol: 'V', name: 'Velocity', unit: 'm/s' },
    ],
  },
  {
    id: 'E3',
    formula: '\\log_{10} P_v = 8.07131 - \\dfrac{1730.63}{233.426 + T}',
    vars: [
      { symbol: 'P_v', name: 'Vapour pressure', unit: 'mmHg' },
      { symbol: 'T', name: 'Temperature', unit: '°C' },
    ],
  },
  {
    id: 'E4',
    formula: 'R = \\dfrac{NPSH_a}{NPSH_3}',
    vars: [
      { symbol: 'NPSH_a', name: 'Net positive suction head available', unit: 'm' },
      { symbol: 'NPSH_3', name: 'NPSH at 3% head drop', unit: 'm' },
    ],
  },
  {
    id: 'E5',
    formula: 'N_{ss} = \\dfrac{N\\sqrt{Q}}{NPSH_3^{0.75}}',
    vars: [
      { symbol: 'N', name: 'Speed', unit: 'rpm' },
      { symbol: 'Q', name: 'Flow per eye', unit: 'gpm' },
      { symbol: 'NPSH_3', name: 'Required NPSH', unit: 'ft' },
    ],
  },
  {
    id: 'E8',
    formula: '\\Delta P = \\rho\\, a\\, \\Delta V \\qquad \\Delta H \\approx \\dfrac{2L\\,\\Delta V}{g\\,T}',
    vars: [
      { symbol: 'a', name: 'Wave speed', unit: 'm/s' },
      { symbol: 'L', name: 'Pipe length', unit: 'm' },
      { symbol: 'T', name: 'Valve stroke time', unit: 's' },
    ],
  },
  {
    id: 'E9',
    formula: 't_{aut} = \\dfrac{V_{usable}}{Q_{supplied}}',
    vars: [
      { symbol: 'V_usable', name: 'Usable tank volume', unit: 'm³' },
      { symbol: 'Q_supplied', name: 'Supplied flow', unit: 'm³/s' },
    ],
  },
];

const UNVERIFIED = [
  'ANSI/HI 9.6.1 margin factors — exact values not confirmed from a primary source.',
  'RO membrane ramp limit (~0.7 bar/s) — must be confirmed with DuPont / Hydranautics / Toray guidance.',
  'Patent search for the dynamic NPSHa lift mechanism is still required.',
];

const REFERENCES = [
  'ANSI/HI 9.6.1 — Rotodynamic Pumps: Guideline for NPSH Margin',
  'ANSI/HI 9.6.3 — Rotodynamic Pumps: Guideline for Operating Regions',
  'ANSI/HI 9.8 — Rotodynamic Pumps: Intake Design',
  'ANSI/HI 6.6 — Rotodynamic Pumps: Pump Pipe Connection',
  'DuPont / Hydranautics / Toray — RO system design guidance (ramp-rate limits)',
];

const LIMITS = [
  'Steady-state and lumped-inertia hydraulics only; no method-of-characteristics surge solver in phase 1.',
  'Damage index is illustrative and normalised; it is not a life prediction.',
  'Synthetic vibration is a secondary confirmation signal, never the primary trigger.',
  'No real-plant, vendor, or SWA data is used or implied.',
];

export function MethodologyPage() {
  const { t } = useTranslation();
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('methodology.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('common.disclaimer')}</p>
      </div>

      <div className="panel">
        <div className="panel-title">{t('methodology.equations')}</div>
        <div className="col" style={{ gap: 12 }}>
          {EQUATIONS.map((eq) => (
            <EqBlock key={eq.id} eq={eq} />
          ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel" style={{ borderInlineStart: '3px solid var(--watch)' }}>
          <div className="panel-title">{t('methodology.unverified')}</div>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {UNVERIFIED.map((u) => (
              <li key={u} className="small" style={{ marginBottom: 4 }}>{u}</li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <div className="panel-title">{t('methodology.limits')}</div>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {LIMITS.map((u) => (
              <li key={u} className="small" style={{ marginBottom: 4 }}>{u}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('methodology.references')}</div>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {REFERENCES.map((r) => (
            <li key={r} className="small" style={{ marginBottom: 4 }}>{r}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <div className="panel-title">{t('methodology.synthetic')}</div>
        <p className="small">
          Every plant, pump, sensor and result in this platform is synthetic and deterministic (seeded). Identical seed and
          parameters give bit-identical headless results. The platform demonstrates a concept; it is not a design or sizing
          tool for real plants. <Badge tone="synthetic">{t('common.synthetic')}</Badge>
        </p>
      </div>
    </div>
  );
}

function EqBlock({ eq }: { eq: Eq }) {
  const { t } = useTranslation();
  const html = useMemo(() => {
    try {
      return katex.renderToString(eq.formula, { throwOnError: false, displayMode: true });
    } catch {
      return eq.formula;
    }
  }, [eq.formula]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ minWidth: 220 }}>
        <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{eq.id}</div>
        <div className="katex-wrap" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--text-2)', textAlign: 'start' }}>
            <th style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>{t('methodology.variable')}</th>
            <th style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>Name</th>
            <th style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>{t('methodology.unit')}</th>
          </tr>
        </thead>
        <tbody>
          {eq.vars.map((v) => (
            <tr key={v.symbol}>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }} className="mono">{v.symbol}</td>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }}>{v.name}</td>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }} className="mono">{v.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
