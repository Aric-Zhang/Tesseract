import { createRuntimeRegistration, type RuntimeRegistration } from "./runtime-disposable";

export interface RuntimeFrame {
  readonly timeMs: number;
  readonly deltaMs: number;
  readonly frameIndex: number;
}

export interface RuntimeWork {
  updateRuntimeFrame(frame: RuntimeFrame): void;
}

export interface RuntimeScheduleOptions {
  readonly priority?: number;
  readonly enabled?: boolean;
}

interface ScheduledRuntimeWork {
  readonly work: RuntimeWork;
  readonly priority: number;
  enabled: boolean;
  disposed: boolean;
}

export class RuntimeFrameClock {
  #lastTimeMs: number | null = null;
  #frameIndex = 0;

  tick(timeMs: number): RuntimeFrame {
    if (!Number.isFinite(timeMs)) {
      throw new Error("RuntimeFrameClock.tick requires a finite timeMs.");
    }
    if (this.#lastTimeMs !== null && timeMs < this.#lastTimeMs) {
      throw new Error("RuntimeFrameClock.tick requires monotonic time.");
    }
    const deltaMs = this.#lastTimeMs === null ? 0 : timeMs - this.#lastTimeMs;
    this.#lastTimeMs = timeMs;
    return { timeMs, deltaMs, frameIndex: this.#frameIndex++ };
  }
}

export class RuntimeScheduler {
  readonly #scheduled = new Set<ScheduledRuntimeWork>();

  register(work: RuntimeWork, options: RuntimeScheduleOptions = {}): RuntimeRegistration {
    const scheduled: ScheduledRuntimeWork = {
      work,
      priority: options.priority ?? 0,
      enabled: options.enabled ?? true,
      disposed: false
    };
    this.#scheduled.add(scheduled);
    return createRuntimeRegistration(() => {
      scheduled.disposed = true;
      this.#scheduled.delete(scheduled);
    });
  }

  setEnabled(work: RuntimeWork, enabled: boolean): void {
    for (const scheduled of this.#scheduled) {
      if (scheduled.work === work && !scheduled.disposed) {
        scheduled.enabled = enabled;
      }
    }
  }

  update(frame: RuntimeFrame): void {
    const scheduled = [...this.#scheduled]
      .filter((entry) => entry.enabled && !entry.disposed)
      .sort((left, right) => right.priority - left.priority);
    for (const entry of scheduled) {
      entry.work.updateRuntimeFrame(frame);
    }
  }

  get size(): number {
    return this.#scheduled.size;
  }
}
