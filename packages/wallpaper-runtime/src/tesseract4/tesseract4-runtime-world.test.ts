import { describe, expect, it } from "vitest";
import { runtimeWorldId } from "runtime-core";
import { Tesseract4RuntimeWorld } from "./tesseract4-runtime-world";

describe("Tesseract4RuntimeWorld", () => {
  it("owns renderer-agnostic 4D world identity and line projection", () => {
    const world = new Tesseract4RuntimeWorld({
      worldId: runtimeWorldId("world:tesseract-main"),
      label: "Main Tesseract"
    });

    expect(world.descriptor).toEqual({
      id: runtimeWorldId("world:tesseract-main"),
      kind: "world-4d",
      label: "Main Tesseract"
    });
    expect(world.maxSegmentCount).toBeGreaterThan(0);
  });

  it("updates projected line data without owning Three resources", () => {
    const world = new Tesseract4RuntimeWorld();

    const result = world.updateRuntimeFrame({ timeMs: 1000, deltaMs: 16, frameIndex: 1 });

    expect(result).toBe(world.lineProjection);
    expect(result.segmentCount).toBeGreaterThan(0);
    expect(result.positions3.length).toBeGreaterThan(0);
    expect(result.bounds3.valid).toBe(true);
  });
});
