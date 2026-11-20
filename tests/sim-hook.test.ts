// @vitest-environment jsdom
// useSimLifecycle: init on mount/seed/scenario, LIVE params on edit (no plant reset),
// play re-sync after re-init, and worker error/ready routing into the store.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useSimLifecycle } from '../src/hooks/sim';
import { useApp } from '../src/state/store';
import { defaultPlant } from '../src/sim/defaults';
import type { Scenario } from '../src/sim/types';
import type { WorkerInbound } from '../src/sim/worker';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const workers: StubWorker[] = [];

class StubWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent) => void) | null = null;
  onmessageerror: ((ev: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: URL, public opts: unknown) {
    workers.push(this);
  }
}

function Probe() {
  useSimLifecycle();
  return null;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(Probe));
  });
}

function sent(w: StubWorker): WorkerInbound[] {
  return w.postMessage.mock.calls.map((c) => c[0] as WorkerInbound);
}

/** Simulate an inbound worker message inside act (store updates must be act-wrapped). */
function deliver(data: unknown): void {
  act(() => {
    workers[0].onmessage?.({ data } as unknown as MessageEvent);
  });
}

const testScenario: Scenario = {
  id: 'test-sc',
  name: 'Test',
  nameAr: 'اختبار',
  description: 'test scenario',
  descriptionAr: 'سيناريو اختبار',
  tags: [],
  duration: 60,
  seed: 777,
  mode: 'ON',
};

beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal('Worker', StubWorker);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useApp.setState({
    playing: false,
    scenario: null,
    seed: 12345,
    params: defaultPlant(),
    workerError: null,
  });
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSimLifecycle', () => {
  it('mount sends init once (with current params/seed) and no params message', () => {
    mount();
    expect(workers).toHaveLength(1);
    expect(sent(workers[0])).toEqual([
      { type: 'init', params: useApp.getState().params, seed: 12345, mode: 'ON' },
    ]);
  });

  it('params edit sends exactly ONE live params message and never init (core regression)', () => {
    mount();
    const w = workers[0];
    const baseline = w.postMessage.mock.calls.length;
    act(() => {
      useApp.getState().setParams((p) => {
        p.fluid.T = 40;
      });
    });
    const next = sent(w).slice(baseline);
    expect(useApp.getState().params.fluid.T).toBe(40);
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe('params');
    expect(next).toEqual([{ type: 'params', params: useApp.getState().params }]);
    expect(next.some((m) => m.type === 'init')).toBe(false);
  });

  it('seed change re-inits with the new seed, then re-syncs play when playing', () => {
    mount();
    const w = workers[0];
    act(() => {
      useApp.getState().setPlaying(true);
    });
    const baseline = w.postMessage.mock.calls.length;
    act(() => {
      useApp.getState().setSeed(999);
    });
    const next = sent(w).slice(baseline);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual({
      type: 'init',
      params: useApp.getState().params,
      seed: 999,
      mode: 'ON',
    });
    expect(next[1]).toEqual({ type: 'play' });
  });

  it('scenario change sends scenario then play while playing', () => {
    mount();
    const w = workers[0];
    act(() => {
      useApp.getState().setPlaying(true);
    });
    const baseline = w.postMessage.mock.calls.length;
    act(() => {
      useApp.getState().setScenario(testScenario);
    });
    const next = sent(w).slice(baseline);
    expect(next).toEqual([{ type: 'scenario', scenario: testScenario }, { type: 'play' }]);
  });

  it('fatal inbound error sets workerError and pauses; ready clears workerError', () => {
    mount();
    act(() => {
      useApp.getState().setPlaying(true);
    });
    deliver({ type: 'error', message: 'boom', fatal: true });
    expect(useApp.getState().workerError).toBe('boom');
    expect(useApp.getState().playing).toBe(false);
    deliver({ type: 'ready' });
    expect(useApp.getState().workerError).toBeNull();
  });

  it('non-fatal inbound error sets workerError without pausing', () => {
    mount();
    act(() => {
      useApp.getState().setPlaying(true);
    });
    deliver({ type: 'error', message: 'soft' });
    expect(useApp.getState().workerError).toBe('soft');
    expect(useApp.getState().playing).toBe(true);
  });

  it('worker load failure (onerror) is fatal: workerError set and playing false', () => {
    mount();
    act(() => {
      useApp.getState().setPlaying(true);
    });
    act(() => {
      workers[0].onerror?.({ message: 'load fail' } as unknown as ErrorEvent);
    });
    expect(useApp.getState().workerError).toBe('load fail');
    expect(useApp.getState().playing).toBe(false);
  });

  it('unmount disposes the singleton; remount creates a fresh worker and re-inits', () => {
    mount();
    const first = workers[0];
    act(() => {
      root!.unmount();
    });
    expect(first.terminate).toHaveBeenCalledTimes(1);
    container?.remove();
    mount();
    expect(workers).toHaveLength(2);
    expect(sent(workers[1])).toEqual([
      { type: 'init', params: useApp.getState().params, seed: 12345, mode: 'ON' },
    ]);
  });
});
