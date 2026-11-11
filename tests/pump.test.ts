import { describe, it, expect } from 'vitest';
import { pumpHead, pumpNPSH3, pumpEfficiency, pumpPower, pumpRunoutFlow, suctionSpecificSpeedUS, suctionSpecificSpeedMetric } from '../src/sim/pump';
import { defaultPlant } from '../src/sim/defaults';

describe('pump module (Section 4.3)', () => {
  const p = defaultPlant().pump;

  it('reference pump curve passes through BEP', () => {
    expect(pumpHead(p.Q_BEP, p)).toBeCloseTo(p.H_BEP, 6);
  });

  it('shutoff head at Q=0', () => {
    expect(pumpHead(0, p)).toBeCloseTo(p.H_shutoff, 6);
  });

  it('NPSH3 at BEP is 4.5 m', () => {
    expect(pumpNPSH3(p.Q_BEP, p)).toBeCloseTo(4.5, 6);
  });

  it('NPSH3 at run-out (0.126 m3/s) is ~5.3 m', () => {
    expect(pumpNPSH3(0.126, p)).toBeCloseTo(5.3, 1);
  });

  it('NPSH3 scales with speed squared', () => {
    const slow = { ...p, n: 0.8 };
    expect(pumpNPSH3(p.Q_BEP, slow)).toBeCloseTo(4.5 * 0.64, 6);
  });

  it('head scales with speed squared at similar flow', () => {
    const slow = { ...p, n: 0.8 };
    const qSlow = p.Q_BEP * 0.8;
    expect(pumpHead(qSlow, slow)).toBeCloseTo(p.H_BEP * 0.64, 4);
  });

  it('efficiency peaks at BEP and floors at 0.05', () => {
    expect(pumpEfficiency(p.Q_BEP, p)).toBeCloseTo(p.eta0, 6);
    expect(pumpEfficiency(0.25, p)).toBe(0.05);
  });

  it('runout flow is 0.211 m3/s', () => {
    expect(pumpRunoutFlow(p)).toBeCloseTo(0.211, 2);
  });

  it('shaft power is positive at BEP', () => {
    const power = pumpPower(p.Q_BEP, p.H_BEP, p, 1025);
    expect(power).toBeGreaterThan(40000);
    expect(power).toBeLessThan(60000);
  });

  it('suction specific speed ~7800 US for the reference pump', () => {
    const nss = suctionSpecificSpeedUS(1480, 0.1 * 15850.32314, 4.5 * 3.280839895);
    expect(nss).toBeGreaterThan(7000);
    expect(nss).toBeLessThan(8600);
  });

  it('metric suction specific speed ~151', () => {
    const nss = suctionSpecificSpeedMetric(1480, 0.1, 4.5);
    expect(nss).toBeGreaterThan(140);
    expect(nss).toBeLessThan(165);
  });
});
