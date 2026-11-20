import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Badge } from '../components/Badges';

interface Eq {
  id: string;
  formula: string;
  vars: { symbol: string; nameKey: string; unit: string }[];
}

// Variable names live in the catalogue (methodology.vars.<nameKey>); symbols/units stay literal.
const EQUATIONS: Eq[] = [
  {
    id: 'E1',
    formula: 'NPSH_a = \\dfrac{P_{surface} - P_v}{\\rho g} + \\Delta z - h_{loss}',
    vars: [
      { symbol: 'P_surface', nameKey: 'surfacePressure', unit: 'Pa' },
      { symbol: 'P_v', nameKey: 'vapourPressure', unit: 'Pa' },
      { symbol: 'rho', nameKey: 'density', unit: 'kg/m³' },
      { symbol: 'g', nameKey: 'gravity', unit: 'm/s²' },
      { symbol: 'Delta z', nameKey: 'staticLift', unit: 'm' },
      { symbol: 'h_loss', nameKey: 'suctionLoss', unit: 'm' },
    ],
  },
  {
    id: 'E2',
    formula: 'h_{loss} = \\left(K_{pipe} + K_{fittings} + K_{strainer}(t)\\right)\\dfrac{V^2}{2g}',
    vars: [
      { symbol: 'K', nameKey: 'lossCoefficients', unit: '—' },
      { symbol: 'V', nameKey: 'velocity', unit: 'm/s' },
    ],
  },
  {
    id: 'E3',
    formula: '\\log_{10} P_v = 8.07131 - \\dfrac{1730.63}{233.426 + T}',
    vars: [
      { symbol: 'P_v', nameKey: 'vapourPressure', unit: 'mmHg' },
      { symbol: 'T', nameKey: 'temperature', unit: '°C' },
    ],
  },
  {
    id: 'E4',
    formula: 'R = \\dfrac{NPSH_a}{NPSH_3}',
    vars: [
      { symbol: 'NPSH_a', nameKey: 'npsha', unit: 'm' },
      { symbol: 'NPSH_3', nameKey: 'npsh3Drop', unit: 'm' },
    ],
  },
  {
    id: 'E5',
    formula: 'N_{ss} = \\dfrac{N\\sqrt{Q}}{NPSH_3^{0.75}}',
    vars: [
      { symbol: 'N', nameKey: 'speed', unit: 'rpm' },
      { symbol: 'Q', nameKey: 'flowPerEye', unit: 'gpm' },
      { symbol: 'NPSH_3', nameKey: 'requiredNpsh', unit: 'ft' },
    ],
  },
  {
    id: 'E8',
    formula: '\\Delta P = \\rho\\, a\\, \\Delta V \\qquad \\Delta H \\approx \\dfrac{2L\\,\\Delta V}{g\\,T}',
    vars: [
      { symbol: 'a', nameKey: 'waveSpeed', unit: 'm/s' },
      { symbol: 'L', nameKey: 'pipeLength', unit: 'm' },
      { symbol: 'T', nameKey: 'strokeTime', unit: 's' },
    ],
  },
  {
    id: 'E9',
    formula: 't_{aut} = \\dfrac{V_{usable}}{Q_{supplied}}',
    vars: [
      { symbol: 'V_usable', nameKey: 'usableVolume', unit: 'm³' },
      { symbol: 'Q_supplied', nameKey: 'suppliedFlow', unit: 'm³/s' },
    ],
  },
];

// List items live in the catalogue; ids are stable.
const UNVERIFIED_IDS = ['marginFactors', 'roRamp', 'patent'];
const LIMIT_IDS = ['hydraulics', 'damageIndex', 'vibration', 'noRealData'];
const REFERENCE_IDS = ['hi961', 'hi963', 'hi98', 'hi66', 'roVendors'];

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
            {UNVERIFIED_IDS.map((id) => (
              <li key={id} className="small" style={{ marginBottom: 4 }}>{t(`methodology.unverifiedItems.${id}`)}</li>
            ))}
          </ul>
        </div>
        <div className="panel">
          <div className="panel-title">{t('methodology.limits')}</div>
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {LIMIT_IDS.map((id) => (
              <li key={id} className="small" style={{ marginBottom: 4 }}>{t(`methodology.limitItems.${id}`)}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('methodology.references')}</div>
        <ul style={{ margin: 0, paddingInlineStart: 18 }}>
          {REFERENCE_IDS.map((id) => (
            <li key={id} className="small" style={{ marginBottom: 4 }}>{t(`methodology.referenceItems.${id}`)}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <div className="panel-title">{t('methodology.synthetic')}</div>
        <p className="small">
          {t('methodology.syntheticBody')} <Badge tone="synthetic">{t('common.synthetic')}</Badge>
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
            <th style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>{t('methodology.name')}</th>
            <th style={{ padding: 4, borderBottom: '1px solid var(--line)' }}>{t('methodology.unit')}</th>
          </tr>
        </thead>
        <tbody>
          {eq.vars.map((v) => (
            <tr key={v.symbol}>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }} className="mono">{v.symbol}</td>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }}>{t(`methodology.vars.${v.nameKey}`)}</td>
              <td style={{ padding: 4, borderBottom: '1px solid var(--line-soft)' }} className="mono">{v.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}