// Worker hardening tests (issue #3): inbound validation + error channel.
// Module state persists across tests in this file: the first describe runs
// before any init (engine === null), the rest re-init in beforeEach.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processMessage,
  loop,
  validateInbound,
  validatePlantParams,
} from '../src/sim/worker';
import type { WorkerOutbound } from '../src/sim/worker';
import { SimEngine } from '../src/sim/engine';
import { defaultPlant, PHYSICS_DT } from '../src/sim/defaults';
import type { SimState } from '../src/sim/types';

function initMsg() {
  return { type: 'init', params: defaultPlant(), seed: 42, mode: 'ON' as const };
}

function getSnapshot(out: WorkerOutbound[]): SimState {
  const snap = out.find(
    (m): m is Extract<WorkerOutbound, { type: 'snapshot' }> => m.type === 'snapshot',
  );
  if (!snap) {
    throw new Error(`no snapshot in outbound: ${JSON.stringify(out)}`);
  }
  return snap.state;
}

function expectError(out: WorkerOutbound[]): string {
  expect(out).toHaveLength(1);
  expect(out[0].type).toBe('error');
  const msg = (out[0] as Extract<WorkerOutbound, { type: 'error' }>).message;
  expect(typeof msg).toBe('string');
  expect(msg.length).toBeGreaterThan(0);
  return msg;
}

/** Recursively assert every number in a snapshot is finite.
 *  Exception: state.autonomy_s is a documented Infinity sentinel in the
 *  engine (emptyState + step: Infinity when tank draw Q_T <= 1e-6), not NaN
 *  contamination — it is the only field allowed to be non-finite. */
function expectAllNumbersFinite(value: unknown, path = 'state'): void {
  if (typeof value === 'number') {
    if (path === 'state.autonomy_s' && value === Infinity) return;
    expect(Number.isFinite(value), `${path} must be finite (got ${value})`).toBe(true);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => expectAllNumbersFinite(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      expectAllNumbersFinite(v, `${path}.${k}`);
    }
  }
}

// Real timers are created by 'play' in node — always clear them.
afterEach(() => {
  processMessage({ type: 'pause' });
  vi.restoreAllMocks();
});

describe('worker before any init (engine === null)', () => {
  it('params without engine returns []', () => {
    expect(processMessage({ type: 'params', params: defaultPlant() })).toEqual([]);
  });

  it('step without engine returns []', () => {
    expect(processMessage({ type: 'step', seconds: 0.1 })).toEqual([]);
  });

  it('loop without engine returns []', () => {
    expect(loop()).toEqual([]);
  });
});

