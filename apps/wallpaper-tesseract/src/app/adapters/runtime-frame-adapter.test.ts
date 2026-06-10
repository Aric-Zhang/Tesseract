import { describe, expect, it } from "vitest";
import { toRuntimeFrame } from "./runtime-frame-adapter";

describe("runtime frame adapter", () => {
  it("maps app update frames into runtime-core frames without changing timing facts", () => {
    expect(toRuntimeFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 })).toEqual({
      timeMs: 32,
      deltaMs: 16,
      frameIndex: 2
    });
  });
});
