export interface Bounds3 {
  min: Float32Array;
  max: Float32Array;
  valid: boolean;
}

export interface IndexedPointProjectionResult {
  layout: "indexed";
  positions3: Float32Array;
  depths4: Float32Array;
  visibility: Uint8Array;
  vertexCount: number;
  bounds3: Bounds3;
}

export interface CompactPointProjectionResult {
  layout: "compact";
  positions3: Float32Array;
  depths4: Float32Array;
  sourceIndices: Uint32Array;
  visiblePointCount: number;
  bounds3: Bounds3;
}

export type PointProjectionResult = IndexedPointProjectionResult | CompactPointProjectionResult;

export interface LineProjectionResult {
  positions3: Float32Array;
  depths4: Float32Array;
  colors?: Float32Array;
  alphas?: Float32Array;
  segmentCount: number;
  bounds3: Bounds3;
}

export function createBounds3(): Bounds3 {
  return {
    min: new Float32Array(3),
    max: new Float32Array(3),
    valid: false
  };
}

export function resetBounds3(bounds: Bounds3): void {
  bounds.valid = false;
  bounds.min[0] = Infinity;
  bounds.min[1] = Infinity;
  bounds.min[2] = Infinity;
  bounds.max[0] = -Infinity;
  bounds.max[1] = -Infinity;
  bounds.max[2] = -Infinity;
}

export function includeBounds3(bounds: Bounds3, x: number, y: number, z: number): void {
  if (!bounds.valid) {
    bounds.min[0] = x;
    bounds.min[1] = y;
    bounds.min[2] = z;
    bounds.max[0] = x;
    bounds.max[1] = y;
    bounds.max[2] = z;
    bounds.valid = true;
    return;
  }
  bounds.min[0] = Math.min(bounds.min[0], x);
  bounds.min[1] = Math.min(bounds.min[1], y);
  bounds.min[2] = Math.min(bounds.min[2], z);
  bounds.max[0] = Math.max(bounds.max[0], x);
  bounds.max[1] = Math.max(bounds.max[1], y);
  bounds.max[2] = Math.max(bounds.max[2], z);
}

