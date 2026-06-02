import { Camera4D, CPUProjector4D, createTesseract4D } from "../src";

describe("CPUProjector4D.projectLines", () => {
  it("projects a complete visible tesseract wireframe", () => {
    const geometry = createTesseract4D();
    const camera = new Camera4D();
    const projector = new CPUProjector4D();
    const out = projector.createLineResult(geometry);

    projector.projectLines({ geometry, camera, out });

    expect(out.segmentCount).toBe(32);
    expect(out.bounds3.valid).toBe(true);
    for (let i = 0; i < out.segmentCount * 6; i++) {
      expect(Number.isFinite(out.positions3[i])).toBe(true);
    }
    for (let i = 0; i < out.segmentCount * 2; i++) {
      expect(out.depths4[i]).toBeGreaterThanOrEqual(camera.safeNear);
      expect(out.depths4[i]).toBeLessThanOrEqual(camera.far);
    }
  });

  it("resets segmentCount and bounds on every update", () => {
    const geometry = createTesseract4D();
    const visibleCamera = new Camera4D();
    const hiddenCamera = new Camera4D({ position: [0, 0, 0, 5] });
    const projector = new CPUProjector4D();
    const out = projector.createLineResult(geometry);

    projector.projectLines({ geometry, camera: visibleCamera, out });
    expect(out.segmentCount).toBeGreaterThan(0);
    expect(out.bounds3.valid).toBe(true);

    projector.projectLines({ geometry, camera: hiddenCamera, out });
    expect(out.segmentCount).toBe(0);
    expect(out.bounds3.valid).toBe(false);
  });

  it("clips lines to the safe near plane", () => {
    const geometry = {
      positions4: new Float32Array([
        0, 0, 0, -1,
        0, 0, 0, 2
      ]),
      vertexCount: 2,
      edges: new Uint16Array([0, 1]),
      edgeCount: 1
    };
    const camera = new Camera4D({ position: [0, 0, 0, 0], near: 0.5, far: 10 });
    const projector = new CPUProjector4D();
    const out = projector.createLineResult(geometry);

    projector.projectLines({ geometry, camera, out });

    expect(out.segmentCount).toBe(1);
    expect(out.depths4[0]).toBeCloseTo(0.5, 5);
    expect(out.depths4[1]).toBeCloseTo(2, 5);
  });

  it("rejects point-only geometry", () => {
    const projector = new CPUProjector4D();
    const camera = new Camera4D();
    const geometry = {
      positions4: new Float32Array([0, 0, 0, 1]),
      vertexCount: 1
    };
    const out = {
      positions3: new Float32Array(0),
      depths4: new Float32Array(0),
      segmentCount: 0,
      bounds3: projector.createLineResult(createTesseract4D()).bounds3
    };

    expect(() => projector.projectLines({ geometry, camera, out })).toThrow(/requires geometry\.edges/);
  });

  it("rejects undersized line output buffers", () => {
    const geometry = {
      positions4: new Float32Array([
        0, 0, 0, 1,
        1, 0, 0, 1
      ]),
      vertexCount: 2,
      edges: new Uint16Array([0, 1]),
      edgeCount: 1
    };
    const projector = new CPUProjector4D();
    const camera = new Camera4D({ position: [0, 0, 0, 0] });
    const out = projector.createLineResult(geometry);
    out.positions3 = new Float32Array(0);

    expect(() => projector.projectLines({ geometry, camera, out })).toThrow(/positions3/);
  });
});
