export function mat4Index(row: number, col: number): number {
  return col * 4 + row;
}

export function identityMat4(out: Float32Array = new Float32Array(16)): Float32Array {
  out.fill(0);
  out[mat4Index(0, 0)] = 1;
  out[mat4Index(1, 1)] = 1;
  out[mat4Index(2, 2)] = 1;
  out[mat4Index(3, 3)] = 1;
  return out;
}

export function multiplyMat4(a: Float32Array, b: Float32Array, out: Float32Array): Float32Array {
  const r00 = a[mat4Index(0, 0)] * b[mat4Index(0, 0)] + a[mat4Index(0, 1)] * b[mat4Index(1, 0)] + a[mat4Index(0, 2)] * b[mat4Index(2, 0)] + a[mat4Index(0, 3)] * b[mat4Index(3, 0)];
  const r10 = a[mat4Index(1, 0)] * b[mat4Index(0, 0)] + a[mat4Index(1, 1)] * b[mat4Index(1, 0)] + a[mat4Index(1, 2)] * b[mat4Index(2, 0)] + a[mat4Index(1, 3)] * b[mat4Index(3, 0)];
  const r20 = a[mat4Index(2, 0)] * b[mat4Index(0, 0)] + a[mat4Index(2, 1)] * b[mat4Index(1, 0)] + a[mat4Index(2, 2)] * b[mat4Index(2, 0)] + a[mat4Index(2, 3)] * b[mat4Index(3, 0)];
  const r30 = a[mat4Index(3, 0)] * b[mat4Index(0, 0)] + a[mat4Index(3, 1)] * b[mat4Index(1, 0)] + a[mat4Index(3, 2)] * b[mat4Index(2, 0)] + a[mat4Index(3, 3)] * b[mat4Index(3, 0)];

  const r01 = a[mat4Index(0, 0)] * b[mat4Index(0, 1)] + a[mat4Index(0, 1)] * b[mat4Index(1, 1)] + a[mat4Index(0, 2)] * b[mat4Index(2, 1)] + a[mat4Index(0, 3)] * b[mat4Index(3, 1)];
  const r11 = a[mat4Index(1, 0)] * b[mat4Index(0, 1)] + a[mat4Index(1, 1)] * b[mat4Index(1, 1)] + a[mat4Index(1, 2)] * b[mat4Index(2, 1)] + a[mat4Index(1, 3)] * b[mat4Index(3, 1)];
  const r21 = a[mat4Index(2, 0)] * b[mat4Index(0, 1)] + a[mat4Index(2, 1)] * b[mat4Index(1, 1)] + a[mat4Index(2, 2)] * b[mat4Index(2, 1)] + a[mat4Index(2, 3)] * b[mat4Index(3, 1)];
  const r31 = a[mat4Index(3, 0)] * b[mat4Index(0, 1)] + a[mat4Index(3, 1)] * b[mat4Index(1, 1)] + a[mat4Index(3, 2)] * b[mat4Index(2, 1)] + a[mat4Index(3, 3)] * b[mat4Index(3, 1)];

  const r02 = a[mat4Index(0, 0)] * b[mat4Index(0, 2)] + a[mat4Index(0, 1)] * b[mat4Index(1, 2)] + a[mat4Index(0, 2)] * b[mat4Index(2, 2)] + a[mat4Index(0, 3)] * b[mat4Index(3, 2)];
  const r12 = a[mat4Index(1, 0)] * b[mat4Index(0, 2)] + a[mat4Index(1, 1)] * b[mat4Index(1, 2)] + a[mat4Index(1, 2)] * b[mat4Index(2, 2)] + a[mat4Index(1, 3)] * b[mat4Index(3, 2)];
  const r22 = a[mat4Index(2, 0)] * b[mat4Index(0, 2)] + a[mat4Index(2, 1)] * b[mat4Index(1, 2)] + a[mat4Index(2, 2)] * b[mat4Index(2, 2)] + a[mat4Index(2, 3)] * b[mat4Index(3, 2)];
  const r32 = a[mat4Index(3, 0)] * b[mat4Index(0, 2)] + a[mat4Index(3, 1)] * b[mat4Index(1, 2)] + a[mat4Index(3, 2)] * b[mat4Index(2, 2)] + a[mat4Index(3, 3)] * b[mat4Index(3, 2)];

  const r03 = a[mat4Index(0, 0)] * b[mat4Index(0, 3)] + a[mat4Index(0, 1)] * b[mat4Index(1, 3)] + a[mat4Index(0, 2)] * b[mat4Index(2, 3)] + a[mat4Index(0, 3)] * b[mat4Index(3, 3)];
  const r13 = a[mat4Index(1, 0)] * b[mat4Index(0, 3)] + a[mat4Index(1, 1)] * b[mat4Index(1, 3)] + a[mat4Index(1, 2)] * b[mat4Index(2, 3)] + a[mat4Index(1, 3)] * b[mat4Index(3, 3)];
  const r23 = a[mat4Index(2, 0)] * b[mat4Index(0, 3)] + a[mat4Index(2, 1)] * b[mat4Index(1, 3)] + a[mat4Index(2, 2)] * b[mat4Index(2, 3)] + a[mat4Index(2, 3)] * b[mat4Index(3, 3)];
  const r33 = a[mat4Index(3, 0)] * b[mat4Index(0, 3)] + a[mat4Index(3, 1)] * b[mat4Index(1, 3)] + a[mat4Index(3, 2)] * b[mat4Index(2, 3)] + a[mat4Index(3, 3)] * b[mat4Index(3, 3)];

  out[mat4Index(0, 0)] = r00;
  out[mat4Index(1, 0)] = r10;
  out[mat4Index(2, 0)] = r20;
  out[mat4Index(3, 0)] = r30;
  out[mat4Index(0, 1)] = r01;
  out[mat4Index(1, 1)] = r11;
  out[mat4Index(2, 1)] = r21;
  out[mat4Index(3, 1)] = r31;
  out[mat4Index(0, 2)] = r02;
  out[mat4Index(1, 2)] = r12;
  out[mat4Index(2, 2)] = r22;
  out[mat4Index(3, 2)] = r32;
  out[mat4Index(0, 3)] = r03;
  out[mat4Index(1, 3)] = r13;
  out[mat4Index(2, 3)] = r23;
  out[mat4Index(3, 3)] = r33;

  return out;
}

export function transformMat4Vec4(
  m: Float32Array,
  x: number,
  y: number,
  z: number,
  u: number,
  out: Float32Array,
  offset = 0
): Float32Array {
  out[offset] = m[mat4Index(0, 0)] * x + m[mat4Index(0, 1)] * y + m[mat4Index(0, 2)] * z + m[mat4Index(0, 3)] * u;
  out[offset + 1] = m[mat4Index(1, 0)] * x + m[mat4Index(1, 1)] * y + m[mat4Index(1, 2)] * z + m[mat4Index(1, 3)] * u;
  out[offset + 2] = m[mat4Index(2, 0)] * x + m[mat4Index(2, 1)] * y + m[mat4Index(2, 2)] * z + m[mat4Index(2, 3)] * u;
  out[offset + 3] = m[mat4Index(3, 0)] * x + m[mat4Index(3, 1)] * y + m[mat4Index(3, 2)] * z + m[mat4Index(3, 3)] * u;
  return out;
}

