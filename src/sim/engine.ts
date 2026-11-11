// Simulation engine (Sections 4.1-4.10).
// Pure TypeScript, no DOM access. Deterministic for a given seed + parameters.
// Fixed physics step dt = 0.01 s is the reference; the UI runs multiple steps
// per frame to achieve speed-up to x200.

import { G, PlantParams, SimInputs, SimState, HistorySample, Alarm, Advisor, SurgeInfo, CavityState } from './types';
import { defaultPlant, defaultInputs, tankLevelBounds, PHYSICS_DT } from './defaults';
import { RngStream } from './prng';
import { vaporPressurePa } from './fluid';
import { pumpHead, pumpNPSH3, pumpEfficiency, pumpPower, pumpRunoutFlow, PumpParams } from './pump';
import { valveResistance, branchArea, moveValve, slewRate } from './valve';
import {
  sourceHead,
  tankHead,
  sourceResistance,
  junctionLossHead,
  velocityHead,
  solveJunction,
  suctionArea,
} from './network';
import {
  headDropFraction,
  cavitationIntensity,
  recirculationIndex,
  minSubmergence,
  airIngestionIndex,
  cavityState,
  damageRate,
  froudeNumber,
} from './cavitation';
import { updateSensors, createSensorState, estimateNPSHa, SensorState } from './sensors';
import { createController, updateController, ControllerContext } from './controller';
import { vibrationRMS, vibrationSpectrum, Spectrum, hfRms, VibrationParams, DEFAULT_VIBRATION } from './vibration';
import { CAVITY_STATES, CTRL_STATES } from './types';

export interface OperatingPoint {
  Q: number;
  H_J: number;
  Q_S: number;
  NPSHa: number;
  NPSH3: number;
  R: number;
  headDrop: number;
  H_pump: number;
  H_system: number;
}

export interface EngineOptions {
  params?: PlantParams;
  seed?: number;
  recordInterval?: number;
}

export class SimEngine {
  seed: number;
  params: PlantParams;
  inputs: SimInputs;
  state: SimState;
  private rng: RngStream;
  private ctrl = createController();
  private sensors: SensorState = createSensorState();
  private hist: HistorySample[] = [];
  private histAccum = 0;
  private recordInterval: number;
  private nEff = 1;
  private R_est_prev: number | null = null;
  private slopeFilter = 0;
  private alarmActive = new Map<string, boolean>();
  private plausTimer = 0;
  private vibParams: VibrationParams = { ...DEFAULT_VIBRATION };
  private lastSpectrum: Spectrum | null = null;
  private thetaTarget = 0;
  private thetaTargetTimer = 0;

  constructor(opts: EngineOptions = {}) {
    this.params = opts.params ? structuredClone(opts.params) : defaultPlant();
    this.seed = opts.seed ?? 12345;
    this.rng = new RngStream(this.seed);
    this.inputs = defaultInputs(this.params);
    this.recordInterval = opts.recordInterval ?? 0.1;
    this.state = this.emptyState();
    this.initialize();
  }

  private emptyState(): SimState {
    return {
      t: 0, Q: 0, Q_S: 0, Q_T: 0, n: 1, theta: 0, tankH: 0, tankV: 0,
      H_J: 0, H_S: 0, H_T: 0, H_pump: 0, H_system: 0,
      NPSHa: 0, NPSH3: 0, R: 0, NPSHa_src: 0, R_src: 0,
      headDrop: 0, CI: 0, RI: 0, AI: 0, damage: 0, cavState: 'NONE',
      eta: 0, power: 0, valveCmd: 0, checkValveOpen: true,
      controller: this.ctrl,
      sensors: {
        P_suction_abs: 0, P_suction_gauge: 0, P_discharge: 0, Q: 0, T: 0,
        level: 0, strainerDP: 0, tankLevel: 0, valvePos: 0, vibrationRMS: 0,
        n: 1, healthy: true, voting: [0, 0, 0],
      },
      R_est: 0, NPSHa_est: 0, NPSH3_est: 0, R_slope: 0,
      alarms: [], surge: this.emptySurge(), advisor: { id: 'ok', severity: 'info', evidence: {} },
      autonomy_s: Infinity, S_min: 0, S: 0, Fr: 0, vfdSpeed: 1,
      tankReserveH: 0, tankUsableV: 0, injected: false,
    };
  }

