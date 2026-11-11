# GraviGuard — Methodology & Assumptions

This document is the model reference behind the in-app **Methodology** page. It covers
the engineering ground truth (plan Section 2), the simulation model (plan Section 4),
the scenario schema, the unverified parameters, and the model limits.

> **Synthetic data statement.** Every plant, pump, sensor and result in this platform is
> synthetic and deterministic (seeded). Identical seed and parameters give bit-identical
> headless results. The platform demonstrates a concept; it is **not** a design or sizing
> tool for real plants, and no real-plant, vendor, or Saudi Water Authority (SWA) data is
> used or implied.

---

## 1. Engineering ground truth

| ID | Item | Formula / rule |
|---|---|---|
| E1 | NPSHa (open source) | `NPSHa = (P_surface − P_v)/(ρg) + Δz − h_loss` (+ inlet velocity head if the flange static pressure is used). 10.2 m water ≈ 1 bar. |
| E2 | Suction loss | `h_loss = (K_pipe + K_fittings + K_strainer(t))·V²/(2g)`, `K_pipe = f·L/D` |
| E3 | Vapour pressure | Antoine (water, 1–100 °C): `log10 P[mmHg] = 8.07131 − 1730.63/(233.426 + T)`; ×0.133322 for kPa; seawater factor 0.981 (≈ −2 %) |
| E4 | Margin ratio | `R = NPSHa / NPSH3`. 3 % head drop is by definition at R = 1. Incipient cavitation occurs at R > 1, often about 2 or more. Margin tables: ANSI/HI 9.6.1 **[VERIFY]**. |
| E5 | Suction specific speed | `Nss = N·√Q / NPSH3^0.75` (US: rpm, gpm per eye, ft). Metric = US / 51.6. 8500 (US) ≈ 165 metric is a design guideline; ~11000 is the HI upper bound. **Not a cavitation threshold.** |
| E6 | Specific speed Ns | US (gpm, ft): radial ≈ 500–4000, mixed 4000–9000, axial > 9000. Metric nq: radial ≈ 10–50, axial > ≈ 100. |
| E7 | Vortex / air ingestion | `S ≥ D(1 + 2.3·Fr)`, `Fr = V/√(gD)` (ANSI/HI 9.8). Air ingestion is not fixed by GraviGuard. |
| E8 | Water hammer | `ΔP = ρ·a·ΔV` for valve motion faster than `2L/a`; otherwise `ΔH ≈ 2L·ΔV/(g·T)`. Design rule: stroke ≥ 10·2L/a, rate-limited. |
| E9 | Tank autonomy | `t_aut = V_usable / Q_supplied`. The tank covers transients, not continuous duty. |
| E10 | Check valve | Required on the source line, otherwise lifted water flows back to the source. |
| E11 | Mechanism classification | Vapour cavitation, air ingestion and recirculation are three different mechanisms with different remedies. The advisor only claims a fix for NPSH-limited vapour cavitation. |
| E12 | Damage location | Educational glossary only (marine propellers: suction face; wet liners: outer coolant side). |
| E13 | RO membranes | A 0.3–0.5 bar lift on ~65 bar is < 1 %. The hazard is the ramp rate; vendors state a maximum (order of 0.7 bar/s) **[VERIFY]**. |

---

## 2. Simulation model

### 2.1 Numerics

- Fixed physics step `dt = 0.01 s` in a Web Worker; UI snapshot at 30 Hz.
- Speed ×0.25 … ×200 by running multiple physics steps per frame, compute capped at
  ~20 ms per frame.
- Integrator: semi-implicit Euler for the line-inertia ODE; monotone bisection for the
  junction head. Convergence: halving `dt` changes key outputs by < 0.5 %
  (`tests/engine.test.ts`).
- Seeded PRNG (mulberry32); the seed is shown in the UI and exported with every run.
  Identical seed + parameters give bit-identical results in the headless runner.
