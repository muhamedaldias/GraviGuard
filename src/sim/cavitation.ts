// Cavitation, recirculation, air ingestion and damage (Sections 4.3, 4.6).
// All indices are dimensionless and illustrative — not a life prediction.

import { G, CavityState } from './types';

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Pump head drop fraction as a function of margin ratio R = NPSHa/NPSH3.
 * 3% head drop is by definition at R = 1; breakdown develops for R <~ 0.6.
 */
export function headDropFraction(R: number): number {
  if (R >= 1) return 0.03 * Math.exp(-8 * (R - 1));
  const x = (1 - R) / 0.25;
  return 0.03 + 0.97 * (1 - Math.exp(-Math.pow(x, 1.5)));
}

/** Cavitation intensity 0..1 between incipient (R_inc) and breakdown (R_brk). */
export function cavitationIntensity(R: number, R_inc: number, R_brk: number): number {
  if (R >= R_inc) return 0;
  if (R <= R_brk) return 1;
  return Math.pow((R_inc - R) / (R_inc - R_brk), 1.5);
}

/** Low-flow recirculation index (separate mechanism; never reduced by GraviGuard). */
export function recirculationIndex(Q: number, Q_BEP: number): number {
  return clamp((0.6 - Q / Q_BEP) / 0.3, 0, 1);
}

export function froudeNumber(V: number, D: number): number {
  return V / Math.sqrt(G * D);
}

/** Minimum required submergence S >= D(1 + 2.3 Fr) per ANSI/HI 9.8. */
export function minSubmergence(D_bell: number, V: number): number {
  return D_bell * (1 + 2.3 * froudeNumber(V, D_bell));
}

/** Air-ingestion / vortex index from actual submergence S and minimum S_min. */
export function airIngestionIndex(S: number, S_min: number): number {
  if (S_min <= 0) return 0;
  return clamp((S_min - S) / S_min, 0, 1);
}

export interface CavityThresholds {
  incipient: number;
  developed: number;
  severe: number;
  breakdown: number;
}

export function cavityState(R: number, th: CavityThresholds): CavityState {
  if (R >= th.incipient) return 'NONE';
  if (R >= th.developed) return 'INCIPIENT';
  if (R >= th.severe) return 'DEVELOPED';
  if (R >= th.breakdown) return 'SEVERE';
  return 'BREAKDOWN';
}

/** Normalised damage rate (illustrative). */
export function damageRate(CI: number, RI: number, AI: number, k_e: number): number {
  return k_e * (Math.pow(CI, 2.5) + 0.4 * RI * RI + 0.3 * AI * AI);
}

/** Pit density (pits per unit area proxy) from accumulated damage. */
export function pitDensity(damage: number): number {
  return clamp(damage, 0, 1);
}
