import { normalizeGeometry4D, validateGeometry4D, validateTesseractOptions } from "../src";

describe("Geometry4D validation", () => {
  it("infers edgeCount when it is omitted", () => {
    const geometry = normalizeGeometry4D({
      positions4: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0]),
      vertexCount: 2,
      edges: new Uint16Array([0, 1])
    });

    expect(geometry.edgeCount).toBe(1);
  });

  it("rejects non-finite vertex values", () => {
    expect(() => validateGeometry4D({
      positions4: new Float32Array([0, 0, 0, Number.NaN]),
      vertexCount: 1
    })).toThrow(/finite/);
  });

  it("rejects out-of-range edge indices", () => {
    expect(() => validateGeometry4D({
      positions4: new Float32Array([0, 0, 0, 0, 1, 0, 0, 0]),
      vertexCount: 2,
      edges: new Uint16Array([0, 2]),
      edgeCount: 1
    })).toThrow(/out-of-range/);
  });

  it("rejects invalid factory options", () => {
    expect(() => validateTesseractOptions({ size: 0 })).toThrow(/size/);
    expect(() => validateTesseractOptions({ center: [0, 0, Infinity, 0] })).toThrow(/center/);
  });
});
