import * as THREE from "three";

export interface RuntimeThreeWebGLRendererOptions {
  readonly antialias?: boolean;
  readonly alpha?: boolean;
}

export class RuntimeThreeWebGLRenderer {
  readonly #renderer: THREE.WebGLRenderer;

  constructor(options: RuntimeThreeWebGLRendererOptions = {}) {
    this.#renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false
    });
  }

  get domElement(): HTMLElement {
    return this.#renderer.domElement;
  }

  setClearColor(color: number, alpha: number): void {
    this.#renderer.setClearColor(color, alpha);
  }

  setPixelRatio(pixelRatio: number): void {
    this.#renderer.setPixelRatio(pixelRatio);
  }

  setSize(width: number, height: number, updateStyle: boolean): void {
    this.#renderer.setSize(width, height, updateStyle);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.#renderer.render(scene, camera);
  }

  dispose(): void {
    this.#renderer.dispose();
  }
}

export function createRuntimeThreeWebGLRenderer(
  options: RuntimeThreeWebGLRendererOptions = {}
): RuntimeThreeWebGLRenderer {
  return new RuntimeThreeWebGLRenderer(options);
}
