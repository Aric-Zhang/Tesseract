import type * as THREE from "three";
import type { RuntimeThreeCameraBackend } from "./runtime-three-camera-backend";
import type { RuntimeThreeSceneBackend } from "./runtime-three-scene-backend";

export interface RuntimeThreeRendererLike {
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize?(width: number, height: number): void;
  dispose(): void;
}

export class RuntimeThreeRendererBackend {
  readonly #renderer: RuntimeThreeRendererLike;
  #disposed = false;

  constructor(renderer: RuntimeThreeRendererLike) {
    this.#renderer = renderer;
  }

  render(scene: RuntimeThreeSceneBackend, camera: RuntimeThreeCameraBackend): void {
    if (this.#disposed) {
      throw new Error("RuntimeThreeRendererBackend cannot render after dispose.");
    }
    this.#renderer.render(scene.scene, camera.object);
  }

  resize(width: number, height: number): void {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
      throw new Error("RuntimeThreeRendererBackend.resize requires non-negative finite dimensions.");
    }
    this.#renderer.setSize?.(width, height);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#renderer.dispose();
  }
}

