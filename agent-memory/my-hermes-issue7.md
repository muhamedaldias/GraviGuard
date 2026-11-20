---
agent: hermes
machine: my
issue: 7
branch: work/issue-7-i18n-parity
status: in-progress
updated: 2026-11-20T00:32:00Z
---

# Understanding
Issue #7 (P1-7 i18n completeness, round-1): eliminate hardcoded-English islands in
ApplicabilityPage (CASES/SCALE), MethodologyPage (UNVERIFIED/LIMITS/REFERENCES/synthetic
paragraph/variable names/'Name' th), translate alarm messages by id in the UI (engine ids
stable), 'CV leak' ×2, 'Strategy' th, TransientsPage line 80, RO badge [VERIFY].
TourPage STRINGS explicitly DEFERRED (saqer owns TourPage via issue #6 this round).
Hard exclusions: src/sim/*, src/hooks/*, src/state/*, src/components/StripChart.tsx,
src/pages/TourPage.tsx. Then issue #8 (deps + hygiene) strictly after #7 PR is open.
Repo: React 18 + Vite 5 + TS 5.6 strict + i18next; en/ar 316 keys each at start; parity
enforced by tests/i18n.test.ts (assertKeyParity in src/i18n/index.ts). 72 tests baseline.

# Decisions & why
- Branch/memory naming: issue bodies carry stale roadmap numbers (issue-6/issue-7); task
  directive overrides → work/issue-7-i18n-parity + this file; issue #8 will use
  work/issue-8-repo-hygiene + my-hermes-issue8.md.
- Fleet region map (issues #3-#6): baba owns sim/hooks/state (#3/#4); saqer owns
  StripChart + chart call-site SERIES/X PROPS REGIONS in {Simulator,Curves,Twin,SensorsPage}
  (#5) and TourPage/App (#6). No other branches pushed at start (only origin/main).
- Scope resolution: #7 'What' names items in files absent from its 'Where' list.
  (a) Alarms: only raw alarm site = ControllerPage.tsx:109 (controller.alarm raw string,
  types.ts:165); no page renders snap.alarms (grep). Added CTRL_ALARM_KEYS +
  ControllerAlarmBadge to Badges.tsx (owned); swapped the one ControllerPage line (alarm
  region; file unowned this round). (b) 'Strategy' th → existing key controller.strategy.
  (c) 'CV leak' Simulator:211 + SensorsPage:121 → sim.cvLeak; fault-label regions OUTSIDE
  saqer's series/x regions. (d) Chart series labels INSIDE saqer's series-props regions →
  wiring DEFERRED (fleet safety); chart.* keys pre-added (speedPct/tank/valve/vib/damage/
  ghost). Symbols (R/NPSHa/Q/H/P/η%/CI/3%) are notation, not English — stay.
- RO [VERIFY]: transients.roLimit already contained literal [VERIFY] in en+ar; AC4 met by
  existing catalogue; browser-verified rendering in AR (red badge) + EN.
- Alarm catalogue: alarm.<engine-id> for 8 stable ids (engine.ts:658-665) + alarm.ctrl-*
  for 4 raw controller messages (controller.ts:85-88,109). UI maps message→key; unknown
  future messages fall back to raw text (covers P1-2 interpolating the cycle limit later).
  Engine/controller byte-identical strings verified programmatically against source.
- TDD: extended tests/i18n.test.ts FIRST; RED run: 4 failed | 5 passed (missing keys,
  missing CTRL_ALARM_KEYS export, catalogue floor 316<398). Then keys+component → GREEN.
- Translation: 1 delegated child drafted 82 AR strings (glossary-matched formal register);
  lead reviewed every string vs EN + existing ar.json glossary; accepted; re-verified via
  tests (parity + Latin-token allowlist scan, placeholders stripped).
- Key design: nested objects with stable ids; flattenKeys covers every leaf; components
  keep structural arrays (ids/numbers) and pull strings via t(). Lists named
  unverifiedItems/limitItems/referenceItems to avoid colliding with existing string title
  keys methodology.unverified/limits/references (zero churn on existing keys).
- Bonus (documented): fixed pre-existing AR English island sensors.voting '2-out-of-3' →
  'تصويت 2 من 3'; SensorsPage 'vs' subtitle + '(bits)' label → sensors.vs/sensors.bits
  (unowned label regions of a file already touched for CV leak; found by browser scan).
- transients.roSummary uses i18next interpolation {{feed}}/{{lift}}.
- dist/ build churn NOT staged (issue #8 owns dist untracking); only owned files committed.

# Files changed
- tests/i18n.test.ts — +6 tests (round-1 key existence; AR no-Latin scan w/ allowlist;
  controller-map completeness vs exact 4 engine strings; 8 engine-id coverage; [VERIFY]
  marker both langs; catalogue ≥398 floor). 3→9 tests.
- src/i18n/en.json, src/i18n/ar.json — 316→400 keys each (+84: 82 round-1 + sensors.vs/bits).
- src/pages/ApplicabilityPage.tsx — CASES/SCALE → ids + t(); 'Case' th, 'Out of scope'.
- src/pages/MethodologyPage.tsx — lists/paragraph/var names/'Name' th → t(); formulas,
  symbols, units byte-identical (structural self-review vs HEAD).
- src/components/Badges.tsx — CTRL_ALARM_KEYS map + ControllerAlarmBadge.
- src/pages/ControllerPage.tsx — alarm line → ControllerAlarmBadge; 'Strategy' th → t();
  import updated (Badge no longer used there).
- src/pages/Simulator.tsx — line 211 'CV leak' → t('sim.cvLeak') ONLY.
- src/pages/SensorsPage.tsx — 'CV leak' → t('sim.cvLeak'); 'vs' → t('sensors.vs');
  '(bits)' → t('sensors.bits') ONLY.
- src/pages/TransientsPage.tsx — line 80 → t('transients.roSummary', {feed, lift}) ONLY.
- agent-memory/my-hermes-issue7.md — this record.

# Tests & evidence
- pnpm install → Done in 1.4s, pnpm 12.21.0 (warm store /data/home/.local/share/pnpm/store/v11).
- RED: pnpm vitest run tests/i18n.test.ts → Tests 4 failed | 5 passed (9).
- GREEN (same cmd) → Tests 9 passed (9).
- pnpm test (full, twice: after wiring, after sensors bonus) → Test Files 6 passed (6);
  Tests 78 passed (78); ~36s. (72 baseline + 6 new i18n.)
- pnpm build (tsc --noEmit && vite build) → exit 0, ✓ built in 1.29s;
  dist/assets/index-Dyq5-sS-.js 651.83 kB │ gzip 210.19 kB; CSS 60.89 kB │ gzip 21.04 kB.
- grep audit: raw engine/controller alarm strings in src/pages+components → ONLY the 4
  CTRL_ALARM_KEYS lookup entries in Badges.tsx (TS const, not JSX); 'CV leak'/'>Strategy<'
  literals in *.tsx → 0 matches.
- Catalogue merge script: en 316→398, ar 316→398 (then +2 sensors keys → 400);
  missingInAr [] missingInEn [] empty []; AR Latin offenders [] (placeholders stripped);
  alarm strings byte-match engine.ts/controller.ts.
- Structural self-review vs HEAD: 9 cases + 9 scale entries identical (text via catalogue,
  effectiveness/t/kind unchanged); 7 KaTeX formulas byte-identical; 20 var entries
  symbols/units unchanged, names via catalogue; UNVERIFIED(3)/LIMITS(4)/REFERENCES(5)
  identical; synthetic paragraph identical; TransientsPage numeric constants unchanged.
- Browser AR walkthrough (vite preview :4173, built bundle, real browser):
  html dir=rtl lang=ar on all pages; DOM text scans (TreeWalker, .katex/.mono excluded):
  applicability/methodology/transients/sensors/controller offenders = [] (allowlist incl.
  EN/SI topbar codes — App.tsx is saqer-owned chrome). Transients badge line:
  'حد المورد لمعدل التغير [VERIFY]'; roSummary rendered 'تغذية 65 bar · رفع +0.4 bar ·
  المقدار < 1 % · معدل التغير يحدد شوط الصمام.'. Live fault: Sensors 'عالق' click →
  worker play → snapshot.controller.name=FAULT_SAFE, alarm='Sensor fault detected —
  fail-safe active' → ControllerPage critical badges ['أمان معطل',
  'تم رصد عطل في الحساس — وضع الأمان مفعّل'] ✓. 'الاستراتيجية' th present ✓. CV-leak
  labels present on Sensors+Simulator ✓. EN regression: Applicability 'Case' header +
  first case render ✓. Screenshots: /data/home/.hermes/cache/scratch/gg-ar-{applicability,
  methodology,transients,sensors,controller-alarm}.png; vision-confirmed RTL + Arabic
  matrix + alarm badge + [VERIFY].

# Open issues
- Chart series label wiring deferred (saqer #5 series-props region) — chart.* keys ready.
- TourPage strings deferred per issue (round-2; saqer #6 owns file).
- Topbar EN/SI toggle codes remain (App.tsx saqer-owned; identifiers, not sentences).
- PidSchematic instrument units hardcoded EN — P2-2 scope, not in #7 What.
- alarm.ctrl-cycles mirrors engine's hardcoded '(3/hour)'; when P1-2 interpolates the
  limit, the map falls back to raw text until the key/message is updated (by design).
- AR quality: lead-reviewed formal register, not native-certified.
- Preview server proc_41f50f0c48e0 on :4173 — kill by port after delivery (fuser -k 4173/tcp).

# Handoff
NEXT STEPS (in order):
1. Stage ONLY owned files (NOT dist/): git add src/i18n/{en,ar}.json
   src/pages/{ApplicabilityPage,MethodologyPage,ControllerPage,Simulator,SensorsPage,TransientsPage}.tsx
   src/components/Badges.tsx tests/i18n.test.ts agent-memory/my-hermes-issue7.md
2. Conventional commit feat(i18n): ... ; push -u origin work/issue-7-i18n-parity.
3. gh pr create --base main --title "issue-7: i18n completeness (round-1)" with body:
   what changed / evidence (above) / AR walkthrough checklist / limitations (above).
4. gh issue comment 7 --body "agent:hermes machine:my ..." (≤5 lines).
5. Finalize this file (status: done, PR link), commit docs(agent-memory), push.
6. git checkout -- dist && git clean -fd dist (drop build churn); fuser -k 4173/tcp.
7. START ISSUE #8: git fetch; git checkout -b work/issue-8-repo-hygiene origin/main;
   read gh issue view 8; create agent-memory/my-hermes-issue8.md; upgrade vitest ≥3.2.6,
   vite ≥6.4.4, esbuild ≥0.25, katex ≥0.18.2 (+vite-node aligned, plugin-react compat);
   fix vitest-3 API breakage (tests use only describe/it/expect — low risk); git rm -r
   --cached dist + .gitignore dist; ESLint flat config incl. react-hooks/exhaustive-deps
   + @typescript-eslint/no-explicit-any + no-console (existing disables: worker.ts:153,
   scenario.ts:43, StripChart.tsx:114, scenarios.test.ts:53); .github/workflows CI
   (install/test/typecheck/build/audit on PR); codename gurve/gurue→graviguard
   (package.json name; ReportsPage export filenames are NOT owned by #8 — check issue
   ownership before touching ReportsPage; package.json name is owned). pnpm audit
   0 critical/high target; document residuals. Verify: pnpm test/build/audit + fresh
   clone build. PR "issue-8: dependency upgrades + repo hygiene" + issue comment +
   memory file. pnpm store prune at end if store grew (root fs 90% full).