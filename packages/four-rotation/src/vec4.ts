import { EPSILON4D } from "./constants";
import type { Vec4Like } from "./types";

export function dot4(ax: number, ay: number, az: number, au: number, bx: number, by: number, bz: number, bu: number): number {
  return ax * bx + ay * by + az * bz + au * bu;
}

export function dot4Array(x: number, y: number, z: number, u: number, basis: Vec4Like, offset = 0): number {
  return x * basis[offset] + y * basis[offset + 1] + z * basis[offset + 2] + u * basis[offset + 3];
}

export function length4(x: number, y: number, z: number, u: number): number {
  return Math.hypot(x, y, z, u);
}

export function normalize4To(x: number, y: number, z: number, u: number, out: Float32Array, offset = 0): boolean {
  const len = length4(x, y, z, u);
  if (len <= EPSILON4D || !Number.isFinite(len)) {
    out[offset] = 0;
    out[offset + 1] = 0;
    out[offset + 2] = 0;
    out[offset + 3] = 0;
    return false;
  }

  const inv = 1 / len;
  out[offset] = x * inv;
  out[offset + 1] = y * inv;
  out[offset + 2] = z * inv;
  out[offset + 3] = u * inv;
  return true;
}

export function subtract4To(a: Vec4Like, b: Vec4Like, out: Float32Array, offset = 0): Float32Array {
  out[offset] = a[0] - b[0];
  out[offset + 1] = a[1] - b[1];
  out[offset + 2] = a[2] - b[2];
  out[offset + 3] = a[3] - b[3];
  return out;
}

export function copy4To(source: Vec4Like, out: Float32Array, offset = 0): Float32Array {
  out[offset] = source[0];
  out[offset + 1] = source[1];
  out[offset + 2] = source[2];
  out[offset + 3] = source[3];
  return out;
}

export function det4Columns(
  ax: number, ay: number, az: number, au: number,
  bx: number, by: number, bz: number, bu: number,
  cx: number, cy: number, cz: number, cu: number,
  dx: number, dy: number, dz: number, du: number
): number {
  const m00 = ax; const m01 = bx; const m02 = cx; const m03 = dx;
  const m10 = ay; const m11 = by; const m12 = cy; const m13 = dy;
  const m20 = az; const m21 = bz; const m22 = cz; const m23 = dz;
  const m30 = au; const m31 = bu; const m32 = cu; const m33 = du;

  const subFactor00 = m22 * m33 - m23 * m32;
  const subFactor01 = m21 * m33 - m23 * m31;
  const subFactor02 = m21 * m32 - m22 * m31;
  const subFactor03 = m20 * m33 - m23 * m30;
  const subFactor04 = m20 * m32 - m22 * m30;
  const subFactor05 = m20 * m31 - m21 * m30;

  return m00 * (m11 * subFactor00 - m12 * subFactor01 + m13 * subFactor02)
    - m01 * (m10 * subFactor00 - m12 * subFactor03 + m13 * subFactor04)
    + m02 * (m10 * subFactor01 - m11 * subFactor03 + m13 * subFactor05)
    - m03 * (m10 * subFactor02 - m11 * subFactor04 + m12 * subFactor05);
}

export function rejectFromBasis4To(
  x: number,
  y: number,
  z: number,
  u: number,
  basis: Vec4Like[],
  out: Float32Array,
  offset = 0
): number {
  let rx = x;
  let ry = y;
  let rz = z;
  let ru = u;

  for (const vector of basis) {
    const projection = dot4Array(rx, ry, rz, ru, vector);
    rx -= projection * vector[0];
    ry -= projection * vector[1];
    rz -= projection * vector[2];
    ru -= projection * vector[3];
  }

  out[offset] = rx;
  out[offset + 1] = ry;
  out[offset + 2] = rz;
  out[offset + 3] = ru;
  return length4(rx, ry, rz, ru);
}

