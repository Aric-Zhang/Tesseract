import * as THREE from "three";

export type Camera3ProjectionMode = "perspective" | "orthographic";

export interface Camera3ProjectionModeControllerOptions {
  fov?: number;
  near?: number;
  far?: number;
  mode?: Camera3ProjectionMode;
}

export class Camera3ProjectionModeController {
  readonly perspectiveCamera: THREE.PerspectiveCamera;
  readonly orthographicCamera: THREE.OrthographicCamera;
  mode: Camera3ProjectionMode;
  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  constructor(options: Camera3ProjectionModeControllerOptions = {}) {
    const fov = options.fov ?? 45;
    const near = options.near ?? 0.1;
    const far = options.far ?? 100;
    this.perspectiveCamera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, near, far);
    this.mode = options.mode ?? "perspective";
    this.activeCamera = this.mode === "perspective" ? this.perspectiveCamera : this.orthographicCamera;
  }

  resize(width: number, height: number, distance: number): void {
    const aspect = width / Math.max(1, height);
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    const orthoHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(this.perspectiveCamera.fov) * 0.5);
    const orthoWidth = orthoHeight * aspect;
    this.orthographicCamera.left = -orthoWidth * 0.5;
    this.orthographicCamera.right = orthoWidth * 0.5;
    this.orthographicCamera.top = orthoHeight * 0.5;
    this.orthographicCamera.bottom = -orthoHeight * 0.5;
    this.orthographicCamera.updateProjectionMatrix();
  }

  setMode(mode: Camera3ProjectionMode): void {
    this.mode = mode;
    this.activeCamera = mode === "perspective" ? this.perspectiveCamera : this.orthographicCamera;
  }

  toggle(): void {
    this.setMode(this.mode === "perspective" ? "orthographic" : "perspective");
  }
}