  private emptySurge(): SurgeInfo {
    return {
      T_wave: 0, strokeTime: 12, dP_joukowsky: 0, dH_slow: 0, dP_slow: 0,
      surgePeak: 0, limit: 0, safeStroke: 0, branchVelocity: 0,
    };
  }

  private initialize(): void {
    const p = this.params;
    const { hMax, hReserve } = tankLevelBounds(p);
    this.state.tankH = hMax;
    this.state.tankReserveH = hReserve;
    this.state.tankUsableV = p.tank.V_usable;
    this.state.n = this.inputs.n;
    this.nEff = this.inputs.n;
    const op = this.operatingPoint(0, 0);
    this.state.Q = op.Q;
    this.state.Q_S = op.Q_S;
    this.state.Q_T = 0;
    this.state.H_J = op.H_J;
    this.state.H_pump = op.H_pump;
    this.state.H_system = op.H_system;
    this.state.NPSHa = op.NPSHa;
    this.state.NPSH3 = op.NPSH3;
    this.state.R = op.R;
    this.state.headDrop = op.headDrop;
    this.state.cavState = cavityState(op.R, p.controller.cavStateThresholds);
    this.state.vfdSpeed = this.nEff;
    this.state.eta = pumpEfficiency(op.Q, this.pump());
    this.state.power = pumpPower(op.Q, op.H_pump, this.pump(), p.fluid.rho);
    this.state.tankV = this.state.tankH * p.tank.area;
    this.state.surge = this.computeSurge();
    // Seed estimator filters.
    this.state.NPSHa_est = op.NPSHa;
    this.state.NPSH3_est = op.NPSH3;
    this.state.R_est = op.R;
    this.R_est_prev = op.R;
    this.slopeFilter = 0;
  }

  private pump(): PumpParams {
    return { ...this.params.pump, n: this.nEff };
  }

  /**
   * Set a time-varying input. Inputs are the live/scenario layer; they are
   * written through to the corresponding plant parameter so the physics
   * modules (which read PlantParams) always see a consistent state.
   */
  setInput<K extends keyof SimInputs>(key: K, value: SimInputs[K]): void {
    this.inputs[key] = value;
    const num = value as unknown as number;
    const bool = value as unknown as boolean;
    const p = this.params;
    switch (key) {
      case 'z_level':
        p.source.z_level = num;
        break;
      case 'K_strainer':
        p.suction.K_strainer = num;
        break;
      case 'T':
        p.fluid.T = num;
        break;
      case 'k_discharge':
        p.discharge.k = num;
        break;
      case 'n':
        p.pump.n = num;
        break;
      case 'z_bell':
        p.source.z_bell = num;
        break;
      case 'noiseScale':
        p.sensors.noiseScale = num;
        break;
      case 'valveStuck':
        p.valve.stuck = bool;
        break;
      case 'pressureDrift':
        p.sensors.faults.pressureDrift = num;
        break;
      case 'pressureStuck':
        p.sensors.faults.pressureStuck = bool;
        break;
      case 'pressureDropout':
        p.sensors.faults.pressureDropout = bool;
        break;
      case 'checkValveLeak':
        p.sensors.faults.checkValveLeak = bool;
        break;
      // mode / manualValve are control-layer only.
    }
  }

