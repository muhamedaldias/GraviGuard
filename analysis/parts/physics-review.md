# GraviGuard — Independent Physics / Correctness Cross-Check

Scope: `src/sim/*` vs `METHODOLOGY.md` (and `DECISIONS.md`). Analysis only; no source files modified.
Method: full read of every `src/sim` module + relevant UI call sites, plus numerical probes executed
with `pnpm exec vite-node` (scratch scripts in `/data/home/.hermes/cache/scratch/gg-probe{1..4}.ts`).
All file:line references verified against the working tree. Severity: **P0** = safety/correctness-critical
at defaults, **P1** = significant model/methodology deviation or wrong result in reachable configs,
**P2** = minor, latent, display-only, or cosmetic.

Headline numerical checks (probes):
- Baseline (default plant, seed 12345, 60 s, mode ON): **R = 2.30727** (analytic 2.30727) — confirms the ≈2.307 claim.
- **S10a surgePeak = 1,450,078 Pa ≈ 1.45 MPa** — confirms DECISIONS D5; equals analytic ρ·a·Q/A_t = 1025·1000·(0.1/0.0706858) to 6 digits. Assertion `minSurgePeak ≥ 1e6` passes.
- Estimator bias (noiseless): NPSHa_est − NPSHa = **+0.0318 m ≈ V²/2g = 0.03229 m**; R bias **+0.00708** — confirms candidate 1.

---

## 1. Equation-by-equation verdict table

