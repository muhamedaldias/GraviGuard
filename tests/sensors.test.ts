// Issue #4 (P1-1): sensor/estimator synthesis correctness.
// Convention: P_suction_abs is the STATIC flange pressure; the estimator adds
// the velocity head from measured flow exactly once. P_discharge is synthesized
// across the pump (voted suction + rho*g*H_pump). Gauge references params.fluid.Patm.
// ADC saturates at FULL_SCALE_PA. Sustained per-sensor deviation from the 2oo3
// median flags the sensor unhealthy (drift becomes observable, S9b).
import { describe, it, expect } from 'vitest';
import { SimEngine } from '../src/sim/engine';
import { defaultPlant, PHYSICS_DT } from '../src/sim/defaults';
import { G } from '../src/sim/types';
import type { PlantParams, Scenario } from '../src/sim/types';
import { vaporPressurePa } from '../src/sim/fluid';
import {
  updateSensors,
  createSensorState,
  estimateNPSHa,
  FULL_SCALE_PA,
  DEVIATION_THRESHOLD_PA,
  DEVIATION_HOLD_S,
} from '../src/sim/sensors';
import type { SensorTruth } from '../src/sim/sensors';
import { RngStream } from '../src/sim/prng';
import { runScenario } from '../src/sim/scenario';
import s9b from '../public/scenarios/S9b.json';

const RHO = 1025;

function noiselessParams(): PlantParams {
  const p = defaultPlant();
  p.sensors.noiseScale = 0;
  p.sensors.lagP = 0;
  p.sensors.quantBits = 24; // half-step 0.006 Pa -> 5.9e-7 m < 1e-6 tolerance
  return p;
}

function makeTruth(over: Partial<SensorTruth> = {}): SensorTruth {
  return {
    P_suction_abs: 110000,
    P_discharge: 560000,
    Q: 0.1,
    T: 35,
    level: 1,
    strainerDP: 1000,
    tankH: 5,
    theta: 0,
    vibration: 1,
    n: 1,
    H_pump: 45,
    rho: RHO,
    Patm: 101325,
    ...over,
  };
}

function unitParams(): PlantParams['sensors'] {
  const sp = defaultPlant().sensors;
  sp.noiseScale = 0;
  sp.lagP = 0;
  return sp;
}

describe('AC1 — noiseless steady state: NPSHa_est == NPSHa truth within 1e-6', () => {
  it('30 s noiseless run converges to truth (no velocity-head double count)', () => {
    const e = new SimEngine({ params: noiselessParams(), seed: 12345 });
    e.run(30);
    const s = e.state;
    expect(Math.abs(s.NPSHa_est - s.NPSHa)).toBeLessThan(1e-6);
    expect(Math.abs(s.R_est - s.R)).toBeLessThan(1e-5);
  });

  it('estimateNPSHa on exact static flange pressure reproduces truth (pure math)', () => {
    const e = new SimEngine({ params: defaultPlant(), seed: 12345 });
    e.run(30);
    const s = e.state;
    const p = e.getParams();
    const PvHead = vaporPressurePa(35, p.fluid.seawaterFactor) / (RHO * G);
    const A = (Math.PI / 4) * p.suction.D * p.suction.D;
    const V = s.Q / A;
    const P_static = (s.NPSHa + PvHead - (V * V) / (2 * G)) * RHO * G;
    const est = estimateNPSHa(P_static, 35, s.Q, RHO, p.fluid.seawaterFactor,
      { Q_BEP: p.pump.Q_BEP, npsh3a: p.pump.npsh3a, npsh3b: p.pump.npsh3b, n: 1 }, p.suction.D);
    expect(Math.abs(est.NPSHa_est - s.NPSHa)).toBeLessThan(1e-9);
  });
});

describe('AC2 — P_discharge - P_suction_abs == rho*g*H_pump (steady + injecting)', () => {
  it('identity holds every step for 10 s steady, then 120 s with injection', () => {
    const e = new SimEngine({ params: defaultPlant(), seed: 12345 });
    let injectedEver = false;
    let maxErr = 0;
    const check = () => {
      const s = e.state;
      const err = Math.abs(s.sensors.P_discharge - s.sensors.P_suction_abs - RHO * G * s.H_pump);
      maxErr = Math.max(maxErr, err);
      if (s.injected) injectedEver = true;
    };
    for (let i = 0; i < 1000; i++) { e.step(PHYSICS_DT); check(); }
    e.setInput('z_level', -3); // drive R below R_inject -> controller injects
    for (let i = 0; i < 12000; i++) { e.step(PHYSICS_DT); check(); }
    expect(maxErr).toBeLessThan(1e-6);
    expect(injectedEver).toBe(true);
  });
});

