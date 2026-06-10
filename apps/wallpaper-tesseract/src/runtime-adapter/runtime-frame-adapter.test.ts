import { describe, expect, it } from "vitest";
import { toRuntimeFrame, toRuntimeFrameClock } from "./runtime-frame-adapter";
import { UpdateFrameClock } from "../runtime/ports";

describe("runtime frame adapter", () => {
  it("maps app UpdateFrame into runtime-core RuntimeFrame without changing timing facts", () => {
    expect(toRuntimeFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 })).toEqual({
      timeMs: 32,
      deltaMs: 16,
      frameIndex: 2
    });
  });

  it("wraps the app update clock as a runtime frame clock", () => {
    const clock = toRuntimeFrameClock(new UpdateFrameClock());

    expect(clock.tick(100)).toEqual({ timeMs: 100, deltaMs: 0, frameIndex: 0 });
    expect(clock.tick(125)).toEqual({ timeMs: 125, deltaMs: 25, frameIndex: 1 });
  });
});
