// Fluid properties (Section 2, E3).
// Antoine equation for water 1-100 deg C, with a seawater vapour-pressure
// depression factor (0.981 ~ -2%). All functions are pure.

import { G } from './types';

/** Saturation vapour pressure in Pa. */
export function vaporPressurePa(T: number, seawaterFactor = 1): number {
  const mmHg = Math.pow(10, 8.07131 - 1730.63 / (233.426 + T));
  return mmHg * 133.322 * seawaterFactor;
}

/** Vapour pressure head in m of fluid. */
export function vaporPressureHead(T: number, rho: number, seawaterFactor = 1): number {
  return vaporPressurePa(T, seawaterFactor) / (rho * G);
}

/**
 * Density of water. Constant by default; optional linear temperature
 * correction (fractional change per 1000 K-ish, small).
 */
export function densityWater(T: number, rho0: number, correctionPer100C = 0): number {
  if (correctionPer100C === 0) return rho0;
  return rho0 * (1 - (correctionPer100C * (T - 20)) / 100);
}

/** Atmospheric pressure head in m of fluid. */
export function atmosphericHead(Patm: number, rho: number): number {
  return Patm / (rho * G);
}

/** Estimate altitude from atmospheric pressure (barometric, ISA-ish). */
export function altitudeFromPressure(Patm: number): number {
  return 44330 * (1 - Math.pow(Patm / 101325, 1 / 5.255));
}
