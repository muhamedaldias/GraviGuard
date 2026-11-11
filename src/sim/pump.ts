// Pump module (Section 4.3). Pure functions over PumpParams.

import { G } from './types';
import type { PumpParams } from './types';

export type { PumpParams } from './types';

/** Pump head (m) at flow Q and speed fraction n. */
export function pumpHead(Q: number, p: PumpParams): number {
  const n = p.n;
  return (p.H_shutoff - p.kHead * (Q / n) * (Q / n)) * n * n;
}

/** NPSH required, 3% head-drop point (m). */
export function pumpNPSH3(Q: number, p: PumpParams): number {
  const n = p.n;
  const r = Q / p.Q_BEP;
  return (p.npsh3a + p.npsh3b * r * r) * n * n;
}

/** Efficiency (fraction) — parabola peaking at BEP, floored at 0.05. */
export function pumpEfficiency(Q: number, p: PumpParams): number {
  const r = Q / p.Q_BEP;
  return Math.max(0.05, p.eta0 * (1 - 0.9 * (r - 1) * (r - 1)));
}

/** Shaft power (W). */
export function pumpPower(Q: number, H: number, p: PumpParams, rho: number): number {
  const eta = pumpEfficiency(Q, p);
  return (rho * G * Q * H) / eta;
}

/** Flow at which the bare pump curve reaches zero head. */
export function pumpRunoutFlow(p: PumpParams): number {
  return p.n * Math.sqrt(p.H_shutoff / p.kHead);
}

/**
 * Suction specific speed (US customary units, per eye).
 * Nss = N[rpm] * sqrt(Q[gpm]) / NPSH3[ft]^0.75
 */
export function suctionSpecificSpeedUS(Nrpm: number, Qgpm: number, npsh3ft: number): number {
  if (npsh3ft <= 0) return 0;
  return (Nrpm * Math.sqrt(Math.max(Qgpm, 0))) / Math.pow(npsh3ft, 0.75);
}

/** Metric suction specific speed (m^3/s, m, rpm) = US / 51.6. */
export function suctionSpecificSpeedMetric(Nrpm: number, Qm3s: number, npsh3m: number): number {
  return suctionSpecificSpeedUS(Nrpm, Qm3s * 15850.32314, npsh3m * 3.280839895) / 51.6;
}

/** Specific speed Ns (US: gpm, ft) — pump category descriptor. */
export function specificSpeedUS(Nrpm: number, Qgpm: number, Hft: number): number {
  if (Hft <= 0) return 0;
  return (Nrpm * Math.sqrt(Qgpm)) / Math.pow(Hft, 0.75);
}

/** Metric specific speed nq = N[rpm]*sqrt(Q[m3/s])/H[m]^0.75. */
export function specificSpeedMetric(Nrpm: number, Qm3s: number, Hm: number): number {
  if (Hm <= 0) return 0;
  return (Nrpm * Math.sqrt(Math.max(Qm3s, 0))) / Math.pow(Hm, 0.75);
}

export function pumpCategoryNs(ns: number): 'radial' | 'mixed' | 'axial' {
  if (ns < 4000) return 'radial';
  if (ns < 9000) return 'mixed';
  return 'axial';
}

export function pumpCategoryNq(nq: number): 'radial' | 'mixed' | 'axial' {
  if (nq < 50) return 'radial';
  if (nq < 100) return 'mixed';
  return 'axial';
}