  /** Re-pull time-varying inputs from plant params (after a Plant Setup edit). */
  syncInputs(): void {
    const p = this.params;
    this.inputs.z_level = p.source.z_level;
    this.inputs.K_strainer = p.suction.K_strainer;
    this.inputs.T = p.fluid.T;
    this.inputs.k_discharge = p.discharge.k;
    this.inputs.n = p.pump.n;
    this.inputs.z_bell = p.source.z_bell;
    this.inputs.noiseScale = p.sensors.noiseScale;
    this.inputs.valveStuck = p.valve.stuck;
    this.inputs.pressureDrift = p.sensors.faults.pressureDrift;
    this.inputs.pressureStuck = p.sensors.faults.pressureStuck;
    this.inputs.pressureDropout = p.sensors.faults.pressureDropout;
    this.inputs.checkValveLeak = p.sensors.faults.checkValveLeak;
  }

  setParams(mutate: (p: PlantParams) => void): void {
    mutate(this.params);
  }

  getParams(): PlantParams {
    return this.params;
  }

  getInputs(): SimInputs {
    return this.inputs;
  }

  getController(): import('./types').CtrlState {
    return this.ctrl;
  }

  getHistory(): HistorySample[] {
    return this.hist;
  }

  clearHistory(): void {
    this.hist = [];
    this.histAccum = 0;
  }

  getSpectrum(): Spectrum {
    const s = this.state;
    this.lastSpectrum = vibrationSpectrum(s.CI, s.RI, s.AI, this.params.pump.N0, this.params.pump.vanes, this.nEff);
    return this.lastSpectrum;
  }

  getHfRms(): number {
    if (!this.lastSpectrum) this.getSpectrum();
    return this.lastSpectrum ? hfRms(this.lastSpectrum) : 0;
  }

  /** Solve the coupled pump / junction operating point for a given Q_T and valve position. */
  operatingPoint(Q_T: number, theta: number): OperatingPoint {
    const p = this.params;
    const pump = this.pump();
    const H_S = sourceHead(p);
    const H_T = tankHead(p, this.state.tankH);
    const R_S = sourceResistance(p);
    const R_T = valveResistance(theta, p.branch);
    const PvHead = vaporPressurePa(this.inputs.T, p.fluid.seawaterFactor) / (p.fluid.rho * G);
    const qHi = Math.max(1e-4, pumpRunoutFlow(pump) * 1.02);

    const evaluate = (Q: number): OperatingPoint => {
      const j = solveJunction(H_S, H_T, R_S, R_T, Q, Q_T);
      const NPSHa = j.H_J - junctionLossHead(Q, p) + velocityHead(Q, p) - PvHead;
      const NPSH3 = pumpNPSH3(Q, pump);
      const R = NPSH3 > 1e-9 ? NPSHa / NPSH3 : 10;
      const headDrop = headDropFraction(R);
      const H_pump = pumpHead(Q, pump) * (1 - headDrop);
      const H_system = p.discharge.H_static + p.discharge.k * Q * Q;
      return { Q, H_J: j.H_J, Q_S: j.Q_S, NPSHa, NPSH3, R, headDrop, H_pump, H_system };
    };

    const residual = (Q: number): number => evaluate(Q).H_pump - evaluate(Q).H_system;
    let lo = 0;
    let hi = qHi;
    let flo = residual(lo);
    let fhi = residual(hi);
    // Guard against a fully cavitated pump that cannot overcome static head.
    if (flo <= 0) {
      const op = evaluate(0);
      return op;
    }
    if (fhi > 0) {
      const op = evaluate(hi);
      return op;
    }
    for (let i = 0; i < 48; i++) {
      const mid = 0.5 * (lo + hi);
      const fm = residual(mid);
      if (fm > 0) lo = mid;
      else hi = mid;
    }
    return evaluate(0.5 * (lo + hi));
  }

