// GraviGuard simulation core — shared types.
// All physical quantities are SI internally: m, m^3/s, Pa, kg/m^3, s, rpm.
// This module is pure TypeScript with no DOM access (testable in Node).

export const G = 9.80665; // m/s^2
export const PATM_SEA_LEVEL = 101325; // Pa

export interface FluidParams {
  rho: number; // kg/m^3
  T: number; // deg C
  seawaterFactor: number; // multiplier applied to vapor pressure (0.981 for seawater)
  Patm: number; // Pa
}

export interface PumpParams {
  Q_BEP: number; // m^3/s
  H_BEP: number; // m
  H_shutoff: number; // m
  kHead: number; // s^2/m^5, H(Q,n) = n^2*H_shutoff - kHead*Q^2
  N0: number; // rpm
  n: number; // speed fraction (0.70 - 1.05)
  eta0: number; // efficiency at BEP
  npsh3a: number; // m
  npsh3b: number; // m, NPSH3 = (a + b*(Q/Q_BEP)^2) * n^2
  eyeDiameter: number; // m
  vanes: number;
  tauQ: number; // s, first-order flow lag
}

export interface DischargeParams {
  H_static: number; // m
  k: number; // s^2/m^5
}

export interface SuctionParams {
  D: number; // m
  L: number; // m
  f: number; // Darcy friction factor
  K_fittings: number;
  K_strainer: number; // time-varying (fouling)
  K_J: number; // junction-to-flange loss coefficient
}

export interface SourceParams {
  z_level: number; // m, relative to pump axis (time-varying: tide)
  bellD: number; // m
  z_bell: number; // m, bell centerline relative to pump axis
}

export interface TankParams {
  V_usable: number; // m^3
  area: number; // m^2
  z_tb: number; // m, tank bottom elevation above pump axis
  reserveFrac: number; // fraction of usable volume kept as reserve
  refillQ: number; // m^3/s
}

export interface BranchParams {
  D: number; // m
  L: number; // m
  K_open: number; // total loss coefficient at full-open valve
  R: number; // equal-percentage rangeability
  Cv_max: number; // dimensional valve coefficient at full open
  waveSpeed: number; // m/s, configurable (default 1000)
}

export interface ValveParams {
  strokeTime: number; // s, full stroke
  stuck: boolean;
}

export type StrategyId = 'A' | 'B' | 'C';
export type CtrlStateName =
  | 'IDLE'
  | 'ARMED'
  | 'INJECTING'
  | 'HOLD'
  | 'RECOVERY'
  | 'REFILL'
  | 'MANUAL'
  | 'FAULT_SAFE';

export interface ControllerParams {
  R_arm: number; // R_est below this -> ARMED
  R_pred: number; // predicted R below this -> ARMED
  T_pred_extra: number; // s added to stroke time for prediction horizon
  R_inject: number; // R_est below this for injectDelay -> INJECTING
  injectDelay: number; // s
  R_target: number; // PI hold target
  holdBand: number; // R_target - holdBand counts as stable
  holdTime: number; // s
  R_recover: number; // source-only R above this for recoverTime -> RECOVERY
  recoverTime: number; // s
  Kp: number;
  Ki: number;
  minDwell: number; // s, anti-chatter
  maxCyclesPerHour: number;
  strategy: StrategyId;
  vfdFallbackSpeed: number; // fraction
  tripOnFault: boolean;
  k_e: number; // damage rate coefficient (illustrative)
  R_inc: number; // incipient cavitation margin ratio
  R_brk: number; // breakdown margin ratio
  cavStateThresholds: { incipient: number; developed: number; severe: number; breakdown: number };
}

export interface SensorFaults {
  pressureDrift: number; // Pa
  pressureStuck: boolean;
  pressureDropout: boolean;
  checkValveLeak: boolean;
  valveStuck: boolean;
}

export interface SensorParams {
  sigmaP: number; // Pa
  sigmaT: number; // deg C
  sigmaQ: number; // relative (1% = 0.01)
  sigmaLevel: number; // m
  lagP: number; // s
  quantBits: number; // ADC resolution
  noiseScale: number; // global multiplier
  faults: SensorFaults;
}

export interface PlantParams {
  fluid: FluidParams;
  pump: PumpParams;
  discharge: DischargeParams;
  suction: SuctionParams;
  source: SourceParams;
  tank: TankParams;
  branch: BranchParams;
  valve: ValveParams;
  controller: ControllerParams;
  sensors: SensorParams;
}

/** Time-varying inputs driven by the scenario timeline or live UI injectors. */
export interface SimInputs {
  z_level: number;
  K_strainer: number;
  T: number;
  k_discharge: number;
  n: number;
  z_bell: number;
  noiseScale: number;
  valveStuck: boolean;
  pressureDrift: number;
  pressureStuck: boolean;
  pressureDropout: boolean;
  checkValveLeak: boolean;
  mode: 'OFF' | 'ON' | 'MANUAL';
  manualValve: number; // 0..1
}

export type CavityState = 'NONE' | 'INCIPIENT' | 'DEVELOPED' | 'SEVERE' | 'BREAKDOWN';

