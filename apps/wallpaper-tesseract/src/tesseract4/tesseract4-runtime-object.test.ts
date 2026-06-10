import { describe, expect, it } from "vitest";
import { runtimeWorldId } from "runtime-core";
import { Tesseract4RuntimeObject } from "./tesseract4-runtime-object";

describe("Tesseract4RuntimeObject", () => {
  it("uses a renderer-agnostic runtime world as its source of projection truth", () => {
    const tesseract = new Tesseract4RuntimeObject({
      id: "tesseract4",
      worldId: runtimeWorldId("world:tesseract")
    });

    expect(tesseract.worldDescriptor).toMatchObject({
      id: runtimeWorldId("world:tesseract"),
      kind: "world-4d"
    });
    expect(tesseract.world.maxSegmentCount).toBeGreaterThan(0);
    tesseract.dispose();
  });

  it("updates projected line buffers during the frame loop", () => {
    const tesseract = new Tesseract4RuntimeObject();

    tesseract.updateFrame({ timeMs: 1000, deltaMs: 16, frameIndex: 1 });

    expect(tesseract.object.geometry.drawRange.count).toBeGreaterThan(0);
    expect(tesseract.object.frustumCulled).toBe(false);
    tesseract.dispose();
  });
});
