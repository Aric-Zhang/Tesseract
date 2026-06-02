import { det4Columns, dot4Array } from "four-rotation";
import { Camera4D } from "../src";

function expectBasisOrthonormal(camera: Camera4D) {
  const bases = [camera.basisX, camera.basisY, camera.basisZ, camera.basisU];
  for (const basis of bases) {
    expect(Math.hypot(basis[0], basis[1], basis[2], basis[3])).toBeCloseTo(1, 5);
  }
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      expect(dot4Array(bases[i][0], bases[i][1], bases[i][2], bases[i][3], bases[j])).toBeCloseTo(0, 5);
    }
  }
  expect(det4Columns(
    camera.basisX[0], camera.basisX[1], camera.basisX[2], camera.basisX[3],
    camera.basisY[0], camera.basisY[1], camera.basisY[2], camera.basisY[3],
    camera.basisZ[0], camera.basisZ[1], camera.basisZ[2], camera.basisZ[3],
    camera.basisU[0], camera.basisU[1], camera.basisU[2], camera.basisU[3]
  )).toBeGreaterThan(0);
}

describe("Camera4D", () => {
  it("copies user-provided arrays", () => {
    const position: [number, number, number, number] = [0, 0, 0, -5];
    const camera = new Camera4D({ position });
    position[3] = 100;
    expect(camera.position[3]).toBe(-5);
  });

  it("normalizes fov inputs into focalScale and tanHalfFov", () => {
    const camera = new Camera4D({ fov4: Math.PI / 2 });
    expect(camera.focalScale[0]).toBeCloseTo(1, 5);
    expect(camera.focalScale[1]).toBeCloseTo(1, 5);
    expect(camera.focalScale[2]).toBeCloseTo(1, 5);
    expect(camera.tanHalfFov[0]).toBeCloseTo(1, 5);
  });

  it("derives tanHalfFov from focalScale as the runtime source of truth", () => {
    const camera = new Camera4D({ focalScale: [2, 4, 8] });
    expect(camera.tanHalfFov[0]).toBeCloseTo(0.5, 5);
    expect(camera.tanHalfFov[1]).toBeCloseTo(0.25, 5);
    expect(camera.tanHalfFov[2]).toBeCloseTo(0.125, 5);
  });

  it("validates far against safeNear", () => {
    expect(() => new Camera4D({ near: 1e-12, far: 5e-7 })).toThrow(/safeNear/);
  });

  it("rejects invalid viewBoxScale and manual basis", () => {
    expect(() => new Camera4D({ viewBoxScale: [1, 0, 1] })).toThrow(/viewBoxScale/);
    expect(() => new Camera4D({ basisX: [2, 0, 0, 0] })).toThrow(/normalized/);
    expect(() => new Camera4D({ basisX: [-1, 0, 0, 0] })).toThrow(/determinant/);
  });

  it("rejects non-finite position and viewBoxCenter values", () => {
    expect(() => new Camera4D({ position: [Number.NaN, 0, 0, -5] })).toThrow(/position.*finite/);
    expect(() => new Camera4D({ position: [0, 0, 0, Infinity] })).toThrow(/position.*finite/);
    expect(() => new Camera4D({ viewBoxCenter: [0, Number.NaN, 0] })).toThrow(/viewBoxCenter.*finite/);
  });

  it("rejects unknown projection and lookAt stability values", () => {
    expect(() => new Camera4D({ projection: "bad-mode" as never })).toThrow(/projection/);
    expect(() => new Camera4D().setProjection("bad-mode" as never)).toThrow(/projection/);
    expect(() => new Camera4D().setLookAt([0, 0, 0, -5], [0, 0, 0, 0], { stability: "bad-mode" as never })).toThrow(/stability/);
  });

  it("constructs a deterministic lookAt basis", () => {
    const camera = new Camera4D();
    camera.setLookAt([0, 0, 0, -5], [0, 0, 0, 0]);
    expectBasisOrthonormal(camera);
    expect(camera.basisU[3]).toBeCloseTo(1, 5);
  });

  it("uses deterministic fallback when hints are degenerate", () => {
    const camera = new Camera4D();
    camera.setLookAt([0, 0, 0, 0], [0, 0, 0, 1], {
      upHint: [0, 0, 0, 1],
      overHint: [0, 0, 0, 1]
    });
    expectBasisOrthonormal(camera);
  });

  it("rejects invalid lookAt requests", () => {
    const camera = new Camera4D();
    expect(() => camera.setLookAt([0, 0, 0, 0], [0, 0, 0, 0])).toThrow(/must not be equal/);
    expect(() => camera.setLookAt([Number.NaN, 0, 0, 0], [0, 0, 0, 1])).toThrow(/position.*finite/);
    expect(() => camera.setLookAt([0, 0, 0, 0], [0, Infinity, 0, 1])).toThrow(/target.*finite/);
    expect(() => camera.setLookAt([0, 0, 0, -5], [0, 0, 0, 0], { stability: "continuous" })).toThrow(/continuous/);
  });
});
