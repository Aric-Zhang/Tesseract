import { Camera4D, CPUProjector4D } from "../src";

describe("CPUProjector4D.projectPoints", () => {
  it("projects indexed orthographic points and preserves source layout", () => {
    const camera = new Camera4D({
      projection: "orthographic",
      position: [0, 0, 0, 0],
      orthoHalfExtent: [2, 4, 8],
      near: 0.1,
      far: 10
    });
    const geometry = {
      positions4: new Float32Array([
        2, 4, 8, 1,
        4, 4, 8, 1
      ]),
      vertexCount: 2
    };
    const projector = new CPUProjector4D();
    const out = projector.createIndexedPointResult(geometry);

    projector.projectPoints({ geometry, camera, out });

    expect(out.visibility[0]).toBe(1);
    expect(out.visibility[1]).toBe(1);
    expect(Array.from(out.positions3.slice(0, 3))).toEqual([1, 1, 1]);
    expect(Array.from(out.positions3.slice(3, 6))).toEqual([2, 1, 1]);
    expect(out.bounds3.valid).toBe(true);
  });

  it("projects compact perspective points and drops unsafe depths by default", () => {
    const camera = new Camera4D({
      position: [0, 0, 0, 0],
      focalScale: [1, 1, 1],
      near: 0.1,
      far: 10
    });
    const geometry = {
      positions4: new Float32Array([
        1, 0, 0, 0,
        1, 0, 0, 2,
        1, 0, 0, 4
      ]),
      vertexCount: 3
    };
    const projector = new CPUProjector4D();
    const out = projector.createCompactPointResult(geometry);

    projector.projectPoints({ geometry, camera, out });

    expect(out.visiblePointCount).toBe(2);
    expect(Array.from(out.sourceIndices.slice(0, 2))).toEqual([1, 2]);
    expect(out.positions3[0]).toBeCloseTo(0.5, 5);
    expect(out.positions3[3]).toBeCloseTo(0.25, 5);
    for (let i = 0; i < out.visiblePointCount * 3; i++) {
      expect(Number.isFinite(out.positions3[i])).toBe(true);
    }
  });

  it("rejects contradictory singularity policy options", () => {
    expect(() => new CPUProjector4D({ clipping: "near-far", singularityPolicy: "allow" })).toThrow(/requires/);
    expect(() => new CPUProjector4D({ clipping: "frustum", singularityPolicy: "allow" })).toThrow(/requires/);
    expect(() => new CPUProjector4D({ clipping: "singularity-only", singularityPolicy: "allow" })).toThrow(/requires/);
    expect(() => new CPUProjector4D({ clipping: "none-unsafe", singularityPolicy: "allow" })).not.toThrow();
  });
});
