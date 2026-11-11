# GraviGuard — Test Report

**Build:** `v1.0.0` · **Date:** 2026-11-11 · **Command:** `pnpm test` (`vitest run`)
**Result:** **72 passed / 72** (6 test files, 36.3 s)

---

## 1. Suite breakdown

| File | Tests | Coverage |
|---|---:|---|
| `tests/fluid.test.ts` | 7 | Antoine vapour pressure, seawater factor, atmospheric head, Pv(T) |
| `tests/pump.test.ts` | 10 | Pump curve through BEP, shutoff, NPSH3 (incl. n² scaling), efficiency floor, run-out, power, Nss |
| `tests/network.test.ts` | 8 | Source resistance, heads, junction solve, check-valve branch logic, backflow |
| `tests/engine.test.ts` | 22 | Reference Plant baseline, determinism, `dt` convergence, physics behaviour, cavitation indices |
| `tests/scenarios.test.ts` | 21 | Full scenario pack (S0–S13) with assertion evaluation |
| `tests/i18n.test.ts` | 3 | EN/AR key parity, catalogue size, glossary terms |
| **Total** | **72** | |

## 2. Reference Plant baseline (verified)

| Quantity | Expected (plan) | Measured | Test |
|---|---|---|---|
| Operating point | Q = 0.100 m³/s, H = 45 m | 0.100 / 45.0 | `engine.test.ts` |
| NPSHa | ≈ 10.4 m | 10.38 m | `engine.test.ts` |
| NPSH3 | 4.5 m | 4.50 m | `engine.test.ts` |
| Margin ratio R | ≈ 2.3 | 2.307 | `engine.test.ts` |
| Controller at t = 0 | IDLE, zero valve movement | IDLE, θ = 0 | `engine.test.ts` |
| Tank | 50 m³, reserve 0.5 m | 50 m³, 0.5 m | `engine.test.ts` |

## 3. Determinism and convergence

- **Determinism:** two engines with the same seed produce bit-identical state after 2000
  steps (JSON compare of t, Q, R, NPSHa, sensor pressure, damage). Different seeds give
  different sensor noise.
- **Convergence:** halving `dt` from 0.02 s to 0.01 s during a tidal ramp changes R and
  NPSHa by < 0.5 %.

## 4. Scenario pack results (headless, `dt = 0.01 s`)

| ID | Scenario | Mode | min R | tank min (m) | Transitions | Cycles | Result |
|---|---|---|---|---|---|---|---|
| S0 | Healthy baseline | ON | 2.31 | 5.00 | 2 | 0 | PASS |
| S1 | Tidal drawdown | ON | 1.54 | 9.14 | 29 | 12 | PASS |
| S2 | Strainer fouling | ON | 1.59 | 18.09 | 3 | 1 | PASS |
| S3 | Rising temperature | ON | 1.54 | 15.07 | 21 | 10 | PASS |
| S4 | Combined worst case | ON | 0.92 | 0.50 | 26 | 8 | PASS |
| S5 | Run-out | ON | 1.50 | 11.28 | 29 | 14 | PASS |
| S6 | Low-flow recirculation | ON | 2.96 | 5.00 | 2 | 0 | PASS |
| S7 | Air ingestion / vortex | ON | 1.53 | 0.50 | 16 | 3 | PASS |
| S8 | Tank depletion | ON | 0.92 | 0.50 | 26 | 8 | PASS |
| S9a | Valve stuck closed | ON | 1.68 | 5.00 | 1 | 0 | PASS |
| S9b | Pressure sensor drift | ON | 2.31 | 5.00 | 2 | 0 | PASS |
| S9c | Check-valve leak | ON | 1.51 | 0.99 | 3 | 1 | PASS |
| S9d | Sensor dropout | ON | 2.59 | 5.00 | 1 | 0 | PASS |
| S10a | Water hammer 0.05 s | MANUAL | 5.19 | 4.38 | 1 | 0 | PASS |
| S10b | Water hammer 12 s | MANUAL | 2.32 | 4.07 | 1 | 0 | PASS |
| S10c | Water hammer 30 s | MANUAL | 2.31 | 3.80 | 1 | 0 | PASS |
| S12 | Noise / false alarms | ON | 2.31 | 5.00 | 2 | 0 | PASS |
| S13 | VFD speed change | ON | 1.99 | 5.00 | 2 | 0 | PASS |

S11 (RO panel) and S14/S15 (sweeps) carry no headless assertions by design; they are
exercised in the UI.

## 5. Assertion types exercised

`minR`, `minNPSHa`, `maxCI`, `maxHeadDrop`, `maxDamage`, `tankMin`, `maxTankMin`,
`maxTransitions`, `falseInjections`, `surgePeak`, `minSurgePeak`, `stateSequence`,
`advisorMessage`.

## 6. UI verification

The built app was served with `vite preview` and driven in a real browser
(Chromium via CDP) at 1440×1000 and 780×437:

- All 16 pages render without console errors.
- The Simulator runs live: baseline NPSHa 10.38 m, R 2.31, Q 360 m³/h.
- All 4 uPlot strip charts plot data; the P&ID schematic, pump artwork and gauges render.
- Arabic mode switches `dir="rtl"` and mirrors navigation/panels while keeping the
  process schematic left-to-right.
- A missing identifier in the scenario selector and a canvas colour-parsing defect
  (`var(--…)` is not valid in Canvas 2D) were found and fixed during this pass.

## 7. Known limitations

See `METHODOLOGY.md` §6 and `DECISIONS.md`. The live view advances by wall-clock
accumulation and is therefore not bit-identical to the headless runner; all reported
KPIs and assertions come from the deterministic path.