  /**
   * True steady-state operating point for a given valve position, using the
   * algebraic tank-branch flow (Section 4.4 bisection). Used for controller
   * feedforward linearization.
   */
  operatingPointSteady(theta: number): OperatingPoint {
    const p = this.params;
    const pump = this.pump();
    const H_S = sourceHead(p);
    const H_T = tankHead(p, this.state.tankH);
    const R_S = sourceResistance(p);
    const R_T = valveResistance(theta, p.branch);
    const PvHead = vaporPressurePa(this.inputs.T, p.fluid.seawaterFactor) / (p.fluid.rho * G);
    const qHi = Math.max(1e-4, pumpRunoutFlow(pump) * 1.02);

    const evaluate = (Q: number): OperatingPoint => {
      const f = (hj: number): number => {
        const qs = hj < H_S ? Math.sqrt(Math.max(0, H_S - hj) / R_S) : 0;
        const qt = hj < H_T && Number.isFinite(R_T) ? Math.sqrt(Math.max(0, H_T - hj) / R_T) : 0;
        return qs + qt - Q;
      };
      let lo = Math.min(H_S, H_T) - 200;
      let hi = Math.max(H_S, H_T);
      let guard = 0;
      while (f(lo) < 0 && guard++ < 20) lo -= 200;
      for (let i = 0; i < 36; i++) {
        const m = 0.5 * (lo + hi);
        if (f(m) > 0) lo = m;
        else hi = m;
      }
      const H_J = 0.5 * (lo + hi);
      const Q_S = H_J < H_S ? Math.sqrt(Math.max(0, H_S - H_J) / R_S) : 0;
      const NPSHa = H_J - junctionLossHead(Q, p) + velocityHead(Q, p) - PvHead;
      const NPSH3 = pumpNPSH3(Q, pump);
      const R = NPSH3 > 1e-9 ? NPSHa / NPSH3 : 10;
      const headDrop = headDropFraction(R);
      const H_pump = pumpHead(Q, pump) * (1 - headDrop);
      const H_system = p.discharge.H_static + p.discharge.k * Q * Q;
      return { Q, H_J, Q_S, NPSHa, NPSH3, R, headDrop, H_pump, H_system };
    };

    const residual = (Q: number): number => evaluate(Q).H_pump - evaluate(Q).H_system;
    let lo = 0;
    let hi = qHi;
    if (residual(lo) <= 0) return evaluate(0);
    if (residual(hi) > 0) return evaluate(hi);
    for (let i = 0; i < 44; i++) {
      const mid = 0.5 * (lo + hi);
      if (residual(mid) > 0) lo = mid;
      else hi = mid;
    }
    return evaluate(0.5 * (lo + hi));
  }

  /**
   * Feedforward linearization (closed form). At the target margin the head
   * drop is negligible, so the pump balance H0(Q) = H_static + k Q^2 is a
   * quadratic with an analytic solution. The required junction head then
   * gives the required branch resistance and hence the valve position.
   */
  computeThetaForTarget(target: number): number {
    const p = this.params;
    const pump = this.pump();
    const n = pump.n;
    const denom = p.pump.kHead + p.discharge.k;
    if (denom <= 0) return 0;
    const Q = Math.sqrt(Math.max(0, (n * n * p.pump.H_shutoff - p.discharge.H_static) / denom));
    if (Q <= 1e-6) return 0;
    const NPSH3 = pumpNPSH3(Q, pump);
    const PvHead = vaporPressurePa(this.inputs.T, p.fluid.seawaterFactor) / (p.fluid.rho * G);
    const hJ = junctionLossHead(Q, p);
    const Vh = velocityHead(Q, p);
    const HJreq = target * NPSH3 + PvHead + hJ - Vh;
    const HS = sourceHead(p);
    const R_S = sourceResistance(p);
    const HJsource = HS - R_S * Q * Q;
    if (HJreq <= HJsource) return 0; // source alone meets the target
    const HT = tankHead(p, this.state.tankH);
    const A = branchArea(p.branch);
    const RTopen = p.branch.K_open / (2 * G * A * A);
    const HJmax = HT - RTopen * Q * Q;
    if (HJreq >= HJmax) return 1; // fully open is not enough
    const RT = (HT - HJreq) / (Q * Q);
    const theta = 1 - Math.log(RT / RTopen) / (2 * Math.log(p.branch.R));
    return Math.max(0, Math.min(1, theta));
  }

