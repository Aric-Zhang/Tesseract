import { rotatePlane4D, rotateXY, rotateXU, transformPoint4D, translate4D } from "../src";

function expectPointClose(actual: ArrayLike<number>, expected: number[]) {
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

describe("4D rotations", () => {
  it("rotates positively in the XY plane", () => {
    const out = new Float32Array(4);
    transformPoint4D(rotateXY(Math.PI / 2), 1, 0, 0, 0, out);
    expectPointClose(out, [0, 1, 0, 0]);
  });

  it("rotates positively in the XU plane", () => {
    const out = new Float32Array(4);
    transformPoint4D(rotateXU(Math.PI / 2), 1, 0, 0, 0, out);
    expectPointClose(out, [0, 0, 0, 1]);
  });

  it("clears translation when reusing output", () => {
    const outTransform = translate4D([1, 2, 3, 4]);
    rotateXU(Math.PI / 2, outTransform);
    expectPointClose(outTransform.translation, [0, 0, 0, 0]);
  });

  it("rejects invalid plane arguments", () => {
    expect(() => rotatePlane4D(0, 0, 1)).toThrow();
    expect(() => rotatePlane4D(-1 as 0, 2, 1)).toThrow();
    expect(() => rotatePlane4D(0, 4 as 3, 1)).toThrow();
    expect(() => rotatePlane4D(0, 1, Number.NaN)).toThrow();
  });
});

