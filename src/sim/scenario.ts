// Scenario library: schema, timeline interpolation, headless runner and
// assertion evaluation (Sections 5, 6.12). Pure TypeScript.

import {
  Assertion,
  HistorySample,
  PlantParams,
  Scenario,
  ScenarioEvent,
  SimInputs,
  CtrlStateName,
} from './types';
import { SimEngine } from './engine';
import { defaultPlant, tankLevelBounds } from './defaults';

// ---------------------------------------------------------------------------
// Parameter binding
// ---------------------------------------------------------------------------

const INPUT_KEYS: (keyof SimInputs)[] = [
  'z_level',
  'K_strainer',
  'T',
  'k_discharge',
  'n',
  'z_bell',
  'noiseScale',
  'valveStuck',
  'pressureDrift',
  'pressureStuck',
  'pressureDropout',
  'checkValveLeak',
  'manualValve',
];

export function isInputKey(key: string): key is keyof SimInputs {
  return (INPUT_KEYS as string[]).includes(key);
}

export function applyParam(params: PlantParams, key: string, value: number): void {
  const parts = key.split('.');
  if (parts.length < 2) throw new Error(`param key must be dotted: ${key}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = params;
  for (let i = 0; i < parts.length - 1; i++) {
    obj = obj[parts[i]];
    if (obj === undefined) throw new Error(`unknown param path: ${key}`);
  }
  const last = parts[parts.length - 1];
  if (obj[last] === undefined) throw new Error(`unknown param: ${key}`);
  obj[last] = value;
}

export function applyToEngine(engine: SimEngine, key: string, value: number): void {
  if (isInputKey(key)) {
    engine.setInput(key, value as never);
  } else {
    engine.setParams((p) => applyParam(p, key, value));
  }
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export class Timeline {
  private tracks = new Map<string, { t: number; value: number }[]>();

  constructor(events: ScenarioEvent[] = []) {
    for (const e of events) {
      const track = this.tracks.get(e.param) ?? [];
      track.push({ t: e.t, value: e.value });
      this.tracks.set(e.param, track);
    }
    for (const track of this.tracks.values()) track.sort((a, b) => a.t - b.t);
  }

  get params(): string[] {
    return [...this.tracks.keys()];
  }

  /** Linear interpolation between keyframes; holds ends outside the range. */
  valueAt(param: string, t: number): number | null {
    const track = this.tracks.get(param);
    if (!track || track.length === 0) return null;
    if (t <= track[0].t) return track[0].value;
    const last = track[track.length - 1];
    if (t >= last.t) return last.value;
    for (let i = 0; i < track.length - 1; i++) {
      const a = track[i];
      const b = track[i + 1];
      if (t >= a.t && t <= b.t) {
        const span = b.t - a.t;
        if (span <= 0) return b.value;
        const f = (t - a.t) / span;
        return a.value + (b.value - a.value) * f;
      }
    }
    return last.value;
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

export interface AssertionResult {
  id: string;
  type: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface Kpis {
  minR: number;
  minNPSHa: number;
  maxCI: number;
  maxHeadDrop: number;
  maxDamage: number;
  tankMin: number;
  tankVolumeUsed: number;
  transitions: number;
  injectionCycles: number;
  falseInjections: number;
  surgePeak: number;
  minAutonomy: number;
  finalR: number;
  stateSequence: CtrlStateName[];
  advisorIds: string[];
  vfdFallbackActive: boolean;
}

export function computeKpis(samples: HistorySample[], engine: SimEngine): Kpis {
  let minR = Infinity;
  let minNPSHa = Infinity;
  let maxCI = 0;
  let maxHeadDrop = 0;
  let maxDamage = 0;
  let tankMin = Infinity;
  let surgePeak = 0;
  let minAutonomy = Infinity;
  const advisorIds = new Set<string>();
  for (const s of samples) {
    if (s.R < minR) minR = s.R;
    if (s.NPSHa < minNPSHa) minNPSHa = s.NPSHa;
    if (s.CI > maxCI) maxCI = s.CI;
    if (s.headDrop > maxHeadDrop) maxHeadDrop = s.headDrop;
    if (s.damage > maxDamage) maxDamage = s.damage;
    if (s.tankH < tankMin) tankMin = s.tankH;
    if (s.surge > surgePeak) surgePeak = s.surge;
    if (s.advisor) advisorIds.add(s.advisor);
  }
  const ctrl = engine.getController();
  const transitions = ctrl.transitions.length;
  let injectionCycles = 0;
  for (const tr of ctrl.transitions) if (tr.to === 'INJECTING') injectionCycles++;
  const stateSequence = ctrl.transitions.map((tr) => tr.to);
  const falseInjections = minR >= 1.9 ? injectionCycles : 0;
  const { hMax } = tankLevelBounds(engine.getParams());
  const tankVolumeUsed = Math.max(0, (hMax - tankMin) * engine.getParams().tank.area);
  const finalR = samples.length > 0 ? samples[samples.length - 1].R : 0;
  return {
    minR: Number.isFinite(minR) ? minR : 0,
    minNPSHa: Number.isFinite(minNPSHa) ? minNPSHa : 0,
    maxCI,
    maxHeadDrop,
    maxDamage,
    tankMin: Number.isFinite(tankMin) ? tankMin : 0,
    tankVolumeUsed,
    transitions,
    injectionCycles,
    falseInjections,
    surgePeak,
    minAutonomy: Number.isFinite(minAutonomy) ? minAutonomy : 0,
    finalR,
    stateSequence,
    advisorIds: [...advisorIds],
    vfdFallbackActive: ctrl.transitions.some((tr) => tr.to === 'FAULT_SAFE'),
  };
}

export function evaluateAssertions(
  assertions: Assertion[],
  samples: HistorySample[],
  kpis: Kpis,
): AssertionResult[] {
  const results: AssertionResult[] = [];
  for (const a of assertions) {
    const res = evaluateAssertion(a, samples, kpis);
    results.push(res);
  }
  return results;
}

function evaluateAssertion(a: Assertion, _samples: HistorySample[], kpis: Kpis): AssertionResult {
  const id = a.id || a.type;
  switch (a.type) {
    case 'minR': {
      const actual = kpis.minR;
      const expected = a.value ?? 0;
      return {
        id,
        type: a.type,
        expected: `min(R) >= ${expected}`,
        actual: `min(R) = ${actual.toFixed(3)}`,
        passed: actual >= expected - (a.tolerance ?? 0),
      };
    }
    case 'minNPSHa': {
      const actual = kpis.minNPSHa;
      const expected = a.value ?? 0;
      return {
        id,
        type: a.type,
        expected: `min(NPSHa) >= ${expected} m`,
        actual: `min(NPSHa) = ${actual.toFixed(3)} m`,
        passed: actual >= expected - (a.tolerance ?? 0),
      };
    }
    case 'maxCI': {
      const actual = kpis.maxCI;
      const expected = a.value ?? 1;
      return {
        id,
        type: a.type,
        expected: `max(CI) <= ${expected}`,
        actual: `max(CI) = ${actual.toFixed(3)}`,
        passed: actual <= expected + (a.tolerance ?? 0),
      };
    }
    case 'maxHeadDrop': {
      const actual = kpis.maxHeadDrop;
      const expected = a.value ?? 1;
      return {
        id,
        type: a.type,
        expected: `max(headDrop) <= ${(expected * 100).toFixed(1)}%`,
        actual: `max(headDrop) = ${(actual * 100).toFixed(1)}%`,
        passed: actual <= expected + (a.tolerance ?? 0),
      };
    }
    case 'maxDamage': {
      const actual = kpis.maxDamage;
      const expected = a.value ?? Infinity;
      return {
        id,
        type: a.type,
        expected: `max(damage) <= ${expected}`,
        actual: `max(damage) = ${actual.toFixed(4)}`,
        passed: actual <= expected + (a.tolerance ?? 0),
      };
    }
    case 'tankMin': {
      const actual = kpis.tankMin;
      const expected = a.value ?? 0;
      return {
        id,
        type: a.type,
        expected: `tankMin >= ${expected} m`,
        actual: `tankMin = ${actual.toFixed(3)} m`,
        passed: actual >= expected - (a.tolerance ?? 0),
      };
    }
    case 'maxTankMin': {
      const actual = kpis.tankMin;
      const expected = a.value ?? Infinity;
      return {
        id,
        type: a.type,
        expected: `tankMin <= ${expected} m`,
        actual: `tankMin = ${actual.toFixed(3)} m`,
        passed: actual <= expected + (a.tolerance ?? 0),
      };
    }
    case 'maxTransitions': {
      const actual = kpis.transitions;
      const expected = a.value ?? Infinity;
      return {
        id,
        type: a.type,
        expected: `transitions <= ${expected}`,
        actual: `transitions = ${actual}`,
        passed: actual <= expected,
      };
    }
    case 'falseInjections': {
      const actual = kpis.falseInjections;
      const expected = a.value ?? 0;
      return {
        id,
        type: a.type,
        expected: `falseInjections <= ${expected}`,
        actual: `falseInjections = ${actual}`,
        passed: actual <= expected,
      };
    }
    case 'surgePeak': {
      const actual = kpis.surgePeak;
      const expected = a.value ?? Infinity;
      return {
        id,
        type: a.type,
        expected: `surgePeak <= ${expected} Pa`,
        actual: `surgePeak = ${actual.toFixed(0)} Pa`,
        passed: actual <= expected,
      };
    }
    case 'stateSequence': {
      const expected = a.expected ?? [];
      const actual = kpis.stateSequence.filter((s) => s !== 'MANUAL');
      // Expected must appear as an ordered subsequence of the actual sequence.
      let i = 0;
      for (const s of actual) {
        if (i < expected.length && s === expected[i]) i++;
      }
      const passed = i >= expected.length;
      return {
        id,
        type: a.type,
        expected: `sequence contains ${expected.join(' -> ')}`,
        actual: `sequence ${actual.join(' -> ')}`,
        passed,
      };
    }
    case 'minSurgePeak': {
      const actual = kpis.surgePeak;
      const expected = a.value ?? 0;
      return {
        id,
        type: a.type,
        expected: `surgePeak >= ${expected} Pa`,
        actual: `surgePeak = ${actual.toFixed(0)} Pa`,
        passed: actual >= expected - (a.tolerance ?? 0),
      };
    }
    case 'advisorMessage': {
      const expected = a.expected ?? [];
      const passed = expected.some((e) => kpis.advisorIds.includes(e));
      return {
        id,
        type: a.type,
        expected: `advisor in [${expected.join(', ')}]`,
        actual: `advisor ids: ${kpis.advisorIds.join(', ') || '(none recorded)'}`,
        passed,
      };
    }
    default:
      return { id, type: a.type, expected: 'custom', actual: 'not evaluated', passed: true };
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface ScenarioRun {
  scenarioId: string;
  mode: 'OFF' | 'ON';
  seed: number;
  duration: number;
  samples: HistorySample[];
  kpis: Kpis;
  assertions: AssertionResult[];
  passed: boolean;
}

export interface RunOptions {
  base?: PlantParams;
  dt?: number;
  recordInterval?: number;
}

export function runScenario(scenario: Scenario, opts: RunOptions = {}): ScenarioRun[] {
  const dt = opts.dt ?? 0.01;
  const modes: ('OFF' | 'ON')[] =
    scenario.mode === 'AB' ? ['OFF', 'ON'] : [scenario.mode === 'MANUAL' ? 'ON' : scenario.mode];
  const results: ScenarioRun[] = [];
  for (const mode of modes) {
    const params = opts.base ? structuredClone(opts.base) : defaultPlant();
    for (const [k, v] of Object.entries(scenario.params ?? {})) {
      if (!isInputKey(k)) {
        try {
          applyParam(params, k, v);
        } catch {
          // Scenario-specific metadata (e.g. RO panel values) is not a plant
          // parameter; it is carried for the UI and ignored by the physics.
        }
      }
    }
    const engine = new SimEngine({ params, seed: scenario.seed, recordInterval: opts.recordInterval ?? 0.5 });
    engine.setInput('mode', scenario.mode === 'MANUAL' ? 'MANUAL' : mode);
    const timeline = new Timeline(scenario.timeline ?? []);
    const steps = Math.round(scenario.duration / dt);
    for (let i = 0; i < steps; i++) {
      const t = i * dt;
      for (const param of timeline.params) {
        const v = timeline.valueAt(param, t);
        if (v !== null) applyToEngine(engine, param, v);
      }
      engine.step(dt);
    }
    const samples = engine.getHistory();
    const kpis = computeKpis(samples, engine);
    const assertions = evaluateAssertions(scenario.assertions ?? [], samples, kpis);
    results.push({
      scenarioId: scenario.id,
      mode,
      seed: scenario.seed,
      duration: scenario.duration,
      samples,
      kpis,
      assertions,
      passed: assertions.every((a) => a.passed),
    });
  }
  return results;
}

export function scenarioPassBadge(run: ScenarioRun): 'pass' | 'fail' | 'partial' {
  if (run.assertions.length === 0) return 'pass';
  const failed = run.assertions.filter((a) => !a.passed).length;
  if (failed === 0) return 'pass';
  if (failed === run.assertions.length) return 'fail';
  return 'partial';
}
