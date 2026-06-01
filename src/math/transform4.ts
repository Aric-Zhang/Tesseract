import { identityMat4 } from "./mat4";
import type { Vec4, Vec4Like } from "./types";

export interface Transform4D {
  matrix: Float32Array;
  translation: Float32Array;
}

export function identityTransform4D(out: Transform4D = createTransform4D()): Transform4D {
  identityMat4(out.matrix);
  out.translation.fill(0);
  return out;
}

export function createTransform4D(): Transform4D {
  return {
    matrix: identityMat4(),
    translation: new Float32Array(4)
  };
}

export function cloneTransform4D(source: Transform4D): Transform4D {
  return {
    matrix: new Float32Array(source.matrix),
    translation: new Float32Array(source.translation)
  };
}

export function translate4D(offset: Vec4Like, out: Transform4D = createTransform4D()): Transform4D {
  identityMat4(out.matrix);
  out.translation[0] = offset[0];
  out.translation[1] = offset[1];
  out.translation[2] = offset[2];
  out.translation[3] = offset[3];
  return out;
}

export function scale4D(scale: number | Vec4, out: Transform4D = createTransform4D()): Transform4D {
  identityMat4(out.matrix);
  out.translation.fill(0);

  if (typeof scale === "number") {
    out.matrix[0] = scale;
    out.matrix[5] = scale;
    out.matrix[10] = scale;
    out.matrix[15] = scale;
  } else {
    out.matrix[0] = scale[0];
    out.matrix[5] = scale[1];
    out.matrix[10] = scale[2];
    out.matrix[15] = scale[3];
  }

  return out;
}

export function multiplyTransform4D(a: Transform4D, b: Transform4D, out: Transform4D): Transform4D {
  const am = a.matrix;
  const bm = b.matrix;

  const a00 = am[0]; const a10 = am[1]; const a20 = am[2]; const a30 = am[3];
  const a01 = am[4]; const a11 = am[5]; const a21 = am[6]; const a31 = am[7];
  const a02 = am[8]; const a12 = am[9]; const a22 = am[10]; const a32 = am[11];
  const a03 = am[12]; const a13 = am[13]; const a23 = am[14]; const a33 = am[15];

  const b00 = bm[0]; const b10 = bm[1]; const b20 = bm[2]; const b30 = bm[3];
  const b01 = bm[4]; const b11 = bm[5]; const b21 = bm[6]; const b31 = bm[7];
  const b02 = bm[8]; const b12 = bm[9]; const b22 = bm[10]; const b32 = bm[11];
  const b03 = bm[12]; const b13 = bm[13]; const b23 = bm[14]; const b33 = bm[15];

  const r00 = a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30;
  const r10 = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
  const r20 = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
  const r30 = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;
  const r01 = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
  const r11 = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
  const r21 = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
  const r31 = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;
  const r02 = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
  const r12 = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
  const r22 = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
  const r32 = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;
  const r03 = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
  const r13 = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
  const r23 = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
  const r33 = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;

  const tbx = b.translation[0];
  const tby = b.translation[1];
  const tbz = b.translation[2];
  const tbu = b.translation[3];
  const tx = a00 * tbx + a01 * tby + a02 * tbz + a03 * tbu + a.translation[0];
  const ty = a10 * tbx + a11 * tby + a12 * tbz + a13 * tbu + a.translation[1];
  const tz = a20 * tbx + a21 * tby + a22 * tbz + a23 * tbu + a.translation[2];
  const tu = a30 * tbx + a31 * tby + a32 * tbz + a33 * tbu + a.translation[3];

  out.matrix[0] = r00;
  out.matrix[1] = r10;
  out.matrix[2] = r20;
  out.matrix[3] = r30;
  out.matrix[4] = r01;
  out.matrix[5] = r11;
  out.matrix[6] = r21;
  out.matrix[7] = r31;
  out.matrix[8] = r02;
  out.matrix[9] = r12;
  out.matrix[10] = r22;
  out.matrix[11] = r32;
  out.matrix[12] = r03;
  out.matrix[13] = r13;
  out.matrix[14] = r23;
  out.matrix[15] = r33;
  out.translation[0] = tx;
  out.translation[1] = ty;
  out.translation[2] = tz;
  out.translation[3] = tu;
  return out;
}

export function composeTransform4D(parts: Transform4D[], out: Transform4D = createTransform4D()): Transform4D {
  return composeTransform4DInto(out, ...parts);
}

export function composeTransform4DInto(out: Transform4D, ...parts: Transform4D[]): Transform4D {
  identityTransform4D(out);
  if (parts.length === 0) {
    return out;
  }

  const tmp = createTransform4D();
  for (const part of parts) {
    multiplyTransform4D(part, out, tmp);
    out.matrix.set(tmp.matrix);
    out.translation.set(tmp.translation);
  }

  return out;
}

export function transformPoint4D(
  t: Transform4D,
  x: number,
  y: number,
  z: number,
  u: number,
  out: Float32Array,
  offset = 0
): Float32Array {
  const mx = t.matrix;
  out[offset] = mx[0] * x + mx[4] * y + mx[8] * z + mx[12] * u + t.translation[0];
  out[offset + 1] = mx[1] * x + mx[5] * y + mx[9] * z + mx[13] * u + t.translation[1];
  out[offset + 2] = mx[2] * x + mx[6] * y + mx[10] * z + mx[14] * u + t.translation[2];
  out[offset + 3] = mx[3] * x + mx[7] * y + mx[11] * z + mx[15] * u + t.translation[3];
  return out;
}
