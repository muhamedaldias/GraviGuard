// Physics worker lifecycle: a module-level singleton client bound to the store.
import { useEffect } from 'react';
import { SimClient } from '../sim/client';
import { useApp } from '../state/store';
import type { WorkerInbound } from '../sim/worker';

let client: SimClient | null = null;

export function simSend(msg: WorkerInbound): void {
  client?.send(msg);
}

export function useSimLifecycle(): void {
  const setSnapshot = useApp((s) => s.setSnapshot);
  const params = useApp((s) => s.params);
  const seed = useApp((s) => s.seed);
  const scenario = useApp((s) => s.scenario);

  useEffect(() => {
    if (!client) {
      client = new SimClient(setSnapshot, (m) => console.error('[sim]', m));
    }
    return () => {
      client?.dispose();
      client = null;
    };
  }, [setSnapshot]);

  useEffect(() => {
    if (!client) return;
    if (scenario) {
      client.send({ type: 'scenario', scenario });
    } else {
      client.send({ type: 'init', params, seed, mode: 'ON' });
    }
  }, [params, seed, scenario]);
}
