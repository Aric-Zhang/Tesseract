import * as THREE from "three";
import { createRuntimeThreeWebGLRenderer } from "runtime-three";
import type { RuntimeRegistration } from "runtime-core";

export interface RuntimeSceneRenderer {
  readonly domElement: HTMLElement;
  setClearColor(color: number, alpha: number): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type RuntimeSceneRendererFactory = () => RuntimeSceneRenderer;

export interface RuntimeSceneRenderOutputOptions {
  readonly id?: string;
  readonly createRenderer?: RuntimeSceneRendererFactory;
}

export class RuntimeSceneRenderOutput {
  readonly id: string;
  readonly #scene = new THREE.Scene();
  readonly #renderer: RuntimeSceneRenderer;
  #disposed = false;

  constructor(options: RuntimeSceneRenderOutputOptions = {}) {
    this.id = options.id ?? "scene-render-output";
    this.#renderer = (options.createRenderer ?? createDefaultRenderer)();
    this.#renderer.setClearColor(0x07090d, 1);
  }

  get domElement(): HTMLElement {
    return this.#renderer.domElement;
  }

  attachObject(object: THREE.Object3D): RuntimeRegistration {
    if (this.#disposed) {
      throw new Error(`Runtime scene render output is disposed: ${this.id}.`);
    }
    this.#scene.add(object);
    return {
      dispose: () => {
        this.#scene.remove(object);
      }
    };
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    if (this.#disposed) return;
    this.#renderer.setPixelRatio(Math.min(pixelRatio || 1, 2));
    this.#renderer.setSize(width, height, false);
  }

  render(camera: THREE.Camera): void {
    if (this.#disposed) return;
    this.#renderer.render(this.#scene, camera);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#renderer.dispose();
  }
}

export function createRuntimeSceneRenderOutput(
  options: RuntimeSceneRenderOutputOptions = {}
): RuntimeSceneRenderOutput {
  return new RuntimeSceneRenderOutput(options);
}

function createDefaultRenderer(): RuntimeSceneRenderer {
  return createRuntimeThreeWebGLRenderer({ antialias: true, alpha: false });
}
