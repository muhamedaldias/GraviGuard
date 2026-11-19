# UI/UX review — analysis-001 (lead: hermes@baba)

All 16 pages, 5 components, hooks, store, i18n, styles read in full. Evidence: file:line.

## Architecture
- No router: page id in zustand store (src/state/store.ts:62,92,107); App.tsx:24-41 maps 16 PageIds to components; no URL/hash sync → no deep links, browser Back does nothing, refresh resets to landing.
- State: single zustand store (store.ts:86-126) holds presentation prefs + latest SimState snapshot + rolling history (MAX_HISTORY 3600, appended at ≥0.1 s sim-time intervals, store.ts:9,110-113). Worker singleton in hooks/sim.ts:7; simSend module function. Params edits: setParams structuredClone → new object identity → hooks/sim.ts:29-36 effect re-sends 'init' → FULL ENGINE RESET on every slider tick (also pages send a redundant, stale-closure 'params' message: ControllerPage.tsx:63, SensorsPage.tsx:25,94,106 capture pre-update `params`).
- Worker errors only console.error (hooks/sim.ts:21); no UI error surface; no React ErrorBoundary anywhere (grep: none); no worker.onerror in client.ts.
- i18n: i18next, static en/ar bundles, lng hardcoded 'en' (i18n/index.ts:20), no browser detection, no persistence (grep localStorage: none). dir/lang set on <html> in App.tsx:59-66. escapeValue:false (safe with React text nodes).
- Settings not persisted; quality setting effectively dead: [data-quality='low'] .panel{backdrop-filter:none} (global.css:344-346) but .panel has no backdrop-filter (only .topbar does, global.css:45).

## Page completeness (16)
| Page | Verdict | Evidence |
|---|---|---|
| Landing | COMPLETE | static i18n hero + 6 steps + CTAs wired (Landing.tsx:27-31,72) |
| Simulator | PARTIAL | live sim wired; fault toggles broken (see F1); gauges ignore units/digits settings; speed slider linear 0.25–200 (Simulator.tsx:119-130) |
| Curves | PARTIAL | charts plotted vs wrong x (F2); timeFrac slider dead (Curves.tsx:19,119 — value never read); US units change axis labels but not data (Curves.tsx:91,113); NPSHa drawn as constant horizontal line vs Q (Curves.tsx:98) |
| Twin | PARTIAL | runs 2×600 s engines synchronously in useMemo on main thread (Twin.tsx:17-33, ~120k steps ≈ 1.5–2 s freeze per params/seed change); Delta color logic wrong for damage/headLoss (improved=b>a, Twin.tsx:109 — lower is better for those); `energy` computed never shown (Twin.tsx:29) |
| PumpPage | PARTIAL | mechanism buttons only swap caption text; PumpCutaway has no mech prop (PumpPage.tsx:38-53, PumpCutaway.tsx:9); cavity badge thresholds hardcoded & never show BREAKDOWN (PumpPage.tsx:77-79); CI uses hardcoded R_inc/R_brk not params (PumpPage.tsx:22) |
| ControllerPage | PARTIAL | Strategy A/B/C selector + comparison are a NO-OP: `strategy` never read in src/sim (grep: only types.ts:98, defaults.ts:79); 3 comparison runs are identical physics (ControllerPage.tsx:31-54); Kp slider dead (ControllerPage.tsx:124-125, controller.ts never reads Kp); comparison runs 3×600 s synchronously (~180k steps main-thread block); 'Strategy' th hardcoded EN (ControllerPage.tsx:151) |
| SensorsPage | PARTIAL | "Truth vs measured" chart plots THE SAME ARRAY TWICE: truth=measured=history.map(h=>h.NPSHa) (SensorsPage.tsx:19-20) — estimator series never recorded in store history; fault buttons one-way but Reset clears all (SensorsPage.tsx:118-127); 'CV leak' hardcoded EN (line 121); no spectrum display |
| TransientsPage | PARTIAL | surge pane live ✓; stroke slider min 0.05 s but actuator slew floors at 0.1 s (valve.ts:34) — UI allows physically impossible stroke; RO ramp slider local-only, not wired to sim (TransientsPage.tsx:18,74); hardcoded EN sentence line 80; safeStroke recomputed locally w/ 0.8 floor (line 25) duplicating engine; 500000 Pa limit hardcoded (lines 52,57) |
| SizingPage | PARTIAL | target R slider dead (SizingPage.tsx:13,42 — in deps, never used); strokeRec = Math.max(10*0.08, Math.min(60,12)) ≡ 12 constant (line 22); junctionHead = elevation+2.5 magic (line 21); economics annualAvoided = downtime*repair*2 magic ×2 (line 24); US units ignored |
| ApplicabilityPage | PARTIAL | content sound (NPIPa, HI 9.8) but ALL 9 case/reason strings + timescale labels hardcoded EN (ApplicabilityPage.tsx:6-29), 'Out of scope' EN (line 55) — page untranslated in AR |
| MonteCarloPage | PARTIAL | MC 300 runs×400 s×2 modes on MAIN THREAD chunked per 10 runs (sweep.ts:71-74) ≈ 400k steps ≈ 5 s freeze per chunk; startContour has no try/finally → on error `running` stuck true, buttons disabled forever (MonteCarloPage.tsx:29-34); start() no catch → no error message; renderContour identity wrapper (line 126-128); histogram no axes/aria |
| ScenariosPage | PARTIAL | runAll executes runScenario synchronously per scenario (~4.7 s freeze for S1) with setTimeout(0) between (ScenariosPage.tsx:34-40); AB badge shows only first run (line 82); JSON export includes full sample arrays (huge); fetch without r.ok/schema validation (lines 22-26) |
| ReportsPage | PARTIAL | CSV/JSON exports work; SVG+PNG export DEAD: querySelector('.chart-box svg') (ReportsPage.tsx:44,52) but StripChart renders uPlot CANVAS, no SVG exists (StripChart.tsx:103,133) → silent no-op; CSV Pv column always 0 in live mode (store.ts:22 Pv:0); JSON 'kpis' field is actually full SimState (misnamed, line 37); PDF = window.print() with no @media print CSS (global.css has none); PNG bg hardcoded dark (line 65) |
| MethodologyPage | PARTIAL | KaTeX equations static hardcoded array → dangerouslySetInnerHTML not user-reachable (MethodologyPage.tsx:13-76,161-170); only E1–E5,E8,E9 shown (E6,E7,E10–E13 absent); UNVERIFIED/LIMITS/REFERENCES/synthetic paragraph/variable names all hardcoded EN (lines 78-97,148-150,18-23 etc.) |
| TourPage | BROKEN | effect calls setPage(step.page) (TourPage.tsx:68) → App swaps ActiveComponent → TourPage UNMOUNTS itself on step 1; tour controls vanish, state lost; re-entry restarts at step 0. AR body b2 contains English word "while" mid-sentence (TourPage.tsx:31). Strings bypass i18n catalogue (local STRINGS, lines 22-48) so parity test doesn't cover them |
| SettingsPage | COMPLETE (mostly) | all toggles wired; quality toggle dead (CSS selector mismatch); no persistence; seed input accepts NaN (SettingsPage.tsx:69, Number('')→NaN→mulberry32(NaN>>>0)=0 silently) |

