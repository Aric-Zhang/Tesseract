export interface Geometry4D {
  positions4: Float32Array;
  vertexCount: number;
  edges?: Uint16Array | Uint32Array;
  edgeCount?: number;
  triangles?: Uint16Array | Uint32Array;
  triangleCount?: number;
}

