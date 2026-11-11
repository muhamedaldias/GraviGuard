# GraviGuard — DECISIONS

This file records every decision taken where the Master Implementation Plan (v1.0) was
silent, ambiguous, or where the implemented model drifted from the plan's indicative
numbers. Per Section 0.4, decisions are recorded here; per Section 5, scenario
parameters were recalibrated (never the physics) when the model drifted.

---

## D1. Plan sections referenced but not supplied

The plan references Section 10 (scenario schema), Section 12.4 (UI disclaimer),
Section 13 (milestone order) and Section 16 (defaults), which were not present in the
document provided. Decisions:

- **Scenario schema** was designed in `src/sim/types.ts` (`Scenario`, `ScenarioEvent`,
  `Assertion`) and documented in `METHODOLOGY.md`.
- **Milestone order** was implemented as: (1) simulation core + tests, (2) scenario
  pack + runner, (3) i18n catalogue, (4) UI shell + simulator, (5) secondary pages,
  (6) documentation + build verification.
- **Defaults** are the Reference Plant values from Section 3, hard-coded in
  `src/sim/defaults.ts`.

## D2. NPSH3 affinity expression

Section 4.3 writes `NPSH3(Q,n) = (3.2 + 1.3·(Q/Q_BEP·n)²)·n²`, which is dimensionally
ambiguous and would scale as n⁴ at fixed Q. The implemented and validated form is

```
NPSH3(Q, n) = ( npsh3a + npsh3b·(Q/Q_BEP)² ) · n²
```

This reproduces the plan's own anchors (4.5 m at BEP and n = 1; ≈5.3 m at
Q = 0.126 m³/s) and the S13 speed behaviour (NPSH3 falls with n²). Verified by
`tests/pump.test.ts`.

## D3. Tank sizing per scenario (autonomy)

The Reference Plant tank is 50 m³. At the reference flow of 0.1 m³/s its autonomy is
≈500 s (Section 2, E9: "the tank covers transients, not continuous duty"). Scenarios
whose intent is *sustained* injection therefore cannot be delivered with 50 m³:

| Scenario | Reference Plant | Implemented | Reason |
|---|---|---|---|
| S1 Tidal drawdown (20 min) | 50 m³ | **200 m³** | 20 min at ~0.1 m³/s ≈ 120 m³; 200 m³ gives < 60 % use |
| S2 Strainer fouling (30 min) | 50 m³ | **250 m³** | Sustained injection; keeps R at target |
| S3 Rising temperature (30 min) | 50 m³ | **250 m³** | Sustained injection |
| S5 Run-out (30 min) | 50 m³ | **250 m³** | Sustained injection |
| S4 / S8 | 50 m³ | 50 m³ | Intent is to *demonstrate* the autonomy limit and fail-safe |

The tank volume is a scenario parameter (`tank.V_usable`), so the Reference Plant
remains the UI default and every value stays editable.

## D4. Continuous refill during injection

The plan's refill line (0.05 m³/s from the discharge header through a throttle) is
modelled as running whenever the pump is online and the tank is below its high level,
including during injection. Blocking refill while injecting is not stated in the plan
and would double the apparent autonomy; continuous refill is the more faithful reading.
S8 still depletes the tank because the injected flow (≈0.1 m³/s) exceeds the refill.

## D5. S10 fast-stroke recalibration

Section 2 (E8) defines the Joukowsky regime as valve motion faster than `2L/a`. With
L = 40 m and a = 1000 m/s, `2L/a = 0.08 s`, so the plan's "1 s" fast case is actually
in the slow-closure regime. Section 5 (S10) therefore contradicts Section 2 (E8).
The physics (E8) was kept and the scenario parameter was recalibrated: the fast case
uses a **0.05 s** stroke, which is genuinely faster than `2L/a` and produces
ΔP ≈ 1.45 MPa. The 12 s and 30 s cases are unchanged.

## D6. Controller architecture

A plain PI on valve position (as written in Section 4.9) is unstable here because the
plant gain `∂R/∂θ` is ≈16 near the operating point and the actuator slews in 12 s.
The implemented controller is:

- **Feedforward linearisation** (closed form): the engine solves the quadratic pump
  balance for Q, derives the junction head required for the target R, and inverts the
  equal-percentage valve characteristic to a valve position.
- **Small integral trim** (Ki = 0.001) around the feedforward.
- **HOLD hysteresis** (re-entry at `R_target − 0.15`, over-injection trim at
  `R_target + 0.6`) and a minimum dwell of 20 s in every state.

This preserves the plan's state machine (IDLE → ARMED → INJECTING → HOLD → RECOVERY →
REFILL → IDLE, plus MANUAL and FAULT_SAFE) and all of its thresholds, while removing
the limit cycle.

## D7. Cavity-state thresholds

Section 4.6 names the states but only fixes NONE (R ≥ 2.0) and the 3 % head-drop point
(R = 1.0). Implemented bands (configurable in `controller.cavStateThresholds`):

| State | R band |
|---|---|
| NONE | R ≥ 2.0 |
| INCIPIENT | 1.6 ≤ R < 2.0 |
| DEVELOPED | 1.0 ≤ R < 1.6 |
| SEVERE | 0.75 ≤ R < 1.0 |
| BREAKDOWN | R < 0.75 |

## D8. Check-valve leak fault

Section 5 (S9c) requires a check-valve leak to be "flagged by source-flow reversal".
The model allows `Q_S < 0` only while the tank can actually raise the junction above
the source head; the advisor then reports `check-valve-leak` and an alarm is raised.

## D9. Plausibility / fail-safe tuning

The estimator/model discrepancy check (Section 4.8) uses a 1.0 R threshold that must
persist for 2 s and is suppressed for the first 5 s of a run. A shorter or tighter
check false-trips on legitimate fast transients (scenario starts, check-valve
switching) and would drive the controller into FAULT_SAFE immediately.

## D10. Water hammer reporting

The surge pane reports the *applicable* estimate for the current stroke time
(`dP_joukowsky` when `stroke < 2L/a`, otherwise `ρg·ΔH_slow`) alongside the raw
Joukowsky value. The S10 assertion set uses a lower bound (`minSurgePeak`) for the
fast case and an upper bound (`surgePeak`) for the slow cases.

## D11. Live determinism

The headless scenario runner is bit-deterministic for a given seed and parameter set
(verified). The live worker advances by wall-clock accumulation, so the live view is
not bit-identical to a headless run; the seed is displayed and exported, and all
reported KPIs come from the deterministic runner.

## D12. Unverified parameters

All `[VERIFY]` items from the plan are surfaced on the in-app Methodology page and in
`METHODOLOGY.md`; none is presented as fact. The RO ramp limit is drawn as a red line
at 0.7 bar/s and labelled `[VERIFY]`.
