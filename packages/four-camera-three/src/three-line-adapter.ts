import * as THREE from "three";
import type { LineProjectionResult } from "four-camera";

export type ThreeLineBoundsMode = "none" | "fixed" | "compute-each-frame";

export interface ThreeLineAdapterOptions {
  maxSegmentCount: number;
  usage?: THREE.Usage;
  boundsMode?: ThreeLineBoundsMode;
  fixedBoundingRadius?: number;
  vertexColors?: boolean;
  material?: THREE.LineBasicMaterial;
}

export class ThreeLineAdapter {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.LineBasicMaterial;
  readonly object: THREE.LineSegments;
  readonly maxSegmentCount: number;
  private readonly positions: Float32Array;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly colors: Float32Array | null = null;
  private readonly colorAttribute: THREE.BufferAttribute | null = null;
  private readonly boundsMode: ThreeLineBoundsMode;
  private readonly ownsMaterial: boolean;

  constructor(options: ThreeLineAdapterOptions) {
    if (!Number.isInteger(options.maxSegmentCount) || options.maxSegmentCount < 0) {
      throw new Error("ThreeLineAdapter maxSegmentCount must be a non-negative integer.");
    }

    this.maxSegmentCount = options.maxSegmentCount;
    this.boundsMode = options.boundsMode ?? "none";
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(options.maxSegmentCount * 2 * 3);
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.positionAttribute.setUsage(options.usage ?? THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setDrawRange(0, 0);

    if (options.vertexColors) {
      this.colors = new Float32Array(options.maxSegmentCount * 2 * 3);
      this.colors.fill(1);
      this.colorAttribute = new THREE.BufferAttribute(this.colors, 3);
      this.colorAttribute.setUsage(options.usage ?? THREE.DynamicDrawUsage);
      this.geometry.setAttribute("color", this.colorAttribute);
    }

    this.ownsMaterial = options.material === undefined;
    this.material = options.material ?? new THREE.LineBasicMaterial({
      color: 0x9ee7ff,
      vertexColors: options.vertexColors === true,
      transparent: true,
      opacity: 0.95
    });
    this.object = new THREE.LineSegments(this.geometry, this.material);

    if (this.boundsMode === "none") {
      this.object.frustumCulled = false;
    } else if (this.boundsMode === "fixed") {
      this.geometry.boundingSphere = new THREE.Sphere(
        new THREE.Vector3(0, 0, 0),
        options.fixedBoundingRadius ?? 1
      );
    }
  }

  update(result: LineProjectionResult): void {
    if (result.segmentCount > this.maxSegmentCount) {
      throw new Error("ThreeLineAdapter result.segmentCount exceeds maxSegmentCount.");
    }
    if (result.colors && !this.colorAttribute) {
      throw new Error("ThreeLineAdapter received result.colors but vertexColors was not enabled.");
    }

    const valueCount = result.segmentCount * 2 * 3;
    for (let i = 0; i < valueCount; i++) {
      this.positions[i] = result.positions3[i];
    }
    this.positionAttribute.needsUpdate = true;
    this.geometry.setDrawRange(0, result.segmentCount * 2);

    if (result.colors && this.colors && this.colorAttribute) {
      for (let i = 0; i < valueCount; i++) {
        this.colors[i] = result.colors[i];
      }
      this.colorAttribute.needsUpdate = true;
    }

    if (this.boundsMode === "compute-each-frame") {
      this.geometry.computeBoundingSphere();
    }
  }

  dispose(): void {
    this.geometry.dispose();
    if (this.ownsMaterial) {
      this.material.dispose();
    }
  }
}
