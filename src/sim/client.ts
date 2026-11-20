// Main-thread client for the physics worker.
import type { WorkerInbound, WorkerOutbound } from './worker';
import type { SimState } from './types';

export class SimClient {
  private worker: Worker;
  private onSnapshot: (s: SimState) => void;
  private onError: (msg: string, fatal: boolean) => void;
  private onReady: () => void;

  constructor(
    onSnapshot: (s: SimState) => void,
    onError: (msg: string, fatal: boolean) => void = () => {},
    onReady: () => void = () => {},
  ) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.onSnapshot = onSnapshot;
    this.onError = onError;
    this.onReady = onReady;
    this.worker.onmessage = (ev: MessageEvent<WorkerOutbound>) => {
      const msg = ev.data;
      if (msg.type === 'snapshot') this.onSnapshot(msg.state);
      else if (msg.type === 'error') this.onError(msg.message, msg.fatal === true);
      else if (msg.type === 'ready') this.onReady();
    };
    // Worker script load/runtime failure: the loop never started or has died.
    this.worker.onerror = (ev) => this.onError(ev.message || 'Physics worker failed to load', true);
    this.worker.onmessageerror = () => this.onError('Worker message deserialization failed', true);
  }

  send(msg: WorkerInbound): void {
    this.worker.postMessage(msg);
  }

  dispose(): void {
    this.worker.terminate();
  }
}
