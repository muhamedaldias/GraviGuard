import { describe, it, expect } from 'vitest';
import { SimEngine } from '../src/sim/engine';
import { defaultPlant, tankLevelBounds } from '../src/sim/defaults';
import { PHYSICS_DT } from '../src/sim/defaults';
import { headDropFraction, cavitationIntensity, recirculationIndex, minSubmergence, airIngestionIndex, cavityState, damageRate } from '../src/sim/cavitation';

function makeEngine(seed = 12345) {
  return new SimEngine({ params: defaultPlant(), seed });
}

describe('SimEngine baseline (Reference Plant, Section 3)', () => {
  it('initial operating point is Q=0.100 m3/s, H=45 m', () => {
    const e = makeEngine();
    expect(e.state.Q).toBeCloseTo(0.1, 3);
    expect(e.state.H_pump).toBeCloseTo(45, 2);
    expect(e.state.H_system).toBeCloseTo(45, 2);
  });

  it('baseline NPSHa ~10.4 m and R ~2.3 (healthy)', () => {
    const e = makeEngine();
    expect(e.state.NPSHa).toBeGreaterThan(10.2);
    expect(e.state.NPSHa).toBeLessThan(10.6);
    expect(e.state.R).toBeGreaterThan(2.2);
    expect(e.state.R).toBeLessThan(2.4);
    expect(e.state.cavState).toBe('NONE');
    expect(e.state.CI).toBe(0);
  });

  it('baseline NPSH3 = 4.5 m', () => {
    const e = makeEngine();
    expect(e.state.NPSH3).toBeCloseTo(4.5, 3);
  });

  it('starts IDLE with zero valve movement', () => {
    const e = makeEngine();
    expect(e.state.controller.name).toBe('IDLE');
    expect(e.state.theta).toBe(0);
  });

  it('tank starts full (50 m3) with reserve 0.5 m', () => {
    const e = makeEngine();
    const { hMax, hReserve } = tankLevelBounds(e.getParams());
    expect(e.state.tankH).toBeCloseTo(hMax, 6);
    expect(hReserve).toBeCloseTo(0.5, 6);
    expect(e.state.tankV).toBeCloseTo(50, 3);
  });
});

describe('SimEngine determinism and convergence (Section 4.1)', () => {
  it('identical seed gives bit-identical results', () => {
    const a = makeEngine(777);
    const b = makeEngine(777);
    for (let i = 0; i < 2000; i++) {
      a.step(PHYSICS_DT);
      b.step(PHYSICS_DT);
    }
    const ka = JSON.stringify([a.state.t, a.state.Q, a.state.R, a.state.NPSHa, a.state.sensors.P_suction_abs, a.state.damage]);
    const kb = JSON.stringify([b.state.t, b.state.Q, b.state.R, b.state.NPSHa, b.state.sensors.P_suction_abs, b.state.damage]);
    expect(ka).toBe(kb);
  });

  it('different seeds give different sensor noise', () => {
    const a = makeEngine(1);
    const b = makeEngine(2);
    for (let i = 0; i < 200; i++) {
      a.step(PHYSICS_DT);
      b.step(PHYSICS_DT);
    }
    expect(a.state.sensors.P_suction_abs).not.toBe(b.state.sensors.P_suction_abs);
  });

  it('halving dt changes key outputs by < 0.5%', () => {
    const run = (dt: number) => {
      const e = makeEngine(42);
      for (let i = 0; i < Math.round(60 / dt); i++) {
        e.setInput('z_level', 1.0 - (i * dt / 600) * 3.0);
        e.step(dt);
      }
      return { R: e.state.R, NPSHa: e.state.NPSHa, Q: e.state.Q };
    };
    const coarse = run(0.02);
    const fine = run(0.01);
    const dR = Math.abs(coarse.R - fine.R) / fine.R;
    const dN = Math.abs(coarse.NPSHa - fine.NPSHa) / fine.NPSHa;
    expect(dR).toBeLessThan(0.005);
    expect(dN).toBeLessThan(0.005);
  });
});