describe('AC3 — gauge references configurable Patm', () => {
  it('Patm = 90 kPa: gauge == abs - 90000 every step', () => {
    const p = defaultPlant();
    p.fluid.Patm = 90000;
    const e = new SimEngine({ params: p, seed: 12345 });
    for (let i = 0; i < 500; i++) {
      e.step(PHYSICS_DT);
      const m = e.state.sensors;
      expect(Math.abs(m.P_suction_gauge - (m.P_suction_abs - 90000))).toBeLessThan(1e-9);
    }
  });

  it('unit level: gauge = voted - truth.Patm', () => {
    const sp = unitParams();
    const m = updateSensors(createSensorState(), makeTruth({ Patm: 90000 }), sp, new RngStream(1), 0.01);
    expect(Math.abs(m.P_suction_gauge - (m.P_suction_abs - 90000))).toBeLessThan(1e-9);
  });
});

describe('ADC saturation at FULL_SCALE_PA', () => {
  it('over-range pressure saturates at 200 kPa; negative at 0', () => {
    const sp = unitParams(); // 12-bit
    const hi = updateSensors(createSensorState(), makeTruth({ P_suction_abs: 250000 }), sp, new RngStream(1), 0.01);
    expect(hi.P_suction_abs).toBe(FULL_SCALE_PA);
    for (const v of hi.voting) expect(v).toBe(FULL_SCALE_PA);
    const lo = updateSensors(createSensorState(), makeTruth({ P_suction_abs: -5000 }), sp, new RngStream(1), 0.01);
    expect(lo.P_suction_abs).toBe(0);
  });

  it('unit discharge identity: voted + rho*g*H_pump', () => {
    const sp = unitParams();
    const m = updateSensors(createSensorState(), makeTruth({ H_pump: 45 }), sp, new RngStream(1), 0.01);
    expect(Math.abs(m.P_discharge - m.P_suction_abs - RHO * G * 45)).toBeLessThan(1e-6);
  });
});

describe('drift fault observability (per-sensor deviation flag)', () => {
  it('+30 kPa drift on sensor 0: flagged after hold time, vote still isolates it', () => {
    const sp = unitParams();
    sp.faults.pressureDrift = 30000;
    const state = createSensorState();
    const rng = new RngStream(42);
    const truth = makeTruth();
    let m = updateSensors(state, truth, sp, rng, 0.01);
    for (let i = 1; i < 100; i++) m = updateSensors(state, truth, sp, rng, 0.01); // 1 s
    expect(m.healthy).toBe(true); // hold time (2 s) not elapsed yet
    for (let i = 100; i < 500; i++) m = updateSensors(state, truth, sp, rng, 0.01); // 5 s
    expect(m.pressureDeviation).toEqual([true, false, false]);
    expect(m.healthy).toBe(false);
    expect(Math.abs(m.P_suction_abs - truth.P_suction_abs)).toBeLessThan(25); // quantization only
    expect(DEVIATION_THRESHOLD_PA).toBe(10000);
    expect(DEVIATION_HOLD_S).toBe(2);
  });

  it('deviation clears after the drift is removed', () => {
    const sp = unitParams();
    sp.faults.pressureDrift = 30000;
    const state = createSensorState();
    const rng = new RngStream(42);
    const truth = makeTruth();
    for (let i = 0; i < 500; i++) updateSensors(state, truth, sp, rng, 0.01);
    sp.faults.pressureDrift = 0;
    let m = updateSensors(state, truth, sp, rng, 0.01);
    for (let i = 1; i < 300; i++) m = updateSensors(state, truth, sp, rng, 0.01); // 3 s
    expect(m.pressureDeviation).toEqual([false, false, false]);
    expect(m.healthy).toBe(true);
  });

  it('healthy noise + spikes never latch a deviation flag (60 s, sigma x1 and x2)', () => {
    for (const ns of [1, 2]) {
      const e = new SimEngine({ params: defaultPlant(), seed: 1012 });
      e.setInput('noiseScale', ns);
      for (let i = 0; i < 6000; i++) {
        e.step(PHYSICS_DT);
        if (i % 10 === 0) {
          expect(e.state.sensors.healthy).toBe(true);
        }
      }
    }
  });
});

describe('S9b headless: drift produces an observable flag / alarm', () => {
  it('controller enters FAULT_SAFE and advisor reports fault; plant keeps running', () => {
    const runs = runScenario(s9b as unknown as Scenario, { recordInterval: 1.0 });
    const r = runs[0];
    expect(r.kpis.stateSequence).toContain('FAULT_SAFE');
    expect(r.kpis.advisorIds).toContain('fault');
    expect(r.kpis.minR).toBeGreaterThanOrEqual(2);
    expect(r.kpis.transitions).toBeLessThanOrEqual(4);
    expect(r.kpis.falseInjections).toBe(0);
  }, 30000);
});

describe('AC5 — baseline truth R unchanged', () => {
  it('60 s baseline run ends at R = 2.30 +/- 0.01', () => {
    const e = new SimEngine({ params: defaultPlant(), seed: 12345 });
    expect(e.state.R).toBeGreaterThan(2.2);
    expect(e.state.R).toBeLessThan(2.4);
    e.run(60);
    expect(Math.abs(e.state.R - 2.30)).toBeLessThanOrEqual(0.01);
  });
});
