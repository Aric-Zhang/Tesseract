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

  it("rejects unknown clipping modes and singularity policies", () => {
    expect(() => new CPUProjector4D({ clipping: "bad-mode" as never })).toThrow(/clipping/);
    expect(() => new CPUProjector4D({ singularityPolicy: "bad-policy" as never })).toThrow(/singularityPolicy/);
  });

  it("rejects undersized indexed output buffers", () => {
    const geometry = {
      positions4: new Float32Array([0, 0, 0, 1]),
      vertexCount: 1
    };
    const projector = new CPUProjector4D();
    const camera = new Camera4D({ position: [0, 0, 0, 0] });

    expect(() => projector.projectPoints({
      geometry,
      camera,
      out: {
        layout: "indexed",
        positions3: new Float32Array(0),
        depths4: new Float32Array(1),
        visibility: new Uint8Array(1),
        vertexCount: 1,
        bounds3: projector.createIndexedPointResult(geometry).bounds3
      }
    })).toThrow(/positions3/);
  });

  it("rejects undersized compact output buffers", () => {
    const geometry = {
      positions4: new Float32Array([0, 0, 0, 1]),
      vertexCount: 1
    };
    const projector = new CPUProjector4D();
    const camera = new Camera4D({ position: [0, 0, 0, 0] });

    expect(() => projector.projectPoints({
      geometry,
      camera,
      out: {
        layout: "compact",
        positions3: new Float32Array(3),
        depths4: new Float32Array(0),
        sourceIndices: new Uint32Array(1),
        visiblePointCount: 0,
        bounds3: projector.createCompactPointResult(geometry).bounds3
      }
    })).toThrow(/depths4/);
  });
});
