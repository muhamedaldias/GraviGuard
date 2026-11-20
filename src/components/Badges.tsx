import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import type { Advisor, CavityState, CtrlStateName } from '../sim/types';
import { CAVITY_STATES, CTRL_STATES } from '../sim/types';

export function Badge({ children, tone }: { children: React.ReactNode; tone?: 'safe' | 'watch' | 'warning' | 'critical' | 'info' | 'synthetic' }) {
  return <span className={`badge ${tone ?? ''}`}>{children}</span>;
}

/**
 * Controller alarms arrive from src/sim/controller.ts as raw message strings
 * (engine alarm ids stay stable). Map each known message to a catalogue key so
 * the UI renders through t(); unknown future messages fall back to raw text.
 */
export const CTRL_ALARM_KEYS: Record<string, string> = {
  'Tank at reserve — injection blocked, VFD fallback': 'alarm.ctrl-tank',
  'Valve fault detected — GraviGuard unavailable': 'alarm.ctrl-valve',
  'Sensor fault detected — fail-safe active': 'alarm.ctrl-sensor',
  'Injection cycle limit exceeded (3/hour)': 'alarm.ctrl-cycles',
};

export function ControllerAlarmBadge({ message }: { message: string | null }) {
  const { t } = useTranslation();
  if (!message) return null;
  const key = CTRL_ALARM_KEYS[message];
  return <Badge tone="critical">{key ? t(key) : message}</Badge>;
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
