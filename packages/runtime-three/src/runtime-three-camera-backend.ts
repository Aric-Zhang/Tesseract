import * as THREE from "three";
import type { RuntimeCameraDescriptor, RuntimeCameraId, RuntimeCameraState } from "runtime-core";

export type RuntimeThreeCameraObject = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export interface RuntimeThreeCameraBackendOptions {
  readonly perspectiveCamera?: RuntimeThreeCameraObject;
  readonly orthographicCamera?: RuntimeThreeCameraObject;
}

export class RuntimeThreeCameraBackend {
  readonly id: RuntimeCameraId;
  readonly #perspectiveCamera: RuntimeThreeCameraObject;
  readonly #orthographicCamera: RuntimeThreeCameraObject;
  #activeCamera: RuntimeThreeCameraObject;

  constructor(descriptor: RuntimeCameraDescriptor, options: RuntimeThreeCameraBackendOptions = {}) {
    this.id = descriptor.id;
    this.#perspectiveCamera = options.perspectiveCamera ?? new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.#orthographicCamera = options.orthographicCamera ?? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    this.#activeCamera = getProjectionMode(descriptor.state) === "orthographic"
      ? this.#orthographicCamera
      : this.#perspectiveCamera;
    this.applyState(descriptor.state);
  }

  get object(): RuntimeThreeCameraObject {
    return this.#activeCamera;
  }

  applyState(state: RuntimeCameraState): void {
    this.#activeCamera = getProjectionMode(state) === "orthographic"
      ? this.#orthographicCamera
      : this.#perspectiveCamera;
    applyProjection(this.#perspectiveCamera, this.#orthographicCamera, state);
    applyPose(this.#activeCamera, state);
  }

  dispose(): void {
    // Three cameras have no disposable GPU resources of their own.
  }
}

export function createRuntimeThreeCameraBackend(
  descriptor: RuntimeCameraDescriptor,
  options: RuntimeThreeCameraBackendOptions = {}
): RuntimeThreeCameraBackend {
  return new RuntimeThreeCameraBackend(descriptor, options);
}

function getProjectionMode(state: RuntimeCameraState): "perspective" | "orthographic" {
  return state.projection?.mode ?? state.projectionMode ?? "perspective";
}

function applyProjection(
  perspectiveCamera: RuntimeThreeCameraObject,
  orthographicCamera: RuntimeThreeCameraObject,
  state: RuntimeCameraState
): void {
  const projection = state.projection;
  if (!projection) return;
  if (perspectiveCamera instanceof THREE.PerspectiveCamera) {
    if (projection.fov !== undefined) perspectiveCamera.fov = projection.fov;
    if (projection.near !== undefined) perspectiveCamera.near = projection.near;
    if (projection.far !== undefined) perspectiveCamera.far = projection.far;
    if (projection.viewport) {
      perspectiveCamera.aspect = projection.viewport.width / Math.max(1, projection.viewport.height);
    }
  }
  if (orthographicCamera instanceof THREE.OrthographicCamera && projection.orthographicHeight !== undefined) {
    const aspect = projection.viewport
      ? projection.viewport.width / Math.max(1, projection.viewport.height)
      : 1;
    const width = projection.orthographicHeight * aspect;
    orthographicCamera.left = -width * 0.5;
    orthographicCamera.right = width * 0.5;
    orthographicCamera.top = projection.orthographicHeight * 0.5;
    orthographicCamera.bottom = -projection.orthographicHeight * 0.5;
  }
  perspectiveCamera.updateProjectionMatrix();
  orthographicCamera.updateProjectionMatrix();
}

function applyPose(camera: RuntimeThreeCameraObject, state: RuntimeCameraState): void {
  const [x = 0, y = 0, z = 0] = state.pose.position;
  camera.position.set(x, y, z);
  if (state.pose.up) {
    const [upX = 0, upY = 1, upZ = 0] = state.pose.up;
    camera.up.set(upX, upY, upZ);
  }
  if (state.pose.target) {
    const [targetX = 0, targetY = 0, targetZ = 0] = state.pose.target;
    camera.lookAt(targetX, targetY, targetZ);
  }
  camera.updateProjectionMatrix();
}
