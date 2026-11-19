## 8. ROADMAP — WHAT REMAINS TO BE DONE

Prioritized, self-contained work items for separate engineers. File ownership is
partitioned to avoid overlap; where two items touch one file, the owned REGION is stated
and sequencing noted. Effort: S ≤ half day, M ≤ 2 days, L > 2 days.

### P0 — blockers (the demonstrator currently misrepresents itself)

**P0-1. Fix StripChart independent variable (all live charts plot vs wrong x)**
- What: add an explicit `x: number[]` prop to StripChart; build uPlot data as
  [x, ...series]; update every call site to pass time (Simulator chart.t, Curves qs,
  Twin off.hist t, SensorsPage tArr). Remove the hardcoded y2 'NPSH (m)' axis when no
  series uses scale y2; make hlines reactive to prop changes.
- Why: browser-verified — at sim time 2.1 s the Simulator "t" legends show R/Q/tank/vib
  values; every time-series chart in the app is misplotted. Core product credibility.
- Where: src/components/StripChart.tsx (owns file); chart call sites in
  src/pages/{Simulator,Curves,Twin,SensorsPage}.tsx (ONLY the series/x props regions).
- Effort: M.
- Acceptance:
  1. With the Simulator playing, each chart's x legend value equals footer sim time (±0.2 s) — verified in a real browser.
  2. Curves H-Q chart x-axis spans 0–0.22 m³/s (not 0–58); NPSH chart x is Q, not a constant.
  3. Charts without y2 series render no right axis; charts with y2 keep it.
  4. pnpm test + pnpm build pass; a regression test asserts StripChart data[0] === supplied x.

**P0-2. Make the Guided Tour actually work**
- What: stop TourPage from navigating itself away. Either render the tour as an overlay
  panel in App while driving page/scenario, or keep the tour on its own page and embed
  the target view; add aria-current="page" to the active nav button while in App.tsx.
- Why: browser-verified — clicking Tour immediately lands on Simulator; the tour is
  unusable, and it is the primary onboarding path (docs/demo scripts reference it).
- Where: src/pages/TourPage.tsx (owns file), src/App.tsx (owns file).
- Effort: M.
- Acceptance:
  1. Clicking Tour keeps the tour panel visible; all 5 steps advance (manual + 8 s auto) without unmounting the tour.
  2. Each step's scenario loads into the worker (snapshot.t resets, scenario id visible) and the target page content is observable.
  3. Exit returns to a sane page; re-entry starts at step 1 deterministically.
  4. Active nav button carries aria-current="page".

**P0-3. Worker lifecycle + message hardening (no silent resets/stalls)**
- What: (a) hooks/sim.ts: send 'params' (live update) instead of 'init' on params edits;
  init only on seed/scenario change; remove stale-closure duplicate sends pattern at the
  hook level; re-sync play state after init/scenario (send play if store.playing).
  (b) worker.ts: validate inbound messages (type whitelist, finite numbers, speed clamp
  0.25–200, step seconds cap, params shape check via a small validator, structuredClone
  on assign); wrap loop() in try/catch posting 'error'; (c) client.ts: add worker.onerror
  → onError; (d) store.ts: expose worker error state for UI (console.error is not enough).
- Why: every slider tick currently resets the plant to t=0 (hooks/sim.ts:29-36); a
  throwing step or NaN speed silently freezes the sim with no UI signal; unvalidated
  messages are the robustness hole nearest to live traffic.
- Where: src/hooks/sim.ts, src/sim/worker.ts, src/sim/client.ts, src/state/store.ts
  (owns these files). Page-side stale 'params' sends are cleaned in P1-5 (sequence:
  P0-3 first, then P1-5 removes the redundant page sends).
- Effort: M.
- Acceptance:
  1. Dragging any controller/sensor slider while playing changes behavior WITHOUT resetting sim time (browser-verified).
  2. Playing state survives scenario load and params edits (button label matches worker activity).
  3. Unit tests: malformed messages (NaN speed, negative step seconds, unknown type, params missing sections) produce an 'error' outbound or are rejected; engine never receives NaN.
  4. A deliberately throwing step surfaces a visible UI error, not a frozen chart.
  5. pnpm test + build pass.

