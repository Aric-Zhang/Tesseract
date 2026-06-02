import { EPSILON4D, det4Columns, dot4Array, normalize4To, rejectFromBasis4To, subtract4To, type Vec3, type Vec4, type Vec4Like } from "four-rotation";
import { assertEnum, assertFiniteVec3, assertFiniteVec4 } from "../validation/assert";

export type ProjectionMode4D = "orthographic" | "perspective";
export type LookAtStabilityMode = "deterministic" | "continuous";

export interface Camera4DOptions {
  position?: Vec4;
  basisX?: Vec4;
  basisY?: Vec4;
  basisZ?: Vec4;
  basisU?: Vec4;
  projection?: ProjectionMode4D;
  fov4?: number;
  fovX?: number;
  fovY?: number;
  fovZ?: number;
  focalScale?: Vec3;
  orthoScale?: number;
  orthoHalfExtent?: Vec3;
  near?: number;
  far?: number;
  viewBoxCenter?: Vec3;
  viewBoxScale?: Vec3;
}

export class Camera4D {
  position = new Float32Array([0, 0, 0, -5]);
  basisX = new Float32Array([1, 0, 0, 0]);
  basisY = new Float32Array([0, 1, 0, 0]);
  basisZ = new Float32Array([0, 0, 1, 0]);
  basisU = new Float32Array([0, 0, 0, 1]);
  projection: ProjectionMode4D = "perspective";
  focalScale = new Float32Array(3);
  tanHalfFov = new Float32Array(3);
  orthoHalfExtent = new Float32Array([1, 1, 1]);
  near = 0.1;
  far = 100;
  viewBoxCenter = new Float32Array([0, 0, 0]);
  viewBoxScale = new Float32Array([1, 1, 1]);

  constructor(options: Camera4DOptions = {}) {
    this.applyOptions(options);
    validateBasis(this.basisX, this.basisY, this.basisZ, this.basisU);
    this.validate();
  }

  setLookAt(position: Vec4, target: Vec4, options: {
    upHint?: Vec4;
    overHint?: Vec4;
    stability?: LookAtStabilityMode;
  } = {}): this {
    const stability = options.stability ?? "deterministic";
    assertEnum(stability, ["deterministic", "continuous"], "Camera4D lookAt stability");
    if (stability === "continuous") {
      throw new Error("continuous lookAt4D is not implemented yet");
    }
    assertFiniteVec4(position, "Camera4D lookAt position");
    assertFiniteVec4(target, "Camera4D lookAt target");
    if (options.upHint) assertFiniteVec4(options.upHint, "Camera4D lookAt upHint");
    if (options.overHint) assertFiniteVec4(options.overHint, "Camera4D lookAt overHint");
    copy4(position, this.position);
    lookAtBasis(position, target, options.upHint ?? [0, 1, 0, 0], options.overHint ?? [0, 0, 1, 0], this.basisX, this.basisY, this.basisZ, this.basisU);
    validateBasis(this.basisX, this.basisY, this.basisZ, this.basisU);
    return this;
  }

  setProjection(mode: ProjectionMode4D, options: Camera4DOptions = {}): this {
    assertEnum(mode, ["orthographic", "perspective"], "Camera4D projection");
    this.projection = mode;
    this.applyProjectionOptions(options);
    this.validate();
    return this;
  }

  get safeNear(): number {
    return Math.max(this.near, EPSILON4D);
  }

  private applyOptions(options: Camera4DOptions): void {
    if (options.position) copy4(options.position, this.position);
    if (options.basisX) copy4(options.basisX, this.basisX);
    if (options.basisY) copy4(options.basisY, this.basisY);
    if (options.basisZ) copy4(options.basisZ, this.basisZ);
    if (options.basisU) copy4(options.basisU, this.basisU);
    if (options.projection !== undefined) {
      assertEnum(options.projection, ["orthographic", "perspective"], "Camera4D projection");
      this.projection = options.projection;
    }
    if (options.near !== undefined) this.near = options.near;
    if (options.far !== undefined) this.far = options.far;
    if (options.viewBoxCenter) copy3(options.viewBoxCenter, this.viewBoxCenter);
    if (options.viewBoxScale) copy3(options.viewBoxScale, this.viewBoxScale);
    this.applyProjectionOptions(options);
  }

  private applyProjectionOptions(options: Camera4DOptions): void {
    const fov = options.fov4 ?? Math.PI / 3;
    const fovX = options.fovX ?? fov;
    const fovY = options.fovY ?? fov;
    const fovZ = options.fovZ ?? fov;
    if (options.focalScale) {
      copy3(options.focalScale, this.focalScale);
    } else {
      validateFov(fovX);
      validateFov(fovY);
      validateFov(fovZ);
      this.focalScale[0] = 1 / Math.tan(fovX * 0.5);
      this.focalScale[1] = 1 / Math.tan(fovY * 0.5);
      this.focalScale[2] = 1 / Math.tan(fovZ * 0.5);
    }
    for (let i = 0; i < 3; i++) {
      if (!Number.isFinite(this.focalScale[i]) || this.focalScale[i] <= 0) {
        throw new Error("Camera4D focalScale values must be finite and > 0.");
      }
      this.tanHalfFov[i] = 1 / this.focalScale[i];
    }
    if (options.orthoHalfExtent) {
      copy3(options.orthoHalfExtent, this.orthoHalfExtent);
    } else if (options.orthoScale !== undefined) {
      this.orthoHalfExtent[0] = options.orthoScale;
      this.orthoHalfExtent[1] = options.orthoScale;
      this.orthoHalfExtent[2] = options.orthoScale;
    }
  }