| Eq / § | Claim (METHODOLOGY) | Verdict | Evidence (file:line) |
|---|---|---|---|
| E1 | NPSHa = (P_surf−Pv)/(ρg)+Δz−h_loss (+velocity head at flange static) | **MATCH** | Truth: `engine.ts:421` `NPSHa = H_J − K_J·V²/2g + V²/2g − PvHead`; heads incl. Patm via `network.ts:19-26`. Matches §2.4 line 99. **But** the synthesized sensor pressure deviates — see Finding 1. |
| E2 | h_loss=(K_pipe+K_fit+K_str)V²/2g, K_pipe=f·L/D | **MATCH** | `network.ts:11-16` (K = f·L/D + K_fittings + K_strainer, R_S=K/(2gA²)); junction loss `network.ts:29-33`; strainer fouling time-varying via `engine.ts:163-164`. |
| E3 | Antoine 8.07131/1730.63/233.426, mmHg×0.133322→kPa, seawater 0.981 | **MATCH** | `fluid.ts:9-10` (×133.322 Pa/mmHg ≡ 0.133322 kPa); factor `defaults.ts:11`. Probe: Pv(20 °C)=2.330 kPa, Pv(100 °C)=101.34 kPa, Pv(35 °C, seawater)=5.502 kPa. |
| E4 | R=NPSHa/NPSH3; 3 % head-drop curve | **MATCH** | R: `engine.ts:423`; curve `cavitation.ts:14-18` identical to §2.3 (0.03·e^(−8(R−1)) for R≥1; 0.03+0.97(1−e^(−((1−R)/0.25)^1.5)) for R<1). |
| E5 | Nss=N√Q/NPSH3^0.75 (US), metric=US/51.6 | **MATCH** | `pump.ts:42-50`; conversions 15850.32314 gpm/(m³/s), 3.280839895 ft/m. Probe at BEP: US 7823.2, metric 151.61, ratio exactly 51.6. "Per eye" is the caller's responsibility (single-suction reference plant). |
| E6 | Ns US radial<4000, mixed 4000–9000, axial>9000; nq radial<50, axial>100 | **MATCH** | `pump.ts:64-74` (boundaries 4000/9000 and 50/100). |
| E7 | S ≥ D(1+2.3·Fr), Fr=V/√(gD) | **MATCH** | `cavitation.ts:32-39`; applied `engine.ts:436-441` with bell velocity; AI `cavitation.ts:42-44`. |
| E8 | ΔP=ρaΔV fast; ΔH=2LΔV/(gT) slow; regime stroke<2L/a; safeStroke=10·2L/a | **MATCH / MISSING-GUARD** | Formulas exact: `engine.ts:581-597`. Guards missing: safeStroke never enforced on RECOVERY closure (Finding 5); regime test uses *configured* strokeTime, not actual valve motion (Finding N5: slew floor 0.1 s makes S10a's actual stroke 0.1 s > 2L/a=0.08 s). |
| E9 | t_aut = V_usable/Q_supplied | **MATCH** | `engine.ts:471` ((tankH−hReserve)·area)/Q_T. (KPI aggregation of it is dead — Finding 14.) |
| E10 | Check valve on source line; no backflow unless leak fault | **MATCH** | `network.ts:57-91` (Q_S≥0 unless `allowBackflow`); leak fault per D8 `network.ts:69-75`, advisor `engine.ts:621-622`. Leak-branch hydraulics deviate — Finding 8. |
| §2.1 | dt=0.01 s, UI 30 Hz, ×0.25–200, 20 ms cap, semi-implicit Euler, seeded mulberry32, pure core | **MATCH (note)** | `defaults.ts:133-134`; `worker.ts:56,59-65,73`; slider `Simulator.tsx:121-123`; PRNG `prng.ts:7-16`; dt-halving test `tests/engine.test.ts:72-86`. Note: the Q_T ODE RHS is evaluated at the *previous* step's H_J (`engine.ts:415` before `:453`) → explicit Euler, not strictly "semi-implicit" (N11); numerically adequate per the dt test. |
| §2.2 | Pv(T) w/ seawater factor; ρ constant, optional linear T correction; unit helpers | **MATCH (partial)** | `fluid.ts:8-16`, `units.ts:7-13` (all factors verified: 15850.32314, 3600, 3.280839895, 0.000145037738, 1e-5, 0.145037738, 1.34102209). Optional ρ(T) correction `fluid.ts:22-25` exists but is **never wired** (dead code, N7). |
| §2.3 | H0, NPSH3, η, P_shaft; bisection operating point; τ_Q=0.6 s; RI, AI | **MATCH** | `pump.ts:9-31` (η floor 0.05 ✓, P=ρgQH/η ✓); bisection `engine.ts:276-295`; lag `engine.ts:407-408` (exact first-order, τ=0.6 `defaults.ts:26`); RI `cavitation.ts:28-29`, AI `:42-44`. NPSH3 affinity form per D2. |
| §2.4 | H_S/H_T, R_S, R_T(θ) equal-%; junction rule; dQ_T/dt=(gA_t/L_t)(H_T−H_J−R_TQ_T²), Q_T≤Q; A_tk dh/dt=Q_refill−Q_T | **MATCH (deviations)** | `network.ts:19-26`, `valve.ts:11-17`, junction rule `network.ts:76-90`, ODE `engine.ts:453-455` (clamped 0..Q ✓), mass balance `engine.ts:469` (continuous refill per D4 ✓). Deviations: valveCv(0)=0 → R_T=∞ vs formula's Cv_max/R at θ=0 (N12, benign stricter shutoff); closed-valve transient credit (Finding 12); leak branch uses Q not Q_T (Finding 8). |
| §2.5 | Controller states/thresholds; R_est<1.6 **for ≥2 s**; R_src_est>2.0 **for ≥60 s**; hammer-safe recovery; 3 cycles/h alarm; VFD 85 % | **DEVIATION** | Threshold values all match `defaults.ts:64-86` (1.9/1.6/1.7/1.65 via holdBand 0.05/2.0/60 s/20 s dwell/3/0.85). Timing semantics deviate: ARMED→INJECTING uses time-in-ARMED (Finding 6), HOLD→RECOVERY uses time-in-HOLD (N1). `R_src_est` is fed **truth** (Finding 3). Recovery rate not checked vs safeStroke (Finding 5). Cycle alarm stale + hardcoded text (Finding 7). VFD fallback ✓ `engine.ts:400`. |
| §2.6 | σP 0.5 kPa/lag 0.2 s/12-bit; σT 0.2; σQ 1 %; σlevel 2 cm; 2oo3 median; estimator formula; τ 1 s R filter; plausibility; HF-vibration message | **DEVIATION** | σ/lag/bits/vote ✓ `sensors.ts:84-117`, `defaults.ts:87-94`, vote `:67-70`; estimator formula ✓ `sensors.ts:170`; τ=1 s ✓ `engine.ts:505-509`; plausibility 1.0 R/2 s/5 s ✓ `engine.ts:529-532` (D9). Deviations: double-counted velocity head (Finding 1), gauge hardcode (2), no ADC saturation (11), drift fault invisible (N2), HF-vibration trigger missing (N4). |
| §2.7 | CI=clip((2−R)/(2−0.6))^1.5; dD/dt=k_e(CI^2.5+0.4RI²+0.3AI²); synthetic spectrum | **MATCH** | `cavitation.ts:21-25,63-64` (R_inc 2.0/R_brk 0.6/k_e 0.002 `defaults.ts:82-84`); `vibration.ts:24-82` (shaft, vane-pass 6·N/60, 2–20 kHz hump, LF recirculation). "2×" implemented as 2×vane-pass (`vibration.ts:65`) — doc ambiguous. Spectrum is computed but never surfaced/used (N4). |
| Constants | G=9.80665; reference plant | **MATCH** | `types.ts:5`; `defaults.ts:6-104` (ρ 1025, T 35, Q_BEP 0.1, H_shutoff 58, kHead 1300 → H(Q_BEP)=45=H_BEP ✓, N0 1480, η0 0.82, npsh3 3.2+1.3r², suction D 0.4/L 30/f 0.018, tank 50 m³/10 m²/z_tb 10, branch D 0.3/L 40/K_open 5.7/R 50/a 1000, stroke 12 s). |

---

## 2. Candidate findings — verdicts

### 1. Estimator double-counts velocity head — **CONFIRMED (P1)**
- `engine.ts:421`: truth `NPSHa = H_J − h_J + V²/2g − PvHead` (correct per §2.4; H_J is piezometric head at the junction, so flange **static** pressure head = H_J − h_J).
- `engine.ts:480`: `P_suction_abs = (s.NPSHa + PvHead)·ρg = ρg(H_J − h_J + V²/2g)` — this is **total** pressure (static + ρV²/2), not the flange static pressure a transmitter would read.
- `sensors.ts:170`: estimator adds `V²/2g` again → `NPSHa_est = NPSHa_true + V²/2g`.
- Probe (noiseless, 60 s): bias **+0.03185 m** vs V²/2g = 0.03229 m; R bias **+0.00708** (with seed-12345 noise: +0.0322 m / +0.0090). Pressure synthesis probe: truth 109,867.7 Pa = static 109,543.1 + dynamic 324.5 Pa.
- The estimator formula itself matches §2.6 exactly; the bug is in the sensor-truth synthesis at `engine.ts:480` (should be `(s.NPSHa + PvHead − velocityHead(s.Q,p))·ρg`). Bias scales with Q² (≈0.10 m at run-out). Systematic offset in the core measurement chain; also eats into the 1.0-R plausibility margin.

### 2. Gauge pressure hardcodes sea-level atmosphere — **CONFIRMED (P2, display-only)**
- `sensors.ts:131`: `P_suction_gauge: voted - 101325`; `params.fluid.Patm` ignored (the constant `PATM_SEA_LEVEL` at `types.ts:6` isn't even imported).
- Probe with Patm=90,000 Pa: gauge error exactly **−11,325 Pa** (= 90,000 − 101,325). Affects displayed/exported gauge pressure (`engine.ts:688` history) only; estimator uses absolute pressure, so physics/control unaffected.

### 3. True model R_src leaked to controller as R_src_est — **CONFIRMED (P1)**
- `engine.ts:537`: `R_src_est: s.R_src` where `s.R_src` is the truth computed at `engine.ts:429-431`.
- Consumed at `controller.ts:142` for HOLD→RECOVERY. METHODOLOGY §2.5 line 112 specifies `R_src_est > 2.0`.
- No source-only R estimator exists anywhere in `sensors.ts` — this is both a leak and a missing estimator. Under sensor faults the recovery decision bypasses what the controller "sees" (probe: truth R_src 2.30727 vs R_est 2.31631 at baseline; divergence grows under drift/spikes).

### 4. Feedforward "2 Hz" comment vs 100 Hz code — **CONFIRMED (P2)**
- `engine.ts:519-520` comment says "recomputed at 2 Hz"; `engine.ts:521-523`: timer += dt every step, threshold `>= 0.01` with dt = 0.01 → fires **every step (100 Hz)**. At dt=0.02 (MC/sweep) still every step. Comment/code mismatch; closed-form compute is cheap, so performance-only. (For 2 Hz the threshold would be 0.5.)

### 5. RECOVERY closure rate never checked vs surge.safeStroke — **CONFIRMED (P1)**
- `controller.ts:157`: `rate = 1/max(strokeTime·2, 1)` → closure time = max(2·strokeTime, 1 s). `engine.ts:597`: `safeStroke = 10·2L/a` is computed but **never referenced by the controller** (no other call site).
- Probe: L=400 m, a=1000 → T_wave=0.8 s, safeStroke=8 s; strokeTime=1 s → closure 2 s < 8 s → violates the E8 design rule (stroke ≥ 10·2L/a). At default L=40 m safeStroke=0.8 s and closure ≥1 s, so defaults are safe; the hazard is reachable via editable `branch.L` (>50 m) and short `valve.strokeTime`. Related: `computeSurge` uses configured strokeTime, not the actual recovery closure time (N5).

### 6. ARMED→INJECTING uses time-in-ARMED, not time-below-R_inject — **CONFIRMED (P1)**
- `controller.ts:107`: `ctx.R_est < p.R_inject && c.timer >= p.injectDelay`; `c.timer` reset only on state entry (`controller.ts:45`). No reset when R_est crosses back above R_inject.
- §2.5 line 109 requires "R_est < 1.6 **for ≥ 2 s**".
- Probe: R_est=1.85 for 5 s (ARMED), then R_est=1.5 → INJECTING after **0.01 s** below 1.6. A prediction-armed transient that briefly dips below 1.6 injects immediately.

### 7. Cycle-limit alarm never clears; "(3/hour)" hardcoded — **CONFIRMED (P2)**
- `controller.ts:109` sets `c.alarm`; the only clear is FAULT_SAFE exit (`controller.ts:177`). `cyclesInWindow` (`:48-51`) prunes old cycles but nothing clears the alarm string.
- Probe: 3 cycles at t=100/200/300, 4th attempt at t=400 → alarm set; at t=4000 (window expired) injection proceeds **with the alarm string still set** → `engine.ts:666-667` keeps re-arming the 'ctrl' alarm indefinitely.
- Text hardcodes "(3/hour)" while `maxCyclesPerHour` is configurable (`defaults.ts:78`, `types.ts:97`).

### 8. Leaking check-valve branch uses pump demand Q for branch loss — **CONFIRMED (P1)**
- `network.ts:70`: `H_J = H_T − R_T·Q·Q` with Q = pump demand. In the leak regime the tank branch actually carries Q_T = Q + |Q_S| (pump demand **plus** backflow), so the loss is understated and H_J overstated.
- Probe (default plant, tank full, θ=1, Q=0.1): code H_J = **24.499 m**, backflow **0.926 m³/s**; self-consistent solution (bisection on H_J = H_T − R_T(Q+√((H_J−H_S)/R_S))²) gives H_J = **13.051 m**, backflow **0.355 m³/s** — backflow overestimated **2.6×**.
- Companion inconsistency (N8): tank mass balance (`engine.ts:469`) drains at Q_T≈Q while the true branch outflow is Q+|Q_S|; the Q_T ODE also relaxes toward Q, not Q+backflow. S9c assertions are calibrated against this overstated leak.

### 9. computeThetaForTarget divides by log(branch.R) without guard — **PARTIALLY CONFIRMED (P2)**
- `engine.ts:381`: `theta = 1 − log(RT/RTopen)/(2·log(p.branch.R))`. No guard on R.
- Probe: **R=1 → theta=0, NOT NaN** in the generic case: RT>RTopen (guaranteed by the `HJreq >= HJmax → return 1` guard at `:379`) gives +∞/0 → −∞ → clamped to 0 by `:382`. NaN arises only if RT rounds exactly to RTopen (0/0), or for **R<0** (log of negative → NaN, confirmed by probe: R=−1 → NaN), which then propagates through `thetaCmd`/`moveValve` into state. R=0.5/0 → clamped 1.
- Verdict: missing-guard is real (division by zero / NaN for R≤0, silent wrong answer at R=1), but the candidate's specific "R==1 → NaN" mechanism is refuted for the generic case. Latent: default R=50 (`defaults.ts:56`), R editable.

### 10. Surge limit hardcoded 0.5e6 Pa — **CONFIRMED (P2)**
- `engine.ts:596`: `limit: 0.5e6`; no plant parameter exists (`SurgeInfo.limit` `types.ts:207` is only ever set here). Duplicated as literal `500000` in `TransientsPage.tsx:52,57`.

### 11. quantize has no full-scale saturation — **CONFIRMED (P2)**
- `sensors.ts:53-59,105`: `FULL_SCALE_PA=200000`, `Math.max(0,v)` clamps only the low side; values >200 kPa quantize beyond ADC range.
- Probe (MANUAL θ=1, 40 s): true suction pressure **244.0 kPa**, sensor reports **244.1 kPa > 200 kPa full scale**. During normal GraviGuard injection the modeled transmitter is therefore operating out of range with no saturation flag — unrealistic sensor behavior exactly in the demo's headline operating condition. Estimator/control unaffected (they consume the same value).

### 12. Closed-valve Q_T decay still credited as junction supply — **CONFIRMED (P2)**
- `engine.ts:450-451`: θ≤1e-6 → `Q_T *= (1−2dt)` (arbitrary 2/s rate, not the inertia ODE); `solveJunction` at `engine.ts:415` still receives the decaying Q_T and computes `Q_S = Q − Q_T` (`network.ts:85`).
- Probe (MANUAL 1→0): after θ reaches 0, Q_T = 0.0097→0.0003 m³/s over ~1.8 s while `checkValveOpen=true` and Q_S = Q−Q_T — a fully closed branch credited with up to ~10 % of demand. Small, short-lived transient inconsistency; the 2/s rate is unphysical (with R_T=∞ the ODE branch would stop flow essentially instantly).

### 13. reset() leaves thetaTarget/thetaTargetTimer/lastSpectrum — **CONFIRMED (P2, negligible impact)**
- `engine.ts:717-731`: resets rng/ctrl/sensors/hist/nEff/R_est_prev/slopeFilter/alarmActive/plausTimer/state, but not `thetaTarget`, `thetaTargetTimer`, `lastSpectrum` (fields at `:71-73`). Probe confirms all three persist.
- Impact is minor: the timer accumulates every step (`:521`), so on the first INJECTING/HOLD step after reset the feedforward is recomputed before `updateController` runs; stale `thetaTarget` can only be used for one step if reset lands mid-cycle with dt<0.01. `lastSpectrum` feeds only the dead `getHfRms` path (N4). Also not reset: `recordInterval` if previously changed by `run()` (N10).

### 14. minAutonomy KPI is dead (always 0) — **CONFIRMED (P2)**
- `scenario.ts:142` initializes `minAutonomy = Infinity`; the sample loop `:144-153` never updates it (`HistorySample` has no autonomy field, `types.ts:260-283`); `:175` maps non-finite → **0**.
- Additionally, no UI page reads `minAutonomy` (grep: only `scenario.ts`). Dead KPI end-to-end; E9 autonomy is computed in state (`engine.ts:471`) but never recorded.

### 15. 'custom' assertion silently auto-passes — **CONFIRMED (P1, latent today)**
- `scenario.ts:348-349`: `default:` returns `passed: true, actual: 'not evaluated'`. `'custom'` (declared `types.ts:325`, documented METHODOLOGY §3 line 168) has no case; **any unknown/typo assertion type also auto-passes**.
- `run.passed` (`scenario.ts:414`) and the CI gate `tests/scenarios.test.ts:47` trust these results. Probe of all 21 pack files: none currently uses `custom` → latent trap for future scenario authors, not an active false-pass.

### 16. Dead controls/fields — **CONFIRMED (P2)**
- `ControllerParams.Kp` (`types.ts:94`, `defaults.ts:75`): exposed as a slider at `ControllerPage.tsx:124-125`, but `controller.ts` reads only `Ki` (`:126`). Dead control — moving the slider does nothing.
- `tripOnFault` (`types.ts:100`, `defaults.ts:81`): grep — declaration/default only, never read.
- `SensorFaults.valveStuck` (`types.ts:112`, `defaults.ts:100`): never read; the actual valve-stuck path is `p.valve.stuck` / `inputs.valveStuck` (`engine.ts:518,662`). Dead duplicate field.
- `MCParams.varyStroke` (`sweep.ts:12`): never read; `strokeTime` is varied unconditionally (`sweep.ts:47`).
- `ScenarioEvent.ramp` (`types.ts:308`): never read; `Timeline` (`scenario.ts:66-101`) interpolates between keyframes only.

### 17. units.ts pressure formatting dead branch — **CONFIRMED (P2)**
- `units.ts:84-87`: the `abs >= 100000` branch and the fallthrough return are byte-identical (both kPa/1000, 2 decimals). Presumably intended bar (or different decimals) above 100 kPa. Cosmetic.

### 18. Prototype-pollution gadgets in dotted-key assignment — **CONFIRMED as gadgets; reachability LATENT (P2)**
- `worker.ts:148-163` (`defaultParamsWith`): walks arbitrary paths with no validation. Probes (isolated process): `__proto__.ggPolluted` **pollutes Object.prototype**; also the 3-level `constructor.prototype.ggPolluted2` works (no existence check at all) — broader than the candidate's 2-level claim.
- `scenario.ts:40-52` (`applyParam`): the `obj[last] === undefined` check (`:50`) passes for **existing** prototype properties: probe `applyParam(p, '__proto__.toString', 5)` succeeded and replaced `Object.prototype.toString` with a number (restored in-probe). Unknown keys (`__proto__.x`) throw and are swallowed by `runScenario` (`:383-388`).
- Reachability audit: scenarios are fetched only from same-origin static files (`Simulator.tsx:49-51`, `ScenariosPage.tsx:22-24`, `TourPage.tsx:70` → `./scenarios/*.json`); **no `JSON.parse`, file input, or paste feature anywhere in `src/`** (grep). No untrusted input path today → defense-in-depth fix, not an active vulnerability. Side note: the worker silently accepts unknown dotted keys that headless `applyParam` rejects → live/headless parameter-binding divergence for malformed keys.

### 19. loop() outside try/catch; no worker.onerror — **CONFIRMED with mechanism correction (P2)**
- `worker.ts:50-67`: `loop()`/`stepOnce()` run on `setInterval` with no try/catch; the catch at `:141-143` wraps only `onmessage`. `client.ts:14-18` handles only `onmessage` ('snapshot'/'error'); **no `worker.onerror`**.
- Correction to the candidate: an exception in a `setInterval` callback does **not** kill the interval (HTML "report the exception" semantics) — it keeps firing and throwing every 33 ms. Net effect: snapshots stop, no 'error' message is ever posted, UI freezes silently (console-only errors). Any malformed `params` message (see 20) or future NaN/undefined bug in `stepOnce` triggers this failure mode.

### 20. Unvalidated worker message payloads — **CONFIRMED with nuance (P2)**
- `worker.ts:133`: `speed = msg.speed` unvalidated. NaN → `acc` NaN → zero steps (frozen sim, snapshots continue); negative → acc drains → no steps; Infinity → bounded by the 20 ms budget + 20,000-step cap + acc reset (`:59-65`), so speed alone cannot block indefinitely. UI slider clamps 0.25–200 (`Simulator.tsx:121-123`), so latent via UI.
- `worker.ts:127-128`: `n = Math.round(msg.seconds/0.01)` unbounded — a large `seconds` blocks the worker synchronously (UI only ever sends 1 s, `Simulator.tsx:75`).
- `worker.ts:98`: `engine.params = msg.params` — no shape validation (a partial object crashes `stepOnce` → failure mode 19). Note: `postMessage` already structured-clones, so aliasing itself is not the risk; missing validation is. The `init` path (`:88`) does clone via the engine constructor.

---

## 3. New findings (not in the candidate list)

### N1. HOLD→RECOVERY dwell has the same timer-semantics bug as Finding 6 — **P1**
`controller.ts:142`: `ctx.R_src_est > p.R_recover && c.timer >= p.recoverTime` — `c.timer` is time since HOLD **entry**, never reset when R_src dips below 2.0. §2.5 requires ">2.0 **for ≥60 s**". Probe: 30 s at R_src=2.5, a 1 s dip to 1.9, then 31 s more → RECOVERY fires although the condition was never sustained 60 s. (INJECTING→HOLD does reset its timer correctly, `controller.ts:134` — the other two transitions don't.)

### N2. Pressure-drift fault is invisible end-to-end — **P1**
Drift is added to sensor 0 only (`sensors.ts:86`); the 2oo3 **median** (`:110`) rejects a single drifting sensor; `healthy` ignores drift (`:127`, only stuck/dropout); the plausibility check compares voted (drift-free) R_est vs truth. Probe: 30 kPa drift → voting [139.8, 109.9, 109.8] kPa, ΔR_est = 0.0007 (noise only), healthy=true, zero alarms. §2.6 lists drift as a fault and claims disagreement drives sensor health — for drift this can never happen (30 kPa ≈ 0.66 R even if it passed the vote, below the 1.0 threshold). The Simulator's drift button (`Simulator.tsx:207-208`) therefore demonstrates nothing. Needs per-sensor deviation monitoring or 2-of-3 drift to be observable.

### N3. P_discharge synthesized from Patm instead of suction pressure — **P2**
`engine.ts:481`: `P_discharge = Patm + ρg·H_pump`. Pump head is differential, so physically `P_discharge_abs = P_suction_abs + ρg·H_pump`. Probe: error **−8.6 kPa** at baseline, **−142.8 kPa (−1.43 bar)** during full injection. Display/history only (`sensors.ts:132` passes truth through; not used by physics/control), but the discharge gauge is materially wrong exactly when GraviGuard is injecting.

### N4. HF-vibration "possible non-NPSH mechanism" trigger missing; spectrum dead — **P2**
§2.6 line 128-129: rising HF vibration while R looks healthy should trigger the message. `engine.getHfRms()`/`getSpectrum()` (`engine.ts:242-251`) have **zero callers** outside engine.ts (grep across src/tests/scripts); no page renders a spectrum. The 'disagreement' advisor ("Possible non-NPSH mechanism…", `en.json:343`) is triggered by estimator/model discrepancy (`engine.ts:627`), not vibration. The §2.7 spectrum machinery (`vibration.ts:40-100`) is implemented but never surfaced.

### N5. Slew-rate floor contradicts configured fast strokes; surge pane uses configured, not actual, closure time — **P2**
`valve.ts:34`: `slewRate = 1/max(strokeTime, 0.1)`. S10a sets strokeTime=0.05 s, but the valve physically moves in **0.1 s** (probe) > 2L/a = 0.08 s — i.e. the "fast" case is actually in the slow-closure regime, while `computeSurge` (`engine.ts:585-588`) classifies by the configured 0.05 s and the scenario text claims "opened in 0.05 s". The reported 1.45 MPa is a what-if Joukowsky estimate (no MOC solver, per §6), so the KPI still passes, but regime labeling is inconsistent with actual motion. Similarly, during RECOVERY the actual closure takes max(2·strokeTime, 1 s) (`controller.ts:157`) while the surge pane keeps showing estimates for `strokeTime`.

### N6. Simulator fault toggles are broken (UI-adjacent) — **P2**
`Simulator.tsx:206`: valve-stuck toggle sends `value: !s?.controller.name` — a non-empty state name always negates to **false**, so the fault can never be enabled from the UI. Drift/dropout/CV-leak toggles (`:207-212`) always send fixed ON values with `active={false}` — one-way, cannot be cleared, and the active indicator never reflects state.

### N7. Dead exports / unwired optional model — **P2 (info)**
`densityWater` (`fluid.ts:22`, the §2.2 "optional linear temperature correction" — never called, ρ is always `p.fluid.rho`), `altitudeFromPressure` (`fluid.ts:33`), `pitDensity` (`cavitation.ts:68`), `boundedGaussian`/`hashSeed` (`prng.ts:38,46`), `PATM_SEA_LEVEL` (`types.ts:6`). Also: random spikes (`sensors.ts:88`) are not scaled by `noiseScale`, so "noise off" still spikes.

### N8. Leak-fault tank mass balance understates drawdown — **P2** (companion to Finding 8)
During backflow the tank branch carries Q+|Q_S| (probe: 0.455 m³/s) but `engine.ts:469` drains the tank at Q_T (≈Q=0.1) and the ODE (`:453`) relaxes Q_T toward Q. Autonomy/tank-level KPIs during S9c are optimistic.

### N9. KPI truncation caps — **info**
`controller.ts:42`: transitions capped at 400 → `maxTransitions`/`stateSequence` KPIs undercount on long/chattering runs. `engine.ts:705`: history capped at 72,000 samples (2 h at 0.1 s) → KPIs silently computed on a trailing window for longer runs.

### N10. reset() keeps run()-modified recordInterval — **info**
`engine.ts:710` mutates `recordInterval`; `reset()` (`:717-731`) doesn't restore it.

### N11. "Semi-implicit Euler" is explicit for the Q_T ODE — **info**
The ODE RHS uses H_J solved from the previous step's Q_T (`engine.ts:415` → `:453`). Terminology deviation from §2.1; the dt-halving convergence test (`tests/engine.test.ts:72-86`) passes, so numerics are adequate at dt=0.01.

### N12. valveCv(0)=0 vs documented equal-% formula — **info**
`valve.ts:6` returns Cv=0 at θ=0 (→ R_T=∞, positive shutoff), while §2.4's `Cv=Cv_max·R^(θ−1)` gives Cv_max/R at θ=0 (finite leakage). Benign stricter interpretation; also the reason Finding 12 needs the special-case decay branch at all.

---

## 4. Severity rollup

| Severity | Items |
|---|---|
| P0 | none (no safety-critical failure at default parameters) |
| P1 | #1 estimator double-count, #3 R_src truth leak, #5 unguarded recovery closure, #6 inject-delay semantics, #8 leak-junction hydraulics (2.6×), #15 silent assertion auto-pass (latent), N1 recovery-delay semantics, N2 invisible drift fault |
| P2 | #2, #4, #7, #9 (missing guard; NaN claim corrected), #10, #11, #12, #13, #14, #16, #17, #18 (latent), #19, #20, N3–N8 |
| info | N9–N12 |

## 5. Probe artifacts
- `gg-probe1.ts`: baseline R/bias, pressure synthesis, Patm gauge, ADC saturation, drift no-op, reset leftovers, theta(R∈{1,0.5,0}), Antoine anchors.
- `gg-probe2.ts`: S10a headless run, ARMED/HOLD timer semantics, stale cycle alarm, recovery vs safeStroke, leak junction (first pass), closed-valve transient (first pass), pollution gadgets.
- `gg-probe3.ts`: leak junction bisection (corrected), closed-valve transient (full), theta(R=−1)→NaN, noiseless bias, Nss ratio, P_discharge error.
- `gg-probe4.ts`: 21-scenario pack audit (no `custom` assertions; only S11 has non-dotted metadata keys `roFeedBar/roLiftBar/roRampBarS`, ignored consistently by both runners).