### P1 — important

**P1-1. Sensor/estimator synthesis correctness**
- What: fix P_suction_abs to be STATIC flange pressure (subtract velocity head) or make
  estimator not re-add it (pick one convention, document in METHODOLOGY); P_discharge =
  P_suction_abs + ρgH_pump; gauge = voted − params.fluid.Patm; add ADC saturation at
  FULL_SCALE_PA; make drift fault observable (e.g. drift on 2 of 3 sensors, or
  per-sensor deviation flag feeding healthy/plausibility) so S9b demonstrates something.
- Why: confirmed double-count (+0.032 m NPSHa_est bias), −143 kPa discharge error while
  injecting, gauge wrong at non-standard Patm, S9b drift scenario currently proves nothing.
- Where: src/sim/sensors.ts (owns), src/sim/engine.ts lines ~477-515 (sensor synthesis
  block ONLY), tests/sensors.test.ts (new), public/scenarios/S9b.json if assertions change.
- Effort: M.
- Acceptance:
  1. Noiseless steady state: NPSHa_est == NPSHa truth within 1e-6 (unit test).
  2. P_discharge − P_suction_abs == ρg·H_pump within quantization (unit test, injecting case included).
  3. Patm=90 kPa: gauge == abs − 90000 (unit test).
  4. S9b produces an observable sensor-health/plausibility flag or alarm headlessly; scenario assertions updated and passing.
  5. Full suite green; baseline R unchanged (2.30 ± 0.01).

**P1-2. Controller timer semantics, truth leak, closure guard, advisor completeness**
- What: track time-below-R_inject explicitly (reset on recovery above threshold); reset
  HOLD recover timer when R_src_est dips; derive a genuine R_src_est from measured
  source-side quantities (or rename ctx field and document the simplification); clamp
  RECOVERY closure rate to safeStroke (10·2L/a); clear cycle-limit alarm when window
  clears and interpolate maxCyclesPerHour into the message; implement the HF-vibration
  "possible non-NPSH mechanism" advisor using existing getHfRms (or delete the claim
  from METHODOLOGY §2.6 and the dead spectrum code — decide, record in DECISIONS).
- Why: probes confirmed inject 0.01 s after threshold crossing, 60 s timer not reset,
  unsafe closure with long branches, stale alarms; controller consumes truth R_src;
  methodology promises an advisor that does not exist.
- Where: src/sim/controller.ts (owns), src/sim/engine.ts lines ~517-564 and 602-644
  (controller ctx + advisor blocks ONLY), tests/controller.test.ts (new).
- Effort: L.
- Acceptance:
  1. Unit tests: R crossing R_inject for < injectDelay then recovering → NO injection; sustained ≥ injectDelay → injection.
  2. Unit test: R_src dip resets the recover countdown.
  3. With branch.L=400, recovery closure time ≥ 10·2L/a (test).
  4. Cycle-limit alarm clears after the window empties (test).
  5. Either advisor id 'non-npsh-mechanism' fires on HF-vibration-with-healthy-R (test) or METHODOLOGY/DECISIONS record the removal; no dead getSpectrum path remains unexplained.

**P1-3. Junction/backflow/tank-branch physics consistency**
- What: leaking-check-valve branch must use Q_T (tank flow) for R_T loss and solve the
  coupled backflow consistently; closed-valve Q_T decay must not be credited as junction
  supply (zero Q_T contribution when theta≈0); leak mass balance accounts for reverse
  flow; add allowBackflow unit tests.
- Why: probe shows 2.6× backflow overestimate (0.926 vs 0.355 m³/s); S9c scenario passes
  on inconsistent hydraulics; tank drawdown understated during leak.
- Where: src/sim/network.ts (owns), src/sim/engine.ts lines ~447-471 (tank inertia +
  mass balance block ONLY), tests/network.test.ts (extend).