  /** Advance the simulation by one fixed physics step. */
  step(dt: number = PHYSICS_DT): void {
    const p = this.params;
    const s = this.state;
    const cp = p.controller;
    s.t += dt;
    const t = s.t;

    // --- Fluid properties -------------------------------------------------
    const T = this.inputs.T;
    const rho = p.fluid.rho;
    const PvHead = vaporPressurePa(T, p.fluid.seawaterFactor) / (rho * G);

    // --- Speed / VFD fallback --------------------------------------------
    const fallback = this.ctrl.name === 'FAULT_SAFE';
    this.nEff = fallback ? Math.min(this.inputs.n, cp.vfdFallbackSpeed) : this.inputs.n;
    s.n = this.inputs.n;
    s.vfdSpeed = this.nEff;
    const pump = this.pump();

    // --- Operating point (uses previous theta and Q_T) --------------------
    const op = this.operatingPoint(s.Q_T, s.theta);
    const alpha = 1 - Math.exp(-dt / Math.max(p.pump.tauQ, 1e-3));
    s.Q = Math.max(0, s.Q + (op.Q - s.Q) * alpha);

    // --- Junction solution with lagged flow -------------------------------
    const H_S = sourceHead(p);
    const H_T = tankHead(p, s.tankH);
    const R_S = sourceResistance(p);
    const R_T = valveResistance(s.theta, p.branch);
    const j = solveJunction(H_S, H_T, R_S, R_T, s.Q, s.Q_T, p.sensors.faults.checkValveLeak);
    s.H_S = H_S;
    s.H_T = H_T;
    s.H_J = j.H_J;
    s.Q_S = j.Q_S;
    s.checkValveOpen = j.checkValveOpen;
    s.NPSHa = j.H_J - junctionLossHead(s.Q, p) + velocityHead(s.Q, p) - PvHead;
    s.NPSH3 = pumpNPSH3(s.Q, pump);
    s.R = s.NPSH3 > 1e-9 ? s.NPSHa / s.NPSH3 : 10;
    s.headDrop = headDropFraction(s.R);
    s.H_pump = pumpHead(s.Q, pump) * (1 - s.headDrop);
    s.H_system = p.discharge.H_static + p.discharge.k * s.Q * s.Q;

    // Source-only reference (tank branch closed).
    const H_J_src = H_S - R_S * s.Q * s.Q;
    s.NPSHa_src = H_J_src - junctionLossHead(s.Q, p) + velocityHead(s.Q, p) - PvHead;
    s.R_src = s.NPSH3 > 1e-9 ? s.NPSHa_src / s.NPSH3 : 10;

    // --- Cavitation / damage ---------------------------------------------
    s.CI = cavitationIntensity(s.R, cp.R_inc, cp.R_brk);
    s.RI = recirculationIndex(s.Q, p.pump.Q_BEP);
    const A_bell = (Math.PI / 4) * p.source.bellD * p.source.bellD;
    const V_bell = s.Q / A_bell;
    s.Fr = froudeNumber(V_bell, p.source.bellD);
    s.S_min = minSubmergence(p.source.bellD, V_bell);
    s.S = this.inputs.z_level - this.inputs.z_bell;
    s.AI = airIngestionIndex(s.S, s.S_min);
    s.cavState = cavityState(s.R, cp.cavStateThresholds) as CavityState;
    s.damage = Math.min(1000, s.damage + damageRate(s.CI, s.RI, s.AI, cp.k_e) * dt);
    s.eta = pumpEfficiency(s.Q, pump);
    s.power = pumpPower(s.Q, s.H_pump, pump, rho);

    // --- Tank branch inertia ---------------------------------------------
    const A_t = branchArea(p.branch);
    const L_t = p.branch.L;
    if (s.theta <= 1e-6) {
      s.Q_T = Math.max(0, s.Q_T - s.Q_T * dt * 2);
    } else if (Number.isFinite(R_T)) {
      const dQ = (G * A_t / L_t) * (H_T - j.H_J - R_T * s.Q_T * s.Q_T);
      // The tank branch can never push more than the pump demands.
      s.Q_T = Math.max(0, Math.min(s.Q, s.Q_T + dQ * dt));
    } else {
      s.Q_T = 0;
    }

    // --- Tank mass balance ------------------------------------------------
    const { hMax, hReserve } = tankLevelBounds(p);
    s.tankReserveH = hReserve;
    s.tankUsableV = p.tank.V_usable;
    // Refill from the discharge header through a throttle runs whenever the
    // pump is online and the tank is below its high level; during injection it
    // partly offsets the drawn volume.
    const refillActive = s.tankH < hMax * 0.98 && s.Q > 0.005;
    const refill = refillActive ? p.tank.refillQ : 0;
    s.tankH = Math.max(0, Math.min(hMax, s.tankH + ((refill - s.Q_T) / p.tank.area) * dt));
    s.tankV = s.tankH * p.tank.area;
    s.autonomy_s = s.Q_T > 1e-6 ? Math.max(0, ((s.tankH - hReserve) * p.tank.area) / s.Q_T) : Infinity;

    // --- Vibration (truth) ------------------------------------------------
    const vibNoise = this.rng.gaussian() * 0.05;
    const vibTruth = vibrationRMS(s.CI, s.RI, s.AI, vibNoise, this.vibParams);

    // --- Sensors ---------------------------------------------------------
    const A_s = suctionArea(p);
    const V_s = s.Q / A_s;
    const P_suction_abs = (s.NPSHa + PvHead) * rho * G;
    const P_discharge = p.fluid.Patm + rho * G * s.H_pump;
    const strainerDP = rho * p.suction.K_strainer * V_s * V_s * 0.5;
    const m = updateSensors(
      this.sensors,
      {
        P_suction_abs,
        P_discharge,
        Q: s.Q,
        T,
        level: this.inputs.z_level,
        strainerDP,
        tankH: s.tankH,
        theta: s.theta,
        vibration: vibTruth,
        n: this.nEff,
      },
      p.sensors,
      this.rng,
      dt,
    );
    s.sensors = m;

    // --- Estimator -------------------------------------------------------
    const est = estimateNPSHa(m.P_suction_abs, m.T, m.Q, rho, p.fluid.seawaterFactor, pump, p.suction.D, G);
    const tauEst = 1.0;
    const kEst = dt / (tauEst + dt);
    s.NPSHa_est = s.NPSHa_est + (est.NPSHa_est - s.NPSHa_est) * kEst;
    s.NPSH3_est = s.NPSH3_est + (est.NPSH3_est - s.NPSH3_est) * kEst;
    s.R_est = s.R_est + (est.R_est - s.R_est) * kEst;
    if (this.R_est_prev !== null && dt > 0) {
      const instSlope = (s.R_est - this.R_est_prev) / dt;
      this.slopeFilter += (instSlope - this.slopeFilter) * (dt / (0.5 + dt));
    }
    s.R_slope = this.slopeFilter;
    this.R_est_prev = s.R_est;

    // --- Controller ------------------------------------------------------
    const stuck = p.valve.stuck || this.inputs.valveStuck;
    // Feedforward valve position for the target margin ratio. Only needed
    // while injecting/holding; recomputed at 2 Hz for performance.
    this.thetaTargetTimer += dt;
    const ctrlActive = this.ctrl.name === 'INJECTING' || this.ctrl.name === 'HOLD';
    if (ctrlActive && this.thetaTargetTimer >= 0.01) {
      this.thetaTargetTimer = 0;
      this.thetaTarget = this.computeThetaForTarget(cp.R_target);
    }
    // Plausibility: a sustained estimator/model discrepancy indicates a sensor
    // problem. Short transients (scenario start, fast events) are tolerated.
    const discrepancy = Math.abs(s.R_est - s.R);
    if (discrepancy > 1.0) this.plausTimer += dt;
    else this.plausTimer = 0;
    const plausible = s.t < 5 || this.plausTimer < 2.0;
    const ctx: ControllerContext = {
      t,
      R_est: s.R_est,
      R_slope: s.R_slope,
      R_src_est: s.R_src,
      tankH: s.tankH,
      tankReserveH: hReserve,
      tankFullH: hMax,
      sensorsHealthy: m.healthy && plausible,
      valveFault: stuck,
      mode: this.inputs.mode,
      manualValve: this.inputs.manualValve,
      theta: s.theta,
      thetaTarget: this.thetaTarget,
      strokeTime: p.valve.strokeTime,
      n: this.nEff,
    };
    updateController(this.ctrl, ctx, cp, dt);
    s.controller = this.ctrl;
    s.valveCmd = this.ctrl.thetaCmd;

    // --- Valve dynamics --------------------------------------------------
    if (!stuck) {
      s.theta = moveValve(s.theta, this.ctrl.thetaCmd, slewRate(p.valve) * dt);
    }
    s.injected = (this.ctrl.name === 'INJECTING' || this.ctrl.name === 'HOLD') && s.theta > 0.02;

    // --- Water hammer / surge -------------------------------------------
    s.surge = this.computeSurge();

    // --- Advisor ---------------------------------------------------------
    s.advisor = this.computeAdvisor(plausible);

    // --- Alarms ----------------------------------------------------------
    this.updateAlarms(plausible);

    // --- History ---------------------------------------------------------
    this.histAccum += dt;
    if (this.histAccum >= this.recordInterval) {
      this.histAccum = 0;
      this.pushHistory();
    }
  }

