import { composeTransform4D, cloneTransform4D, identityTransform4D, multiplyTransform4D, rotateXY, scale4D, transformPoint4D, translate4D } from "../src";

function expectPointClose(actual: ArrayLike<number>, expected: number[]) {
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]).toBeCloseTo(expected[i], 5);
  }
}

describe("Transform4D", () => {
  it("keeps points unchanged with identity", () => {
    const out = new Float32Array(4);
    transformPoint4D(identityTransform4D(), 1, 2, 3, 4, out);
    expectPointClose(out, [1, 2, 3, 4]);
  });

  it("translates points", () => {
    const out = new Float32Array(4);
    transformPoint4D(translate4D([1, 2, 3, 4]), 0, 0, 0, 0, out);
    expectPointClose(out, [1, 2, 3, 4]);
  });

  it("composes translation and rotation as a circle operator", () => {
    const translateX1 = translate4D([1, 0, 0, 0]);
    const rotateXY90 = rotateXY(Math.PI / 2);
    const composed = identityTransform4D();
    const out = new Float32Array(4);

    multiplyTransform4D(rotateXY90, translateX1, composed);
    transformPoint4D(composed, 0, 0, 0, 0, out);
    expectPointClose(out, [0, 1, 0, 0]);

    composeTransform4D([translateX1, rotateXY90], composed);
    transformPoint4D(composed, 0, 0, 0, 0, out);
    expectPointClose(out, [0, 1, 0, 0]);
  });

  it("returns identity for empty compose", () => {
    const out = new Float32Array(4);
    const composed = composeTransform4D([]);
    transformPoint4D(composed, 1, 2, 3, 4, out);
    expectPointClose(out, [1, 2, 3, 4]);
  });

  it("supports multiply aliases", () => {
    const a = rotateXY(Math.PI / 2);
    const b = translate4D([1, 0, 0, 0]);
    const expected = identityTransform4D();
    multiplyTransform4D(a, b, expected);

    const aliasedA = cloneTransform4D(a);
    multiplyTransform4D(aliasedA, b, aliasedA);
    expectPointClose(aliasedA.translation, Array.from(expected.translation));

    const aliasedB = cloneTransform4D(b);
    multiplyTransform4D(a, aliasedB, aliasedB);
    expectPointClose(aliasedB.translation, Array.from(expected.translation));
  });

  it("scales uniformly and per axis", () => {
    const out = new Float32Array(4);
    transformPoint4D(scale4D(2), 1, 2, 3, 4, out);
    expectPointClose(out, [2, 4, 6, 8]);

    transformPoint4D(scale4D([1, 2, 3, 4]), 1, 1, 1, 1, out);
    expectPointClose(out, [1, 2, 3, 4]);
  });
});