- Effort: M.
- Acceptance:
  1. Backflow test: Q_S negative magnitude matches analytic two-branch solution within 1 %.
  2. theta=0 with residual Q_T: junction head equals source-only head (test).
  3. S9c assertions re-validated headlessly; pack stays green.
  4. dt-convergence test still < 0.5 %.

**P1-4. Scenario runner honesty + full pack coverage**
- What: 'custom'/unknown assertion types must FAIL (or throw) instead of auto-passing;
  compute minAutonomy from samples (add autonomy to HistorySample or drop the KPI);
  apply tolerance consistently (maxTransitions/falseInjections/surgePeak ignore it);
  bring S11/S14/S15 into headless CI (S14/S15 via sweep smoke runs with bounded runs);
  make the calibration-summary test order-independent.
- Why: a silent auto-pass hole in the test bench undermines the "every expected outcome
  asserted" promise; minAutonomy always 0; 3 of 21 scenarios never run in CI.
- Where: src/sim/scenario.ts (owns), tests/scenarios.test.ts (owns), tests/sweep.test.ts
  (new), public/scenarios/S11.json assertions if added.
- Effort: M.
- Acceptance:
  1. A scenario with a 'custom' assertion fails headlessly with a clear message (test).
  2. minAutonomy KPI > 0 on an injecting scenario and matches V/Q analytic bound (test).
  3. All 21 scenarios executed by pnpm test (S14/S15 with reduced run counts, deterministic seeds).
  4. Calibration summary identical under --shard and filtered runs.

**P1-5. Remove or wire dead UI controls; fix exports and fault toggles**
- What: Simulator fault toggles → real two-way state from snapshot (valveStuck boolean,
  drift 30000/0, dropout true/false, leak true/false) with active feedback; remove Kp
  slider (or implement proportional trim and test it); Strategy A/B/C: implement distinct
  strategies in controller or remove the lab section + comparison; remove Curves timeFrac
  and Sizing target sliders (or wire them); Reports SVG/PNG: export the uPlot CANVAS
  (toDataURL) or render a real SVG — current '.chart-box svg' query matches nothing;
  fix quality CSS selector ([data-quality] .topbar) or drop the setting; remove redundant
  stale page-side 'params' sends (after P0-3); fix MonteCarloPage.startContour try/finally.
- Why: six+ controls do nothing; fault injection (a headline feature) is broken;
  export buttons silently no-op — demonstrator credibility.
- Where: src/pages/{Simulator,ControllerPage,Curves,SizingPage,ReportsPage,SettingsPage,
  MonteCarloPage}.tsx (owns these files, except chart-series prop regions owned by P0-1),
  src/styles/global.css quality rule region.
- Effort: L.
- Acceptance:
  1. Each fault toggle visibly latches and clears; valveStuck actually drives FAULT_SAFE (browser-verified).
  2. No control remains that changes nothing: every slider/button either has an observable effect or is removed (checklist in PR).
  3. Reports PNG/SVG downloads produce a non-empty image of the actual chart (browser-verified).
  4. startContour error path re-enables buttons (test or manual fault injection).
  5. pnpm test + build pass.

**P1-6. Move batch physics off the main thread (or chunk finely)**
- What: run Twin, Controller comparison, ScenariosPage runAll and MonteCarlo/contour in
  the worker (new 'batch' message reusing runScenario/sweep) OR chunk per-run with
  progress + cancel; add cancellation on unmount; show progress per run, not per 10 runs.
- Why: measured freezes ~2 s (Twin), ~2.5 s (controller lab), ~5 s/scenario (bench),
  ~5 s/chunk (MC) — the app is unresponsive during its own headline analyses.
- Where: src/sim/sweep.ts (owns), src/pages/{Twin,ScenariosPage,MonteCarloPage}.tsx
  run-loop regions, src/pages/ControllerPage.tsx comparison region; worker batch message
  requires P0-3 landed first (coordinate worker.ts edits through P0-3 owner or sequence).
