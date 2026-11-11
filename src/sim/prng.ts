// Deterministic seeded PRNG (mulberry32) + Gaussian helper.
// Identical seed => bit-identical streams, which is a hard requirement of the
// simulation contract (Section 4.1).

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RngStream {
  private next: Rng;
  constructor(seed: number) {
    this.next = mulberry32(seed);
  }
  /** Uniform in [0, 1). */
  uniform(): number {
    return this.next();
  }
  /** Uniform in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  /** Standard normal via Box-Muller (deterministic). */
  gaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  /** Approximately normal, bounded to +/-3 sigma (for bounded noise). */
  boundedGaussian(): number {
    const g = this.gaussian();
    return Math.max(-3, Math.min(3, g)) / 3;
  }
}

export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
