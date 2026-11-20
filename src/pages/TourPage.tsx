import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp, type PageId } from '../state/store';
import type { Scenario } from '../sim/types';

export interface TourStep {
  titleKey: string;
  bodyKey: string;
  scenarioId?: string;
  page: PageId;
}

export const TOUR_STEPS: TourStep[] = [
  { titleKey: 't1', bodyKey: 'b1', scenarioId: 'S0', page: 'simulator' },
  { titleKey: 't2', bodyKey: 'b2', scenarioId: 'S1', page: 'simulator' },
  { titleKey: 't3', bodyKey: 'b3', page: 'twin' },
  { titleKey: 't4', bodyKey: 'b4', scenarioId: 'S6', page: 'simulator' },
  { titleKey: 't5', bodyKey: 'b5', scenarioId: 'S10a', page: 'transients' },
];

// Local copy because these strings are specific to the tour.
const STRINGS: Record<string, { en: string; ar: string }> = {
  t1: { en: 'A healthy plant', ar: 'محطة سليمة' },
  b1: {
    en: 'At high tide the margin ratio R is about 2.3. GraviGuard stays idle: no valve movement, no tank draw. This is the baseline that everything else is compared against.',
    ar: 'عند المد العالي نسبة الهامش R حوالي 2.3. يبقى GraviGuard خاملاً: لا حركة صمام، لا سحب من الخزان. هذا هو خط الأساس الذي تُقارن به كل الحالات.',
  },
  t2: { en: 'The tide falls', ar: 'ينخفض المد' },
  b2: {
    en: 'Over twenty minutes the source level drops from +1.0 m to −4.5 m. NPSHa falls with it. Watch the controller arm, then modulate the valve to hold R near 1.7 while the tank level falls.',
    ar: 'خلال عشرين دقيقة ينخفض منسوب المصدر من +1.0 م إلى −4.5 م. ينخفض NPSHa معه. لاحظ استعداد المتحكم ثم تعديل الصمام للحفاظ على R قرب 1.7  while ينخفض منسوب الخزان.',
  },
  t3: { en: 'The same plant, two fates', ar: 'المحطة نفسها، مصيران' },
  b3: {
    en: 'The A/B twin runs the identical seed with GraviGuard OFF and ON. The delta panel shows the avoided damage and the margin that was preserved.',
    ar: 'يعمل التوأم A/B بنفس البذرة مع تعطيل GraviGuard وتفعيله. تُظهر لوحة الفرق الضرر المتجنَّب والهامش الذي تم الحفاظ عليه.',
  },
  t4: { en: 'Where it does not work', ar: 'أين لا يعمل' },
  b4: {
    en: 'At 0.4 Q_BEP the pump recirculates internally. The margin ratio stays healthy, so GraviGuard has nothing to fix. The advisor classifies the mechanism and refuses to claim a benefit.',
    ar: 'عند 0.4 من نقطة الكفاءة تعيد المضخة التدوير داخلياً. تبقى نسبة الهامش سليمة، فلا يوجد شيء يصلحه GraviGuard. يصنّف المستشار الآلية ويرفض الادعاء بفائدة.',
  },
  t5: { en: 'The hard constraint', ar: 'القيد الحاسم' },
  b5: {
    en: 'A 0.05 s valve stroke is faster than the wave travel time 2L/a, so the full Joukowsky pressure appears. A 12 s stroke keeps the surge near 0.1 bar. Stroke time is a hard constraint.',
    ar: 'شوط صمام 0.05 ث أسرع من زمن حركة الموجة 2L/a، فيظهر ضغط جوكوفسكي الكامل. شوط 12 ث يبقي الطرق المائي قرب 0.1 بار. زمن الشوط قيد حاسم.',
  },
};

interface TourPageProps {
  idx: number;
  playing: boolean;
  onIdx: (i: number) => void;
  onPlaying: (p: boolean) => void;
  onExit: () => void;
}

/**
 * Guided tour overlay panel. Rendered by App ON TOP of the target page while
 * store.page === 'tour'. It never navigates itself: App owns the page state and
 * renders TOUR_STEPS[idx].page underneath, so the panel stays mounted across
 * steps. Scenario loading still happens here (store.setScenario → worker init).
 */
export function TourPage({ idx, playing, onIdx, onPlaying, onExit }: TourPageProps) {
  const { t, i18n } = useTranslation();
  const setScenario = useApp((s) => s.setScenario);
  const step = TOUR_STEPS[idx];
  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  // Auto-advance: 8 s per step; stop at the last step.
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (idx < TOUR_STEPS.length - 1) onIdx(idx + 1);
      else onPlaying(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [playing, idx, onIdx, onPlaying]);

  // Load the step's scenario into the store (the sim lifecycle hook forwards it
  // to the worker, resetting the plant). No scenario → default init.
  useEffect(() => {
    if (step.scenarioId) {
      let cancelled = false;
      fetch(`./scenarios/${step.scenarioId}.json`)
        .then((r) => r.json())
        .then((sc: Scenario) => {
          if (!cancelled) setScenario(sc);
        })
        .catch(() => {
          if (!cancelled) setScenario(null);
        });
      return () => {
        cancelled = true;
      };
    }
    setScenario(null);
  }, [idx, step, setScenario]);

  return (
    <div
      data-testid="tour-panel"
      className="col"
      style={{
        gap: 12,
        position: 'fixed',
        insetInlineEnd: 16,
        bottom: 16,
        width: 'min(440px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 120px)',
        overflowY: 'auto',
        zIndex: 40,
        padding: 12,
        borderRadius: 12,
        background: 'var(--bg-1)',
        border: '1px solid var(--line)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
      }}
    >
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('tour.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('tour.script')} · 5 min</p>
      </div>
      <div className="panel" style={{ minHeight: 200 }}>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>{idx + 1}/{TOUR_STEPS.length}</span>
          <h3 style={{ margin: 0 }}>{STRINGS[step.titleKey][lang]}</h3>
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          {step.page} · {step.scenarioId ?? 'default'}
        </p>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          {STRINGS[step.bodyKey][lang]}
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={() => onPlaying(!playing)}>
            {playing ? t('common.pause') : t('tour.start')}
          </button>
          <button onClick={() => onIdx(Math.max(0, idx - 1))} disabled={idx === 0}>
            {t('tour.prev')}
          </button>
          <button onClick={() => onIdx(Math.min(TOUR_STEPS.length - 1, idx + 1))} disabled={idx === TOUR_STEPS.length - 1}>
            {t('tour.next')}
          </button>
          <button onClick={onExit}>{t('tour.exit')}</button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">{t('tour.script')}</div>
        {TOUR_STEPS.map((s, i) => (
          <div key={i} className="row" style={{ gap: 8, padding: '4px 0', opacity: i === idx ? 1 : 0.6 }}>
            <span className="mono small">{i + 1}</span>
            <span className="small">{STRINGS[s.titleKey][lang]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}