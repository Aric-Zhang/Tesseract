import type { Vec4 } from "../math/types";
import type { Geometry4D } from "./geometry4";
import { validateTesseractOptions } from "./validate-geometry4";

export interface TesseractOptions {
  size?: number;
  center?: Vec4;
}

export function createTesseract4D(options: TesseractOptions = {}): Geometry4D {
  validateTesseractOptions(options);
  const size = options.size ?? 2;
  const center = options.center ?? [0, 0, 0, 0];
  const half = size / 2;
  const positions4 = new Float32Array(16 * 4);

  for (let i = 0; i < 16; i++) {
    const offset = i * 4;
    positions4[offset] = center[0] + ((i & 1) ? half : -half);
    positions4[offset + 1] = center[1] + ((i & 2) ? half : -half);
    positions4[offset + 2] = center[2] + ((i & 4) ? half : -half);
    positions4[offset + 3] = center[3] + ((i & 8) ? half : -half);
  }

  const edgePairs: number[] = [];
  for (let i = 0; i < 16; i++) {
    for (const bit of [1, 2, 4, 8]) {
      const j = i ^ bit;
      if (i < j) {
        edgePairs.push(i, j);
      }
    }
  }

  return {
    positions4,
    vertexCount: 16,
    edges: new Uint16Array(edgePairs),
    edgeCount: edgePairs.length / 2
  };
}

