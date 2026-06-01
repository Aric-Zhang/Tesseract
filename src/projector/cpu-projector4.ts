import type { Camera4D } from "../camera/camera4";
import type { Geometry4D } from "../geometry/geometry4";
import { normalizeGeometry4D } from "../geometry/validate-geometry4";
import { EPSILON4D } from "../math/constants";
import { identityTransform4D, type Transform4D } from "../math/transform4";
import { clipSegmentByURange, clipSegmentNearFar } from "./edge-clipper4";
import { createBounds3, includeBounds3, resetBounds3, type CompactPointProjectionResult, type IndexedPointProjectionResult, type LineProjectionResult, type PointProjectionResult } from "./projection-result";

export type ClippingMode4D = "none-unsafe" | "singularity-only" | "near-far" | "frustum";
export type SingularityPolicy4D = "drop" | "allow";

export interface CPUProjector4DOptions {
  clipping?: ClippingMode4D;
  singularityPolicy?: SingularityPolicy4D;
  computeBounds?: boolean;
}

export interface ProjectInput4D<TOut> {
  geometry: Geometry4D;
  model?: Transform4D;
  camera: Camera4D;
  out: TOut;
}

const IDENTITY_MODEL = identityTransform4D();

export class CPUProjector4D {
  clipping: ClippingMode4D;
  singularityPolicy: SingularityPolicy4D;
  computeBounds: boolean;
  private scratchEye4 = new Float32Array(0);

  constructor(options: CPUProjector4DOptions = {}) {
    this.clipping = options.clipping ?? "near-far";
    this.singularityPolicy = options.singularityPolicy ?? "drop";
    this.computeBounds = options.computeBounds ?? true;
    validateClippingOptions(this.clipping, this.singularityPolicy);
  }

  ensureScratchCapacity(vertexCount: number): void {
    const required = vertexCount * 4;
    if (this.scratchEye4.length < required) {
      this.scratchEye4 = new Float32Array(required);
    }
  }

  createIndexedPointResult(geometry: Geometry4D): IndexedPointProjectionResult {
    const normalized = normalizeGeometry4D(geometry);
    return {
      layout: "indexed",
      positions3: new Float32Array(normalized.vertexCount * 3),
      depths4: new Float32Array(normalized.vertexCount),
      visibility: new Uint8Array(normalized.vertexCount),
      vertexCount: normalized.vertexCount,
      bounds3: createBounds3()
    };
  }

  createCompactPointResult(geometry: Geometry4D): CompactPointProjectionResult {
    const normalized = normalizeGeometry4D(geometry);
    return {
      layout: "compact",
      positions3: new Float32Array(normalized.vertexCount * 3),
      depths4: new Float32Array(normalized.vertexCount),
      sourceIndices: new Uint32Array(normalized.vertexCount),
      visiblePointCount: 0,
      bounds3: createBounds3()
    };
  }

  createLineResult(geometry: Geometry4D): LineProjectionResult {
    const normalized = normalizeGeometry4D(geometry);
    if (!normalized.edges || normalized.edgeCount === undefined) {
      throw new Error("CPUProjector4D.projectLines requires geometry.edges.");
    }
    return {
      positions3: new Float32Array(normalized.edgeCount * 2 * 3),
      depths4: new Float32Array(normalized.edgeCount * 2),
      segmentCount: 0,
      bounds3: createBounds3()
    };
  }

