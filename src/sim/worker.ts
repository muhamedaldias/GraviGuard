/// <reference lib="webworker" />
// Physics worker (Section 4.1): fixed dt = 0.01 s, UI snapshot at 30 Hz,
// speed x0.25..x200, compute capped at ~20 ms per frame.
//
// Hardening (issue #3): every inbound message is validated before it touches
// engine/timer state (validateInbound / validatePlantParams). processMessage
// and loop are pure with respect to posting — they RETURN outbound messages
// so the module is importable and testable in Node. All worker-global access
// (self / postMessage) is guarded by typeof self checks.

import { SimEngine } from './engine';
import { PHYSICS_DT } from './defaults';
import type { PlantParams, Scenario, SimInputs, SimState } from './types';
import { Timeline, applyToEngine } from './scenario';

export type WorkerInbound =
  | { type: 'init'; params: PlantParams; seed: number; mode: 'OFF' | 'ON' | 'MANUAL' }
  | { type: 'params'; params: PlantParams }
  | { type: 'input'; key: keyof SimInputs; value: number | boolean | string }
  | { type: 'mode'; mode: 'OFF' | 'ON' | 'MANUAL' }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'step'; seconds: number }
  | { type: 'speed'; speed: number }
  | { type: 'reset'; seed: number }
  | { type: 'scenario'; scenario: Scenario };

export type WorkerOutbound =
  | { type: 'snapshot'; state: SimState }
  | { type: 'ready' }
  | { type: 'error'; message: string; fatal?: boolean };

let engine: SimEngine | null = null;
let timeline: Timeline | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let speed = 1;
let acc = 0;
let last = 0;

function post(msg: WorkerOutbound): void {
  if (typeof self === 'undefined') return; // Node/test environment: no posting.
  (self as unknown as Worker).postMessage(msg);
}

function stepOnce(): void {
  if (!engine) return;
  if (timeline) {
    const t = engine.state.t;
    for (const p of timeline.params) {
      const v = timeline.valueAt(p, t);
      if (v !== null) applyToEngine(engine, p, v);
    }
  }
  engine.step(PHYSICS_DT);
}

/** One 33 ms frame. Returns outbound messages; a throw becomes a fatal error
 *  and stops the timer so a broken scenario cannot spin forever. */
export function loop(): WorkerOutbound[] {
  if (!engine) return [];
  try {
    const now = performance.now();
    const elapsed = last === 0 ? 1 / 60 : (now - last) / 1000;
    last = now;
    acc += elapsed * speed;
    const budget = 0.02; // 20 ms compute cap per frame
    const t0 = performance.now();
    let steps = 0;
    while (acc >= PHYSICS_DT && performance.now() - t0 < budget) {
      stepOnce();
      acc -= PHYSICS_DT;
      steps++;
      if (steps > 20000) break;
    }
    if (acc > PHYSICS_DT * 1000) acc = 0; // avoid spiral after a stall
    return [{ type: 'snapshot', state: engine.state }];
  } catch (err) {
    stop();
    return [{ type: 'error', message: err instanceof Error ? err.message : String(err), fatal: true }];
  }
}

function start(): void {
  if (timer !== null) return;
  last = 0;
  acc = 0;
  timer = setInterval(() => {
    for (const m of loop()) post(m);
  }, 33);
}

function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

// ---------------------------------------------------------------------------
// Inbound validation
// ---------------------------------------------------------------------------

const MESSAGE_TYPES = [
  'init',
  'params',
  'scenario',
  'input',
  'mode',
  'play',
  'pause',
  'step',
  'speed',
  'reset',
] as const;

const MODES = ['OFF', 'ON', 'MANUAL'];
const SCENARIO_MODES = ['OFF', 'ON', 'AB', 'MANUAL'];
const NUMERIC_INPUT_KEYS = [
  'z_level',
  'K_strainer',
  'T',
  'k_discharge',
  'n',
  'z_bell',
  'noiseScale',
  'pressureDrift',
  'manualValve',
];
const BOOLEAN_INPUT_KEYS = ['valveStuck', 'pressureStuck', 'pressureDropout', 'checkValveLeak'];

const MAX_STEP_SECONDS = 3600;
const MIN_SPEED = 0.25;
const MAX_SPEED = 200;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isMode(v: unknown): v is 'OFF' | 'ON' | 'MANUAL' {
  return typeof v === 'string' && MODES.includes(v);
}

type Validation = { ok: true; msg: WorkerInbound } | { ok: false; error: string };

function invalid(error: string): Validation {
  return { ok: false, error };
}

/** Recursively build a sanitized copy of raw using the template's keys.
 *  Every template key must be present with a matching, finite leaf type;
 *  extra keys in raw are dropped. Returns null on any violation. */
