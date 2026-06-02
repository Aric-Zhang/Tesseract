import { CPUProjector4D, createBounds3, createTesseract4D, includeBounds3, resetBounds3 } from "../src";

describe("projection result buffers", () => {
  it("creates reusable bounds objects", () => {
    const bounds = createBounds3();
    expect(bounds.valid).toBe(false);

    includeBounds3(bounds, 1, 2, 3);
    includeBounds3(bounds, -1, 4, 0);
    expect(bounds.valid).toBe(true);
    expect(Array.from(bounds.min)).toEqual([-1, 2, 0]);
    expect(Array.from(bounds.max)).toEqual([1, 4, 3]);

    resetBounds3(bounds);
    expect(bounds.valid).toBe(false);
  });

  it("sizes point and line results from normalized geometry", () => {
    const projector = new CPUProjector4D();
    const geometry = createTesseract4D();

    const indexed = projector.createIndexedPointResult(geometry);
    expect(indexed.positions3.length).toBe(16 * 3);
    expect(indexed.depths4.length).toBe(16);
    expect(indexed.visibility.length).toBe(16);

    const compact = projector.createCompactPointResult(geometry);
    expect(compact.positions3.length).toBe(16 * 3);
    expect(compact.sourceIndices.length).toBe(16);

    const lines = projector.createLineResult(geometry);
    expect(lines.positions3.length).toBe(32 * 2 * 3);
    expect(lines.depths4.length).toBe(32 * 2);
  });

  it("rejects line results for point-only geometry", () => {
    const projector = new CPUProjector4D();
    expect(() => projector.createLineResult({
      positions4: new Float32Array([0, 0, 0, 0]),
      vertexCount: 1
    })).toThrow(/requires geometry\.edges/);
  });
});