  projectPoints(input: ProjectInput4D<PointProjectionResult>): PointProjectionResult {
    validateClippingOptions(this.clipping, this.singularityPolicy);
    if (this.clipping === "frustum") throw new Error("frustum clipping is not implemented in this version");
    const geometry = normalizeGeometry4D(input.geometry);
    const model = input.model ?? IDENTITY_MODEL;
    const out = input.out;
    resetBounds3(out.bounds3);
    let visibleCount = 0;
    if (out.layout === "indexed") out.visibility.fill(0);
    this.ensureScratchCapacity(1);

    for (let i = 0; i < geometry.vertexCount; i++) {
      const i4 = i * 4;
      this.writeModelToEye(geometry.positions4[i4], geometry.positions4[i4 + 1], geometry.positions4[i4 + 2], geometry.positions4[i4 + 3], model, input.camera, this.scratchEye4, 0);
      const xEye = this.scratchEye4[0];
      const yEye = this.scratchEye4[1];
      const zEye = this.scratchEye4[2];
      const uEye = this.scratchEye4[3];
      const visible = this.isVisible(input.camera, uEye);
      if (!visible) continue;
      if (out.layout === "indexed") {
        const i3 = i * 3;
        if (!writeProjectedEyeToScene(input.camera, xEye, yEye, zEye, uEye, out.positions3, i3)) continue;
        out.depths4[i] = uEye;
        out.visibility[i] = 1;
        if (this.computeBounds) includeBounds3(out.bounds3, out.positions3[i3], out.positions3[i3 + 1], out.positions3[i3 + 2]);
      } else {
        const i3 = visibleCount * 3;
        if (!writeProjectedEyeToScene(input.camera, xEye, yEye, zEye, uEye, out.positions3, i3)) continue;
        out.depths4[visibleCount] = uEye;
        out.sourceIndices[visibleCount] = i;
        out.visiblePointCount = visibleCount + 1;
        if (this.computeBounds) includeBounds3(out.bounds3, out.positions3[i3], out.positions3[i3 + 1], out.positions3[i3 + 2]);
      }
      visibleCount++;
    }
    if (out.layout === "compact") out.visiblePointCount = visibleCount;
    return out;
  }

  projectLines(input: ProjectInput4D<LineProjectionResult>): LineProjectionResult {
    validateClippingOptions(this.clipping, this.singularityPolicy);
    if (this.clipping === "frustum") throw new Error("frustum clipping is not implemented in this version");
    const geometry = normalizeGeometry4D(input.geometry);
    if (!geometry.edges || geometry.edgeCount === undefined) {
      throw new Error("CPUProjector4D.projectLines requires geometry.edges.");
    }
    const model = input.model ?? IDENTITY_MODEL;
    const out = input.out;
    out.segmentCount = 0;
    resetBounds3(out.bounds3);
    this.ensureScratchCapacity(geometry.vertexCount);

    for (let i = 0; i < geometry.vertexCount; i++) {
      const i4 = i * 4;
      this.writeModelToEye(geometry.positions4[i4], geometry.positions4[i4 + 1], geometry.positions4[i4 + 2], geometry.positions4[i4 + 3], model, input.camera, this.scratchEye4, i4);
    }

    for (let i = 0; i < geometry.edgeCount; i++) {
      const a = geometry.edges[i * 2];
      const b = geometry.edges[i * 2 + 1];
      const a4 = a * 4;
      const b4 = b * 4;
      const x0 = this.scratchEye4[a4];
      const y0 = this.scratchEye4[a4 + 1];
      const z0 = this.scratchEye4[a4 + 2];
      const u0 = this.scratchEye4[a4 + 3];
      const x1 = this.scratchEye4[b4];
      const y1 = this.scratchEye4[b4 + 1];
      const z1 = this.scratchEye4[b4 + 2];
      const u1 = this.scratchEye4[b4 + 3];
      const clip = this.clipForLine(input.camera, u0, u1);
      if (!clip) continue;
      const cx0 = lerp(x0, x1, clip.t0);
      const cy0 = lerp(y0, y1, clip.t0);
      const cz0 = lerp(z0, z1, clip.t0);
      const cu0 = lerp(u0, u1, clip.t0);
      const cx1 = lerp(x0, x1, clip.t1);
      const cy1 = lerp(y0, y1, clip.t1);
      const cz1 = lerp(z0, z1, clip.t1);
      const cu1 = lerp(u0, u1, clip.t1);
      const segmentOffset = out.segmentCount * 6;
      if (!writeProjectedEyeToScene(input.camera, cx0, cy0, cz0, cu0, out.positions3, segmentOffset)) continue;
      if (!writeProjectedEyeToScene(input.camera, cx1, cy1, cz1, cu1, out.positions3, segmentOffset + 3)) continue;
      const depthOffset = out.segmentCount * 2;
      out.depths4[depthOffset] = cu0;
      out.depths4[depthOffset + 1] = cu1;
      out.segmentCount++;
      if (this.computeBounds) {
        includeBounds3(out.bounds3, out.positions3[segmentOffset], out.positions3[segmentOffset + 1], out.positions3[segmentOffset + 2]);
        includeBounds3(out.bounds3, out.positions3[segmentOffset + 3], out.positions3[segmentOffset + 4], out.positions3[segmentOffset + 5]);
      }
    }
    return out;
  }

