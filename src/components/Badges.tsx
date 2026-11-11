import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import type { Advisor, CavityState, CtrlStateName } from '../sim/types';
import { CAVITY_STATES, CTRL_STATES } from '../sim/types';

export function Badge({ children, tone }: { children: React.ReactNode; tone?: 'safe' | 'watch' | 'warning' | 'critical' | 'info' | 'synthetic' }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

export function SyntheticBadge() {
  const { t } = useTranslation();
  return <Badge tone="synthetic">{t('common.synthetic')}</Badge>;
}

export function CavityBadge({ state }: { state: CavityState }) {
  const { t } = useTranslation();
  const tone =
    state === 'NONE' ? 'safe' : state === 'INCIPIENT' ? 'watch' : state === 'DEVELOPED' ? 'warning' : 'critical';
  return <Badge tone={tone}>{t(`cavity.${state}`)}</Badge>;
}

export function StateBadge({ name }: { name: CtrlStateName }) {
  const { t } = useTranslation();
  const tone =
    name === 'FAULT_SAFE'
      ? 'critical'
      : name === 'INJECTING'
        ? 'info'
        : name === 'HOLD'
          ? 'safe'
          : name === 'RECOVERY' || name === 'REFILL'
            ? 'watch'
            : undefined;
  return <Badge tone={tone}>{t(`state.${name}`)}</Badge>;
}

export function AdvisorCard({ advisor }: { advisor: Advisor }) {
  const { t } = useTranslation();
  const tone = advisor.severity === 'critical' ? 'critical' : advisor.severity === 'warning' ? 'warning' : advisor.severity === 'watch' ? 'watch' : 'info';
  const entries = Object.entries(advisor.evidence).slice(0, 6);
  return (
    <div className="panel" style={{ borderInlineStart: `3px solid var(--${tone === 'info' ? 'accent' : tone})` }}>
      <div className="panel-title">{t('sim.advisor')}</div>
      <div className="small" style={{ color: 'var(--text-0)', marginBottom: 8 }}>
        {t(`advisor.${advisor.id}`)}
      </div>
      <div className="row" style={{ gap: 8 }}>
        {entries.map(([k, v]) => (
          <span key={k} className="badge">
            <span className="muted">{k}</span>
            <span className="mono">{v.toFixed(2)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function StateStrip({ current }: { current: CtrlStateName }) {
  const { t } = useTranslation();
  return (
    <div className="row" style={{ gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
      {CTRL_STATES.map((s) => (
        <span
          key={s}
          className="badge"
          style={
            s === current
              ? { borderColor: 'var(--accent)', color: 'var(--accent)', boxShadow: 'var(--glow)' }
              : undefined
          }
        >
          {t(`state.${s}`)}
        </span>
      ))}
    </div>
  );
}

export function CavityStrip({ current }: { current: CavityState }) {
  const { t } = useTranslation();
  return (
    <div className="row" style={{ gap: 4, flexWrap: 'nowrap', overflowX: 'auto' }}>
      {CAVITY_STATES.map((s) => (
        <span
          key={s}
          className="badge"
          style={s === current ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
        >
          {t(`cavity.${s}`)}
        </span>
      ))}
    </div>
  );
}

export function useSeverityTones() {
  const theme = useApp((s) => s.theme);
  return { theme };
}
