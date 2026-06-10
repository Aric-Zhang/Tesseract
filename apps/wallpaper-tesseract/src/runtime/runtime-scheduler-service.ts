import {
  RuntimeScheduler,
  type RuntimeFrame,
  type RuntimeRegistration,
  type RuntimeScheduleOptions,
  type RuntimeWork
} from "runtime-core";

export interface ProductionRuntimeSchedulerServiceOptions {
  readonly scheduler?: RuntimeScheduler;
}

export class ProductionRuntimeSchedulerService {
  readonly #scheduler: RuntimeScheduler;
  readonly #registrations = new Set<RuntimeRegistration>();

  constructor(options: ProductionRuntimeSchedulerServiceOptions = {}) {
    this.#scheduler = options.scheduler ?? new RuntimeScheduler();
  }

  registerRuntimeWork(work: RuntimeWork, options: RuntimeScheduleOptions = {}): RuntimeRegistration {
    const registration = this.#scheduler.register(work, options);
    this.#registrations.add(registration);
    return {
      dispose: () => {
        if (!this.#registrations.delete(registration)) return;
        registration.dispose();
      }
    };
  }

  setRuntimeWorkEnabled(work: RuntimeWork, enabled: boolean): void {
    this.#scheduler.setEnabled(work, enabled);
  }

  updateRuntimeFrame(frame: RuntimeFrame): void {
    this.#scheduler.update(frame);
  }

  dispose(): void {
    const errors: unknown[] = [];
    for (const registration of [...this.#registrations].reverse()) {
      this.#registrations.delete(registration);
      try {
        registration.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(errors, "Failed to dispose runtime scheduler registrations.");
    }
  }

  get size(): number {
    return this.#scheduler.size;
  }
}
