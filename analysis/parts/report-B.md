## 4. CODE QUALITY REVIEW

TypeScript: strict + noUnusedLocals/Parameters + noFallthroughCasesInSwitch +
noImplicitOverride (tsconfig.json:8-12); `tsc --noEmit` clean (build evidence §8).
Gaps: no noUncheckedIndexedAccess/exactOptionalPropertyTypes; `any` + `as never` casts at
module boundaries (worker.ts:113, scenario.ts:44, engine.ts:156-157); eslint-disable
comments exist but **no ESLint config is present** (cargo-cult suppressions).

Module boundaries: sim core is genuinely DOM-free and reusable headless ✓; UI imports
SimEngine directly for A/B/MC (main-thread blocks, §5 F6); sensors.ts re-exports pumpNPSH3
(sensors.ts:178) — odd coupling; RadialGauge imports store at file bottom via a shim
(RadialGauge.tsx:118-125); store exposes window.__gurve in production (store.ts:128-131).

Duplication: surge limit 500 kPa in 4 places; safeStroke formula duplicated
(TransientsPage.tsx:25); cavity thresholds hardcoded in PumpPage.tsx:22,77-79 vs
configurable defaults; PidSchematic hardcodes 10.08 m atmos head / 10 m² tank area /
0.5 m reserve (PidSchematic.tsx:12,96,101); operatingPoint vs operatingPointSteady share
~40 lines of evaluate() logic (engine.ts:264-273 vs 313-336); residual() calls evaluate()
twice per bisection iteration (engine.ts:275,339) — 2× wasted solves.

Dead code: vibrationSpectrum/getSpectrum/getHfRms (zero callers), Kp/tripOnFault/
faults.valveStuck/varyStroke/ramp params, minAutonomy KPI, units.ts:84-87 identical
if/else branches, Twin energy (Twin.tsx:29), Curves timeFrac, MonteCarloPage
renderContour identity wrapper, Badges.useSeverityTones (returns {theme}, unused),
fluid.densityWater correction (never called with nonzero), prng.boundedGaussian/hashSeed
(exported, unused), UI_HZ/MODEL_VERSION partially used (MODEL_VERSION shown in footer via
i18n? — footer uses t('common.model'), constant itself unused in UI).

Error handling: worker onmessage try/catch posts error ✓ but loop() unprotected; client
ignores 'ready', no onerror; UI error path = console.error only (hooks/sim.ts:21); fetch
chains silently swallow failures to empty lists (Simulator.tsx:53, ScenariosPage.tsx:26);
MonteCarloPage.startContour lacks try/finally (stuck spinner); no React ErrorBoundary.

Naming: package name "gurve" vs export filenames "gurue-*" vs product GraviGuard —
three inconsistent codenames (package.json:2, ReportsPage.tsx:32,38,48,70).

### Test honesty — do the 72 tests cover the physics?
Partly. Genuine coverage: Antoine/seawater/atmos head (7), pump curves/NPSH3/n² affinity/
Nss (11), junction branch rule incl. check-valve closure (8), baseline/determinism/
dt-convergence/behavioural physics + cavitation indices (24), 18-scenario headless pack
with 37 assertions (19), i18n parity (3). The scenario pack is the strongest asset: it
asserts real outcomes (minR, tankMin, stateSequence, surge bounds) end-to-end.