- Effort: L.
- Acceptance:
  1. During a 300-run MC, UI remains interactive (input latency < 200 ms, browser-verified) and progress updates ≥ 1 Hz.
  2. Twin/controller results identical to current synchronous values (determinism preserved, same seeds).
  3. Navigating away mid-run cancels cleanly (no setState-after-unmount, no orphan work).
  4. runAll completes all 18 runnable scenarios with per-scenario progress.

**P1-7. i18n completeness: eliminate hardcoded-English islands**
- What: move ApplicabilityPage CASES/SCALE, MethodologyPage UNVERIFIED/LIMITS/REFERENCES/
  synthetic paragraph/variable names, TourPage STRINGS into en.json/ar.json (parity test
  then covers them); translate engine/controller alarm messages by id in the UI (keep
  engine ids stable); translate 'CV leak', 'Strategy' th, chart series labels,
  TransientsPage line 80; fix AR tour b2 "while" defect; add literal [VERIFY] label to
  the RO limit badge.
- Why: AR is a first-class product promise; whole pages currently render English in AR
  mode; alarm strings bypass the catalogue entirely.
- Where: src/i18n/{en,ar}.json (owns), src/pages/{ApplicabilityPage,MethodologyPage}.tsx,
  src/pages/TourPage.tsx STRINGS region (navigation region owned by P0-2 — sequence),
  src/components/Badges.tsx alarm rendering, src/pages/TransientsPage.tsx label regions.
- Effort: M.
- Acceptance:
  1. Key parity test passes with the new keys; AR mode shows no English sentences on Applicability/Methodology/Tour (manual AR walkthrough checklist).
  2. Every alarm/advisor string rendered in the UI resolves through t() (grep audit: no raw engine message strings in JSX).
  3. Tour b2 AR contains no Latin-script words other than symbols/units.
  4. RO limit badge visibly carries [VERIFY].

**P1-8. Dependency upgrades + repo hygiene**
- What: upgrade vitest → ≥3.2.6 (fixes 3 criticals incl. tinypool), vite → ≥6.4.4
  (1 high + moderates), esbuild ≥0.25, katex ≥0.18.2; re-run full suite (vitest 3 API
  changes); remove dist/ from git + add to .gitignore; add ESLint (+ the react-hooks rule
  the code already disables) and a minimal CI workflow running install/test/typecheck/build/audit;
  decide jsdom: use it (P2-5) or drop it; unify codename (gurve/gurue → graviguard).
- Why: pnpm audit: 16 vulns (3 critical/1 high) — all dev-time but vite --host exposes
  the dev server; committed build artifacts bloat clones and drift from source; no CI
  means the 72-test guarantee is manual.
- Where: package.json, pnpm-lock.yaml, pnpm-workspace.yaml, .gitignore, .github/workflows/
  (new), eslint.config (new), git rm -r --cached dist. Owns all config files.
- Effort: M.
- Acceptance:
  1. pnpm audit reports 0 critical/high (moderate/low documented if any remain).
  2. pnpm test (72+ tests) and pnpm build green on the upgraded toolchain.
  3. dist/ untracked; fresh clone builds identically.
  4. CI runs the four commands + audit on PR; ESLint passes (or baseline documented).

**P1-9. Responsive layout, accessibility basics, print stylesheet**
- What: add width breakpoints so Simulator's 260px/1fr/300px grid and PumpPage 1fr/300px
  collapse below ~900/620 px; ≥44 px touch targets for nav; aria-pressed on toggle
  buttons, accessible label on scenario select, text alternatives for canvas charts
  (aria-label summarizing latest values); fix light-theme watch-yellow and dark text-2
  contrast to ≥4.5:1; add @media print rules for ReportsPage PDF export; honor
  reduced-motion for SMIL (pause animations via JS when matchMedia matches).
- Why: zero width breakpoints today; Simulator overflows on phones; TEST_REPORT's own
  780×437 check would fail the grid; keyboard/AT users get unlabeled toggles; printed
  reports are unstyled dark-theme dumps.