- The core (`src/sim/*`) is pure TypeScript with no DOM access.

### 2.2 Fluid module

`Pv(T)` via E3 with the seawater factor; `ρ` constant by default with an optional linear
temperature correction. Unit helpers cover m, bar, kPa, psi, ft, gpm, m³/h, °C/°F with
an SI/US toggle.

### 2.3 Pump module

```
H0(Q, n)      = (H_shutoff − kHead·(Q/n)²)·n²
NPSH3(Q, n)   = (npsh3a + npsh3b·(Q/Q_BEP)²)·n²
η(Q)          = max(0.05, η0·(1 − 0.9·(Q/Q_BEP − 1)²))
P_shaft       = ρgQH/η
```

Operating point: solve `H0(Q,n)·(1 − drop(R)) = H_static + k·Q²` by bisection; the flow
follows with a first-order lag `τ_Q = 0.6 s`.

Head-drop function (R = NPSHa/NPSH3):

```
R ≥ 1:  drop = 0.03·exp(−8·(R − 1))
R < 1:  drop = 0.03 + 0.97·(1 − exp(−((1 − R)/0.25)^1.5))
```

Recirculation index `RI = clip((0.6 − Q/Q_BEP)/0.3, 0, 1)` (a separate mechanism, never
reduced by GraviGuard). Air index `AI = clip((S_min − S)/S_min, 0, 1)`.

### 2.4 Suction network and tank

Heads are measured relative to the pump axis. Two parallel suppliers feed a junction J:

```
H_S = Patm/(ρg) + z_level                     (source branch)
H_T = Patm/(ρg) + z_tb + h_tank               (tank branch)
R_S = (f·L/D + K_fittings + K_strainer)/(2gA²)
R_T(θ) = R_T,open · (Cv_max/Cv(θ))²           (equal-percentage, Cv = Cv_max·R^(θ−1))
```

The junction head `H_J` is solved each step with a monotone branch rule: if the tank can
supply the whole demand at a head above the source, the check valve is shut and the tank
sets `H_J`; otherwise the source sets it and the tank makes up the difference. The tank
branch flow `Q_T` is a state with line inertia

```
dQ_T/dt = (g·A_t/L_t)·(H_T − H_J − R_T·Q_T²),   Q_T ≤ Q
```

and the tank mass balance is `A_tk·dh/dt = Q_refill − Q_T`.

NPSHa (truth): `NPSHa = H_J − h_J + V²/2g − Pv/(ρg)`, with `h_J = K_J·V²/2g`.

### 2.5 Controller

States: `IDLE → ARMED → INJECTING → HOLD → RECOVERY → REFILL → IDLE`, plus `MANUAL` and
`FAULT_SAFE`. Thresholds (all configurable):

| Transition | Condition |
|---|---|
| IDLE → ARMED | `R_est < 1.9` or predicted `R(t + T_pred) < 1.6`, `T_pred = T_stroke + 10 s` |
| ARMED → INJECTING | `R_est < 1.6` for ≥ 2 s, sensors healthy, tank above reserve |
| INJECTING | feedforward + integral trim to hold `R_target = 1.7` |
| INJECTING → HOLD | `R_est ≥ 1.65` stable for 10 s |
| HOLD → RECOVERY | `R_src_est > 2.0` for ≥ 60 s |
| RECOVERY | ramp the valve closed at a water-hammer-safe rate |
| any → FAULT_SAFE | sensor failure, valve fault, or tank at reserve |

Anti-chatter: 20 s minimum dwell per state, hysteresis bands, max 3 injection cycles per
hour (alarm if exceeded). The fallback on fault is a VFD speed reduction to 85 %.

### 2.6 Sensors and estimator

Sensors: suction pressure (σ 0.5 kPa, lag 0.2 s, 12-bit), temperature (σ 0.2 °C), flow
(σ 1 %), source level (σ 2 cm), strainer ΔP, tank level, valve position, accelerometer.
Faults: drift, stuck, dropout, spikes. Three pressure transmitters feed a 2-out-of-3
median vote.

