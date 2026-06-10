import type { LineProjectionResult } from "four-camera";
import { ThreeLineAdapter, type ThreeLineAdapterOptions } from "four-camera-three";
import type * as THREE from "three";
import type { RuntimeNodeId } from "runtime-core";
import type { RuntimeThreeRenderable } from "./runtime-three-renderable";

export interface RuntimeThreeLineRenderableOptions {
  readonly id: RuntimeNodeId;
  readonly maxSegmentCount: number;
  readonly adapter?: ThreeLineAdapter;
  readonly adapterOptions?: Omit<ThreeLineAdapterOptions, "maxSegmentCount">;
}

export class RuntimeThreeLineRenderable implements RuntimeThreeRenderable {
  readonly id: RuntimeNodeId;
  readonly #adapter: ThreeLineAdapter;
  readonly #ownsAdapter: boolean;

  constructor(options: RuntimeThreeLineRenderableOptions) {
    this.id = options.id;
    this.#adapter = options.adapter ?? new ThreeLineAdapter({
      ...options.adapterOptions,
      maxSegmentCount: options.maxSegmentCount
    });
    this.#ownsAdapter = options.adapter === undefined;
  }

  get object(): THREE.LineSegments {
    return this.#adapter.object;
  }

  update(result: LineProjectionResult): void {
    this.#adapter.update(result);
  }

  dispose(): void {
    if (this.#ownsAdapter) {
      this.#adapter.dispose();
    }
  }
}
