// Physics worker lifecycle: a module-level singleton client bound to the store.
// Init happens on mount and on seed/scenario changes ONLY; param edits are sent
// live ('params') so the plant is never reset to t=0 by a slider move.
import { useEffect, useRef } from 'react';
import { SimClient } from '../sim/client';
import { useApp } from '../state/store';
import type { WorkerInbound } from '../sim/worker';
import type { PlantParams } from '../sim/types';

let client: SimClient | null = null;

export function simSend(msg: WorkerInbound): void {
  client?.send(msg);
}

export function useSimLifecycle(): void {
  const setSnapshot = useApp((s) => s.setSnapshot);
  const seed = useApp((s) => s.seed);
  const scenario = useApp((s) => s.scenario);
  const params = useApp((s) => s.params);
  // Exact params object last sent via 'init'/'params' (identity guard for effect 3).
  const lastParams = useRef<PlantParams | null>(null);

  // Effect 1 (mount): create/dispose the singleton client. StrictMode-safe:
  // cleanup disposes and nulls, so the second mount creates a fresh worker.
  useEffect(() => {
    if (!client) {
      client = new SimClient(
        setSnapshot,
        (m, fatal) => {
          useApp.getState().setWorkerError(m);
          console.error('[sim]', m);
          if (fatal) useApp.getState().setPlaying(false);
        },
        () => useApp.getState().setWorkerError(null),
      );
    }
    return () => {
      client?.dispose();
      client = null;
    };
  }, [setSnapshot]);

  // Effect 2 (seed/scenario): (re)initialize the plant, then re-sync play state.
  // Reads fresh store state — no stale closures over params/playing.
  useEffect(() => {
    if (!client) return;
    const { params: freshParams, playing } = useApp.getState();
    useApp.getState().setWorkerError(null);
    if (scenario) {
      client.send({ type: 'scenario', scenario });
    } else {
      client.send({ type: 'init', params: freshParams, seed, mode: 'ON' });
    }
    if (playing) client.send({ type: 'play' });
    lastParams.current = freshParams;
  }, [seed, scenario]);

  // Effect 3 (params): live param edits only — never 'init'. Declared after
  // effect 2 so a seed/scenario change records the ref first and no duplicate
  // 'params' is sent; on a params-only change effect 2 does not run at all.
  useEffect(() => {
    if (!client) return;
    if (params === lastParams.current) return;
    lastParams.current = params;
    client.send({ type: 'params', params });
  }, [params]);
}
