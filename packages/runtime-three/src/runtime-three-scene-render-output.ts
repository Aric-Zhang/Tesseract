import * as THREE from "three";
import type { RuntimeRegistration } from "runtime-core";
import { createRuntimeThreeWebGLRenderer } from "./runtime-three-webgl-renderer";

export interface RuntimeThreeSceneRenderer {
  readonly domElement: HTMLElement;
  setClearColor(color: number, alpha: number): void;
  setPixelRatio(pixelRatio: number): void;
  setSize(width: number, height: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type RuntimeThreeSceneRendererFactory = () => RuntimeThreeSceneRenderer;

export interface RuntimeThreeSceneRenderOutputOptions {
  readonly id?: string;
  readonly createRenderer?: RuntimeThreeSceneRendererFactory;
}

export class RuntimeThreeSceneRenderOutput {
  readonly id: string;
  readonly #scene = new THREE.Scene();
  readonly #renderer: RuntimeThreeSceneRenderer;
  #disposed = false;

  constructor(options: RuntimeThreeSceneRenderOutputOptions = {}) {
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

export function createRuntimeThreeSceneRenderOutput(
  options: RuntimeThreeSceneRenderOutputOptions = {}
): RuntimeThreeSceneRenderOutput {
  return new RuntimeThreeSceneRenderOutput(options);
}

function createDefaultRenderer(): RuntimeThreeSceneRenderer {
  return createRuntimeThreeWebGLRenderer({ antialias: true, alpha: false });
}
