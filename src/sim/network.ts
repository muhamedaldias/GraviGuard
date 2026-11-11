// Suction network hydraulics and GraviGuard tank branch (Section 4.4).
// Heads are measured in metres of fluid relative to the pump axis.

import { G, PlantParams } from './types';
import { branchArea, valveResistance } from './valve';

export function suctionArea(p: PlantParams): number {
  return (Math.PI / 4) * p.suction.D * p.suction.D;
}

export function sourceResistance(p: PlantParams): number {
  const A = suctionArea(p);
  const K =
    p.suction.f * (p.suction.L / p.suction.D) + p.suction.K_fittings + p.suction.K_strainer;
  return K / (2 * G * A * A);
}

/** Absolute head at the source free surface (m). */
export function sourceHead(p: PlantParams): number {
  return p.fluid.Patm / (p.fluid.rho * G) + p.source.z_level;
}

/** Absolute head delivered by the elevated tank at level h (m). */
export function tankHead(p: PlantParams, h: number): number {
  return p.fluid.Patm / (p.fluid.rho * G) + p.tank.z_tb + h;
}

/** Head loss from junction J to the pump flange (m). */
export function junctionLossHead(Q: number, p: PlantParams): number {
  const A = suctionArea(p);
  const V = Q / A;
  return p.suction.K_J * (V * V) / (2 * G);
}

/** Velocity head in the suction line (m). */
export function velocityHead(Q: number, p: PlantParams): number {
  const A = suctionArea(p);
  const V = Q / A;
  return (V * V) / (2 * G);
}

export interface JunctionSolution {
  H_J: number;
  Q_S: number;
  checkValveOpen: boolean;
}

/**
 * Solve the junction head H_J given pump demand Q and tank-branch flow Q_T.
 *
 * The tank branch cannot push more than the pump demands (the check valve
 * blocks backflow and there is no other outlet), so Q_T <= Q always. When the
 * source branch is open (Q_S = Q - Q_T > 0) the junction pressure is set by
 * the source; otherwise the tank alone sets it and Q_T relaxes towards Q
 * through its inertia ODE. This keeps the coupled solve robust.
 */
export function solveJunction(
  H_S: number,
  H_T: number,
  R_S: number,
  R_T: number,
  Q: number,
  Q_T: number,
  allowBackflow = false,
): JunctionSolution {
  const Qt = Math.max(0, Q_T);
  // Leaking check valve: the tank can push water back to the source, but only
  // when it can actually raise the junction above the source head.
  if (allowBackflow && Number.isFinite(R_T)) {
    const H_J = H_T - R_T * Q * Q;
    if (H_J > H_S) {
      const Q_S = -Math.sqrt((H_J - H_S) / R_S);
      return { H_J, Q_S, checkValveOpen: false };
    }
  }
  // Can the tank alone supply the demand at a head above the source? If so the
  // check valve is shut and the tank branch sets the junction pressure.
  const qtAtSource = Number.isFinite(R_T) ? Math.sqrt(Math.max(0, H_T - H_S) / R_T) : 0;
  if (qtAtSource >= Q) {
    const H_J = Number.isFinite(R_T) ? H_T - R_T * Q * Q : H_S;
    return { H_J, Q_S: 0, checkValveOpen: false };
  }
  // Otherwise the source must supply at least part of the demand, so the
  // junction head cannot exceed the source head.
  const Qs = Math.max(0, Q - Qt);
  if (Number.isFinite(R_S)) {
    return { H_J: H_S - R_S * Qs * Qs, Q_S: Qs, checkValveOpen: Qs > 0 };
  }
  const H_J = Number.isFinite(R_T) ? H_T - R_T * Q * Q : H_S;
  return { H_J, Q_S: 0, checkValveOpen: false };
}

/** Branch cross-sectional area (m^2). */
export { branchArea, valveResistance };
