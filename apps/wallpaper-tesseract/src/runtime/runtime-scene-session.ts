import type * as THREE from "three";
import type { RuntimeRegistration } from "runtime-core";
import type {
  RuntimeThreeSceneRendererFactory,
  RuntimeThreeSceneRenderOutput
} from "runtime-three";
import { createRuntimeThreeSceneRenderOutput } from "runtime-three";

export interface RuntimeSceneSessionOptions {
  readonly id?: string;
  readonly createRenderer?: RuntimeThreeSceneRendererFactory;
}

export interface RuntimeSceneObjectHost {
  attachObject(object: THREE.Object3D): RuntimeRegistration;
}

export class RuntimeSceneSession {
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
  #disposed = false;

  constructor(options: RuntimeSceneSessionOptions = {}) {
    this.renderOutput = createRuntimeThreeSceneRenderOutput({
      id: options.id ?? "runtime-scene-session:render-output",
      createRenderer: options.createRenderer
    });
  }

  get renderTarget(): RuntimeThreeSceneRenderOutput {
    return this.renderOutput;
  }

  render(camera: THREE.Camera): void {
    if (this.#disposed) return;
    this.renderOutput.render(camera);
  }

  attachObject(object: THREE.Object3D): RuntimeRegistration {
    return this.renderOutput.attachObject(object);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.renderOutput.dispose();
  }
}

export function createRuntimeSceneSession(options: RuntimeSceneSessionOptions = {}): RuntimeSceneSession {
  return new RuntimeSceneSession(options);
}
