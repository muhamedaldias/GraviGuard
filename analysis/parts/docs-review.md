# Docs-vs-code drift register — analysis-001

Verdicts: ACCURATE / DRIFT / UNVERIFIABLE. All doc claims checked against code by lead.

## TEST_REPORT.md
1. DRIFT — TEST_REPORT.md:12-17 per-file test counts: claims fluid 7 / pump 10 / network 8 / engine 22 / scenarios 21 / i18n 3. Actual (vitest run + file read): fluid 7 / pump 11 / network 8 / engine 24 / scenarios 19 (18 scenario imports + 1 summary test) / i18n 3. Total 72 coincidentally correct.
2. DRIFT — TEST_REPORT.md:14 claims network.test.ts covers "backflow"; tests/network.test.ts has no allowBackflow=true case (all 8 tests use default false).
3. DRIFT — TEST_REPORT.md:65-69 lists minNPSHa and maxDamage as "assertion types exercised"; grep over public/scenarios/*.json: neither type appears. Actual pack counts: minR 10, maxTransitions 7, falseInjections 5, stateSequence 4, advisorMessage 3, surgePeak 2, maxTankMin 2, maxCI 1, maxHeadDrop 1, minSurgePeak 1, tankMin 1 (37 assertions, 11 types). 'custom' never used (evaluator auto-pass hole latent, scenario.ts:348-349).
4. ACCURATE — TEST_REPORT.md:62-63 S11/S14/S15 no headless assertions: S11.json assertions [] (RO metadata params roFeedBar/roLiftBar/roRampBarS), S14/S15 sweep scenarios; tests/scenarios.test.ts imports 18 of 21.
5. ACCURATE — baseline table (Q 0.100/45.0, NPSHa 10.38, NPSH3 4.50, R 2.307): reproduced by physics cross-check probe (R=2.30727).
6. UNVERIFIABLE (historical) — TEST_REPORT.md:73-82 browser pass at 1440×1000 / 780×437 "all 16 pages render without console errors". Lead's browser spot-check FOUND chart x-axis defect and Tour self-unmount (see ui-review.md F2/F3) — the "charts plot data" claim is technically true but the plots are against the wrong x variable; console-error claim not re-verified exhaustively.
7. ACCURATE — TEST_REPORT.md:86-88 live vs headless determinism caveat matches worker.ts wall-clock loop and DECISIONS D11.

## README.md
8. ACCURATE — README.md:18,37 "72 tests": vitest run 72 passed (6 files).
9. ACCURATE — README.md:31 dt=0.01 s (defaults.ts:133), 30 Hz snapshots (worker.ts:73 setInterval 33 ms), ×0.25–×200 (Simulator.tsx:121-122 slider bounds).
10. ACCURATE — README.md:34 21 scenario JSONs; index.json lists exactly the 21 files present.
11. ACCURATE — README.md:35,41-44 16 pages; App.tsx:24-41 PAGES has 16 entries matching the listed names.
12. ACCURATE — README.md:48-51 "implements Section 2 equations exactly": true for E1–E10 formulas (see physics-review.md verdict table) BUT estimator/sensor synthesis deviations exist (velocity-head double count, gauge Patm, P_discharge) and the HF-vibration advisor claim is unimplemented — "exactly" overstates.
13. DRIFT (repo hygiene) — README.md:19 "static build in dist/" while dist/ is COMMITTED (git ls-files dist: 116 files) and .gitignore lacks dist. Build artifacts in VCS.
14. ACCURATE — README.md:16 pnpm 12 esbuild approval: pnpm-workspace.yaml allowBuilds esbuild:true; install exit 0.

## METHODOLOGY.md
15. DRIFT (terminology) — METHODOLOGY.md:42-43 "monotone bisection for the junction head": the live path solveJunction (network.ts:57-91) is a closed-form branch rule; bisection is used for the pump operating point (engine.ts:289-295) and only operatingPointSteady (engine.ts:319-328) bisects junction head (feedforward path).
16. DRIFT (terminology) — METHODOLOGY.md:42 "semi-implicit Euler for the line-inertia ODE": engine.ts:453-455 evaluates the RHS at the current Q_T then adds dQ·dt — explicit (forward) Euler.
17. DRIFT — METHODOLOGY.md:128-129 "high-frequency vibration rising while R looks healthy triggers the 'possible non-NPSH mechanism' message": no such advisor id exists (engine.ts:602-644) and getHfRms/getSpectrum have zero callers outside engine/vibration modules (grep verified). vibrationSpectrum is dead code in the shipped app.
18. DRIFT — METHODOLOGY.md:126-127 estimator formula matches sensors.ts:170, but the pressure fed to it (engine.ts:480) already includes velocity head → estimator double-counts V²/2g (probe: +0.0318 m bias). Doc formula is right; wiring is wrong.
19. ACCURATE — METHODOLOGY.md:108-117 controller thresholds vs defaults.ts:64-86 and controller.ts: all match (R_arm 1.9, R_pred 1.6, T_pred stroke+10, inject 1.6/2 s, target 1.7, hold 1.65/10 s, recover 2.0/60 s, dwell 20 s, 3 cycles/h, VFD 85%). Semantics deviations: injectDelay counts time-in-ARMED not time-below-threshold (controller.ts:107); HOLD→RECOVERY timer not reset on R_src dips (controller.ts:142); R_src_est is truth R_src (engine.ts:537).
20. ACCURATE — METHODOLOGY.md:156-168 timeline interpolation & assertion type list vs scenario.ts:66-101,196-351 (types exist; 'custom' auto-passes; ramp field declared types.ts:308 but never read by Timeline and never used in any JSON — grep verified).
21. ACCURATE — METHODOLOGY.md:175-183 [VERIFY] items surfaced in-app: MethodologyPage.tsx:78-82 UNVERIFIED list matches (HI 9.6.1, RO ramp, patent search). RO limit 0.7 bar/s drawn in TransientsPage.tsx:21,77 — but the in-app badge does NOT carry a literal [VERIFY] label (comment only), unlike the doc's promise "labelled [VERIFY]". Minor drift.
22. ACCURATE — METHODOLOGY.md:39-47 numerics/determinism claims vs engine/worker/prng + tests/engine.test.ts:50-87.

## DECISIONS.md
23. ACCURATE — D2 NPSH3 form (pump.ts:15-19), D3 tank sizes (S1 200 / S2,S3,S5 250 m³ verified in JSONs), D4 continuous refill (engine.ts:467-469), D5 S10a 0.05 s stroke + ΔP≈1.45 MPa (JSON valve.strokeTime 0.05; probe surgePeak 1,450,078 Pa; minSurgePeak assertion ≥1e6), D6 feedforward+Ki trim (engine.ts:358-383, controller.ts:119-136), D7 cavity bands (defaults.ts:85), D8 leak reversal (network.ts:69-75, engine.ts:621-623), D9 plausibility 1.0/2 s/5 s (engine.ts:529-532), D10 surge reporting (engine.ts:588-595), D11 live determinism, D12 [VERIFY].
24. DRIFT (interaction) — D5's 0.05 s stroke is below the actuator slew floor 0.1 s (valve.ts:34): actual valve motion in S10a takes 0.1 s (> 2L/a=0.08 s), while computeSurge classifies regime from the 0.05 s param. The scenario demonstrates the Joukowsky NUMBER but the simulated actuator never actually moves that fast. Not recorded in DECISIONS.

## Demo scripts
25. ACCURATE — docs/demo-script.en.md:11 R=2.31 baseline matches; page names match App.tsx.
26. DRIFT — docs/demo-script.en.md:79 "Drag the valve stroke from 0.05 s to 30 s" — TransientsPage slider min is 0.05 but effective actuator floor is 0.1 s (same as #24); also the Joukowsky pane shows the algebraic estimate, not a simulated transient.
27. NOT FULLY CHECKED — AR demo script parity line-by-line (spot-checked structure; both 103/113 lines, same section layout).

## Scenario schema conformance
28. ACCURATE — all 21 JSONs parse; params values numeric (S11 RO metadata numeric, ignored by physics via scenario.ts:381-389 catch); timeline values numeric; assertion fields subset of Assertion interface. No schema validator exists at runtime (fetch→json→cast, Simulator.tsx:49-53, ScenariosPage.tsx:22-26) — conformance holds today by construction (generator), not by validation.
29. ACCURATE — scripts/generate-scenarios.ts embeds the same ids/assertions as committed JSONs (S0–S8 spot-compared); generator not executed (would overwrite public/).