- Where: src/styles/{global,tokens}.css (owns), page-level aria attributes in
  src/pages/*.tsx (attribute-only edits; coordinate with P1-5 which owns those files —
  sequence P1-9 after P1-5 or fold aria into P1-5's checklist).
- Effort: M.
- Acceptance:
  1. No horizontal overflow at 390×844 and 780×437 on all 16 pages (browser-verified).
  2. axe-core (or equivalent) scan: zero critical violations on Simulator/Scenarios/Settings.
  3. Contrast: modified tokens meet 4.5:1 for normal text in both themes (measured).
  4. window.print() produces a readable light report layout.

### P2 — nice-to-have

**P2-1. Parameterize PidSchematic** — replace hardcoded 10.08 m atmos head, 10 m² tank
area, 0.5 m reserve with values derived from snapshot/params; clamp tank water rect to
the tank body (overflow at h>7.5 m in S1/S2/S3/S5). Where: src/components/PidSchematic.tsx.
Effort S. AC: 1) level display correct at Patm=90 kPa/ρ=1000; 2) tank volume label matches
tankH×params.tank.area; 3) no water drawn outside tank rect at hMax=25 m; 4) reserve line
tracks reserveFrac×hMax.

**P2-2. Units & digits consistency** — Simulator GaugeBox and P&ID instrument tags honor
units/digits settings; Curves converts data (not just labels) for US; PumpPage preview
uses params.controller thresholds incl. BREAKDOWN band. Where: src/pages/{Simulator,PumpPage}.tsx
display regions, src/components/PidSchematic.tsx text nodes, src/pages/Curves.tsx data maps.
Effort M. AC: 1) US mode shows ft/psi/gpm/hp with converted values everywhere; 2) AR
digits mode shows Arabic-Indic digits in gauges/tags; 3) PumpPage badge shows BREAKDOWN
below 0.75; 4) no hardcoded '#8fbf3f' band colors remain (token added).

**P2-3. Persistence + URL routing** — persist lang/theme/units/digits/quality/seed to
localStorage; hash-based page routing (#/simulator) with deep links and Back support;
validate stored values. Where: src/state/store.ts, src/App.tsx (after P0-2/P0-3).
Effort M. AC: 1) refresh restores settings and page; 2) direct #/curves URL opens Curves;
3) Back/Forward navigate pages; 4) corrupt storage falls back to defaults.

**P2-4. Minor physics guards + dead-code cleanup** — guard branch.R ≤ 1 in
computeThetaForTarget; make surge limit a PlantParams field (single source for engine +
UI); complete reset() (thetaTarget/timer/spectrum); fix '2 Hz' comment or threshold;
remove dead params (tripOnFault, faults.valveStuck, varyStroke, ramp) or implement;
collapse units.ts identical branches; document Cv(0)=0 convention; remove
useSeverityTones/renderContour/energy dead code. Where: src/sim/{engine,defaults,types,
units,sweep}.ts cleanup regions, src/sim/valve.ts comment. Effort M. AC: 1) branch.R=1
and R<0 produce finite theta (test); 2) surge limit editable in one place and reflected
in UI; 3) grep shows no unused exported sim symbols; 4) suite green.

**P2-5. Test suite expansion** — unit tests for controller state machine, sensors
(vote/quantize/faults/estimator), valve characteristic/slew, units formatting/Arabic
digits, prng determinism, sweep stats; full-state determinism compare; jsdom smoke test
mounting App and switching all 16 pages (uses existing jsdom dep); extreme-parameter
NaN-guard tests. Where: tests/*.test.ts (new files), vite.config.ts test env region.
Effort L. AC: 1) ≥ 40 new tests, all green; 2) every src/sim module has direct coverage;
3) 16-page mount smoke test passes without console errors; 4) suite runtime < 90 s.

**P2-6. Docs synchronization** — correct TEST_REPORT per-file counts/backflow/assertion
claims (or regenerate from vitest output); fix METHODOLOGY Euler/bisection terminology
and estimator wiring description after P1-1; soften README "exactly"; record slew-floor
vs S10a interaction in DECISIONS; align demo scripts (0.05 s drag instruction); AR/EN
demo parity check; document codename decision. Where: README.md, METHODOLOGY.md,
DECISIONS.md, TEST_REPORT.md, docs/demo-script.*.md. Effort S. AC: 1) every drift item
in analysis/parts/docs-review.md resolved or explicitly deferred with rationale;
2) TEST_REPORT regenerated from an actual run; 3) no doc claim contradicts code at merge.

**P2-7. Bundle & loading performance** — route-level code splitting (16 pages eagerly
imported, 644.78 kB JS / 207.64 kB gzip single chunk); lazy-load KaTeX (only Methodology)
and uPlot; subset/trim font imports (all IBM Plex Arabic weights + Inter subsets shipped);
re-enable chunk size warning. Where: src/App.tsx imports, src/main.tsx font imports,
vite.config.ts build region. Effort M. AC: 1) initial JS < 300 kB gzip; 2) Methodology
KaTeX loads on demand; 3) Lighthouse performance ≥ 90 on Landing (local measurement);
4) build warning limit restored to default.

Roadmap totals: **P0 = 3, P1 = 9, P2 = 7 (19 items)**.
Suggested sequencing: P0-1 ∥ P0-2 ∥ P0-3 → P1-1 ∥ P1-2 ∥ P1-3 ∥ P1-4 ∥ P1-8 →
P1-5 → P1-6 ∥ P1-7 ∥ P1-9 → P2 batch. Physics items P1-1/2/3 own disjoint engine.ts
regions (sensor block / controller-advisor block / tank block) and can run in parallel.

## 9. VERIFICATION EVIDENCE & LIMITATIONS

Commands actually run (this machine, 2026-11-19 UTC):
- `pnpm install` → "Done in 1.5s using pnpm v12.15.0" (exit 0).
- `pnpm test` → "Test Files 6 passed (6) / Tests 72 passed (72) / Duration 38.85s";
  scenarios.test.ts 19 tests in 38469 ms; calibration line e.g. "S13 [ON] PASS minR=1.99
  tankMin=5.00 trans=2 cycles=0 false=0".
- `pnpm build` (tsc --noEmit && vite build) → exit 0, "✓ built in 1.40s";
  dist/assets/index-BAIqCUJk.js 644.78 kB │ gzip 207.64 kB; CSS 60.89 kB │ gzip 21.04 kB.
- `pnpm audit` → "16 vulnerabilities found / Severity: 2 low | 10 moderate | 1 high |
  3 critical" (full advisory list in §7; JSON parse output in session record).
- i18n parity script (node, flatten+diff): en 316 / ar 316 keys, missingInAr [],
  missingInEn [], empty [], 6 legitimate identical values.
- Assertion-type census over public/scenarios/*.json: 37 assertions, 11 types (§6).
- Real-browser check of built app (vite preview + browser): chart x-axis defect and
  Tour self-unmount reproduced (§5 F2/F3).
- Physics subagent probes (vite-node): baseline R=2.30727; S10a surgePeak=1,450,078 Pa;
  estimator bias +0.0318 m; gauge error −11325 Pa at Patm=90 kPa; backflow 0.926 vs
  0.355 m³/s; inject 0.01 s after crossing; drift ΔR_est 0.0007 (details in parts file).

NOT verified (explicit):
- Exhaustive console-error sweep of all 16 pages in both languages/themes (spot-checks only).
- Visual rendering quality of every page (no full screenshot review; artwork assessed from code).
- Contrast ratios are computed estimates, not tool-measured.
- AR demo-script line-by-line parity; AR translation quality beyond spot-checks.
- scripts/generate-scenarios.ts was NOT executed (would overwrite public/scenarios);
  generator↔JSON equivalence spot-compared structurally only.
- Worker behavior under real 30 Hz load for extended periods; mobile-device touch testing
  (viewport reasoning from CSS only); print output not physically printed.
- TEST_REPORT's historical browser pass (2026-11-11) cannot be re-verified as stated.
- No source code was modified; all findings are observations, not fixes.
