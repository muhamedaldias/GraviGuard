// Monte Carlo and parametric sweep (Sections 5 S14/S15, 6.11).
import { SimEngine } from './engine';
import { defaultPlant } from './defaults';
import type { PlantParams } from './types';
import { RngStream } from './prng';

export interface MCParams {
  runs: number;
  duration: number;
  dt?: number;
  varyTank?: boolean;
  varyStroke?: boolean;
}

export interface MCResult {
  count: number;
  minR: number[];
  damage: number[];
  tankUsed: number[];
  pRBelow15: number;
  meanDamage: number;
  p95Tank: number;
  onStats: { pRBelow15: number; meanDamage: number; p95Tank: number };
  offStats: { pRBelow15: number; meanDamage: number; p95Tank: number };
}

/** Chunked Monte Carlo so the UI stays responsive. */
export async function runMonteCarlo(
  opts: MCParams,
  onProgress: (fraction: number) => void,
): Promise<MCResult> {
  const dt = opts.dt ?? 0.02;
  const rng = new RngStream(20240115);
  const minR: number[] = [];
  const damage: number[] = [];
  const tankUsed: number[] = [];
  const minRoff: number[] = [];
  const damageOff: number[] = [];
  const tankOff: number[] = [];

  for (let i = 0; i < opts.runs; i++) {
    const params: PlantParams = defaultPlant();
    params.source.z_level = -4.5 + rng.range(0, 5.5);
    params.suction.K_strainer = 2 + rng.range(0, 78);
    params.fluid.T = 30 + rng.range(0, 30);
    params.sensors.noiseScale = 0.5 + rng.range(0, 2.5);
    params.valve.strokeTime = 3 + rng.range(0, 57);
    if (opts.varyTank) params.tank.V_usable = 50 + rng.range(0, 200);
    const seed = 1000 + i;

    const run = (mode: 'ON' | 'OFF') => {
      const e = new SimEngine({ params: structuredClone(params), seed, recordInterval: 1 });
      e.setInput('mode', mode);
      e.run(opts.duration, dt);
      const hist = e.getHistory();
      return {
        minR: Math.min(...hist.map((h) => h.R)),
        damage: e.state.damage,
        tank: Math.max(0, (params.tank.V_usable / params.tank.area - Math.min(...hist.map((h) => h.tankH))) * params.tank.area),
      };
    };
    const on = run('ON');
    const off = run('OFF');
    minR.push(on.minR);
    damage.push(on.damage);
    tankUsed.push(on.tank);
    minRoff.push(off.minR);
    damageOff.push(off.damage);
    tankOff.push(off.tank);

    if (i % 10 === 0) {
      onProgress((i + 1) / opts.runs);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const stats = (r: number[], d: number[], tk: number[]) => ({
    pRBelow15: r.filter((x) => x < 1.5).length / r.length,
    meanDamage: d.reduce((a, b) => a + b, 0) / d.length,
    p95Tank: percentile(tk, 0.95),
  });

  return {
    count: opts.runs,
    minR,
    damage,
    tankUsed,
    ...stats(minR, damage, tankUsed),
    onStats: stats(minR, damage, tankUsed),
    offStats: stats(minRoff, damageOff, tankOff),
  };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))));
  return s[idx];
}

export interface ContourResult {
  xs: number[];
  ys: number[];
  values: number[][];
}

/** Tank elevation × stroke time sweep (S15). */
export async function runContour(
  onProgress: (f: number) => void,
): Promise<{ minR: ContourResult; surge: ContourResult }> {
  const xs = [5, 7.5, 10, 12.5, 15, 17.5, 20];
  const ys = [3, 6, 12, 20, 30, 45, 60];
  const minR: ContourResult = { xs, ys, values: [] };
  const surge: ContourResult = { xs, ys, values: [] };
  let done = 0;
  for (const elev of xs) {
    const rRow: number[] = [];
    const sRow: number[] = [];
    for (const stroke of ys) {
      const p = defaultPlant();
      p.tank.z_tb = elev;
      p.valve.strokeTime = stroke;
      const e = new SimEngine({ params: p, seed: 777, recordInterval: 1 });
      e.setInput('mode', 'ON');
      e.setInput('z_level', -3);
      e.setInput('K_strainer', 40);
      e.run(400, 0.02);
      const hist = e.getHistory();
      rRow.push(Math.min(...hist.map((h) => h.R)));
      sRow.push(Math.max(...hist.map((h) => h.surge)));
      done++;
      onProgress(done / (xs.length * ys.length));
      await new Promise((r) => setTimeout(r, 0));
    }
    minR.values.push(rRow);
    surge.values.push(sRow);
  }
  return { minR, surge };
}