## Top findings
- F1 (P1): Simulator fault toggles broken — valveStuck sends `!s?.controller.name` ≡ false (Simulator.tsx:206); drift/dropout/CV-leak one-way (always 30000/true/true, lines 207-212), active={false} hardcoded → no state feedback; 'CV leak' label hardcoded EN (line 211).
- F2 (P0/P1): StripChart uses series[0].data as the x-axis (StripChart.tsx:49,119) and no caller passes time as first series → Simulator charts plot vs R (Simulator.tsx:276-298), Curves vs H / constant NPSHa (Curves.tsx:83-114), Twin vs off.R (Twin.tsx:73-90), Sensors vs NPSHa (SensorsPage.tsx:42-49). X legend formats values as seconds ('t', StripChart.tsx:67). All time-series charts are plotted against the wrong independent variable.
  BROWSER-VERIFIED (vite preview + real browser, 2026-11-19): at sim time 2.1 s the four Simulator chart legends show t = "2.3 s" (R), "0.1 s" (Q), "5.0 s" (tankH), "0.0 s" (vib) — x-axis is the first y-series, not time.
- F3 (P1): TourPage self-unmounts (above). BROWSER-VERIFIED: clicking Tour nav leaves active page = 'Simulator', tour panel not rendered.
- F4 (P1): SensorsPage truth-vs-measured is the same data twice.
- F5 (P1): Strategy Lab A/B/C no-op; Kp slider no-op; Curves timeFrac no-op; Sizing target no-op; Reports SVG/PNG no-op; quality setting no-op. Six dead controls.
- F6 (P1): main-thread physics blocks: Twin (~2 s), ControllerPage (~2.5 s), ScenariosPage runAll (~40 s total, 5 s chunks), MonteCarlo (~5 s chunks). Only the live simulator uses the worker.
- F7 (P1): params edits full-reset the engine (hooks/sim.ts:29-36) + stale 'params' messages; playing state desyncs after scenario/init (worker paused, store.playing stays true → button shows ⏸ while sim stopped).
- F8 (P2): PidSchematic hardcodes atmos head 10.08 (PidSchematic.tsx:12), tank area 10 (line 101), reserve 0.5 m (line 96); tank water rect overflows the tank drawing for h>7.5 m (large-tank scenarios S1/S2/S3/S5, tankY=150−12h, line 15).
- F9 (P2): StripChart y2 axis always rendered with hardcoded label 'NPSH (m)' even on flow/tank/vibration charts (StripChart.tsx:64); hlines captured at plot creation → stale when npshaAtOp changes (Curves.tsx:104).
- F10 (P2): Curves US toggle relabels axes m→ft, kW→hp without converting data (Curves.tsx:91,113). Simulator GaugeBox ignores units & digits (Simulator.tsx:252-259, toFixed Western).

