import { describe, expect, it } from "vitest";
import type { RuntimeFrame, RuntimeWork } from "runtime-core";
import { RuntimeScheduler, type RuntimeRegistration, type RuntimeScheduleOptions } from "runtime-core";
import { ProductionRuntimeSchedulerService } from "./runtime-scheduler-service";

const frame: RuntimeFrame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };

describe("ProductionRuntimeSchedulerService", () => {
  it("updates registered runtime work in scheduler priority order", () => {
    const calls: string[] = [];
    const service = new ProductionRuntimeSchedulerService();

    service.registerRuntimeWork(work("low", calls), { priority: -1 });
    service.registerRuntimeWork(work("high", calls), { priority: 10 });

    service.updateRuntimeFrame(frame);

    expect(calls).toEqual(["high:1", "low:1"]);
  });

  it("enables, disables, and unregisters runtime work without using UI/component tick", () => {
    const calls: string[] = [];
    const service = new ProductionRuntimeSchedulerService();
    const runtimeWork = work("runtime", calls);
    const registration = service.registerRuntimeWork(runtimeWork);

    service.setRuntimeWorkEnabled(runtimeWork, false);
    service.updateRuntimeFrame(frame);
    service.setRuntimeWorkEnabled(runtimeWork, true);
    service.updateRuntimeFrame({ ...frame, frameIndex: 2 });
    registration.dispose();
    service.updateRuntimeFrame({ ...frame, frameIndex: 3 });

    expect(calls).toEqual(["runtime:2"]);
    expect(service.size).toBe(0);
  });

  it("disposes remaining registrations in reverse order and aggregates failures", () => {
    const calls: string[] = [];
    const scheduler = new ThrowingDisposeScheduler(calls);
    const service = new ProductionRuntimeSchedulerService({ scheduler });

    service.registerRuntimeWork(work("a", calls));
    service.registerRuntimeWork(work("b", calls));

    expect(() => service.dispose()).toThrow("boom");
    expect(calls).toEqual(["second", "first"]);
    expect(service.size).toBe(0);
  });
});

function work(id: string, calls: string[]): RuntimeWork {
  return {
    updateRuntimeFrame(updateFrame) {
      calls.push(`${id}:${updateFrame.frameIndex}`);
    }
  };
}

class ThrowingDisposeScheduler extends RuntimeScheduler {
  readonly #calls: string[];
  #disposeIndex = 0;

  constructor(calls: string[]) {
    super();
    this.#calls = calls;
  }

  override register(work: RuntimeWork, options: RuntimeScheduleOptions = {}): RuntimeRegistration {
    const registration = super.register(work, options);
    const disposeLabel = this.#disposeIndex++ === 0 ? "first" : "second";
    return {
      dispose: () => {
        registration.dispose();
        this.#calls.push(disposeLabel);
        if (disposeLabel === "second") {
          throw new Error("boom");
        }
      }
    };
  }
}