  private computeSurge(): SurgeInfo {
    const p = this.params;
    const s = this.state;
    const a = p.branch.waveSpeed;
    const T_wave = (2 * p.branch.L) / Math.max(a, 1);
    const A_t = branchArea(p.branch);
    const V = s.Q_T / A_t;
    const dP = p.fluid.rho * a * Math.abs(V);
    const stroke = Math.max(p.valve.strokeTime, 1e-3);
    const dH = (2 * p.branch.L * Math.abs(V)) / (G * stroke);
    const dP_slow = p.fluid.rho * G * dH;
    const fast = stroke < T_wave;
    return {
      T_wave,
      strokeTime: stroke,
      dP_joukowsky: dP,
      dH_slow: dH,
      dP_slow,
      surgePeak: fast ? dP : dP_slow,
      limit: 0.5e6,
      safeStroke: 10 * T_wave,
      branchVelocity: V,
    };
  }

  private computeAdvisor(plausible: boolean): Advisor {
    const s = this.state;
    const p = this.params;
    const ev = {
      R: s.R,
      NPSHa: s.NPSHa,
      NPSH3: s.NPSH3,
      CI: s.CI,
      RI: s.RI,
      AI: s.AI,
      tankLevel: s.tankH,
      valvePos: s.theta,
    };
    if (this.ctrl.name === 'FAULT_SAFE') {
      return { id: 'fault', severity: 'critical', evidence: ev };
    }
    if (s.RI > 0.3 && s.R > 1.6) {
      return { id: 'recirculation', severity: 'warning', evidence: ev };
    }
    if (s.Q_S < -1e-6) {
      return { id: 'check-valve-leak', severity: 'warning', evidence: ev };
    }
    if (s.AI > 0.1) {
      return { id: 'air-ingestion', severity: 'warning', evidence: ev };
    }
    if (!plausible && s.CI > 0.05) {
      return { id: 'disagreement', severity: 'watch', evidence: ev };
    }
    if (s.R < 1.0) {
      return s.injected
        ? { id: 'npsh-acting-severe', severity: 'critical', evidence: ev }
        : { id: 'npsh-severe', severity: 'critical', evidence: ev };
    }
    if (s.R < p.controller.R_target) {
      return s.injected
        ? { id: 'npsh-acting', severity: 'watch', evidence: ev }
        : { id: 'npsh-eroding', severity: 'watch', evidence: ev };
    }
    if (s.R < p.controller.R_arm) {
      return { id: 'npsh-margin', severity: 'info', evidence: ev };
    }
    return { id: 'ok', severity: 'info', evidence: ev };
  }

