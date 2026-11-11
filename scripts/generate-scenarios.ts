// Generates the scenario pack (JSON) into public/scenarios/.
// Run: pnpm scenarios:generate
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Scenario } from '../src/sim/types';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'scenarios');
mkdirSync(outDir, { recursive: true });

const scenarios: Scenario[] = [
  {
    id: 'S0',
    name: 'Healthy baseline',
    nameAr: 'خط أساس سليم',
    description: 'Reference plant at z = +1.0 m and T = 35 °C for 30 min. GraviGuard must stay idle.',
    descriptionAr: 'المحطة المرجعية عند منسوب +1.0 م ودرجة حرارة 35°م لمدة 30 دقيقة. يجب أن يبقى GraviGuard خاملاً.',
    tags: ['baseline', 'healthy'],
    duration: 1800,
    seed: 1000,
    mode: 'ON',
    timeline: [{ t: 0, param: 'z_level', value: 1.0 }],
    assertions: [
      { id: 's0-minR', type: 'minR', value: 2.0 },
      { id: 's0-maxCI', type: 'maxCI', value: 0.05 },
      { id: 's0-maxHeadDrop', type: 'maxHeadDrop', value: 0.01 },
      { id: 's0-transitions', type: 'maxTransitions', value: 2 },
      { id: 's0-false', type: 'falseInjections', value: 0 },
    ],
    expected: { on: 'R ≈ 2.3, CI = 0, controller IDLE, zero valve movement, tank untouched' },
  },
  {
    id: 'S1',
    name: 'Tidal drawdown',
    nameAr: 'انخفاض المد',
    description:
      'Source level falls from +1.0 m to −4.5 m over 20 min, holds, then recovers. GraviGuard must hold the margin near 1.7. Tank sized at 200 m³ for this event (see DECISIONS.md).',
    descriptionAr:
      'ينخفض منسوب المصدر من +1.0 م إلى −4.5 م خلال 20 دقيقة ثم يتعافى. يجب أن يحافظ GraviGuard على الهامش قرب 1.7. الخزان 200 م³ لهذه الحالة.',
    tags: ['tide', 'transient', 'target'],
    duration: 3600,
    seed: 1001,
    mode: 'ON',
    params: { 'tank.V_usable': 200 },
    timeline: [
      { t: 0, param: 'z_level', value: 1.0 },
      { t: 1200, param: 'z_level', value: -4.5 },
      { t: 2400, param: 'z_level', value: -4.5 },
      { t: 3000, param: 'z_level', value: 1.0 },
    ],
    assertions: [
      { id: 's1-minR', type: 'minR', value: 1.5 },
      { id: 's1-tank', type: 'tankMin', value: 8.0 },
      { id: 's1-transitions', type: 'maxTransitions', value: 40 },
      { id: 's1-false', type: 'falseInjections', value: 0 },
    ],
    expected: { on: 'R held near 1.7, tank used < 60 %, no chatter, recovery at the end' },
  },
  {
    id: 'S2',
    name: 'Strainer fouling',
    nameAr: 'انسداد المصفاة',
    description:
      'Source at −1.0 m; strainer K rises from 2 to 80 over 30 min. GraviGuard must arm early and hold the target margin.',
    descriptionAr:
      'المصدر عند −1.0 م؛ يرتفع معامل المصفاة من 2 إلى 80 خلال 30 دقيقة. يجب أن يستعد GraviGuard مبكراً ويحافظ على الهامش المستهدف.',
    tags: ['fouling', 'slow', 'target'],
    duration: 2400,
    seed: 1002,
    mode: 'ON',
    params: { 'tank.V_usable': 250 },
    timeline: [
      { t: 0, param: 'z_level', value: -1.0 },
      { t: 0, param: 'K_strainer', value: 2.0 },
      { t: 1800, param: 'K_strainer', value: 80.0 },
    ],
    assertions: [
      { id: 's2-minR', type: 'minR', value: 1.5 },
      { id: 's2-transitions', type: 'maxTransitions', value: 6 },
      { id: 's2-false', type: 'falseInjections', value: 0 },
    ],
    expected: { on: 'Early arming by slope prediction, R held at target' },
  },
  {
    id: 'S3',
    name: 'Rising temperature',
    nameAr: 'ارتفاع درجة الحرارة',
    description:
      'Temperature rises 35 → 60 °C at z = −2.0 m. Vapour pressure climbs; the estimator must compensate through T-corrected Pv.',
    descriptionAr:
      'ترتفع الحرارة من 35 إلى 60°م عند منسوب −2.0 م. يرتفع ضغط البخار؛ يجب أن يعوّض المقدِّر عبر تصحيح درجة الحرارة.',
    tags: ['temperature', 'slow'],
    duration: 2400,
    seed: 1003,
    mode: 'ON',
    params: { 'tank.V_usable': 250 },
    timeline: [
      { t: 0, param: 'z_level', value: -2.0 },
      { t: 0, param: 'T', value: 35 },
      { t: 1800, param: 'T', value: 60 },
    ],
    assertions: [
      { id: 's3-minR', type: 'minR', value: 1.5 },
      { id: 's3-transitions', type: 'maxTransitions', value: 30 },
    ],
    expected: { on: 'Compensated through T-corrected vapour pressure in the estimator' },
  },
  {
    id: 'S4',
    name: 'Combined worst case',
    nameAr: 'الحالة الأسوأ المشتركة',
    description:
      'z = −3.5 m, strainer K = 60, T = 45 °C, sensor noise on. Severe cavitation without protection; with GraviGuard the margin is restored until autonomy runs out.',
    descriptionAr:
      'منسوب −3.5 م، مصفاة K = 60، حرارة 45°م، ضوضاء حساسات مفعّلة. تجوف شديد بدون حماية؛ مع GraviGuard يُستعاد الهامش حتى تنفد ذاتية الخزان.',
    tags: ['worst-case', 'severe', 'autonomy'],
    duration: 1800,
    seed: 1004,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -3.5 },
      { t: 0, param: 'K_strainer', value: 60 },
      { t: 0, param: 'T', value: 45 },
      { t: 0, param: 'noiseScale', value: 1.5 },
    ],
    assertions: [
      { id: 's4-minR', type: 'minR', value: 0.9 },
      { id: 's4-tank', type: 'maxTankMin', value: 0.6 },
      { id: 's4-fault', type: 'stateSequence', expected: ['ARMED', 'INJECTING', 'HOLD', 'FAULT_SAFE'] },
    ],
    expected: {
      off: 'R ≈ 0.80, severe, head drop > 20 %, flow collapse',
      on: 'R restored toward target; tank autonomy KPI shown; VFD fallback when autonomy is insufficient',
    },
  },
  {
    id: 'S5',
    name: 'Run-out (flow above BEP)',
    nameAr: 'تشغيل فوق نقطة الكفاءة',
    description:
      'Discharge resistance lowered so Q ≈ 0.126 m³/s at z = −1.5 m. NPSH3 rises; GraviGuard still helps because NPSHa is the lever.',
    descriptionAr:
      'مقاومة التصريف منخفضة  so التدفق ≈ 0.126 م³/ث عند منسوب −1.5 م. يرتفع NPSH3؛ يظل GraviGuard مفيداً لأن NPSHa هو الرافعة.',
    tags: ['runout', 'bep'],
    duration: 1800,
    seed: 1005,
    mode: 'ON',
    params: { 'tank.V_usable': 250 },
    timeline: [
      { t: 0, param: 'z_level', value: -1.5 },
      { t: 0, param: 'k_discharge', value: 800 },
    ],
    assertions: [
      { id: 's5-minR', type: 'minR', value: 1.4 },
      { id: 's5-transitions', type: 'maxTransitions', value: 40 },
    ],
    expected: { on: 'Helps, because NPSHa is the lever; advisor still recommends checking the system curve' },
  },
  {
    id: 'S6',
    name: 'Low-flow recirculation',
    nameAr: 'إعادة التدوير الداخلي عند تدفق منخفض',
    description:
      'Q forced to 0.04 m³/s (0.4 Q_BEP) with healthy NPSHa. Recirculation damage rises despite a healthy margin. GraviGuard must not claim a fix.',
    descriptionAr:
      'التدفق 0.04 م³/ث (0.4 من نقطة الكفاءة) مع NPSHa سليم. يرتفع ضرر إعادة التدوير رغم الهامش السليم. لا يجب أن يدّعي GraviGuard وجود حل.',
    tags: ['recirculation', 'limit-case'],
    duration: 1800,
    seed: 1006,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: 1.0 },
      { t: 0, param: 'k_discharge', value: 19325 },
    ],
    assertions: [
      { id: 's6-minR', type: 'minR', value: 2.5 },
      { id: 's6-advisor', type: 'advisorMessage', expected: ['recirculation'] },
    ],
    expected: {
      off: 'RI ≈ 0.67, damage and vibration rise despite healthy R',
      on: 'No benefit. Advisor: "Recirculation, not NPSH. Not addressable by GraviGuard."',
    },
  },
  {
    id: 'S7',
    name: 'Air ingestion / vortex',
    nameAr: 'سحب الهواء / الدوامة',
    description:
      'Bell raised to −3.0 m with level −2.5 m (submergence 0.5 m < S_min 0.77 m). HF vibration rises while R looks healthy; the disagreement detector must fire.',
    descriptionAr:
      'رفعة الجرس إلى −3.0 م مع منسوب −2.5 م (الغمر 0.5 م < الحد الأدنى 0.77 م). يرتفع الاهتزاز عالي التردد بينما يبدو الهامش سليماً؛ يجب أن يطلق كاشف التعارض.',
    tags: ['air-ingestion', 'limit-case'],
    duration: 1800,
    seed: 1007,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -2.5 },
      { t: 0, param: 'z_bell', value: -3.0 },
    ],
    assertions: [
      { id: 's7-advisor', type: 'advisorMessage', expected: ['air-ingestion'] },
      { id: 's7-minR', type: 'minR', value: 1.4 },
    ],
    expected: {
      on: 'Disagreement detector fires; advisor recommends intake design (HI 9.8, vortex suppressors)',
    },
  },
  {
    id: 'S8',
    name: 'Tank depletion',
    nameAr: 'نضوب الخزان',
    description:
      'S4 conditions held for 25 min. The tank reaches reserve; the controller must move to FAULT_SAFE and command a VFD speed reduction before the level drops below reserve.',
    descriptionAr:
      'ظروف S4 مستمرة لمدة 25 دقيقة. يصل الخزان إلى الاحتياطي؛ يجب أن ينتقل المتحكم إلى FAULT_SAFE ويأمر بخفض سرعة الـVFD قبل انخفاض المنسوب تحت الاحتياطي.',
    tags: ['autonomy', 'fault-safe', 'worst-case'],
    duration: 1500,
    seed: 1008,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -3.5 },
      { t: 0, param: 'K_strainer', value: 60 },
      { t: 0, param: 'T', value: 45 },
    ],
    assertions: [
      { id: 's8-tank', type: 'maxTankMin', value: 0.6 },
      { id: 's8-fault', type: 'stateSequence', expected: ['ARMED', 'INJECTING', 'HOLD', 'FAULT_SAFE'] },
    ],
    expected: { on: 'Tank reaches reserve; FAULT_SAFE; VFD speed reduction to 85 %' },
  },
  {
    id: 'S9a',
    name: 'Fault: valve stuck closed',
    nameAr: 'عطل: صمام عالق مغلقاً',
    description: 'The motorized valve is stuck closed while the plant needs injection. GraviGuard must raise an alarm and apply the VFD fallback.',
    descriptionAr: 'الصمام الميكانيكي عالق مغلقاً بينما تحتاج المحطة إلى الحقن. يجب أن يطلق GraviGuard إنذاراً ويطبّق خفض سرعة الـVFD.',
    tags: ['fault', 'valve'],
    duration: 900,
    seed: 1090,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -3.5 },
      { t: 0, param: 'K_strainer', value: 60 },
      { t: 0, param: 'valveStuck', value: 1 },
    ],
    assertions: [{ id: 's9a-fault', type: 'stateSequence', expected: ['FAULT_SAFE'] }],
    expected: { on: 'Alarm + VFD fallback' },
  },
  {
    id: 'S9b',
    name: 'Fault: pressure sensor drift +30 kPa',
    nameAr: 'عطل: انحراف حساس الضغط +30 كيلوباسكال',
    description: 'One of three pressure sensors drifts by +30 kPa. 2-out-of-3 voting must isolate it and the plant must keep running.',
    descriptionAr: 'أحد حساسات الضغط الثلاثة ينحرف بمقدار +30 كيلوباسكال. يجب أن يعزل التصويت 2-out-of-3 الحساس المعطل وتستمر المحطة.',
    tags: ['fault', 'sensor', 'voting'],
    duration: 1800,
    seed: 1091,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: 1.0 },
      { t: 0, param: 'pressureDrift', value: 30000 },
    ],
    assertions: [
      { id: 's9b-false', type: 'falseInjections', value: 0 },
      { id: 's9b-transitions', type: 'maxTransitions', value: 4 },
      { id: 's9b-minR', type: 'minR', value: 2.0 },
    ],
    expected: { on: '2oo3 vote isolates the drifting sensor' },
  },
  {
    id: 'S9c',
    name: 'Fault: check-valve leak',
    nameAr: 'عطل: تسرب صمام عدم الرجوع',
    description: 'The source check valve leaks, so lifted water flows back to the source. The simulator must flag source-flow reversal.',
    descriptionAr: 'صمام عدم الرجوع في خط المصدر يتسرب، فيعود الماء المرفوع إلى المصدر. يجب أن يشير المحاكي إلى انعكاس تدفق المصدر.',
    tags: ['fault', 'check-valve'],
    duration: 900,
    seed: 1092,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -2.0 },
      { t: 0, param: 'K_strainer', value: 20 },
      { t: 0, param: 'checkValveLeak', value: 1 },
    ],
    assertions: [{ id: 's9c-advisor', type: 'advisorMessage', expected: ['check-valve-leak'] }],
    expected: { on: 'Leak flagged by source-flow reversal' },
  },
  {
    id: 'S9d',
    name: 'Fault: sensor dropout',
    nameAr: 'عطل: انقطاع الحساس',
    description: 'The suction pressure transmitter drops out. The estimator must detect the loss and the controller must go fail-safe.',
    descriptionAr: 'جهاز إرسال ضغط الشفط ينقطع. يجب أن يكتشف المقدِّر الفقد وينتقل المتحكم إلى وضع الأمان.',
    tags: ['fault', 'sensor', 'fail-safe'],
    duration: 900,
    seed: 1093,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: -2.0 },
      { t: 0, param: 'pressureDropout', value: 1 },
    ],
    assertions: [{ id: 's9d-fault', type: 'stateSequence', expected: ['FAULT_SAFE'] }],
    expected: { on: 'FAULT_SAFE' },
  },
  {
    id: 'S10a',
    name: 'Water hammer: fast stroke (0.05 s)',
    nameAr: 'الطرق المائي: شوط سريع (0.05 ث)',
    description:
      'Valve opened in 0.05 s (faster than 2L/a = 0.08 s). The Joukowsky estimate applies: ΔP ≈ 1.45 MPa.',
    descriptionAr: 'فُتح الصمام في 0.05 ث (أسرع من 2L/a = 0.08 ث). ينطبق تقدير جوكوفسكي: ΔP ≈ 1.45 ميغاباسكال.',
    tags: ['water-hammer', 'fast', 'surge'],
    duration: 120,
    seed: 1100,
    mode: 'MANUAL',
    params: { 'valve.strokeTime': 0.05 },
    timeline: [{ t: 0, param: 'manualValve', value: 1 }],
    assertions: [{ id: 's10a-surge', type: 'minSurgePeak', value: 1e6, tolerance: 0 }],
    expected: { on: 'Fast: Joukowsky ΔP ≈ 1.45 MPa (14.5 bar)' },
  },
  {
    id: 'S10b',
    name: 'Water hammer: nominal stroke (12 s)',
    nameAr: 'الطرق المائي: الشوط الاسمي (12 ث)',
    description: 'Valve opened in 12 s. Slow-closure estimate: ΔH ≈ 1 m (≈ 0.1 bar). Safe.',
    descriptionAr: 'فُتح الصمام في 12 ث. تقدير الإغلاق البطيء: ΔH ≈ 1 م (≈ 0.1 بار). آمن.',
    tags: ['water-hammer', 'nominal', 'surge'],
    duration: 180,
    seed: 1101,
    mode: 'MANUAL',
    params: { 'valve.strokeTime': 12 },
    timeline: [{ t: 0, param: 'manualValve', value: 1 }],
    assertions: [{ id: 's10b-surge', type: 'surgePeak', value: 200000, tolerance: 0 }],
    expected: { on: 'Slow (12 s): ΔH ≈ 1 m (≈ 0.1 bar)' },
  },
  {
    id: 'S10c',
    name: 'Water hammer: slow stroke (30 s)',
    nameAr: 'الطرق المائي: شوط بطيء (30 ث)',
    description: 'Valve opened in 30 s. Slow-closure estimate: ΔH ≈ 0.38 m (≈ 0.04 bar).',
    descriptionAr: 'فُتح الصمام في 30 ث. تقدير الإغلاق البطيء: ΔH ≈ 0.38 م (≈ 0.04 بار).',
    tags: ['water-hammer', 'slow', 'surge'],
    duration: 240,
    seed: 1102,
    mode: 'MANUAL',
    params: { 'valve.strokeTime': 30 },
    timeline: [{ t: 0, param: 'manualValve', value: 1 }],
    assertions: [{ id: 's10c-surge', type: 'surgePeak', value: 100000, tolerance: 0 }],
    expected: { on: 'Slow (30 s): ΔH ≈ 0.38 m' },
  },
  {
    id: 'S11',
    name: 'RO feed-side demonstration (out of scope)',
    nameAr: 'عرض جانب تغذية التناضح العكسي (خارج النطاق)',
    description:
      'Educational panel: a 0.4 bar lift on a 65 bar RO feed is < 1 % in magnitude; the ramp rate governs. Clearly labelled out of scope.',
    descriptionAr:
      'لوحة تعليمية: رفع 0.4 بار على تغذية تناضح عكسي بضغط 65 بار أقل من 1% في المقدار؛ معدل التغير هو الحاكم. موسوم بوضوح خارج النطاق.',
    tags: ['ro', 'educational', 'out-of-scope'],
    duration: 60,
    seed: 1110,
    mode: 'OFF',
    params: { roFeedBar: 65, roLiftBar: 0.4, roRampBarS: 2.0 },
    assertions: [],
    expected: { on: 'Magnitude < 1 %; ramp above the vendor limit [VERIFY] flagged red' },
  },
  {
    id: 'S12',
    name: 'Noise and false-alarm test',
    nameAr: 'اختبار الضوضاء والإنذارات الكاذبة',
    description: 'Healthy plant with doubled noise and random spikes. Zero false injections in one simulated hour.',
    descriptionAr: 'محطة سليمة مع ضوضاء مضاعفة وذباذيب عشوائية. صفر حقن كاذب في ساعة محاكاة واحدة.',
    tags: ['noise', 'false-alarm'],
    duration: 3600,
    seed: 1012,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: 1.0 },
      { t: 0, param: 'noiseScale', value: 2.0 },
    ],
    assertions: [
      { id: 's12-false', type: 'falseInjections', value: 0 },
      { id: 's12-transitions', type: 'maxTransitions', value: 4 },
    ],
    expected: { on: 'Zero false injections in 1 simulated hour; spike rejection visible' },
  },
  {
    id: 'S13',
    name: 'VFD speed change',
    nameAr: 'تغيير سرعة الـVFD',
    description: 'Speed ramps 105 → 80 %. NPSH3 falls with n² and R rises: speed reduction is the alternative lever.',
    descriptionAr: 'تنخفض السرعة من 105 إلى 80%. ينخفض NPSH3 مع n² ويرتفع R: خفض السرعة هو الرافعة البديلة.',
    tags: ['vfd', 'affinity'],
    duration: 1800,
    seed: 1013,
    mode: 'ON',
    timeline: [
      { t: 0, param: 'z_level', value: 1.0 },
      { t: 0, param: 'n', value: 1.05 },
      { t: 900, param: 'n', value: 0.8 },
    ],
    assertions: [{ id: 's13-minR', type: 'minR', value: 1.9 }],
    expected: { on: 'NPSH3 falls with n², R rises' },
  },
  {
    id: 'S14',
    name: 'Monte Carlo (500 runs)',
    nameAr: 'مونت كارلو (500 تشغيلة)',
    description:
      '500 seeded runs varying tide amplitude, fouling rate, temperature, noise and stroke time. Compares ON vs OFF statistics.',
    descriptionAr: '500 تشغيلة مذيلية تغيّر سعة المد ومعدل الانسداد والحرارة والضوضاء وزمن الشوط. تقارن إحصاءات التشغيل والتوقف.',
    tags: ['monte-carlo', 'sweep'],
    duration: 1800,
    seed: 1014,
    mode: 'AB',
    assertions: [],
    expected: { on: 'P(R < 1.5), mean damage index, P95 tank volume, ON vs OFF' },
  },
  {
    id: 'S15',
    name: 'Parametric sweep: tank elevation × stroke time',
    nameAr: 'مسح بارامتري: ارتفاع الخزان × زمن الشوط',
    description: 'Contour maps of minimum R and surge peak over tank elevation 5–20 m and valve stroke 3–60 s.',
    descriptionAr: 'خرائط كونتور للحد الأدنى من R وذروة الطرق المائي  over ارتفاع الخزان 5–20 م وزمن الصمام 3–60 ث.',
    tags: ['sweep', 'contour'],
    duration: 600,
    seed: 1015,
    mode: 'ON',
    assertions: [],
    expected: { on: 'Contour maps of minimum R and surge peak, feasible region shaded' },
  },
];

for (const sc of scenarios) {
  const path = join(outDir, `${sc.id}.json`);
  writeFileSync(path, JSON.stringify(sc, null, 2) + '\n');
  console.log('wrote', path);
}
console.log(`Generated ${scenarios.length} scenarios in ${outDir}`);
