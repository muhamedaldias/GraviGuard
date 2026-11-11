# GraviGuard — Simulation Platform

An interactive, bilingual (English / Arabic) simulation of the **GraviGuard** protection
concept for centrifugal pumps: when suction conditions erode the NPSH margin, an elevated
gravity tank and a modulating valve dynamically raise NPSH available — only when needed.

> **All plant data is synthetic.** Every value is deterministic (seeded) and labelled
> "Synthetic data / simulation". This is a concept demonstrator, not a design or sizing
> tool for real plants.

---

## Quick start

```bash
pnpm install     # pnpm 12: esbuild build approval is pre-configured in pnpm-workspace.yaml
pnpm dev         # http://localhost:5173
pnpm test        # 72 tests (physics, scenarios, i18n)
pnpm build       # static build in dist/
pnpm preview     # serve the built app
```

No backend is required; the app is a static site. The physics runs in a Web Worker.
A clean install was verified (`rm -rf node_modules && pnpm install` exits 0).

## What's inside

| Area | Path | Notes |
|---|---|---|
| Simulation core | `src/sim/` | Pure TypeScript, no DOM. Deterministic, seeded. |
| Physics worker | `src/sim/worker.ts` | `dt = 0.01 s`, 30 Hz snapshots, ×0.25–×200 speed. |
| Scenario runner | `src/sim/scenario.ts` | Headless, bit-deterministic, assertion evaluation. |
| Monte Carlo / sweeps | `src/sim/sweep.ts` | S14 / S15. |
| Scenario pack | `public/scenarios/` | 21 JSON scenarios (S0–S15), EN/AR. |
| UI | `src/pages/`, `src/components/` | 16 pages, RTL-aware, dark/light. |
| i18n | `src/i18n/` | `en.json` / `ar.json`; a test fails on key mismatch or empty values. |
| Tests | `tests/` | 72 tests across physics, scenarios and i18n. |

## Pages

Concept (landing), Live Simulator, Pump Curves, A/B Digital Twin, Inside the Pump,
Controller & Strategy Lab, Sensors & Estimator, Transients & Water Hammer, Sizing &
Economics, Applicability Map, Monte Carlo & Sweeps, Scenario Library & Test Bench,
Reports & Export, Methodology, Guided Tour, Settings.

## Engineering ground truth

The model implements the plan's Section 2 equations exactly: Antoine vapour pressure with
a seawater factor, suction-line losses, the margin ratio `R = NPSHa/NPSH3`, the 3 %
head-drop characteristic, suction specific speed, submergence per HI 9.8, Joukowsky and
slow-closure water hammer, and tank autonomy. See [`METHODOLOGY.md`](./METHODOLOGY.md).

## Decisions and deviations

All decisions, recalibrations and deviations from the plan are recorded in
[`DECISIONS.md`](./DECISIONS.md). The plan's `[VERIFY]` items are listed on the in-app
Methodology page and in `METHODOLOGY.md`, and are never presented as fact.

## Testing

`pnpm test` runs the full suite. `tests/scenarios.test.ts` executes the entire scenario
pack headlessly and asserts every expected outcome. `tests/engine.test.ts` verifies the
Reference Plant baseline (R ≈ 2.3), determinism (bit-identical runs) and `dt`
convergence (< 0.5 %).

## Demo video script

See [`docs/demo-script.en.md`](./docs/demo-script.en.md) and
[`docs/demo-script.ar.md`](./docs/demo-script.ar.md).

## License

The simulation code is provided as a concept demonstration. Synthetic data only.
