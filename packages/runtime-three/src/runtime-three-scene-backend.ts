import * as THREE from "three";
import type { RuntimeNodeId } from "runtime-core";
import type { RuntimeThreeRenderable } from "./runtime-three-renderable";

export class RuntimeThreeSceneBackend {
  readonly scene: THREE.Scene;
  readonly #renderables = new Map<RuntimeNodeId, RuntimeThreeRenderable>();

  constructor(scene: THREE.Scene = new THREE.Scene()) {
    this.scene = scene;
  }

  attach(renderable: RuntimeThreeRenderable): void {
    if (this.#renderables.has(renderable.id)) {
      throw new Error(`RuntimeThreeSceneBackend already contains renderable ${renderable.id}.`);
    }
    this.#renderables.set(renderable.id, renderable);
    this.scene.add(renderable.object);
  }

  detach(renderableId: RuntimeNodeId): boolean {
    const renderable = this.#renderables.get(renderableId);
    if (!renderable) return false;
    this.scene.remove(renderable.object);
    this.#renderables.delete(renderableId);
    return true;
  }

  has(renderableId: RuntimeNodeId): boolean {
    return this.#renderables.has(renderableId);
  }

  list(): readonly RuntimeThreeRenderable[] {
    return [...this.#renderables.values()];
  }

  dispose(): void {
    for (const renderable of [...this.#renderables.values()]) {
      this.scene.remove(renderable.object);
      renderable.dispose();
    }
    this.#renderables.clear();
  }
}

