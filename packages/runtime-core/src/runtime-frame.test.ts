import { describe, expect, it } from "vitest";
import { RuntimeFrameClock, RuntimeScheduler, type RuntimeFrame, type RuntimeWork } from "./runtime-frame";

describe("runtime frame and scheduler", () => {
  it("creates monotonic runtime frames", () => {
    const clock = new RuntimeFrameClock();

    expect(clock.tick(100)).toEqual({ timeMs: 100, deltaMs: 0, frameIndex: 0 });
    expect(clock.tick(116)).toEqual({ timeMs: 116, deltaMs: 16, frameIndex: 1 });
    expect(() => clock.tick(115)).toThrow(/monotonic/);
  });

  it("schedules runtime work by priority and disposal", () => {
    const calls: string[] = [];
    const createWork = (label: string): RuntimeWork => ({
      updateRuntimeFrame(frame: RuntimeFrame) {
        calls.push(`${label}:${frame.frameIndex}`);
      }
    });
    const scheduler = new RuntimeScheduler();
    const low = createWork("low");
    const high = createWork("high");
    const lowRegistration = scheduler.register(low, { priority: 1 });
    scheduler.register(high, { priority: 10 });

    scheduler.update({ timeMs: 0, deltaMs: 0, frameIndex: 0 });
    scheduler.setEnabled(high, false);
    scheduler.update({ timeMs: 16, deltaMs: 16, frameIndex: 1 });
    lowRegistration.dispose();
    lowRegistration.dispose();
    scheduler.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(calls).toEqual(["high:0", "low:0", "low:1"]);
    expect(scheduler.size).toBe(1);
  });
});
