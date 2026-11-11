import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import { StripChart } from '../components/StripChart';
import { SimEngine } from '../sim/engine';
import { formatNumber } from '../sim/units';

/** A/B digital twin: two identical plants on the same seed, OFF vs ON. */
export function Twin() {
  const { t } = useTranslation();
  const params = useApp((s) => s.params);
  const seed = useApp((s) => s.seed);
  const lang = useApp((s) => s.lang);
  const digits = useApp((s) => s.digits);
  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';

  const { off, on } = useMemo(() => {
    const run = (mode: 'OFF' | 'ON') => {
      const e = new SimEngine({ params: structuredClone(params), seed, recordInterval: 0.5 });
      e.setInput('mode', mode);
      e.setInput('z_level', -3.5);
      e.setInput('K_strainer', 60);
      e.setInput('T', 45);
      e.run(600, 0.01);
      const hist = e.getHistory();
      const minR = Math.min(...hist.map((h) => h.R));
      const damage = e.state.damage;
      const headLoss = Math.max(...hist.map((h) => h.headDrop));
      const energy = hist.reduce((a, h) => a + h.H * h.Q, 0);
      return { hist, minR, damage, headLoss, energy, state: e.state };
    };
    return { off: run('OFF'), on: run('ON') };
  }, [params, seed]);

  const tArr = off.hist.map((h) => h.t);
  const avoided = Math.max(0, off.damage - on.damage);

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('twin.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          {t('common.seed')}: <span className="mono">{seed}</span> · 600 s · S4 conditions
        </p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">{t('twin.off')}</div>
          <Kpis kpis={off} locale={locale} digits={digits} />
        </div>
        <div className="panel">
          <div className="panel-title">{t('twin.on')}</div>
          <Kpis kpis={on} locale={locale} digits={digits} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('twin.delta')}</div>
        <div className="grid-3">
          <Delta label={t('twin.minR')} a={off.minR} b={on.minR} locale={locale} digits={digits} />
          <Delta label={t('twin.damage')} a={off.damage} b={on.damage} locale={locale} digits={digits} />
          <Delta label={t('twin.headLoss')} a={off.headLoss} b={on.headLoss} locale={locale} digits={digits} />
        </div>
        <div className="kpi" style={{ marginTop: 10, borderInlineStartColor: 'var(--safe)' }}>
          <span className="kpi-label">{t('twin.avoided')}</span>
          <span className="kpi-value" style={{ color: 'var(--safe)' }}>{formatNumber(avoided, { decimals: 3, locale, digitStyle: digits })}</span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('sim.margin')}</div>
        <StripChart
          series={[
            { label: t('twin.off'), color: 'var(--critical)', data: off.hist.map((h) => h.R) },
            { label: t('twin.on'), color: 'var(--safe)', data: on.hist.map((h) => h.R) },
          ]}
          height={200}
          hlines={[{ y: 1.6, color: 'var(--watch)', label: 'R=1.6' }]}
        />
      </div>
      <div className="panel">
        <div className="panel-title">{t('sim.damage')}</div>
        <StripChart
          series={[
            { label: t('twin.off'), color: 'var(--critical)', data: off.hist.map((h) => h.damage) },
            { label: t('twin.on'), color: 'var(--safe)', data: on.hist.map((h) => h.damage) },
          ]}
          height={160}
        />
      </div>
      <span className="muted small">t = {tArr.length > 0 ? tArr[tArr.length - 1].toFixed(0) : 0} s</span>
    </div>
  );
}

function Kpis({ kpis, locale, digits }: { kpis: { minR: number; damage: number; headLoss: number }; locale: string; digits: 'western' | 'arabic-indic' }) {
  const { t } = useTranslation();
  return (
    <div className="grid-2" style={{ gap: 8 }}>
      <div className="kpi"><span className="kpi-label">{t('twin.minR')}</span><span className="kpi-value">{formatNumber(kpis.minR, { decimals: 2, locale, digitStyle: digits })}</span></div>
      <div className="kpi"><span className="kpi-label">{t('twin.damage')}</span><span className="kpi-value">{formatNumber(kpis.damage, { decimals: 3, locale, digitStyle: digits })}</span></div>
      <div className="kpi"><span className="kpi-label">{t('twin.headLoss')}</span><span className="kpi-value">{formatNumber(kpis.headLoss * 100, { decimals: 1, locale, digitStyle: digits })}%</span></div>
    </div>
  );
}

function Delta({ label, a, b, locale, digits }: { label: string; a: number; b: number; locale: string; digits: 'western' | 'arabic-indic' }) {
  const improved = b > a;
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value" style={{ color: improved ? 'var(--safe)' : 'var(--text-0)' }}>
        {formatNumber(b - a, { decimals: 3, locale, digitStyle: digits })}
      </span>
      <span className="muted small">
        {formatNumber(a, { decimals: 2, locale, digitStyle: digits })} → {formatNumber(b, { decimals: 2, locale, digitStyle: digits })}
      </span>
    </div>
  );
}
