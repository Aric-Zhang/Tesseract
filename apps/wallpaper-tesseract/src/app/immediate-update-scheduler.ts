export type ImmediateUpdateMicrotaskScheduler = (callback: () => void) => void;

export interface ImmediateUpdateSchedulerOptions {
  update(timeMs: number): void;
  isUpdatingFrame(): boolean;
  now?: () => number;
  enqueueMicrotask?: ImmediateUpdateMicrotaskScheduler;
}

export class ImmediateUpdateScheduler {
  private readonly update: (timeMs: number) => void;
  private readonly isUpdatingFrame: () => boolean;
  private readonly now: () => number;
  private readonly enqueueMicrotask: ImmediateUpdateMicrotaskScheduler;
  private queued = false;
  private disposed = false;

  constructor(options: ImmediateUpdateSchedulerOptions) {
    this.update = options.update;
    this.isUpdatingFrame = options.isUpdatingFrame;
    this.now = options.now ?? readMonotonicTime;
    this.enqueueMicrotask = options.enqueueMicrotask ?? enqueueMicrotask;
  }

  requestUpdate(timeMs = this.now()): void {
    if (this.disposed || this.queued || this.isUpdatingFrame()) return;
    this.queued = true;
    this.enqueueMicrotask(() => {
      this.queued = false;
      if (this.disposed) return;
      this.update(timeMs);
    });
  }

  dispose(): void {
    this.disposed = true;
    this.queued = false;
  }
}

function enqueueMicrotask(callback: () => void): void {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
}

function readMonotonicTime(): number {
  return globalThis.performance?.now() ?? Date.now();
}
