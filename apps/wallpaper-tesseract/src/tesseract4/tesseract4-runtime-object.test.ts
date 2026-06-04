import { describe, expect, it } from "vitest";
import { Tesseract4RuntimeObject } from "./tesseract4-runtime-object";

describe("Tesseract4RuntimeObject", () => {
  it("updates projected line buffers during the frame loop", () => {
    const tesseract = new Tesseract4RuntimeObject();

    tesseract.updateFrame({ timeMs: 1000, deltaMs: 16, frameIndex: 1 });

    expect(tesseract.object.geometry.drawRange.count).toBeGreaterThan(0);
    expect(tesseract.object.frustumCulled).toBe(false);
    tesseract.dispose();
  });
});
