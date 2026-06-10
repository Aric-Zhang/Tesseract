import type { RuntimeCameraId, RuntimeWorldId } from "./runtime-id";

export type RuntimeCameraKind = "camera-4d" | "camera-3d";
export type RuntimeCameraProjectionMode = "perspective" | "orthographic";
export type RuntimeCameraAxis = "+x" | "-x" | "+y" | "-y" | "+z" | "-z";

export interface RuntimeCameraPose {
  readonly position: readonly number[];
  readonly target?: readonly number[];
  readonly up?: readonly number[];
}

export interface RuntimeCameraOrbitState {
  readonly target: readonly number[];
  readonly distance: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll?: number;
  readonly snapAxis?: RuntimeCameraAxis;
}

export interface RuntimeCameraProjectionState {
  readonly mode: RuntimeCameraProjectionMode;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
  readonly viewport?: {
    readonly width: number;
    readonly height: number;
  };
  readonly orthographicHeight?: number;
}

export interface RuntimeCameraState {
  readonly pose: RuntimeCameraPose;
  readonly projectionMode?: RuntimeCameraProjectionMode;
  readonly orbit?: RuntimeCameraOrbitState;
  readonly projection?: RuntimeCameraProjectionState;
}

export interface RuntimeCameraDescriptor {
  readonly id: RuntimeCameraId;
  readonly kind: RuntimeCameraKind;
  readonly sourceWorldId: RuntimeWorldId;
  readonly state: RuntimeCameraState;
  readonly label?: string;
}

export type RuntimeCameraCommand =
  | {
      readonly type: "set-camera-state";
      readonly cameraId: RuntimeCameraId;
      readonly state: RuntimeCameraState;
    }
  | {
      readonly type: "orbit-camera-delta";
      readonly cameraId: RuntimeCameraId;
      readonly delta: { readonly yaw: number; readonly pitch: number };
    }
  | {
      readonly type: "snap-camera-axis";
      readonly cameraId: RuntimeCameraId;
      readonly axis: RuntimeCameraAxis;
    }
  | {
      readonly type: "toggle-camera-projection";
      readonly cameraId: RuntimeCameraId;
    }
  | {
      readonly type: "set-camera-projection-mode";
      readonly cameraId: RuntimeCameraId;
      readonly mode: RuntimeCameraProjectionMode;
    }
  | {
      readonly type: "resize-camera-projection";
      readonly cameraId: RuntimeCameraId;
      readonly viewport: { readonly width: number; readonly height: number };
      readonly distance?: number;
    };

export class RuntimeCameraRegistry {
  readonly #cameras = new Map<RuntimeCameraId, RuntimeCameraDescriptor>();

  add(camera: RuntimeCameraDescriptor): void {
    if (this.#cameras.has(camera.id)) {
      throw new Error(`RuntimeCameraRegistry already contains camera ${camera.id}.`);
    }
    this.#cameras.set(camera.id, camera);
  }

  setState(cameraId: RuntimeCameraId, state: RuntimeCameraState): boolean {
    const camera = this.#cameras.get(cameraId);
    if (!camera) return false;
    this.#cameras.set(cameraId, { ...camera, state });
    return true;
  }

  remove(cameraId: RuntimeCameraId): boolean {
    return this.#cameras.delete(cameraId);
  }

  get(cameraId: RuntimeCameraId): RuntimeCameraDescriptor | null {
    return this.#cameras.get(cameraId) ?? null;
  }

  list(): readonly RuntimeCameraDescriptor[] {
    return [...this.#cameras.values()];
  }
}
