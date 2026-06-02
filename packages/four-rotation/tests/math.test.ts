import { det4Columns, identityMat4, multiplyMat4, normalize4To, rejectFromBasis4To, transformMat4Vec4 } from "../src";

function expectArrayClose(actual: ArrayLike<number>, expected: number[], precision = 5) {
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], precision);
  }
}

describe("math primitives", () => {
  it("keeps vectors unchanged through identity matrix", () => {
    const out = new Float32Array(4);
    transformMat4Vec4(identityMat4(), 1, 2, 3, 4, out);
    expectArrayClose(out, [1, 2, 3, 4]);
  });

  it("multiplies by identity on both sides", () => {
    const identity = identityMat4();
    const matrix = identityMat4();
    matrix[0] = 2;
    matrix[5] = 3;
    matrix[10] = 4;
    matrix[15] = 5;

    expectArrayClose(multiplyMat4(identity, matrix, new Float32Array(16)), Array.from(matrix));
    expectArrayClose(multiplyMat4(matrix, identity, new Float32Array(16)), Array.from(matrix));
  });

  it("normalizes vectors", () => {
    const out = new Float32Array(4);
    expect(normalize4To(3, 0, 0, 0, out)).toBe(true);
    expectArrayClose(out, [1, 0, 0, 0]);
  });

  it("computes determinant from 4D column vectors", () => {
    expect(det4Columns(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    )).toBeCloseTo(1);
  });

  it("rejects vectors from existing bases", () => {
    const out = new Float32Array(4);
    const eX = new Float32Array([1, 0, 0, 0]);
    expect(rejectFromBasis4To(1, 0, 0, 0, [eX], out)).toBeCloseTo(0);
    expectArrayClose(out, [0, 0, 0, 0]);

    expect(rejectFromBasis4To(0, 1, 0, 0, [eX], out)).toBeCloseTo(1);
    expectArrayClose(out, [0, 1, 0, 0]);
  });
});

