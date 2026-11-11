import { describe, it, expect } from 'vitest';
import { vaporPressurePa, vaporPressureHead, atmosphericHead } from '../src/sim/fluid';
import { G } from '../src/sim/types';

describe('fluid module (E3)', () => {
  it('Antoine vapour pressure for water at 35 C', () => {
    // 42.1 mmHg -> 5.61 kPa
    const pv = vaporPressurePa(35, 1);
    expect(pv).toBeGreaterThan(5500);
    expect(pv).toBeLessThan(5700);
  });

  it('seawater factor reduces vapour pressure by ~2%', () => {
    const fresh = vaporPressurePa(35, 1);
    const sea = vaporPressurePa(35, 0.981);
    expect(sea / fresh).toBeCloseTo(0.981, 5);
  });

  it('reference plant vapour pressure head is ~0.55 m', () => {
    const h = vaporPressureHead(35, 1025, 0.981);
    expect(h).toBeGreaterThan(0.53);
    expect(h).toBeLessThan(0.57);
  });

  it('atmospheric head at sea level is ~10.33 m of water', () => {
    const h = atmosphericHead(101325, 1000);
    expect(h).toBeCloseTo(10.33, 2);
  });

  it('atmospheric head for seawater is ~10.08 m', () => {
    const h = atmosphericHead(101325, 1025);
    expect(h).toBeCloseTo(10.08, 2);
  });

  it('vapour pressure rises steeply with temperature', () => {
    const h35 = vaporPressureHead(35, 1025, 0.981);
    const h60 = vaporPressureHead(60, 1025, 0.981);
    expect(h60 / h35).toBeGreaterThan(3);
    expect(h60).toBeGreaterThan(1.5);
  });

  it('G is 9.80665', () => {
    expect(G).toBe(9.80665);
  });
});