describe('worker inbound validation + error channel', () => {
  beforeEach(() => {
    const out = processMessage(initMsg());
    expect(out.map((m) => m.type)).toEqual(['ready', 'snapshot']);
  });

  // (a) NaN speed is rejected; module speed unchanged; play/step still work.
  it('rejects NaN speed and keeps the worker usable', () => {
    const bad = validateInbound({ type: 'speed', speed: NaN });
    expect(bad.ok).toBe(false);

    const out = processMessage({ type: 'speed', speed: NaN });
    expectError(out);

    // A following valid speed + play + step still works (speed state intact).
    const okSpeed = processMessage({ type: 'speed', speed: 2 });
    expect(okSpeed).toEqual([]);
    expect(processMessage({ type: 'play' })).toEqual([]);
    const stepped = processMessage({ type: 'step', seconds: 0.1 });
    expect(stepped.map((m) => m.type)).toEqual(['snapshot']);
    expect(getSnapshot(stepped).t).toBeGreaterThan(0);
    expect(processMessage({ type: 'pause' })).toEqual([]);
  });

  // (b) negative / non-finite step seconds.
  it('rejects negative step seconds', () => {
    expectError(processMessage({ type: 'step', seconds: -1 }));
    const v = validateInbound({ type: 'step', seconds: -0.5 });
    expect(v.ok).toBe(false);
  });

  it('rejects non-finite step seconds', () => {
    expectError(processMessage({ type: 'step', seconds: NaN }));
    expectError(processMessage({ type: 'step', seconds: Infinity }));
  });

  // (c) unknown / malformed messages.
  it('rejects unknown and malformed messages', () => {
    expectError(processMessage({ type: 'bogus' }));
    expectError(processMessage(null));
    expectError(processMessage(42));
    expectError(processMessage('string'));
    expectError(processMessage({}));
    const v = validateInbound({ type: 'bogus' });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toContain('bogus');
  });

  // (d) params missing a whole section.
  it('rejects params missing a whole section (fluid)', () => {
    const p = defaultPlant() as unknown as Record<string, unknown>;
    delete p.fluid;
    expect(validatePlantParams(p)).toBeNull();
    expectError(processMessage({ type: 'params', params: p }));
  });

  // (e) NaN leaf rejected AND engine state untouched.
  it('rejects params with a NaN leaf and leaves engine state untouched', () => {
    const t0 = getSnapshot(processMessage({ type: 'step', seconds: 0 })).t;

    const bad = defaultPlant();
    bad.pump.Q_BEP = NaN;
    expect(validatePlantParams(bad)).toBeNull();
    expectError(processMessage({ type: 'params', params: bad }));

    const out = processMessage({ type: 'step', seconds: 0.1 });
    const state = getSnapshot(out);
    expect(Math.abs(state.t - (t0 + 0.1))).toBeLessThanOrEqual(PHYSICS_DT + 1e-9);
    expectAllNumbersFinite(state);
  });

  // (f) clamping rules.
  it('clamps speed to [0.25, 200]', () => {
    const low = validateInbound({ type: 'speed', speed: 0.1 });
    expect(low.ok).toBe(true);
    if (low.ok && low.msg.type === 'speed') expect(low.msg.speed).toBe(0.25);

    const high = validateInbound({ type: 'speed', speed: 500 });
    expect(high.ok).toBe(true);
    if (high.ok && high.msg.type === 'speed') expect(high.msg.speed).toBe(200);

    const mid = validateInbound({ type: 'speed', speed: 2 });
    expect(mid.ok).toBe(true);
    if (mid.ok && mid.msg.type === 'speed') expect(mid.msg.speed).toBe(2);
  });

  it('clamps step seconds to max 3600', () => {
    const v = validateInbound({ type: 'step', seconds: 99999 });
    expect(v.ok).toBe(true);
    if (v.ok && v.msg.type === 'step') expect(v.msg.seconds).toBe(3600);
  });

  // (g) input validation.
  it('rejects input with NaN value', () => {
    expectError(processMessage({ type: 'input', key: 'z_level', value: NaN }));
    expect(validateInbound({ type: 'input', key: 'n', value: Infinity }).ok).toBe(false);
  });

  it('rejects boolean input key given a number', () => {
    expectError(processMessage({ type: 'input', key: 'valveStuck', value: 1 }));
    expectError(processMessage({ type: 'input', key: 'pressureStuck', value: 'true' }));
  });

  it('rejects unknown input keys and bad mode values', () => {
    expectError(processMessage({ type: 'input', key: 'nope', value: 1 }));
    expectError(processMessage({ type: 'input', key: 'mode', value: 'AUTO' }));
    expectError(processMessage({ type: 'mode', mode: 'AUTO' }));
  });

  it('clamps manualValve to [0, 1]', () => {
    const hi = validateInbound({ type: 'input', key: 'manualValve', value: 5 });
    expect(hi.ok).toBe(true);
    if (hi.ok && hi.msg.type === 'input') expect(hi.msg.value).toBe(1);
    const lo = validateInbound({ type: 'input', key: 'manualValve', value: -2 });
    expect(lo.ok).toBe(true);
    if (lo.ok && lo.msg.type === 'input') expect(lo.msg.value).toBe(0);
  });

  it('accepts valid numeric and boolean inputs', () => {
    expect(processMessage({ type: 'input', key: 'z_level', value: 2 })).toEqual([]);
    expect(processMessage({ type: 'input', key: 'valveStuck', value: true })).toEqual([]);
    expect(processMessage({ type: 'mode', mode: 'MANUAL' })).toEqual([]);
  });

  // (h) valid init / step behavior preserved.
  it('valid init returns [ready, snapshot] with t=0', () => {
    const out = processMessage(initMsg());
    expect(out.map((m) => m.type)).toEqual(['ready', 'snapshot']);
    expect(getSnapshot(out).t).toBe(0);
  });

  it('valid step advances t by seconds (±PHYSICS_DT)', () => {
    const out = processMessage({ type: 'step', seconds: 0.5 });
    expect(out.map((m) => m.type)).toEqual(['snapshot']);
    const t = getSnapshot(out).t;
    expect(Math.abs(t - 0.5)).toBeLessThanOrEqual(PHYSICS_DT + 1e-9);
  });

  // (i) a throwing physics step becomes a fatal error and stops the timer.
  it('loop() returns a fatal error when engine.step throws', () => {
    vi.spyOn(SimEngine.prototype, 'step').mockImplementation(() => {
      throw new Error('boom');
    });
    expect(processMessage({ type: 'play' })).toEqual([]);
    const out = loop();
    expect(out).toEqual([{ type: 'error', message: 'boom', fatal: true }]);
  });

  // (j) unknown dotted timeline param passes validation, throws at runtime.
  it('scenario with unknown timeline param validates, then loop() reports fatal error', () => {
    const scenario = {
      id: 'bad-param',
      name: 'Bad param',
      nameAr: '',
      description: '',
      descriptionAr: '',
      tags: [],
      duration: 10,
      seed: 1,
      mode: 'ON',
      timeline: [{ t: 0, param: 'pump.bogus', value: 1 }],
    };
    const v = validateInbound({ type: 'scenario', scenario });
    expect(v.ok).toBe(true);

    const out = processMessage({ type: 'scenario', scenario });
    expect(out.map((m) => m.type)).toEqual(['ready', 'snapshot']);

    expect(processMessage({ type: 'play' })).toEqual([]);
    const errs = loop();
    expect(errs).toHaveLength(1);
    expect(errs[0].type).toBe('error');
    const e = errs[0] as Extract<WorkerOutbound, { type: 'error' }>;
    expect(e.message).toContain('unknown param');
    expect(e.fatal).toBe(true);
  });

  it('rejects malformed scenarios without touching the engine', () => {
    const base = {
      id: 's',
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      tags: [],
      duration: 10,
      seed: 1,
      mode: 'ON',
    };
    const t0 = getSnapshot(processMessage({ type: 'step', seconds: 0 })).t;
    expectError(processMessage({ type: 'scenario', scenario: { ...base, duration: 0 } }));
    expectError(processMessage({ type: 'scenario', scenario: { ...base, seed: NaN } }));
    expectError(processMessage({ type: 'scenario', scenario: { ...base, mode: 'XX' } }));
    expectError(
      processMessage({
        type: 'scenario',
        scenario: { ...base, timeline: [{ t: -1, param: 'n', value: 1 }] },
      }),
    );
    expectError(
      processMessage({ type: 'scenario', scenario: { ...base, params: { 'pump.n': NaN } } }),
    );
    expectError(processMessage({ type: 'scenario', scenario: null }));
    // Engine untouched: time still advances from t0.
    const state = getSnapshot(processMessage({ type: 'step', seconds: 0.1 }));
    expect(Math.abs(state.t - (t0 + 0.1))).toBeLessThanOrEqual(PHYSICS_DT + 1e-9);
  });

  // (k) reset seed validation.
  it('rejects reset with NaN seed', () => {
    expectError(processMessage({ type: 'reset', seed: NaN }));
    expect(validateInbound({ type: 'reset', seed: Infinity }).ok).toBe(false);
  });

  it('valid reset returns a snapshot at t=0', () => {
    processMessage({ type: 'step', seconds: 0.2 });
    const out = processMessage({ type: 'reset', seed: 7 });
    expect(out.map((m) => m.type)).toEqual(['snapshot']);
    expect(getSnapshot(out).t).toBe(0);
  });

  it('valid params returns a snapshot; init seed/mode validated', () => {
    const out = processMessage({ type: 'params', params: defaultPlant() });
    expect(out.map((m) => m.type)).toEqual(['snapshot']);
    expectError(processMessage({ type: 'init', params: defaultPlant(), seed: NaN, mode: 'ON' }));
    expectError(processMessage({ type: 'init', params: defaultPlant(), seed: 1, mode: 'AUTO' }));
  });
});