Estimator: `NPSHa_est = (P_s,abs − Pv(T_meas))/(ρg) + V_meas²/2g`, `NPSH3_est` from the
stored curve, `R_est` filtered (τ 1 s). A sustained disagreement between `R_est` and the
model-based R drives the sensor-health flag; high-frequency vibration rising while R
looks healthy triggers the "possible non-NPSH mechanism" message.

### 2.7 Cavitation, damage and vibration

```
CI = clip((R_inc − R)/(R_inc − R_brk), 0, 1)^1.5,  R_inc = 2.0, R_brk = 0.6
dD/dt = k_e·(CI^2.5 + 0.4·RI² + 0.3·AI²)        (normalised, illustrative)
```

Synthetic vibration: broadband RMS plus a spectrum with shaft frequency, vane-pass
(6·N/60), 2×, a 2–20 kHz cavitation hump and low-frequency recirculation modulation.
It is a secondary confirmation only and never the primary trigger.

---

## 3. Scenario schema

```jsonc
{
  "id": "S1",
  "name": "Tidal drawdown", "nameAr": "…",
  "description": "…", "descriptionAr": "…",
  "tags": ["tide"],
  "duration": 3600,          // simulated seconds
  "seed": 1001,
  "mode": "ON",             // OFF | ON | AB | MANUAL
  "params": { "tank.V_usable": 200 },   // static plant overrides (dotted keys)
  "timeline": [ { "t": 0, "param": "z_level", "value": 1.0 } ],
  "assertions": [
    { "id": "s1-minR", "type": "minR", "value": 1.5 },
    { "id": "s1-tank", "type": "tankMin", "value": 8.0 }
  ],
  "expected": { "on": "…" }
}
```

Timeline interpolation is linear between keyframes and holds at the ends. Assertion
types: `minR`, `minNPSHa`, `maxCI`, `maxHeadDrop`, `maxDamage`, `tankMin`, `maxTankMin`,
`maxTransitions`, `falseInjections`, `surgePeak`, `minSurgePeak`, `stateSequence`
(ordered subsequence), `advisorMessage`, `custom`.

The scenario pack lives in `public/scenarios/` (21 JSON files) and is generated by
`scripts/generate-scenarios.ts`.

---

## 4. Unverified parameters [VERIFY]

| Parameter | Status |
|---|---|
| ANSI/HI 9.6.1 margin factors | Exact values not confirmed from a primary source; defaults are configurable. |
| RO membrane ramp limit (~0.7 bar/s) | Must be confirmed with DuPont / Hydranautics / Toray guidance. Shown as a red limit line labelled `[VERIFY]`. |
| Patent search | The potential novelty is the specific mechanism (dynamic NPSHa lift via elevated tank + valve). A patent search is still required. |
| SWA / vendor data | No real plant, vendor, or SWA data is used or implied. |

---

## 5. References

- ANSI/HI 9.6.1 — Rotodynamic Pumps: Guideline for NPSH Margin
- ANSI/HI 9.6.3 — Rotodynamic Pumps: Guideline for Operating Regions
- ANSI/HI 9.8 — Rotodynamic Pumps: Intake Design
- ANSI/HI 6.6 — Rotodynamic Pumps: Pump Pipe Connection
- DuPont / Hydranautics / Toray — RO system design guidance (ramp-rate limits)

---

## 6. Model limits

- Steady-state plus lumped-inertia hydraulics; no method-of-characteristics surge solver
  in phase 1.
- The damage index is illustrative and normalised; it is not a life prediction.
- Synthetic vibration is a secondary confirmation signal, never the primary trigger.
- The tank covers transients, not continuous duty (E9).
- The platform demonstrates a concept; it is not a design or sizing tool for real plants.
