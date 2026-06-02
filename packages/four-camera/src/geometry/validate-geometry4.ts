import type { Vec4Like } from "four-rotation";
import type { TesseractOptions } from "./tesseract";
import type { Geometry4D } from "./geometry4";

export function normalizeGeometry4D(input: Geometry4D): Geometry4D {
  const edgeCount = input.edgeCount ?? (input.edges ? input.edges.length / 2 : undefined);
  const triangleCount = input.triangleCount ?? (input.triangles ? input.triangles.length / 3 : undefined);
  const normalized: Geometry4D = {
    ...input,
    edgeCount,
    triangleCount
  };
  validateGeometry4D(normalized);
  return normalized;
}

export function validateGeometry4D(input: Geometry4D): void {
  if (!Number.isInteger(input.vertexCount) || input.vertexCount < 0) {
    throw new Error("Geometry4D.vertexCount must be a non-negative integer.");
  }
  if (input.positions4.length !== input.vertexCount * 4) {
    throw new Error("Geometry4D.positions4 length must equal vertexCount * 4.");
  }
  for (const value of input.positions4) {
    if (!Number.isFinite(value)) {
      throw new Error("Geometry4D.positions4 must contain only finite values.");
    }
  }
  if (input.edges) {
    if (input.edges.length % 2 !== 0) {
      throw new Error("Geometry4D.edges length must be divisible by 2.");
    }
    if (input.edgeCount !== undefined && input.edges.length !== input.edgeCount * 2) {
      throw new Error("Geometry4D.edges length must equal edgeCount * 2.");
    }
    validateIndices(input.edges, input.vertexCount, "Geometry4D.edges");
  }
  if (input.triangles) {
    if (input.triangles.length % 3 !== 0) {
      throw new Error("Geometry4D.triangles length must be divisible by 3.");
    }
    if (input.triangleCount !== undefined && input.triangles.length !== input.triangleCount * 3) {
      throw new Error("Geometry4D.triangles length must equal triangleCount * 3.");
    }
    validateIndices(input.triangles, input.vertexCount, "Geometry4D.triangles");
  }
}

export function validateTesseractOptions(options: TesseractOptions): void {
  validateSizeAndCenter(options.size, options.center);
}

export function validateSizeAndCenter(size: number | undefined, center: Vec4Like | undefined): void {
  if (size !== undefined && (!Number.isFinite(size) || size <= 0)) {
    throw new Error("Geometry factory size must be finite and > 0.");
  }
  if (center) {
    for (let i = 0; i < 4; i++) {
      if (!Number.isFinite(center[i])) {
        throw new Error("Geometry factory center must contain only finite values.");
      }
    }
  }
}

function validateIndices(indices: Uint16Array | Uint32Array, vertexCount: number, label: string): void {
  for (const index of indices) {
    if (index < 0 || index >= vertexCount) {
      throw new Error(`${label} contains an out-of-range index.`);
    }
  }
}
