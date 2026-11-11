// Valve module (Section 4.5). Equal-percentage characteristic.

import { G, BranchParams } from './types';

export function valveCv(theta: number, p: BranchParams): number {
  if (theta <= 0) return 0;
  return p.Cv_max * Math.pow(p.R, theta - 1);
}

/** Branch resistance R_T (s^2/m^5) at valve position theta (0..1). */
export function valveResistance(theta: number, p: BranchParams): number {
  const Cv = valveCv(theta, p);
  if (Cv <= 1e-12) return Number.POSITIVE_INFINITY;
  const A = (Math.PI / 4) * p.D * p.D;
  const K = p.K_open * Math.pow(p.Cv_max / Cv, 2);
  return K / (2 * G * A * A);
}

/** Branch cross-sectional area (m^2). */
export function branchArea(p: BranchParams): number {
  return (Math.PI / 4) * p.D * p.D;
}

/** Flow through the branch for a given head difference and valve position. */
export function branchFlow(dH: number, theta: number, p: BranchParams): number {
  if (dH <= 0) return 0;
  const R = valveResistance(theta, p);
  if (!Number.isFinite(R)) return 0;
  return Math.sqrt(dH / R);
}

/** Linear slew rate limit (fraction/s) from full-stroke time. */
export function slewRate(p: { strokeTime: number }): number {
  return 1 / Math.max(p.strokeTime, 0.1);
}

/**
 * Move valve position toward target respecting the actuator slew rate.
 * Returns the new position.
 */
export function moveValve(theta: number, target: number, maxDelta: number): number {
  const d = Math.max(-maxDelta, Math.min(maxDelta, target - theta));
  return Math.max(0, Math.min(1, theta + d));
}
