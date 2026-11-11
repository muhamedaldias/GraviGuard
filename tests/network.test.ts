import { describe, it, expect } from 'vitest';
import { sourceResistance, sourceHead, tankHead, junctionLossHead, velocityHead, solveJunction } from '../src/sim/network';
import { defaultPlant } from '../src/sim/defaults';

describe('suction network (Section 4.4)', () => {
  const p = defaultPlant();

  it('source resistance gives ~0.16 m loss at BEP', () => {
    const R = sourceResistance(p);
    const h = R * 0.1 * 0.1;
    expect(h).toBeGreaterThan(0.14);
    expect(h).toBeLessThan(0.18);
  });

  it('source head with z=+1.0 m is ~11.08 m', () => {
    expect(sourceHead(p)).toBeCloseTo(11.08, 2);
  });

  it('tank head with full tank is ~25.08 m', () => {
    const hMax = p.tank.V_usable / p.tank.area;
    expect(tankHead(p, hMax)).toBeCloseTo(10.08 + 10 + 5, 2);
  });

  it('junction loss is small', () => {
    expect(junctionLossHead(0.1, p)).toBeLessThan(0.05);
  });

  it('velocity head at BEP is ~0.032 m', () => {
    expect(velocityHead(0.1, p)).toBeCloseTo(0.0323, 3);
  });

  it('junction solve recovers the source-only head at BEP', () => {
    const H_S = sourceHead(p);
    const R_S = sourceResistance(p);
    const sol = solveJunction(H_S, 0, R_S, Infinity, 0.1, 0);
    expect(sol.H_J).toBeCloseTo(H_S - R_S * 0.01, 3);
    expect(sol.Q_S).toBeCloseTo(0.1, 6);
    expect(sol.checkValveOpen).toBe(true);
  });

  it('check valve closes when the tank alone over-supplies demand', () => {
    const H_S = sourceHead(p);
    const H_T = tankHead(p, 5);
    const sol = solveJunction(H_S, H_T, sourceResistance(p), 58.13, 0.1, 0.2);
    expect(sol.checkValveOpen).toBe(false);
    expect(sol.Q_S).toBe(0);
  });

  it('both branches supply when the tank head barely exceeds the source', () => {
    const H_S = sourceHead(p);
    const H_T = tankHead(p, 5);
    // High branch resistance (partly closed valve): the tank alone cannot
    // supply the demand at source head, so the source makes up the difference.
    const sol = solveJunction(H_S, H_T, sourceResistance(p), 2000, 0.1, 0.02);
    expect(sol.Q_S).toBeCloseTo(0.08, 2);
    expect(sol.checkValveOpen).toBe(true);
  });

  it('tank alone supplies when its head is high and resistance low', () => {
    const H_S = sourceHead(p);
    const H_T = tankHead(p, 5);
    const sol = solveJunction(H_S, H_T, sourceResistance(p), 58.13, 0.1, 0.02);
    expect(sol.Q_S).toBe(0);
    expect(sol.checkValveOpen).toBe(false);
    expect(sol.H_J).toBeCloseTo(H_T - 58.13 * 0.01, 3);
  });
});