function sanitizeAgainstTemplate(
  raw: Record<string, unknown>,
  template: Record<string, unknown>,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(template)) {
    if (!(key in raw)) return null;
    const tv = template[key];
    const rv = raw[key];
    if (typeof tv === 'number') {
      if (!isFiniteNumber(rv)) return null;
      out[key] = rv;
    } else if (typeof tv === 'boolean') {
      if (typeof rv !== 'boolean') return null;
      out[key] = rv;
    } else if (typeof tv === 'string') {
      if (typeof rv !== 'string') return null;
      out[key] = rv;
    } else if (tv !== null && typeof tv === 'object') {
      if (rv === null || typeof rv !== 'object' || Array.isArray(rv)) return null;
      const sub = sanitizeAgainstTemplate(
        rv as Record<string, unknown>,
        tv as Record<string, unknown>,
      );
      if (sub === null) return null;
      out[key] = sub;
    } else {
      return null;
    }
  }
  return out;
}

/** Validate plant params against defaultPlant() as the shape template.
 *  Guarantees the engine never receives NaN/Infinity or a partial object. */
export function validatePlantParams(raw: unknown): PlantParams | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const template = defaultPlant() as unknown as Record<string, unknown>;
  const sanitized = sanitizeAgainstTemplate(raw as Record<string, unknown>, template);
  if (sanitized === null) return null;
  return structuredClone(sanitized) as unknown as PlantParams;
}

function validateScenario(raw: unknown): Scenario | string {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return 'scenario: scenario must be a non-null object';
  }
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string') return 'scenario: id must be a string';
  if (!isFiniteNumber(s.duration) || s.duration <= 0) {
    return 'scenario: duration must be a finite number > 0';
  }
  if (!isFiniteNumber(s.seed)) return 'scenario: seed must be a finite number';
  if (typeof s.mode !== 'string' || !SCENARIO_MODES.includes(s.mode)) {
    return 'scenario: mode must be OFF/ON/AB/MANUAL';
  }
  if (s.params !== undefined) {
    if (s.params === null || typeof s.params !== 'object' || Array.isArray(s.params)) {
      return 'scenario: params must be a record of finite numbers';
    }
    for (const [k, v] of Object.entries(s.params as Record<string, unknown>)) {
      if (!isFiniteNumber(v)) return `scenario: params.${k} must be a finite number`;
    }
  }
  if (s.timeline !== undefined) {
    if (!Array.isArray(s.timeline)) return 'scenario: timeline must be an array';
    for (const e of s.timeline) {
      if (e === null || typeof e !== 'object' || Array.isArray(e)) {
        return 'scenario: timeline event must be an object';
      }
      const ev = e as Record<string, unknown>;
      if (!isFiniteNumber(ev.t) || ev.t < 0) {
        return 'scenario: timeline event t must be a finite number >= 0';
      }
      if (typeof ev.param !== 'string' || ev.param.length === 0) {
        return 'scenario: timeline event param must be a non-empty string';
      }
      if (!isFiniteNumber(ev.value)) {
        return 'scenario: timeline event value must be a finite number';
      }
      if (ev.ramp !== undefined && (!isFiniteNumber(ev.ramp) || ev.ramp < 0)) {
        return 'scenario: timeline event ramp must be a finite number >= 0';
      }
    }
  }
  // Dotted param paths are deliberately NOT validated against the plant:
  // unknown paths must reach applyParam and throw at runtime, where loop()'s
  // try/catch turns them into a fatal error-channel message.
  return structuredClone(raw) as Scenario;
}

/** Validate an inbound message. On success returns a sanitized/clamped copy;
 *  on failure a descriptive error. Never touches engine/timer state. */
