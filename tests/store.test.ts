// Store contract: workerError state, plus existing setters keep their semantics.
import { describe, it, expect, beforeEach } from 'vitest';
import { useApp } from '../src/state/store';
import { defaultPlant } from '../src/sim/defaults';

beforeEach(() => {
  useApp.setState({
    playing: false,
    scenario: null,
    seed: 12345,
    params: defaultPlant(),
    workerError: null,
  });
});

describe('store workerError', () => {
  it('is null initially', () => {
    expect(useApp.getState().workerError).toBeNull();
  });

  it('setWorkerError sets and clears the error', () => {
    useApp.getState().setWorkerError('boom');
    expect(useApp.getState().workerError).toBe('boom');
    useApp.getState().setWorkerError(null);
    expect(useApp.getState().workerError).toBeNull();
  });
});

describe('store existing setters (unchanged behavior)', () => {
  it('setParams clones: the mutate callback does not alias previous params', () => {
    const before = useApp.getState().params;
    useApp.getState().setParams((p) => {
      p.fluid.T = 40;
    });
    const after = useApp.getState().params;
    expect(after).not.toBe(before);
    expect(after.fluid.T).toBe(40);
    expect(before.fluid.T).toBe(35);
  });

  it('setPlaying toggles playing', () => {
    useApp.getState().setPlaying(true);
    expect(useApp.getState().playing).toBe(true);
    useApp.getState().setPlaying(false);
    expect(useApp.getState().playing).toBe(false);
  });
});