## i18n
- Parity (script run, node flatten diff): en 316 keys, ar 316 keys; missingInAr [] ; missingInEn [] ; empty [] . 6 identical values, all legitimate (common.appName, transients.joukowsky, reports.png/svg/csv/json).
- BUT hardcoded EN content outside catalogue: ApplicabilityPage whole matrix+timescale; MethodologyPage lists+paragraph+var names; TourPage STRINGS (bilingual but outside parity test, AR defect 'while'); alarm messages engine.ts:658-665 + controller.ts:85-88,109 shown raw (ControllerPage.tsx:109); 'CV leak' ×2; 'Strategy' th; TransientsPage line 80; Simulator chart series labels ('R','NPSHa','Q','speed %','tank','valve','vib','damage','CI'); PidSchematic instrument units.
- AR quality spot-check: technical terms present (ضغط الشفط الصافي الموجب, إعادة التدوير — tests/i18n.test.ts:19-25); Tour b2 mixed-language defect.

## Accessibility
- Good: focus-visible outline (global.css:330-333), prefers-reduced-motion (335-342, but SMIL animations in PidSchematic/PumpCutaway are NOT covered by it), SVG role="img"+aria-label on gauges/schematics (RadialGauge.tsx:77, PidSchematic.tsx:23, PumpCutaway.tsx:20,72, ApplicabilityPage.tsx:82), sliders wrapped in <label>, nav aria-label (App.tsx:86).
- Gaps: no aria-current on active nav; toggle buttons lack aria-pressed (mode/fault/strategy); icon-only topbar buttons rely on title; scenario <select> has no accessible label (Simulator.tsx:141); histograms/contours no role/aria (MonteCarloPage.tsx:114,136); no skip-link; heading order h1 only on Landing, other pages start h2 ✓ acceptable; uPlot canvas charts have no text alternative; contrast risks: --text-2 #6b7d92 on #101722 ≈ 4.0:1 (below 4.5 for 11–12 px text), --watch #f2b705 on light bg ≈ 1.9:1 (yellow badges unreadable in light theme) — computed estimates, not tool-measured.

## Mobile/responsive
- ZERO @media width breakpoints in global.css. grid-2/grid-3 auto-fit minmax(320/240px) collapse ✓, but Simulator inline grid '260px 1fr 300px' (Simulator.tsx:159) forces ~880 px min → horizontal overflow on phones; PumpPage '1fr 300px' (PumpPage.tsx:46) ~620 px min. 16-button nav-rail scrolls horizontally (global.css:68-78) — usable but long; no mobile menu. Touch targets: nav-link padding 6px 10px (~30 px tall) below 44 px guideline. TEST_REPORT's 780×437 check would already overflow the Simulator grid.

## Visual design
- Coherent industrial control-room token system (tokens.css): dark+light palettes, severity colors, logical properties for RTL, blueprint grid background, glow accents, tabular nums. Quality: good for a demonstrator; consistent panel/badge/kpi language across pages. Weaknesses: inline styles everywhere (hundreds of style={{}} overrides), hardcoded hex colors in artwork & a few bands ('#8fbf3f' Simulator.tsx:16, PumpPage.tsx:65), IBM Plex Mono referenced but never imported (falls back), light-theme severity contrast, no print stylesheet.

## XSS / robustness surface
- dangerouslySetInnerHTML only in MethodologyPage.tsx:170 with static hardcoded KaTeX input (throwOnError:false, trust default false) → not user-reachable; katex 0.16.x has low-sev prototype-pollution advisory (GHSA-238p-pmpm-9mq7).
- Scenario JSON fetched same-origin, no schema validation, no user import/paste path (grep: none) → worker defaultParamsWith pollution gadget latent, not reachable today.
- Exports build Blobs from internal data only; SVG serialization of own DOM; no injection vector found.
- window.__gurve store handle exposed in production (store.ts:128-131).
