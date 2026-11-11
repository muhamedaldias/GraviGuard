// Main-thread client for the physics worker.
import type { WorkerInbound, WorkerOutbound } from './worker';
import type { SimState } from './types';

export class SimClient {
  private worker: Worker;
  private onSnapshot: (s: SimState) => void;
  private onError: (msg: string) => void;

  constructor(onSnapshot: (s: SimState) => void, onError: (msg: string) => void = () => {}) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.onSnapshot = onSnapshot;
    this.onError = onError;
    this.worker.onmessage = (ev: MessageEvent<WorkerOutbound>) => {
      const msg = ev.data;
      if (msg.type === 'snapshot') this.onSnapshot(msg.state);
      else if (msg.type === 'error') this.onError(msg.message);
    };
  }

  send(msg: WorkerInbound): void {
    this.worker.postMessage(msg);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
