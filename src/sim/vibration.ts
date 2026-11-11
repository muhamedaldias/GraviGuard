// Synthetic vibration and acoustic signals (Section 4.7).
// Secondary confirmation only — never the primary trigger.

export interface Spectrum {
  freqs: Float64Array;
  amps: Float64Array;
}

export interface VibrationParams {
  a0: number; // baseline RMS m/s^2
  a1: number; // cavitation contribution
  a2: number; // recirculation contribution
  a3: number; // air ingestion contribution
}

export const DEFAULT_VIBRATION: VibrationParams = {
  a0: 0.05,
  a1: 0.6,
  a2: 0.25,
  a3: 0.3,
};

/** Broadband RMS acceleration (m/s^2). */
export function vibrationRMS(
  CI: number,
  RI: number,
  AI: number,
  noise = 0,
  vp: VibrationParams = DEFAULT_VIBRATION,
): number {
  const base = vp.a0 + vp.a1 * Math.pow(CI, 1.2) + vp.a2 * RI + vp.a3 * AI;
  return Math.max(0, base * (1 + noise));
}

/**
 * Generate a synthetic spectrum: shaft frequency, vane-pass, 2x, a 2-20 kHz
 * broadband cavitation hump, low-frequency recirculation modulation, and a
 * flat noise floor. Log-spaced bins.
 */
export function vibrationSpectrum(
  CI: number,
  RI: number,
  AI: number,
  Nrpm: number,
  vanes: number,
  n: number,
  bins = 256,
  fMax = 20000,
): Spectrum {
  const freqs = new Float64Array(bins);
  const amps = new Float64Array(bins);
  const f0 = 1;
  const logMin = Math.log10(f0);
  const logMax = Math.log10(fMax);
  const shaft = (Nrpm / 60) * n;
  const vanePass = vanes * shaft;
  const floor = 0.002;
  for (let i = 0; i < bins; i++) {
    const f = Math.pow(10, logMin + (i / (bins - 1)) * (logMax - logMin));
    freqs[i] = f;
    let a = floor;
    // Discrete tones (shaft, vane pass, 2x) with slight broadband spreading.
    a += gaussianBump(f, shaft, shaft * 0.03) * (0.25 + 0.35 * CI);
    a += gaussianBump(f, vanePass, vanePass * 0.04) * (0.2 + 0.5 * CI);
    a += gaussianBump(f, 2 * vanePass, 2 * vanePass * 0.05) * (0.1 + 0.3 * CI);
    // Cavitation broadband hump 2-20 kHz.
    if (f >= 2000 && f <= fMax) {
      const centre = 8000;
      a += CI * 0.9 * gaussianBump(f, centre, 5000);
    }
    // Recirculation low-frequency modulation.
    if (f < 20) {
      a += RI * 0.4 * gaussianBump(f, 3, 2);
    }
    // Air ingestion adds mid-band energy.
    if (f >= 200 && f <= 2000) {
      a += AI * 0.3 * gaussianBump(f, 700, 400);
    }
    amps[i] = Math.max(0, a);
  }
  return { freqs, amps };
}

function gaussianBump(f: number, centre: number, width: number): number {
  const x = (f - centre) / Math.max(width, 1e-6);
  return Math.exp(-0.5 * x * x);
}

/** High-frequency (2-20 kHz) RMS extracted from a spectrum. */
export function hfRms(spec: Spectrum): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < spec.freqs.length; i++) {
    if (spec.freqs[i] >= 2000) {
      sum += spec.amps[i] * spec.amps[i];
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}
