import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../state/store';
import type { Scenario } from '../sim/types';

interface TourStep {
  titleKey: string;
  bodyKey: string;
  scenarioId?: string;
  page: string;
}

const STEPS: TourStep[] = [
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

export function TourPage() {
  const { t, i18n } = useTranslation();
  const setPage = useApp((s) => s.setPage);
  const setScenario = useApp((s) => s.setScenario);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = STEPS[idx];

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (idx < STEPS.length - 1) setIdx(idx + 1);
      else setPlaying(false);
    }, 8000);
    return () => clearTimeout(timer);
  }, [playing, idx]);

  useEffect(() => {
    setPage(step.page as never);
    if (step.scenarioId) {
      fetch(`./scenarios/${step.scenarioId}.json`)
        .then((r) => r.json())
        .then((sc: Scenario) => setScenario(sc))
        .catch(() => setScenario(null));
    } else {
      setScenario(null);
    }
  }, [idx, step, setPage, setScenario]);

  return (
    <div className="col" style={{ gap: 12, maxWidth: 760, margin: '0 auto' }}>
      <div className="panel">
        <h2 style={{ margin: 0, fontSize: 18 }}>{t('tour.title')}</h2>
        <p className="muted small" style={{ margin: '4px 0 0' }}>{t('tour.script')} · 5 min</p>
      </div>
      <div className="panel" style={{ minHeight: 200 }}>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>{idx + 1}/{STEPS.length}</span>
          <h3 style={{ margin: 0 }}>{STRINGS[step.titleKey][i18n.language === 'ar' ? 'ar' : 'en']}</h3>
        </div>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          {STRINGS[step.bodyKey][i18n.language === 'ar' ? 'ar' : 'en']}
        </p>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? t('common.pause') : t('tour.start')}
          </button>
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
            {t('tour.prev')}
          </button>
          <button onClick={() => setIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={idx === STEPS.length - 1}>
            {t('tour.next')}
          </button>
          <button onClick={() => { setIdx(0); setPlaying(false); }}>{t('tour.exit')}</button>
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">{t('tour.script')}</div>
        {STEPS.map((s, i) => (
          <div key={i} className="row" style={{ gap: 8, padding: '4px 0', opacity: i === idx ? 1 : 0.6 }}>
            <span className="mono small">{i + 1}</span>
            <span className="small">{STRINGS[s.titleKey][i18n.language === 'ar' ? 'ar' : 'en']}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
