import { mat4Index } from "./mat4";
import { createTransform4D, identityTransform4D, type Transform4D } from "./transform4";

export type Axis4D = 0 | 1 | 2 | 3;

export function rotatePlane4D(axisA: Axis4D, axisB: Axis4D, angle: number, out: Transform4D = createTransform4D()): Transform4D {
  if (!Number.isInteger(axisA) || axisA < 0 || axisA > 3 || !Number.isInteger(axisB) || axisB < 0 || axisB > 3) {
    throw new Error("rotatePlane4D axes must be integers in 0..3.");
  }
  if (axisA === axisB) {
    throw new Error("rotatePlane4D axes must be different.");
  }
  if (!Number.isFinite(angle)) {
    throw new Error("rotatePlane4D angle must be finite.");
  }

  identityTransform4D(out);
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  out.matrix[mat4Index(axisA, axisA)] = c;
  out.matrix[mat4Index(axisB, axisB)] = c;
  out.matrix[mat4Index(axisA, axisB)] = -s;
  out.matrix[mat4Index(axisB, axisA)] = s;
  return out;
}

export function rotateXY(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(0, 1, angle, out);
}

export function rotateXZ(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(0, 2, angle, out);
}

export function rotateXU(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(0, 3, angle, out);
}

export function rotateYZ(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(1, 2, angle, out);
}

export function rotateYU(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(1, 3, angle, out);
}

export function rotateZU(angle: number, out?: Transform4D): Transform4D {
  return rotatePlane4D(2, 3, angle, out);
}