NOT covered (verified by reading all 6 test files):
- controller.ts: zero direct unit tests (cycle limit, dwell, MANUAL, FAULT_SAFE exit,
  REFILL→IDLE, timer semantics — the defects #5/#6/#18 all live here, untested).
- sensors.ts: zero direct tests (vote, quantize, stuck/dropout/drift, estimator — defects
  #1/#3/#9/#13 untested; S9b/S9d scenarios pass despite drift being invisible).
- valve.ts, units.ts, prng.ts, vibration.ts, sweep.ts (S14/S15), worker.ts, client.ts,
  hooks, store: zero tests. No UI/DOM tests at all (jsdom is a devDependency but unused;
  vitest environment 'node', vite.config.ts:15).
- network backflow path (allowBackflow=true): untested despite TEST_REPORT claim.
- Assertion evaluator edge cases: custom auto-pass, tolerance handling, empty packs.
- No extreme-parameter/NaN guards tests (T>100, n=0, D=0, branch.R=1, Patm≠101325).
- Determinism test compares 6 fields, not full state (engine.test.ts:57-59).
- scenarios.test.ts "calibration summary" test depends on test execution order and
  shared mutable `results` (scenarios.test.ts:32,52-59) — fragile under filtering/sharding.
- 3 of 21 scenarios (S11/S14/S15) never executed headlessly in CI.
Conclusion: the suite is honest about what it asserts (no fake expects), but it covers
the happy-path physics well and the controller/sensor/fault layer poorly — exactly where
the confirmed defects cluster. 72 passing tests ≠ 72 tests of correctness-critical paths.

## 5. UI/UX REVIEW

Full detail: **analysis/parts/ui-review.md** (all 16 pages read; browser-verified items
marked). Completeness: Landing/Settings complete; 13 pages partial; TourPage broken.
Six dead controls (Strategy A/B/C, Kp, Curves timeFrac, Sizing target R, Reports SVG/PNG,
quality setting). Headline defects:
- **F2 (browser-verified): every StripChart plots against the wrong x-axis** —
  series[0].data is used as x (StripChart.tsx:49) and no caller supplies time; at sim
  time 2.1 s the four Simulator charts' "t" legends read 2.3 s (R), 0.1 s (Q), 5.0 s
  (tank level), 0.0 s (vibration). The flagship live view is misplotted.
- **F3 (browser-verified): TourPage unmounts itself** — its effect calls setPage(step.page)
  (TourPage.tsx:68); clicking Tour lands on Simulator with the tour gone.
- **F4: SensorsPage "truth vs measured" plots the same array twice** (SensorsPage.tsx:19-20).
- **F1: all four Simulator fault toggles broken/one-way** (Simulator.tsx:205-212).
- **F6: main-thread physics freezes** — Twin ~2 s, Controller lab ~2.5 s, scenario bench
  ~5 s/scenario, Monte Carlo ~5 s/chunk.
- **F7: every params slider tick fully resets the engine** (hooks/sim.ts:29-36) and sends
  a stale redundant 'params' message; play-state desyncs after scenario load.
i18n: en/ar key parity EXACT — 316/316 keys, 0 missing, 0 empty (script output in
ui-review.md); 6 identical values all legitimate. BUT large hardcoded-English islands:
ApplicabilityPage matrix+timescale (whole page), MethodologyPage lists/paragraph/var
names, engine alarm strings shown raw, TourPage AR text contains English "while"
(TourPage.tsx:31), 'CV leak' ×2, chart series labels.
Accessibility: focus-visible + reduced-motion + SVG role/aria-label present; gaps:
no aria-pressed/current, unlabeled scenario select, canvas charts without alternatives,
SMIL ignores reduced-motion, contrast risks (text-2 on dark ≈4.0:1; watch yellow on
light ≈1.9:1 — estimates). Mobile: ZERO width breakpoints; Simulator fixed
260px/1fr/300px grid overflows below ~880 px; 16-tab scrolling nav; ~30 px touch targets.
Visual design: coherent industrial token system, dark/light, RTL logical properties —
good demonstrator quality; undermined by pervasive inline styles, hardcoded hexes,
missing print stylesheet, dead PNG/SVG exports.

## 6. DOCS REVIEW

Full drift register (29 items): **analysis/parts/docs-review.md**. Highlights:
- TEST_REPORT.md:12-17 per-file test counts wrong (pump 10→11, engine 22→24,
  scenarios 21→19); total 72 coincidentally right.
- TEST_REPORT.md:14 claims backflow coverage that does not exist.
- TEST_REPORT.md:65-69 lists minNPSHa/maxDamage as exercised; neither appears in any
  scenario JSON (actual: 11 types, 37 assertions).
- METHODOLOGY.md:42-43 "semi-implicit Euler"/"bisection for junction head" vs explicit
  Euler + closed-form branch rule in the live path (engine.ts:453-455, network.ts:57-91).
- METHODOLOGY.md:128-129 HF-vibration advisor message claimed but unimplemented (zero
  callers of getSpectrum/getHfRms).
- README.md:48-51 "implements the plan's Section 2 equations exactly" overstated given
  sensor-synthesis wiring defects (§3 #1–#3).
- DECISIONS.md D5 vs valve.ts:34: S10a's 0.05 s stroke is below the 0.1 s actuator floor —
  unrecorded interaction; demo-script.en.md:79 repeats the 0.05 s drag instruction.
- TransientsPage RO limit lacks the literal [VERIFY] label promised by METHODOLOGY.md:180
  (comment-only, TransientsPage.tsx:21).
- dist/ committed (116 files) though README presents it as build output; .gitignore lacks dist.
- DECISIONS.md D1–D12 otherwise accurate and unusually thorough (tank recalibration,
  NPSH3 affinity fix, feedforward rationale all verified against code/JSONs/probes).

## 7. ROBUSTNESS BASICS

- **Worker message validation: none.** msg.type/params/key/value/speed/seconds/seed
  trusted and cast (worker.ts:83-140); 'params' replaces engine.params by reference
  without clone or shape check (worker.ts:98); speed=NaN silently stalls stepping;
  step seconds huge → unbounded blocking loop (worker.ts:127-128); loop() exceptions
  escape the try/catch and kill rendering silently; client has no onerror (client.ts).
- **Scenario JSON validation: none at runtime.** fetch→.json()→cast (Simulator.tsx:49-53,
  ScenariosPage.tsx:22-26, TourPage.tsx:70-73); no r.ok on per-scenario fetches; malformed
  JSON → NaN physics or silent empty list. Dotted-key application has prototype-pollution
  gadgets (worker.ts:148-163 unvalidated; scenario.ts:40-52 partially validated — probe
  overwrote Object.prototype.toString). LATENT: scenarios are same-origin static files;
  no user import/paste path exists (grep verified). Becomes live the moment custom
  scenario upload is added — validate before building that feature.
- **XSS surface: minimal.** One dangerouslySetInnerHTML (MethodologyPage.tsx:170) fed by
  a hardcoded static equation array through KaTeX (throwOnError:false, trust default
  false) — not user-reachable. i18n escapeValue:false is safe with React text nodes.
  Exports serialize own DOM/Blobs; no injection vector found. window.__gurve debug handle
  exposed (store.ts:128-131) — low risk, remove for production polish.
- **Dependencies — `pnpm audit` actual output (2026-11-19): 16 vulnerabilities
  (2 low, 10 moderate, 1 high, 3 critical).** All critical/high/moderate are DEV/BUILD-time:
  vitest <3.2.6 (critical, GHSA-5xrq-8626-4rwp), tinypool ≤2.1.0 / <2.1.2 (2× critical,
  GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr), vite ≤6.4.3 (1 high + 6 moderate, incl.
  GHSA-587h-7wmj-h5pm, GHSA-rq7h-c2jc-7f22), esbuild ≤0.24.2 (moderate, GHSA-67mh-4wv8-2f99),
  @vitest/mocker (2 moderate). Only RUNTIME advisory: katex <0.18.2 (low,
  GHSA-238p-pmpm-9mq7, prototype-pollution bypass of trust restrictions). Shipped bundle
  risk is therefore low; dev-server exposure is real (vite --host binds all interfaces,
  package.json:8). Fix path: vitest 3+/vite 6.4.4+/katex 0.18.2+ (major bumps — schedule
  as one upgrade item, re-run suite). Full JSON: pnpm audit --json re-runnable.
- No CI, no lint, no dependency-update automation in repo; single commit history means
  no provenance for the claimed prior verification passes.