  private validate(): void {
    assertEnum(this.projection, ["orthographic", "perspective"], "Camera4D projection");
    assertFiniteVec4(this.position, "Camera4D position");
    assertFiniteVec3(this.viewBoxCenter, "Camera4D viewBoxCenter");
    if (!Number.isFinite(this.near) || this.near <= 0) {
      throw new Error("Camera4D near must be finite and > 0.");
    }
    if (!Number.isFinite(this.far) || this.far <= this.safeNear) {
      throw new Error("Camera4D far must be finite and > safeNear.");
    }
    for (const value of this.orthoHalfExtent) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Camera4D orthoHalfExtent values must be finite and > 0.");
      }
    }
    for (const value of this.viewBoxScale) {
      if (!Number.isFinite(value) || value === 0) {
        throw new Error("Camera4D viewBoxScale values must be finite and non-zero.");
      }
    }
  }
}

export function lookAtBasis(
  position: Vec4Like,
  target: Vec4Like,
  upHint: Vec4Like,
  overHint: Vec4Like,
  basisX: Float32Array,
  basisY: Float32Array,
  basisZ: Float32Array,
  basisU: Float32Array
): void {
  const direction = new Float32Array(4);
  subtract4To(target, position, direction);
  if (!normalize4To(direction[0], direction[1], direction[2], direction[3], basisU)) {
    throw new Error("Camera4D.setLookAt failed: position and target must not be equal.");
  }

  const tmp = new Float32Array(4);
  chooseBasis(upHint, [basisU], basisY, tmp);
  chooseBasis(overHint, [basisU, basisY], basisZ, tmp);
  chooseBasis([1, 0, 0, 0], [basisU, basisY, basisZ], basisX, tmp);

  const determinant = det4Columns(
    basisX[0], basisX[1], basisX[2], basisX[3],
    basisY[0], basisY[1], basisY[2], basisY[3],
    basisZ[0], basisZ[1], basisZ[2], basisZ[3],
    basisU[0], basisU[1], basisU[2], basisU[3]
  );
  if (determinant < 0) {
    for (let i = 0; i < 4; i++) basisX[i] = -basisX[i];
  }
}

export function validateBasis(x: Vec4Like, y: Vec4Like, z: Vec4Like, u: Vec4Like): void {
  const bases = [x, y, z, u];
  for (const basis of bases) {
    let lengthSq = 0;
    for (let i = 0; i < 4; i++) {
      if (!Number.isFinite(basis[i])) throw new Error("Camera4D basis values must be finite.");
      lengthSq += basis[i] * basis[i];
    }
    if (Math.abs(Math.sqrt(lengthSq) - 1) > 1e-4) {
      throw new Error("Camera4D basis vectors must be normalized.");
    }
  }
  for (let i = 0; i < bases.length; i++) {
    for (let j = i + 1; j < bases.length; j++) {
      if (Math.abs(dot4Array(bases[i][0], bases[i][1], bases[i][2], bases[i][3], bases[j])) > 1e-4) {
        throw new Error("Camera4D basis vectors must be orthogonal.");
      }
    }
  }
  const determinant = det4Columns(
    x[0], x[1], x[2], x[3],
    y[0], y[1], y[2], y[3],
    z[0], z[1], z[2], z[3],
    u[0], u[1], u[2], u[3]
  );
  if (determinant <= 0) {
    throw new Error("Camera4D basis determinant must be positive.");
  }
}

function chooseBasis(candidate: Vec4Like, existing: Vec4Like[], out: Float32Array, tmp: Float32Array): void {
  const fallbackAxes: Vec4Like[] = [
    candidate,
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1]
  ];
  for (const axis of fallbackAxes) {
    const length = rejectFromBasis4To(axis[0], axis[1], axis[2], axis[3], existing, tmp);
    if (length > EPSILON4D && normalize4To(tmp[0], tmp[1], tmp[2], tmp[3], out)) {
      return;
    }
  }
  throw new Error("Camera4D lookAt failed to construct a stable basis.");
}

function copy4(source: Vec4Like, target: Float32Array): void {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
  target[3] = source[3];
}

function copy3(source: Vec3, target: Float32Array): void {
  target[0] = source[0];
  target[1] = source[1];
  target[2] = source[2];
}

function validateFov(value: number): void {
  if (!Number.isFinite(value) || value <= 0 || value >= Math.PI) {
    throw new Error("Camera4D fov values must be finite and in (0, PI).");
  }
}