// ---------------------------------------------------------------------------
// verdict-issue3 finding F1 (MAJOR): prototype pollution via scenario JSON.
// Repro of the tester's three bypass variants + an inherited-keys variant.
// Hostile payloads are built with JSON.parse so "__proto__" is an OWN
// enumerable key — exactly the shape a fetch()'d scenario asset would have.
// Validation-level assertions come FIRST so a red run fails before any
// assignment sink can actually pollute Object.prototype in this process.
// ---------------------------------------------------------------------------
describe('scenario injection hardening (verdict-issue3 F1)', () => {
  const origToString = Object.prototype.toString;
  const origValueOf = Object.prototype.valueOf;
  const origHasOwn = Object.prototype.hasOwnProperty;

  const base = {
    id: 'evil',
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    tags: [],
    duration: 10,
    seed: 1,
    mode: 'ON',
  };

  function expectPrototypeIntact(): void {
    expect(Object.prototype.toString).toBe(origToString);
    expect(Object.prototype.valueOf).toBe(origValueOf);
    expect(Object.prototype.hasOwnProperty).toBe(origHasOwn);
    expect({}.toString()).toBe('[object Object]');
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
  }

  const hostileParamsPayloads = [
    '{"__proto__.toString": 1}',
    '{"constructor.prototype.hasOwnProperty": 1}',
    '{"pump.__proto__.polluted": 1}',
    '{"__proto__": 1}',
  ];

  for (const payload of hostileParamsPayloads) {
    it(`rejects scenario.params ${payload} and leaves Object.prototype untouched`, () => {
      const scenario = { ...base, params: JSON.parse(payload) };
      const v = validateInbound({ type: 'scenario', scenario });
      expect(v.ok).toBe(false);
      expectError(processMessage({ type: 'scenario', scenario }));
      expectPrototypeIntact();
    });
  }

  const hostileTimelineParams = ['__proto__.valueOf', 'constructor.prototype.hasOwnProperty'];

  for (const param of hostileTimelineParams) {
    it(`rejects timeline param ${param} and leaves Object.prototype untouched`, () => {
      const scenario = { ...base, timeline: [{ t: 0.05, param, value: 1 }] };
      const v = validateInbound({ type: 'scenario', scenario });
      expect(v.ok).toBe(false);
      expectError(processMessage({ type: 'scenario', scenario }));
      expectPrototypeIntact();
    });
  }

  it('rejects plant params whose sections are only inherited (own-enumerable check)', () => {
    // `key in raw` walks the prototype chain: an object with NO own keys but
    // defaultPlant() as its prototype must not pass template validation.
    const inherited = Object.create(defaultPlant()) as Record<string, unknown>;
    expect(Object.keys(inherited)).toHaveLength(0);
    expect(validatePlantParams(inherited)).toBeNull();
    expectError(processMessage({ type: 'params', params: inherited }));
    expectPrototypeIntact();
  });

  it('still accepts a legitimate scenario with dotted plant params', () => {
    const scenario = { ...base, params: { 'tank.V_usable': 250 } };
    const v = validateInbound({ type: 'scenario', scenario });
    expect(v.ok).toBe(true);
    const out = processMessage({ type: 'scenario', scenario });
    expect(out.map((m) => m.type)).toEqual(['ready', 'snapshot']);
    expectPrototypeIntact();
  });
});