describe('SimEngine physics behaviour', () => {
  it('tidal drawdown lowers NPSHa and R (GraviGuard OFF)', () => {
    const e = makeEngine();
    e.setInput('mode', 'OFF');
    const r0 = e.state.R;
    for (let i = 0; i < 6000; i++) {
      e.setInput('z_level', 1.0 - (i / 6000) * 5.5);
      e.step(PHYSICS_DT);
    }
    expect(e.state.R).toBeLessThan(r0 - 0.5);
    expect(e.state.NPSHa).toBeLessThan(8);
  });

  it('opening the tank valve raises NPSHa (manual mode)', () => {
    const e = makeEngine();
    e.setInput('mode', 'MANUAL');
    e.setInput('manualValve', 0.8);
    for (let i = 0; i < 3000; i++) e.step(PHYSICS_DT);
    expect(e.state.theta).toBeGreaterThan(0.7);
    expect(e.state.Q_T).toBeGreaterThan(0.02);
    expect(e.state.NPSHa).toBeGreaterThan(11);
  });

  it('strainer fouling increases suction loss and reduces R (OFF)', () => {
    const e = makeEngine();
    e.setInput('mode', 'OFF');
    const r0 = e.state.R;
    e.setInput('K_strainer', 80);
    for (let i = 0; i < 3000; i++) e.step(PHYSICS_DT);
    expect(e.state.R).toBeLessThan(r0 - 0.3);
  });

  it('rising temperature raises vapour pressure and reduces R (OFF)', () => {
    const e = makeEngine();
    e.setInput('mode', 'OFF');
    const r0 = e.state.R;
    e.setInput('T', 60);
    for (let i = 0; i < 3000; i++) e.step(PHYSICS_DT);
    expect(e.state.R).toBeLessThan(r0 - 0.3);
  });

  it('damage accumulates under sustained cavitation', () => {
    const e = makeEngine();
    e.setInput('z_level', -4.5);
    e.setInput('mode', 'OFF');
    for (let i = 0; i < 6000; i++) e.step(PHYSICS_DT);
    expect(e.state.damage).toBeGreaterThan(0);
  });

  it('tank depletes during sustained injection and triggers the reserve interlock', () => {
    const e = makeEngine();
    e.setInput('z_level', -3.5);
    e.setInput('K_strainer', 60);
    e.setInput('T', 45);
    const { hReserve } = tankLevelBounds(e.getParams());
    let minTank = Infinity;
    let sawFaultSafe = false;
    let sawFallback = false;
    for (let i = 0; i < 120000; i++) {
      e.step(PHYSICS_DT);
      if (e.state.tankH < minTank) minTank = e.state.tankH;
      if (e.state.controller.name === 'FAULT_SAFE') sawFaultSafe = true;
      if (e.state.vfdSpeed < 1) sawFallback = true;
    }
    expect(minTank).toBeLessThanOrEqual(hReserve * 1.05 + 0.01);
    expect(sawFaultSafe).toBe(true);
    expect(sawFallback).toBe(true);
  });

  it('surge info is populated with a safe stroke time', () => {
    const e = makeEngine();
    expect(e.state.surge.T_wave).toBeCloseTo(0.08, 3);
    expect(e.state.surge.safeStroke).toBeCloseTo(0.8, 2);
  });
});

describe('cavitation module', () => {
  it('head drop is 3% at R=1 and negligible at R=2', () => {
    expect(headDropFraction(1)).toBeCloseTo(0.03, 6);
    expect(headDropFraction(2)).toBeLessThan(0.001);
  });

  it('head drop exceeds 50% near R=0.6', () => {
    expect(headDropFraction(0.6)).toBeGreaterThan(0.5);
  });

  it('cavitation intensity is 0 above incipient and 1 below breakdown', () => {
    expect(cavitationIntensity(2.0, 2.0, 0.6)).toBe(0);
    expect(cavitationIntensity(0.6, 2.0, 0.6)).toBe(1);
    expect(cavitationIntensity(1.3, 2.0, 0.6)).toBeGreaterThan(0.3);
  });

  it('recirculation index matches S6 expectation (~0.67)', () => {
    expect(recirculationIndex(0.04, 0.1)).toBeCloseTo(0.667, 2);
  });

  it('minimum submergence matches S7 expectation (~0.77 m)', () => {
    const p = defaultPlant();
    const V = 0.1 / (Math.PI / 4 * p.source.bellD ** 2);
    expect(minSubmergence(p.source.bellD, V)).toBeCloseTo(0.7645, 3);
  });

  it('air ingestion index matches S7 expectation (~0.35)', () => {
    expect(airIngestionIndex(0.5, 0.7646)).toBeCloseTo(0.35, 2);
  });

  it('cavity state thresholds follow the specification', () => {
    const th = { incipient: 2.0, developed: 1.6, severe: 1.0, breakdown: 0.75 };
    expect(cavityState(2.3, th)).toBe('NONE');
    expect(cavityState(1.8, th)).toBe('INCIPIENT');
    expect(cavityState(1.3, th)).toBe('DEVELOPED');
    expect(cavityState(0.9, th)).toBe('SEVERE');
    expect(cavityState(0.5, th)).toBe('BREAKDOWN');
  });

  it('damage rate grows super-linearly with cavitation intensity', () => {
    const d0 = damageRate(0, 0, 0, 0.002);
    const d1 = damageRate(0.5, 0, 0, 0.002);
    const d2 = damageRate(1, 0, 0, 0.002);
    expect(d0).toBe(0);
    expect(d1).toBeGreaterThan(0);
    expect(d2).toBeGreaterThan(d1 * 3);
  });
});
