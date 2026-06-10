import type * as THREE from "three";
import type { RuntimeNodeId } from "runtime-core";

export interface RuntimeThreeRenderable {
  readonly id: RuntimeNodeId;
  readonly object: THREE.Object3D;
  dispose(): void;
}