export function validateInbound(raw: unknown): Validation {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return invalid('malformed message');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== 'string') return invalid('malformed message');
  if (!(MESSAGE_TYPES as readonly string[]).includes(r.type)) {
    return invalid(`unknown message type: ${r.type}`);
  }
  const type = r.type as (typeof MESSAGE_TYPES)[number];
  switch (type) {
    case 'init': {
      if (!isFiniteNumber(r.seed)) return invalid('init: seed must be a finite number');
      if (!isMode(r.mode)) return invalid('init: mode must be OFF/ON/MANUAL');
      const params = validatePlantParams(r.params);
      if (params === null) {
        return invalid('init: invalid params (missing fields or non-finite/wrong-typed values)');
      }
      return { ok: true, msg: { type: 'init', params, seed: r.seed, mode: r.mode } };
    }
    case 'params': {
      const params = validatePlantParams(r.params);
      if (params === null) {
        return invalid('params: invalid params (missing fields or non-finite/wrong-typed values)');
      }
      return { ok: true, msg: { type: 'params', params } };
    }
    case 'scenario': {
      const res = validateScenario(r.scenario);
      if (typeof res === 'string') return invalid(res);
      return { ok: true, msg: { type: 'scenario', scenario: res } };
    }
    case 'input': {
      const key = r.key;
      if (typeof key !== 'string') return invalid('input: key must be a string');
      if (key === 'mode') {
        if (!isMode(r.value)) return invalid('input: mode value must be OFF/ON/MANUAL');
        return { ok: true, msg: { type: 'input', key: 'mode', value: r.value } };
      }
      if (NUMERIC_INPUT_KEYS.includes(key)) {
        if (!isFiniteNumber(r.value)) {
          return invalid(`input: ${key} requires a finite number`);
        }
        let value = r.value;
        if (key === 'manualValve') value = Math.min(1, Math.max(0, value));
        return { ok: true, msg: { type: 'input', key: key as keyof SimInputs, value } };
      }
      if (BOOLEAN_INPUT_KEYS.includes(key)) {
        if (typeof r.value !== 'boolean') {
          return invalid(`input: ${key} requires a boolean`);
        }
        return { ok: true, msg: { type: 'input', key: key as keyof SimInputs, value: r.value } };
      }
      return invalid(`input: unknown key: ${key}`);
    }
    case 'mode': {
      if (!isMode(r.mode)) return invalid('mode: mode must be OFF/ON/MANUAL');
      return { ok: true, msg: { type: 'mode', mode: r.mode } };
    }
    case 'play':
      return { ok: true, msg: { type: 'play' } };
    case 'pause':
      return { ok: true, msg: { type: 'pause' } };
    case 'step': {
      if (!isFiniteNumber(r.seconds) || r.seconds < 0) {
        return invalid('step: seconds must be a finite number >= 0');
      }
      return { ok: true, msg: { type: 'step', seconds: Math.min(MAX_STEP_SECONDS, r.seconds) } };
    }
    case 'speed': {
      if (!isFiniteNumber(r.speed)) return invalid('speed: speed must be a finite number');
      return {
        ok: true,
        msg: { type: 'speed', speed: Math.min(MAX_SPEED, Math.max(MIN_SPEED, r.speed)) },
      };
    }
    case 'reset': {
      if (!isFiniteNumber(r.seed)) return invalid('reset: seed must be a finite number');
      return { ok: true, msg: { type: 'reset', seed: r.seed } };
    }
  }
}

// ---------------------------------------------------------------------------
// Message application (returns outbound messages; does not post)
// ---------------------------------------------------------------------------

export function processMessage(raw: unknown): WorkerOutbound[] {
  const v = validateInbound(raw);
  if (!v.ok) return [{ type: 'error', message: v.error }];
  const msg = v.msg;
  try {
    switch (msg.type) {
      case 'init': {
        engine = new SimEngine({ params: msg.params, seed: msg.seed });
        engine.setInput('mode', msg.mode);
        timeline = null;
        acc = 0;
        return [{ type: 'ready' }, { type: 'snapshot', state: engine.state }];
      }
      case 'params': {
        if (!engine) return [];
        engine.params = structuredClone(msg.params);
        engine.syncInputs();
        return [{ type: 'snapshot', state: engine.state }];
      }
      case 'scenario': {
        engine = new SimEngine({ params: defaultParamsWith(msg.scenario), seed: msg.scenario.seed });
        engine.setInput('mode', msg.scenario.mode === 'AB' ? 'ON' : msg.scenario.mode);
        timeline = new Timeline(msg.scenario.timeline ?? []);
        acc = 0;
        return [{ type: 'ready' }, { type: 'snapshot', state: engine.state }];
      }
      case 'input': {
        engine?.setInput(msg.key, msg.value as never);
        return [];
      }
      case 'mode': {
        engine?.setInput('mode', msg.mode);
        return [];
      }
      case 'play':
        start();
        return [];
      case 'pause':
        stop();
        return [];
      case 'step': {
        const n = Math.round(msg.seconds / PHYSICS_DT);
        for (let i = 0; i < n; i++) stepOnce();
        return engine ? [{ type: 'snapshot', state: engine.state }] : [];
      }
      case 'speed':
        speed = msg.speed;
        return [];
      case 'reset':
        engine?.reset(msg.seed);
        acc = 0;
        return engine ? [{ type: 'snapshot', state: engine.state }] : [];
    }
  } catch (err) {
    return [{ type: 'error', message: err instanceof Error ? err.message : String(err) }];
  }
}

// Guarded so the module is importable in Node (vitest): no worker globals exist there.
if (typeof self !== 'undefined') {
  self.onmessage = (ev: MessageEvent) => {
    for (const m of processMessage(ev.data)) post(m);
  };
}

// Local import indirection to keep the worker bundle small.
import { defaultPlant } from './defaults';
function defaultParamsWith(scenario: Scenario): PlantParams {
  const p = defaultPlant();
  for (const [k, v] of Object.entries(scenario.params ?? {})) {
    if (k.includes('.')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts = k.split('.');
        let obj: any = p;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts[parts.length - 1]] = v;
      } catch {
        /* metadata keys are ignored */
      }
    }
  }
  return p;
}