  private writeModelToEye(
    x: number,
    y: number,
    z: number,
    u: number,
    model: Transform4D,
    camera: Camera4D,
    out: Float32Array,
    offset: number
  ): void {
    const m = model.matrix;
    const wx = m[0] * x + m[4] * y + m[8] * z + m[12] * u + model.translation[0];
    const wy = m[1] * x + m[5] * y + m[9] * z + m[13] * u + model.translation[1];
    const wz = m[2] * x + m[6] * y + m[10] * z + m[14] * u + model.translation[2];
    const wu = m[3] * x + m[7] * y + m[11] * z + m[15] * u + model.translation[3];
    const rx = wx - camera.position[0];
    const ry = wy - camera.position[1];
    const rz = wz - camera.position[2];
    const ru = wu - camera.position[3];
    out[offset] = rx * camera.basisX[0] + ry * camera.basisX[1] + rz * camera.basisX[2] + ru * camera.basisX[3];
    out[offset + 1] = rx * camera.basisY[0] + ry * camera.basisY[1] + rz * camera.basisY[2] + ru * camera.basisY[3];
    out[offset + 2] = rx * camera.basisZ[0] + ry * camera.basisZ[1] + rz * camera.basisZ[2] + ru * camera.basisZ[3];
    out[offset + 3] = rx * camera.basisU[0] + ry * camera.basisU[1] + rz * camera.basisU[2] + ru * camera.basisU[3];
  }

  private isVisible(camera: Camera4D, uEye: number): boolean {
    if (this.clipping === "none-unsafe") {
      return this.singularityPolicy === "allow" || camera.projection === "orthographic" || uEye >= EPSILON4D;
    }
    if (this.clipping === "singularity-only") return uEye >= EPSILON4D;
    return uEye >= camera.safeNear && uEye <= camera.far;
  }

  private clipForLine(camera: Camera4D, u0: number, u1: number) {
    if (this.clipping === "none-unsafe") {
      if (this.singularityPolicy === "allow" || camera.projection === "orthographic") return { t0: 0, t1: 1 };
      return clipSegmentByURange(u0, u1, EPSILON4D);
    }
    if (this.clipping === "singularity-only") return clipSegmentByURange(u0, u1, EPSILON4D);
    return clipSegmentNearFar(u0, u1, camera.safeNear, camera.far);
  }
}

function validateClippingOptions(clipping: ClippingMode4D, policy: SingularityPolicy4D): void {
  if (policy === "allow" && clipping !== "none-unsafe") {
    throw new Error('singularityPolicy="allow" requires clipping="none-unsafe".');
  }
}

function writeProjectedEyeToScene(camera: Camera4D, x: number, y: number, z: number, u: number, out: Float32Array, offset: number): boolean {
  let px: number;
  let py: number;
  let pz: number;
  if (camera.projection === "perspective") {
    px = camera.focalScale[0] * x / u;
    py = camera.focalScale[1] * y / u;
    pz = camera.focalScale[2] * z / u;
  } else {
    px = x / camera.orthoHalfExtent[0];
    py = y / camera.orthoHalfExtent[1];
    pz = z / camera.orthoHalfExtent[2];
  }
  const sx = camera.viewBoxCenter[0] + camera.viewBoxScale[0] * px;
  const sy = camera.viewBoxCenter[1] + camera.viewBoxScale[1] * py;
  const sz = camera.viewBoxCenter[2] + camera.viewBoxScale[2] * pz;
  if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(sz)) return false;
  out[offset] = sx;
  out[offset + 1] = sy;
  out[offset + 2] = sz;
  return true;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
