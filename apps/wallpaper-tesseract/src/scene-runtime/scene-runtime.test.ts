import { describe, expect, it } from "vitest";
import { SceneFrameClock, SceneRuntime, type RuntimeObject } from ".";

describe("SceneFrameClock", () => {
  it("creates monotonic frame contexts", () => {
    const clock = new SceneFrameClock();

    expect(clock.tick(100)).toEqual({ timeMs: 100, deltaMs: 0, frameIndex: 0 });
    expect(clock.tick(116)).toEqual({ timeMs: 116, deltaMs: 16, frameIndex: 1 });
  });
});

describe("SceneRuntime", () => {
  it("updates enabled runtime objects by priority then registration order", () => {
    const runtime = new SceneRuntime();
    const calls: string[] = [];
    const first: RuntimeObject = {
      id: "first",
      priority: 10,
      updateFrame: () => calls.push("first")
    };
    const second: RuntimeObject = {
      id: "second",
      priority: 0,
      updateFrame: () => calls.push("second")
    };
    const disabled: RuntimeObject = {
      id: "disabled",
      enabled: false,
      priority: -10,
      updateFrame: () => calls.push("disabled")
    };

    runtime.register(first);
    runtime.register(second);
    runtime.register(disabled);
    runtime.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(calls).toEqual(["second", "first"]);
  });

  it("disposes registered objects in reverse registration order", () => {
    const runtime = new SceneRuntime();
    const calls: string[] = [];

    runtime.register({ id: "a", dispose: () => calls.push("a") });
    runtime.register({ id: "b", dispose: () => calls.push("b") });
    runtime.dispose();

    expect(calls).toEqual(["b", "a"]);
  });
});