describe('validatePlantParams (template-based sanitization)', () => {
  it('accepts a full default plant and returns a fresh clone', () => {
    const p = defaultPlant();
    const out = validatePlantParams(p);
    expect(out).not.toBeNull();
    expect(out).toEqual(defaultPlant());
    expect(out).not.toBe(p);
    expect(out!.pump).not.toBe(p.pump);
  });

  it('drops extra keys', () => {
    const p = defaultPlant() as unknown as Record<string, unknown>;
    p.extra = 123;
    (p.pump as unknown as Record<string, unknown>).extra = 456;
    const out = validatePlantParams(p);
    expect(out).not.toBeNull();
    expect(out).toEqual(defaultPlant());
    expect('extra' in (out as unknown as Record<string, unknown>)).toBe(false);
  });

  it('rejects wrong leaf types', () => {
    const numAsString = defaultPlant();
    (numAsString.fluid as unknown as Record<string, unknown>).rho = '1025';
    expect(validatePlantParams(numAsString)).toBeNull();

    const boolAsNumber = defaultPlant();
    (boolAsNumber.valve as unknown as Record<string, unknown>).stuck = 1;
    expect(validatePlantParams(boolAsNumber)).toBeNull();

    const stringAsNumber = defaultPlant();
    (stringAsNumber.controller as unknown as Record<string, unknown>).strategy = 5;
    expect(validatePlantParams(stringAsNumber)).toBeNull();
  });

  it('rejects Infinity leaves and non-object sections', () => {
    const inf = defaultPlant();
    inf.pump.H_BEP = Infinity;
    expect(validatePlantParams(inf)).toBeNull();

    const nullSection = defaultPlant() as unknown as Record<string, unknown>;
    nullSection.sensors = null;
    expect(validatePlantParams(nullSection)).toBeNull();

    expect(validatePlantParams(null)).toBeNull();
    expect(validatePlantParams(42)).toBeNull();
    expect(validatePlantParams('plant')).toBeNull();
  });

  it('rejects a missing nested leaf', () => {
    const p = defaultPlant();
    delete (p.sensors.faults as unknown as Record<string, unknown>).pressureDrift;
    expect(validatePlantParams(p)).toBeNull();
  });
});
