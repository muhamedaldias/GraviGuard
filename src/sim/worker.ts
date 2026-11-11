/// <reference lib="webworker" />
// Physics worker (Section 4.1): fixed dt = 0.01 s, UI snapshot at 30 Hz,
// speed x0.25..x200, compute capped at ~20 ms per frame.

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
  | { type: 'error'; message: string };

let engine: SimEngine | null = null;
let timeline: Timeline | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let speed = 1;
let acc = 0;
let last = 0;

function post(msg: WorkerOutbound): void {
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

function loop(): void {
  if (!engine) return;
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
  post({ type: 'snapshot', state: engine.state });
}

function start(): void {
  if (timer !== null) return;
  last = 0;
  acc = 0;
  timer = setInterval(loop, 33);
}

function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

self.onmessage = (ev: MessageEvent<WorkerInbound>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init': {
        engine = new SimEngine({ params: msg.params, seed: msg.seed });
        engine.setInput('mode', msg.mode);
        timeline = null;
        acc = 0;
        post({ type: 'ready' });
        post({ type: 'snapshot', state: engine.state });
        break;
      }
      case 'params': {
        if (!engine) break;
        engine.params = msg.params;
        engine.syncInputs();
        post({ type: 'snapshot', state: engine.state });
        break;
      }
      case 'scenario': {
        engine = new SimEngine({ params: defaultParamsWith(msg.scenario), seed: msg.scenario.seed });
        engine.setInput('mode', msg.scenario.mode === 'AB' ? 'ON' : msg.scenario.mode);
        timeline = new Timeline(msg.scenario.timeline ?? []);
        acc = 0;
        post({ type: 'ready' });
        post({ type: 'snapshot', state: engine.state });
        break;
      }
      case 'input': {
        engine?.setInput(msg.key, msg.value as never);
        break;
      }
      case 'mode': {
        engine?.setInput('mode', msg.mode);
        break;
      }
      case 'play':
        start();
        break;
      case 'pause':
        stop();
        break;
      case 'step': {
        const n = Math.round(msg.seconds / PHYSICS_DT);
        for (let i = 0; i < n; i++) stepOnce();
        if (engine) post({ type: 'snapshot', state: engine.state });
        break;
      }
      case 'speed':
        speed = msg.speed;
        break;
      case 'reset':
        engine?.reset(msg.seed);
        acc = 0;
        if (engine) post({ type: 'snapshot', state: engine.state });
        break;
    }
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};

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