  private updateAlarms(plausible: boolean): void {
    const s = this.state;
    const p = this.params;
    const set = (id: string, severity: Alarm['severity'], message: string, active: boolean) => {
      const was = this.alarmActive.get(id) ?? false;
      if (active && !was) {
        this.pushAlarm({ id, t: s.t, severity, message });
        this.alarmActive.set(id, true);
      } else if (!active) {
        this.alarmActive.set(id, false);
      }
    };
    set('reserve', 'critical', 'Tank at reserve — injection blocked', s.tankH <= s.tankReserveH * 1.02);
    set('r-low', 'critical', 'Margin ratio below 1.0 — cavitation', s.R < 1.0);
    set('r-watch', 'warning', 'Margin ratio below target', s.R < p.controller.R_target && s.R >= 1.0);
    set('sensor', 'warning', 'Sensor plausibility check failed', !plausible);
    set('valve', 'critical', 'Valve fault detected', p.valve.stuck || this.inputs.valveStuck);
    set('recirc', 'warning', 'Low-flow recirculation detected', s.RI > 0.3);
    set('air', 'warning', 'Air ingestion / vortex risk', s.AI > 0.1);
    set('checkvalve', 'warning', 'Check valve leak — source flow reversal', s.Q_S < -1e-6);
    if (this.ctrl.alarm) {
      set('ctrl', 'warning', this.ctrl.alarm, true);
    } else {
      this.alarmActive.set('ctrl', false);
    }
    // Trim alarm list.
    if (s.alarms.length > 200) s.alarms.splice(0, s.alarms.length - 200);
  }

