import { describe, expect, it } from "vitest";
import { RenderLoop, type RenderLoopEnvironment } from "./render-loop";

describe("RenderLoop", () => {
  it("uses requestAnimationFrame when the document is visible", () => {
    const env = createEnvironment({ hidden: false });
    const loop = new RenderLoop({
      update: () => {},
      environment: env
    });

    loop.start();

    expect(env.calls).toEqual(["requestAnimationFrame"]);
  });

  it("uses timeout when the document is hidden", () => {
    const env = createEnvironment({ hidden: true });
    const loop = new RenderLoop({
      update: () => {},
      environment: env
    });

    loop.start();

    expect(env.calls).toEqual(["setTimeout:16"]);
  });

  it("uses the same monotonic clock for hidden timeout ticks", () => {
    let timeoutCallback: () => void = () => {
      throw new Error("timeout callback was not registered");
    };
    const updates: number[] = [];
    const env: RenderLoopEnvironment = {
      document: {
        hidden: true
      },
      now: () => 1234,
      window: {
        requestAnimationFrame() {
          throw new Error("requestAnimationFrame should not be used while hidden");
        },
        cancelAnimationFrame() {},
        setTimeout(callback: () => void) {
          timeoutCallback = callback;
          return 1;
        },
        clearTimeout() {}
      } as unknown as RenderLoopEnvironment["window"]
    };
    const loop = new RenderLoop({
      update: (timeMs) => updates.push(timeMs),
      environment: env
    });

    loop.start();
    timeoutCallback();

    expect(updates).toEqual([1234]);
  });

  it("does not schedule multiple frame requests when already running", () => {
    const env = createEnvironment({ hidden: false });
    const loop = new RenderLoop({
      update: () => {},
      environment: env
    });

    loop.start();
    loop.start();

    expect(env.calls).toEqual(["requestAnimationFrame"]);
  });

  it("cancels the active frame request on stop", () => {
    const env = createEnvironment({ hidden: false });
    const loop = new RenderLoop({
      update: () => {},
      environment: env
    });

    loop.start();
    loop.stop();

    expect(env.calls).toEqual(["requestAnimationFrame", "cancelAnimationFrame:1"]);
  });

  it("restarts only when already running", () => {
    const env = createEnvironment({ hidden: false });
    const loop = new RenderLoop({
      update: () => {},
      environment: env
    });

    loop.restart();
    loop.start();
    loop.restart();

    expect(env.calls).toEqual([
      "requestAnimationFrame",
      "cancelAnimationFrame:1",
      "requestAnimationFrame"
    ]);
  });
});

function createEnvironment(options: { hidden: boolean }): RenderLoopEnvironment & { calls: string[] } {
  const calls: string[] = [];
  let nextId = 1;
  return {
    calls,
    document: {
      hidden: options.hidden
    },
    now: () => 100,
    window: {
      requestAnimationFrame() {
        calls.push("requestAnimationFrame");
        return nextId++;
      },
      cancelAnimationFrame(id: number) {
        calls.push(`cancelAnimationFrame:${id}`);
      },
      setTimeout() {
        calls.push("setTimeout:16");
        return nextId++;
      },
      clearTimeout(id: number) {
        calls.push(`clearTimeout:${id}`);
      }
    } as unknown as RenderLoopEnvironment["window"]
  };
}
