// Sensors and the NPSHa estimator (Section 4.8).
// Models noise, lag, quantisation, drift, stuck, dropout and spikes, plus
// 2-out-of-3 pressure voting and plausibility checks.

import { Measurement, SensorParams } from './types';
import { RngStream } from './prng';
import { vaporPressurePa } from './fluid';
import { pumpNPSH3 } from './pump';

export interface SensorState {
  p: [number, number, number];
  stuckValue: [number, number, number];
  stuckActive: [boolean, boolean, boolean];
  dropoutHold: [number, number, number];
  t: number;
  q: number;
  level: number;
  tank: number;
  vib: number;
  theta: number;
  init: boolean;
}

export function createSensorState(): SensorState {
  return {
    p: [0, 0, 0],
    stuckValue: [0, 0, 0],
    stuckActive: [false, false, false],
    dropoutHold: [0, 0, 0],
    t: 20,
    q: 0,
    level: 0,
    tank: 0,
    vib: 0,
    theta: 0,
    init: false,
  };
}

export interface SensorTruth {
  P_suction_abs: number;
  P_discharge: number;
  Q: number;
  T: number;
  level: number;
  strainerDP: number;
  tankH: number;
  theta: number;
  vibration: number;
  n: number;
}

const FULL_SCALE_PA = 200000; // 0-200 kPa abs ADC range

function quantize(value: number, bits: number): number {
  const steps = Math.pow(2, bits);
  const step = FULL_SCALE_PA / steps;
  return Math.round(value / step) * step;
}

function lag(prev: number, target: number, tau: number, dt: number): number {
  if (tau <= 0) return target;
  return prev + (target - prev) * (dt / (tau + dt));
}

/** Median of three pressure readings (2-out-of-3 voting). */
export function votePressure(readings: [number, number, number]): number {
  const s = [readings[0], readings[1], readings[2]].sort((a, b) => a - b);
  return s[1];
}

export function updateSensors(
  s: SensorState,
  truth: SensorTruth,
  p: SensorParams,
  rng: RngStream,
  dt: number,
): Measurement {
  const ns = p.noiseScale;
  const raw: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) {
    let v = truth.P_suction_abs;
    // Independent sensor noise.
    v += rng.gaussian() * p.sigmaP * ns;
    // Sensor 0 carries the drift fault.
    if (i === 0) v += p.faults.pressureDrift;
    // Random spikes (rejected by voting).
    if (rng.uniform() < 0.0015) v += (rng.uniform() < 0.5 ? -1 : 1) * rng.range(5000, 25000);
    // Stuck sensor.
    if (p.faults.pressureStuck) {
      if (!s.stuckActive[i]) {
        s.stuckActive[i] = true;
        s.stuckValue[i] = v;
      }
      v = s.stuckValue[i];
    } else {
      s.stuckActive[i] = false;
    }
    // Dropout: hold last value.
    if (p.faults.pressureDropout && rng.uniform() < 0.02) {
      v = s.dropoutHold[i];
    } else {
      s.dropoutHold[i] = v;
    }
    raw[i] = quantize(Math.max(0, v), p.quantBits);
  }
  for (let i = 0; i < 3; i++) {
    s.p[i] = lag(s.p[i], raw[i], p.lagP, dt);
  }
  const voted = votePressure(s.p);

  s.t = lag(s.t, truth.T + rng.gaussian() * p.sigmaT * ns, 0.5, dt);
  s.q = lag(s.q, truth.Q * (1 + rng.gaussian() * p.sigmaQ * ns), 0.3, dt);
  s.level = lag(s.level, truth.level + rng.gaussian() * p.sigmaLevel * ns, 0.4, dt);
  s.tank = lag(s.tank, truth.tankH + rng.gaussian() * p.sigmaLevel * ns, 0.4, dt);
  s.vib = lag(s.vib, truth.vibration * (1 + rng.gaussian() * 0.1 * ns), 0.1, dt);
  s.theta = lag(s.theta, truth.theta * (1 + rng.gaussian() * 0.01 * ns), 0.1, dt);

  if (!s.init) {
    s.init = true;
    s.t = truth.T;
    s.q = truth.Q;
    s.level = truth.level;
    s.tank = truth.tankH;
  }

  const healthy = !(p.faults.pressureStuck || p.faults.pressureDropout);

  return {
    P_suction_abs: voted,
    P_suction_gauge: voted - 101325,
    P_discharge: truth.P_discharge,
    Q: Math.max(0, s.q),
    T: s.t,
    level: s.level,
    strainerDP: truth.strainerDP,
    tankLevel: Math.max(0, s.tank),
    valvePos: Math.max(0, Math.min(1, s.theta)),
    vibrationRMS: Math.max(0, s.vib),
    n: truth.n,
    healthy,
    voting: [s.p[0], s.p[1], s.p[2]],
  };
}

export interface EstimatorResult {
  NPSHa_est: number;
  NPSH3_est: number;
  R_est: number;
  plausible: boolean;
}

/**
 * NPSHa estimator: (P_s,abs - Pv(T_meas))/(rho g) + V_meas^2/2g.
 * Uses only what the controller "sees" (measured pressure, temperature, flow).
 */
export function estimateNPSHa(
  P_abs: number,
  T_meas: number,
  Q_meas: number,
  rho: number,
  seawaterFactor: number,
  p: { Q_BEP: number; npsh3a: number; npsh3b: number; n: number },
  D: number,
  g = 9.80665,
): EstimatorResult {
  const Pv = vaporPressurePa(T_meas, seawaterFactor);
  const A = (Math.PI / 4) * D * D;
  const V = Math.max(0, Q_meas) / A;
  const NPSHa_est = (P_abs - Pv) / (rho * g) + (V * V) / (2 * g);
  const n = p.n;
  const r = Q_meas / p.Q_BEP;
  const NPSH3_est = (p.npsh3a + p.npsh3b * r * r) * n * n;
  const R_est = NPSH3_est > 1e-6 ? NPSHa_est / NPSH3_est : 0;
  return { NPSHa_est, NPSH3_est, R_est, plausible: true };
}

export { pumpNPSH3 };