  private pushAlarm(a: Alarm): void {
    this.state.alarms.push(a);
  }

  private pushHistory(): void {
    const s = this.state;
    this.hist.push({
      t: s.t,
      R: s.R,
      NPSHa: s.NPSHa,
      NPSH3: s.NPSH3,
      Q: s.Q,
      H: s.H_pump,
      P_suction: s.sensors.P_suction_gauge,
      P_discharge: s.sensors.P_discharge,
      T: s.sensors.T,
      Pv: vaporPressurePa(s.sensors.T, this.params.fluid.seawaterFactor),
      level: s.sensors.level,
      tankH: s.tankH,
      theta: s.theta,
      CI: s.CI,
      damage: s.damage,
      vibration: s.sensors.vibrationRMS,
      n: s.n,
      headDrop: s.headDrop,
      state: CAVITY_STATES.indexOf(s.cavState),
      ctrl: CTRL_STATES.indexOf(s.controller.name),
      advisor: s.advisor.id,
      surge: s.surge.surgePeak,
    });
    if (this.hist.length > 72000) this.hist.splice(0, this.hist.length - 72000);
  }

  /** Run headless for a duration, returning recorded samples. */
  run(duration: number, dt: number = PHYSICS_DT, recordInterval?: number): HistorySample[] {
    if (recordInterval !== undefined) this.recordInterval = recordInterval;
    const steps = Math.max(0, Math.round(duration / dt));
    for (let i = 0; i < steps; i++) this.step(dt);
    return this.hist;
  }

  /** Reset to t=0 with the same parameters and a new seed. */
  reset(seed: number = this.seed): void {
    this.rng = new RngStream(seed);
    this.seed = seed;
    this.ctrl = createController();
    this.sensors = createSensorState();
    this.hist = [];
    this.histAccum = 0;
    this.nEff = 1;
    this.R_est_prev = null;
    this.slopeFilter = 0;
    this.alarmActive = new Map();
    this.plausTimer = 0;
    this.state = this.emptyState();
    this.initialize();
  }
}
