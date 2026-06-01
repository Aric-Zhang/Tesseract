import { createTesseract4D } from "../src";

function distance4(positions: Float32Array, a: number, b: number): number {
  const a4 = a * 4;
  const b4 = b * 4;
  return Math.hypot(
    positions[a4] - positions[b4],
    positions[a4 + 1] - positions[b4 + 1],
    positions[a4 + 2] - positions[b4 + 2],
    positions[a4 + 3] - positions[b4 + 3]
  );
}

describe("createTesseract4D", () => {
  it("creates 16 vertices and 32 edges", () => {
    const geometry = createTesseract4D({ size: 2 });
    expect(geometry.vertexCount).toBe(16);
    expect(geometry.positions4.length).toBe(64);
    expect(geometry.edgeCount).toBe(32);
    expect(geometry.edges?.length).toBe(64);
  });

  it("uses size as edge length", () => {
    const geometry = createTesseract4D({ size: 3 });
    for (let i = 0; i < geometry.edgeCount!; i++) {
      const a = geometry.edges![i * 2];
      const b = geometry.edges![i * 2 + 1];
      expect(distance4(geometry.positions4, a, b)).toBeCloseTo(3, 5);
    }
  });

  it("centers vertices around the requested center", () => {
    const center = [1, -2, 3, -4] as [number, number, number, number];
    const geometry = createTesseract4D({ size: 2, center });
    const mean = [0, 0, 0, 0];
    for (let i = 0; i < geometry.vertexCount; i++) {
      const i4 = i * 4;
      mean[0] += geometry.positions4[i4];
      mean[1] += geometry.positions4[i4 + 1];
      mean[2] += geometry.positions4[i4 + 2];
      mean[3] += geometry.positions4[i4 + 3];
    }
    for (let i = 0; i < 4; i++) {
      expect(mean[i] / geometry.vertexCount).toBeCloseTo(center[i], 5);
    }
  });
});
