// SimClient: outbound message routing + worker failure handling (stubbed Worker, node env).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SimClient } from '../src/sim/client';
import type { WorkerInbound } from '../src/sim/worker';
import type { SimState } from '../src/sim/types';

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

/** Deliver an inbound worker message (cast keeps tests independent of WorkerOutbound shape). */
function deliver(w: StubWorker, data: unknown): void {
  w.onmessage?.({ data } as unknown as MessageEvent);
}

describe('SimClient', () => {
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal('Worker', StubWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates a module worker and routes snapshots to onSnapshot', () => {
    const onSnapshot = vi.fn();
    new SimClient(onSnapshot);
    expect(workers).toHaveLength(1);
    expect(String(workers[0].url)).toContain('worker.ts');
    expect(workers[0].opts).toEqual({ type: 'module' });
    const state = { t: 1.5 } as unknown as SimState;
    deliver(workers[0], { type: 'snapshot', state });
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith(state);
  });

  it('routes an error with fatal:true as onError(msg, true)', () => {
    const onError = vi.fn();
    new SimClient(vi.fn(), onError);
    deliver(workers[0], { type: 'error', message: 'x', fatal: true });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('x', true);
  });

  it('routes an error without fatal as onError(msg, false)', () => {
    const onError = vi.fn();
    new SimClient(vi.fn(), onError);
    deliver(workers[0], { type: 'error', message: 'x' });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('x', false);
  });

  it('routes ready to onReady', () => {
    const onReady = vi.fn();
    new SimClient(vi.fn(), vi.fn(), onReady);
    deliver(workers[0], { type: 'ready' });
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('treats worker.onerror as a fatal error with the event message', () => {
    const onError = vi.fn();
    new SimClient(vi.fn(), onError);
    workers[0].onerror?.({ message: 'load fail' } as unknown as ErrorEvent);
    expect(onError).toHaveBeenCalledWith('load fail', true);
  });

  it('falls back to a default message when onerror carries none', () => {
    const onError = vi.fn();
    new SimClient(vi.fn(), onError);
    workers[0].onerror?.({ message: '' } as unknown as ErrorEvent);
    expect(onError).toHaveBeenCalledWith('Physics worker failed to load', true);
  });

  it('treats worker.onmessageerror as a fatal error', () => {
    const onError = vi.fn();
    new SimClient(vi.fn(), onError);
    workers[0].onmessageerror?.({} as unknown as MessageEvent);
    expect(onError).toHaveBeenCalledWith('Worker message deserialization failed', true);
  });

  it('send() posts the message to the worker', () => {
    const c = new SimClient(vi.fn());
    const msg: WorkerInbound = { type: 'play' };
    c.send(msg);
    expect(workers[0].postMessage).toHaveBeenCalledTimes(1);
    expect(workers[0].postMessage).toHaveBeenCalledWith(msg);
  });

  it('dispose() terminates the worker', () => {
    const c = new SimClient(vi.fn());
    c.dispose();
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
  });
});
