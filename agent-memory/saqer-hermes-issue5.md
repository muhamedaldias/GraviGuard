---
agent: hermes
machine: saqer
issue: 5
branch: work/issue-5-stripchart-x
status: done
updated: 2026-11-20T00:30:00Z
pr: https://github.com/muhamedaldias/GraviGuard/pull/10
---

# Understanding
Issue #5 (P0-1): StripChart plotted every chart against its first y-series instead of an
explicit independent variable. Fix: `x: number[]` prop, uPlot data = [x, ...series];
call sites pass time/flow; conditional y2 right axis; hlines reactive. Regression test:
data[0] === supplied x. Scope HARD: StripChart.tsx (whole) + ONLY chart props regions in
{Simulator,Curves,Twin,SensorsPage}.tsx (+ ChartRow pass-through in Simulator).
NOTE: issue body carries stale numbering (issue-4); user TASK overrides → issue-5 branch/memory.

# Decisions & why
- vitest include = tests/**/*.test.ts (node env). Regression test written as .ts with
  React.createElement + `// @vitest-environment jsdom` docblock + tests/helpers/jsdom-stubs.ts
  imported FIRST (uPlot calls matchMedia at module scope). No vite.config.ts/package.json
  edits (out of scope). Real uPlot used in tests (no mock of library behavior); a
  vi.mock importOriginal subclass Spy captures constructor {opts, data, instance} —
  verified: uPlot factory returns fresh `self`, super() binds `this` to it.
- Subagent A (probe): real uPlot works in jsdom with 5 stubs (matchMedia, canvas ctx Proxy,
  ResizeObserver, devicePixelRatio, Path2D). Subagent B (design review, 19 probes):
  (1) cursor parking MUST move to hooks.ready — valToPos right after construction is
  Infinity (scales ranged only in first commit microtask); fixed. (2) create-effect deps
  strengthened with scalesJoin + series.length (label-join alone misses y→y2 swaps).
  (3) redraw(false) re-runs draw hooks cheaply — used for hlines reactivity via hlinesRef.
  (4) keep `v ?? 0` in x formatter (null when cursor hidden). Delegation budget 2/2 used.
- xUnit/xDecimals props added (default 's'/1) so Curves legends read "Q 0.220 m³/s".
  x axis now labelled with xLabel. Wired declared-but-unused yMin/yMax (both required).
- dist/ is committed in repo; pnpm build rewrote it. EXCLUDED dist from commit (restored
  to HEAD) to avoid conflicts with concurrent fleet PRs; committed-dist removal is a
  separate roadmap hygiene item.

# Files changed
- src/components/StripChart.tsx — x prop, [x,...series] data in both effects, ready=x.length>1,
  conditional y2 axis, hlinesRef + redraw(false) effect, hooks.ready cursor parking,
  xUnit/xDecimals/x-axis label, yMin/yMax range, strengthened create deps.
- src/pages/Simulator.tsx — ChartRow gains x prop; 4 ChartRow calls pass x={chart.t}.
- src/pages/Curves.tsx — 4 charts: x={qs}, xLabel="Q", xUnit="m³/s", xDecimals={3}.
- src/pages/Twin.tsx — 2 charts: x={tArr}.
- src/pages/SensorsPage.tsx — 1 chart: x={tArr}.
- tests/stripchart.test.ts — 9 regression tests (real uPlot, jsdom).
- tests/helpers/jsdom-stubs.ts — jsdom stubs for uPlot/React act.
- agent-memory/saqer-hermes-issue5.md — this record.

# Tests & evidence
- TDD red: `pnpm vitest run tests/stripchart.test.ts` BEFORE fix → Tests 7 failed | 2 passed
  (the 2 passes = behaviors buggy code already had: always-3-axes, default 's' formatter).
- TDD green (after component fix): same command → Tests 9 passed (9).
- `pnpm test` (full) → Test Files 7 passed (7); Tests 81 passed (81); 47.31s.
- `pnpm build` → tsc --noEmit clean; vite ✓ built in 2.03s; JS 645.30 kB (gzip 207.80).
- REAL BROWSER (browser_exec, built app via vite preview :4173):
  * Simulator playing: footer sim time 2.0 s; ALL 4 chart x-legends "t 2.0 s" (±0.2 s ✓).
    u-axis counts per chart [3,2,2,2] — right axis only on margin/NPSH (y2) chart ✓.
  * Curves: all 4 legends "Q 0.220 m³/s"; screenshot vision-verified x ticks
    0, 0.05, 0.1, 0.15, 0.2 spanning to 0.22 m³/s; no right axes; NPSH x = Q not constant ✓.
  * A/B Twin: both charts "t 600.0 s" (600 s run) ✓.
  * Sensors: legend "t 63.7 s" == footer "Simulated time: 63.7 s" ✓.

# Open issues
- None blocking. Known limitations: theme CSS-var colors resolved only at plot (re)build
  (pre-existing); x legend decimals fixed per chart via xDecimals; tests stub canvas so
  pixel rendering is verified in browser, not in jsdom.

# Handoff
DONE. Commit 797c8a2 pushed on work/issue-5-stripchart-x; PR #10 OPEN against main
(+412/−27, verified via gh pr view); issue comment posted (issuecomment-7026173030).
Next session task: issue #6 (P0-2 guided tour) — see saqer-hermes-issue6.md.