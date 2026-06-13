import type { RuntimeFrame } from "runtime-core";
import type { UiFrame, UiScheduledService, UiSchedulerRegistration } from "../window-runtime";

interface UiFrameEntry {
  readonly service: UiScheduledService;
  readonly order: number;
}

export class UiFrameScheduler {
  readonly #entries: UiFrameEntry[] = [];
  #nextOrder = 0;
  #disposed = false;

  register(service: UiScheduledService): UiSchedulerRegistration {
    if (this.#disposed) {
      throw new Error("Cannot register a UI scheduled service after UiFrameScheduler.dispose().");
    }
    if (this.#entries.some((entry) => entry.service === service)) {
      throw new Error(`UI scheduled service is already registered: ${service.id}`);
    }
    const entry: UiFrameEntry = {
      service,
      order: this.#nextOrder++
    };
    this.#entries.push(entry);
    this.#entries.sort(compareUiFrameEntries);
    return {
      dispose: () => this.#unregister(service)
    };
  }

  updateFrame(frame: RuntimeFrame): void {
    const uiFrame = toUiFrame(frame);
    for (const entry of [...this.#entries]) {
      const service = entry.service;
      if (service.enabled === false) continue;
      service.updateFrame?.(uiFrame);
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const entries = [...this.#entries].sort((a, b) => b.order - a.order);
    this.#entries.length = 0;
    for (const entry of entries) {
      entry.service.dispose?.();
    }
  }

  #unregister(service: UiScheduledService): void {
    const index = this.#entries.findIndex((entry) => entry.service === service);
    if (index >= 0) {
      this.#entries.splice(index, 1);
    }
  }
}

function compareUiFrameEntries(a: UiFrameEntry, b: UiFrameEntry): number {
  const priorityDelta = (a.service.priority ?? 0) - (b.service.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;
  return a.order - b.order;
}

function toUiFrame(frame: RuntimeFrame): UiFrame {
  return {
    timeMs: frame.timeMs,
    deltaMs: frame.deltaMs,
    frameIndex: frame.frameIndex
  };
}
