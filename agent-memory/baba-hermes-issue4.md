---
agent: hermes
machine: baba
issue: 4
branch: work/issue-4-sensor-synthesis
status: in-progress
updated: 2026-11-20T00:18:00Z
---

# Understanding
Issue #4 (P1-1): sensor/estimator synthesis correctness. Scope (hard): src/sim/sensors.ts,
src/sim/engine.ts sensor synthesis block ~477-515 ONLY, tests/sensors.test.ts (new),
public/scenarios/S9b.json (assertions only). METHODOLOGY.md doc note is explicitly
requested by the issue ("document it in METHODOLOGY"); §2.6 is the place. Forbidden:
pages/components/i18n/package.json/CI; types.ts NOT owned → extend Measurement via
`SensorMeasurement extends Measurement` in sensors.ts (structural subtype assigns fine
to SimState.sensors). Branch from origin/main a7072ff (issue #3 PR #9 not merged yet;
file sets are disjoint — no conflict).
Confirmed bugs: (1) P_suction_abs=(NPSHa+PvHead)ρg includes velocity head; estimator
re-adds V²/2g → +0.032 m bias. (2) P_discharge=Patm+ρgH_pump ignores suction → −143 kPa
error while injecting. (3) gauge hardcodes −101325. (4) no ADC upper saturation.
(5) drift on sensor 0 isolated by vote → invisible (S9b proves nothing).
Key facts: velocityHead uses suctionArea=π/4·D² — SAME area as estimator → static
convention cancels exactly. Controller: !sensorsHealthy → FAULT_SAFE (VFD 0.85 fallback,
plant keeps running; thetaCmd 0; alarm 'Sensor fault detected — fail-safe active';
advisor id 'fault'). Only S9b uses pressureDrift. S12 noise σ×2 for 1 h must stay
healthy (threshold 10 kPa ≈ 10σ sustained 2 s — spike-safe: 25 kPa spikes attenuated
~1.2 kPa by 0.2 s lag, decay fast). Quantization: 12-bit step 48.8 Pa; AC1 1e-6 m needs
quantBits 24 in the noiseless test (half-step 0.006 Pa → 5.9e-7 m < 1e-6).

# Decisions & why
- Convention: P_suction_abs = STATIC flange pressure = (NPSHa + PvHead − velocityHead)·ρg.
  Estimator unchanged (adds V_meas²/2g — correct for static pressure). Document §2.6.
- P_discharge (measured) = voted + ρg·H_pump → AC2 identity EXACT (both from voted).
  SensorTruth gains H_pump, rho, Patm (interface lives in sensors.ts — owned).
- gauge = voted − truth.Patm (configurable atmospheric).
- ADC: clamp raw to [0, FULL_SCALE_PA=200000] before quantize; export FULL_SCALE_PA.
- Drift observability: per-sensor deviation flag. SensorState += devTimer[3];
  |s.p[i] − voted| > 10000 Pa sustained ≥ 2.0 s → pressureDeviation[i]=true;
  healthy = !(stuck||dropout) && no deviation. Keeps S9b narrative (vote still isolates
  drift; plant keeps running in FAULT_SAFE fallback) while making the fault observable.
  Exposed via SensorMeasurement extends Measurement { pressureDeviation: [b,b,b] }.
- S9b assertions (lead applies after implementation): keep existing 3; add
  stateSequence ['FAULT_SAFE'] + advisorMessage ['fault']. Predicted KPIs: 1 transition,
  minR ≈ 3.7 at n=0.85 (NPSH3 2.79, NPSHa 10.45), falseInjections 0.
- Delegation: child A = sensors.ts + engine block + tests/sensors.test.ts (TDD);
  child B = METHODOLOGY §2.6 note + isolated pre-change S9b probe (copies src to
  scratch so A's edits can't corrupt the probe). Lead: S9b JSON, full suite,
  baseline R probe, diff review, PR.

# Files changed
(planned)
- src/sim/sensors.ts — static convention support, saturation, gauge, deviation flags.
- src/sim/engine.ts — sensor block only (~477-501): P_suction_abs static, P_discharge
  across pump, truth += H_pump/rho/Patm.
- tests/sensors.test.ts — new (AC1-AC5 unit + headless S9b + baseline R).
- public/scenarios/S9b.json — assertions only (lead).
- METHODOLOGY.md — §2.6 convention note (child B).
- agent-memory/baba-hermes-issue4.md — this file.

# Tests & evidence
- Delegation budget exhausted (2/2 one-shot children used on issue #3) → issue #4
  implemented by lead directly, TDD.
- Pre-change probe (scratch/s9b-pre-probe.ts → s9b-pre-change-evidence.txt):
  S9b 1800 s: healthy=true throughout, controller IDLE, advisor 'ok', alarms [],
  maxVotingDev 31252 Pa, estBias +0.0357 m → drift INVISIBLE (bug confirmed).
- RED: `pnpm exec vitest run tests/sensors.test.ts` → Tests 9 failed | 3 passed (12);
  failures for the right reasons (missing exports, no FAULT_SAFE, bias, gauge).
- GREEN: `pnpm exec vitest run tests/sensors.test.ts tests/engine.test.ts` →
  Test Files 2 passed; Tests 35 passed (sensors 12, engine 23).
- Post-change probe (s9b-post-change-evidence.txt): S9b stateSequence [ARMED,
  FAULT_SAFE], advisorIds ['ok','fault'], transitions 2, minR 2.3073, falseInj 0;
  direct run: healthy=false, controller FAULT_SAFE, alarm 'ctrl', R 3.743 (VFD 0.85
  fallback), R_est−R 0.0013 (noise/quantization only).
- Full suite: `pnpm test` → Test Files 7 passed (7); Tests 84 passed (84); 39.06s.
  All 18 scenarios PASS incl. S9b with new assertions; S12 (1 h, σ×2) trans=2 false=0.
  Calibration: S0 minR=2.31; S9b minR=2.31 trans=2 cycles=0 false=0.
- `pnpm typecheck` → exit 0. `pnpm build` → ✓ built in 1.38s.
- AC5 baseline R: initial 2.307273; 60 s run |R−2.30| ≤ 0.01 (unit test).
- AC1 noiseless (σ=0, lag 0, 24-bit): |NPSHa_est − NPSHa| < 1e-6 after 30 s.
- AC2 identity every step, steady 10 s + injecting 120 s (z_level −3): max err < 1e-6 Pa.
- AC3 Patm 90 kPa: gauge == abs − 90000 every step (unit + engine).

# Open issues
- SensorTruth.P_discharge is now unused by updateSensors (discharge synthesized from
  voted + ρgH); kept in the truth record for completeness — harmless.
- Two sensors drifting identically would move the median together (no deviation flag);
  large bias still caught by the R_est-vs-R plausibility timer. Not in scenario pack.
- Deviation threshold 10 kPa / hold 2 s are synthetic constants (documented §2.6);
  real-plant tuning would need [VERIFY] treatment per repo convention.
- dist/ build artifacts restored, NOT committed (P1-8 owns dist hygiene).

# Handoff
Children A/B in flight per contract. Next: lead applies S9b assertions, runs full
suite + baseline R probe (2.30 ± 0.01), reviews diffs, commits, pushes, PR
"issue-4: sensor estimator synthesis correctness", issue comment, finalize memory.
