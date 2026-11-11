// Reference Plant defaults (Section 3) and default inputs.
// Every value here is synthetic and editable in the UI.

import { PlantParams, SimInputs } from './types';

export function defaultPlant(): PlantParams {
  return {
    fluid: {
      rho: 1025,
      T: 35,
      seawaterFactor: 0.981,
      Patm: 101325,
    },
    pump: {
      Q_BEP: 0.1,
      H_BEP: 45,
      H_shutoff: 58,
      kHead: 1300,
      N0: 1480,
      n: 1.0,
      eta0: 0.82,
      npsh3a: 3.2,
      npsh3b: 1.3,
      eyeDiameter: 0.2,
      vanes: 6,
      tauQ: 0.6,
    },
    discharge: {
      H_static: 25,
      k: 2000,
    },
    suction: {
      D: 0.4,
      L: 30,
      f: 0.018,
      K_fittings: 1.5,
      K_strainer: 2.0,
      K_J: 0.8,
    },
    source: {
      z_level: 1.0,
      bellD: 0.5,
      z_bell: -5.0,
    },
    tank: {
      V_usable: 50,
      area: 10,
      z_tb: 10,
      reserveFrac: 0.1,
      refillQ: 0.05,
    },
    branch: {
      D: 0.3,
      L: 40,
      K_open: 5.7,
      R: 50,
      Cv_max: 1.0,
      waveSpeed: 1000,
    },
    valve: {
      strokeTime: 12,
      stuck: false,
    },
    controller: {
      R_arm: 1.9,
      R_pred: 1.6,
      T_pred_extra: 10,
      R_inject: 1.6,
      injectDelay: 2,
      R_target: 1.7,
      holdBand: 0.05,
      holdTime: 10,
      R_recover: 2.0,
      recoverTime: 60,
      Kp: 0.12,
      Ki: 0.001,
      minDwell: 20,
      maxCyclesPerHour: 3,
      strategy: 'B',
      vfdFallbackSpeed: 0.85,
      tripOnFault: false,
      k_e: 0.002,
      R_inc: 2.0,
      R_brk: 0.6,
      cavStateThresholds: { incipient: 2.0, developed: 1.6, severe: 1.0, breakdown: 0.75 },
    },
    sensors: {
      sigmaP: 500,
      sigmaT: 0.2,
      sigmaQ: 0.01,
      sigmaLevel: 0.02,
      lagP: 0.2,
      quantBits: 12,
      noiseScale: 1,
      faults: {
        pressureDrift: 0,
        pressureStuck: false,
        pressureDropout: false,
        checkValveLeak: false,
        valveStuck: false,
      },
    },
  };
}

export function defaultInputs(p: PlantParams = defaultPlant()): SimInputs {
  return {
    z_level: p.source.z_level,
    K_strainer: p.suction.K_strainer,
    T: p.fluid.T,
    k_discharge: p.discharge.k,
    n: p.pump.n,
    z_bell: p.source.z_bell,
    noiseScale: 1,
    valveStuck: false,
    pressureDrift: 0,
    pressureStuck: false,
    pressureDropout: false,
    checkValveLeak: false,
    mode: 'ON',
    manualValve: 0,
  };
}

/** Tank level bounds from usable volume and area. */
export function tankLevelBounds(p: PlantParams): { hMin: number; hMax: number; hReserve: number } {
  const hMax = p.tank.V_usable / p.tank.area;
  const hReserve = hMax * p.tank.reserveFrac;
  return { hMin: 0, hMax, hReserve };
}

export const MODEL_VERSION = '1.0.0';
export const PHYSICS_DT = 0.01;
export const UI_HZ = 30;