export interface CtrlState {
  name: CtrlStateName;
  timeInState: number;
  cycles: number;
  integral: number;
  thetaCmd: number;
  alarm: string | null;
  timer: number;
  cycleTimes: number[];
  transitions: { t: number; from: CtrlStateName; to: CtrlStateName }[];
}

export interface Measurement {
  P_suction_abs: number; // Pa
  P_suction_gauge: number; // Pa
  P_discharge: number; // Pa
  Q: number; // m^3/s
  T: number; // deg C
  level: number; // m
  strainerDP: number; // Pa
  tankLevel: number; // m
  valvePos: number; // 0..1
  vibrationRMS: number; // m/s^2
  n: number;
  healthy: boolean;
  voting: [number, number, number]; // three pressure sensor readings (Pa abs)
}

export interface Alarm {
  id: string;
  t: number;
  severity: 'info' | 'watch' | 'warning' | 'critical';
  message: string;
}

export interface Advisor {
  id: string;
  severity: 'info' | 'watch' | 'warning' | 'critical';
  evidence: Record<string, number>;
}

export interface SurgeInfo {
  T_wave: number; // 2L/a, s
  strokeTime: number; // s
  dP_joukowsky: number; // Pa
  dH_slow: number; // m
  dP_slow: number; // Pa, rho g dH_slow
  surgePeak: number; // Pa, applicable estimate for the current stroke time
  limit: number; // Pa, allowable surge
  safeStroke: number; // s, >= 10 * 2L/a
  branchVelocity: number; // m/s
}

export interface SimState {
  t: number;
  Q: number;
  Q_S: number;
  Q_T: number;
  n: number;
  theta: number;
  tankH: number;
  tankV: number;
  H_J: number;
  H_S: number;
  H_T: number;
  H_pump: number;
  H_system: number;
  NPSHa: number;
  NPSH3: number;
  R: number;
  NPSHa_src: number;
  R_src: number;
  headDrop: number;
  CI: number;
  RI: number;
  AI: number;
  damage: number;
  cavState: CavityState;
  eta: number;
  power: number;
  valveCmd: number;
  checkValveOpen: boolean;
  controller: CtrlState;
  sensors: Measurement;
  R_est: number;
  NPSHa_est: number;
  NPSH3_est: number;
  R_slope: number;
  alarms: Alarm[];
  surge: SurgeInfo;
  advisor: Advisor;
  autonomy_s: number;
  S_min: number;
  S: number;
  Fr: number;
  vfdSpeed: number;
  tankReserveH: number;
  tankUsableV: number;
  injected: boolean;
}

export interface HistorySample {
  t: number;
  R: number;
  NPSHa: number;
  NPSH3: number;
  Q: number;
  H: number;
  P_suction: number;
  P_discharge: number;
  T: number;
  Pv: number;
  level: number;
  tankH: number;
  theta: number;
  CI: number;
  damage: number;
  vibration: number;
  n: number;
  headDrop: number;
  state: number; // index into CAVITY_STATES
  ctrl: number; // index into CTRL_STATES
  advisor: string; // advisor message id
  surge: number; // Joukowsky surge pressure (Pa)
}

export const CAVITY_STATES: CavityState[] = ['NONE', 'INCIPIENT', 'DEVELOPED', 'SEVERE', 'BREAKDOWN'];
export const CTRL_STATES: CtrlStateName[] = [
  'IDLE',
  'ARMED',
  'INJECTING',
  'HOLD',
  'RECOVERY',
  'REFILL',
  'MANUAL',
  'FAULT_SAFE',
];

// ---------------------------------------------------------------------------
// Scenario schema (Section 5 / Section 10)
// ---------------------------------------------------------------------------

export interface ScenarioEvent {
  /** Simulated time in seconds. */
  t: number;
  /** Input key (e.g. "z_level") or dotted plant param (e.g. "pump.n"). */
  param: string;
  value: number;
  /** Optional ramp duration in seconds (linear interpolation to the value). */
  ramp?: number;
}

export type AssertionType =
  | 'minR'
  | 'minNPSHa'
  | 'maxCI'
  | 'maxHeadDrop'
  | 'maxDamage'
  | 'tankMin'
  | 'maxTankMin'
  | 'maxTransitions'
  | 'falseInjections'
  | 'surgePeak'
  | 'minSurgePeak'
  | 'stateSequence'
  | 'advisorMessage'
  | 'custom';

export interface Assertion {
  id: string;
  type: AssertionType;
  value?: number;
  tolerance?: number;
  phase?: 'ON' | 'OFF' | 'any';
  expected?: string[];
  message?: string;
}

export interface Scenario {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  tags: string[];
  /** Simulated duration in seconds. */
  duration: number;
  seed: number;
  mode: 'OFF' | 'ON' | 'AB' | 'MANUAL';
  /** Static parameter overrides (dotted keys for plant params). */
  params?: Record<string, number>;
  /** Time-varying input keyframes. */
  timeline?: ScenarioEvent[];
  assertions?: Assertion[];
  expected?: { off?: string; on?: string };
}
