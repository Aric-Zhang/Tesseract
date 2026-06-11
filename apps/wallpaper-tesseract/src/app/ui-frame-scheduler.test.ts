import { describe, expect, it } from "vitest";
import { UiFrameScheduler } from "./ui-frame-scheduler";

describe("UiFrameScheduler", () => {
  it("ticks enabled services by priority and registration order", () => {
    const calls: string[] = [];
    const scheduler = new UiFrameScheduler();
    scheduler.register({
      id: "second",
      priority: 10,
      updateFrame(frame) {
        calls.push(`second:${frame.frameIndex}`);
      }
    });
    scheduler.register({
      id: "first",
      priority: -1,
      updateFrame(frame) {
        calls.push(`first:${frame.frameIndex}`);
      }
    });
    scheduler.register({
      id: "disabled",
      priority: -100,
      enabled: false,
      updateFrame() {
        calls.push("disabled");
      }
    });

    scheduler.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 4 });

    expect(calls).toEqual(["first:4", "second:4"]);
  });

  it("disposes registered services in reverse registration order", () => {
    const calls: string[] = [];
    const scheduler = new UiFrameScheduler();
    scheduler.register({
      id: "a",
      dispose() {
        calls.push("a");
      }
    });
    scheduler.register({
      id: "b",
      dispose() {
        calls.push("b");
      }
    });

    scheduler.dispose();
    scheduler.dispose();

    expect(calls).toEqual(["b", "a"]);
  });

  it("removes disposed registrations without disposing the service", () => {
    const calls: string[] = [];
    const scheduler = new UiFrameScheduler();
    const registration = scheduler.register({
      id: "a",
      updateFrame() {
        calls.push("tick");
      },
      dispose() {
        calls.push("dispose");
      }
    });

    registration.dispose();
    scheduler.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 1 });
    scheduler.dispose();

    expect(calls).toEqual([]);
  });
});

