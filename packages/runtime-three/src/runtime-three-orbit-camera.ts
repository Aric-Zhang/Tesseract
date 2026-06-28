import {
  runtimeCameraId,
  runtimeWorldId,
  type RuntimeCameraAxis,
  type RuntimeCameraDescriptor,
  type RuntimeCameraId,
  type RuntimeCameraProjectionMode,
  type RuntimeCameraState
} from "runtime-core";
import { RuntimeThreeCameraBackend, type RuntimeThreeCameraObject } from "./runtime-three-camera-backend";

export interface RuntimeThreeOrbitCameraState {
  readonly target: readonly [number, number, number];
  readonly distance: number;
  readonly yaw: number;
  readonly pitch: number;
  readonly roll?: number;
}

export interface RuntimeThreeOrbitCameraOptions {
  readonly id?: RuntimeCameraId;
  readonly orbit?: Partial<RuntimeThreeOrbitCameraState>;
  readonly projectionMode?: RuntimeCameraProjectionMode;
  readonly label?: string;
}

export class RuntimeThreeOrbitCamera {
  readonly id: RuntimeCameraId;
  readonly #backend: RuntimeThreeCameraBackend;
  #state: RuntimeCameraState;

  constructor(options: RuntimeThreeOrbitCameraOptions = {}) {
    this.id = options.id ?? runtimeCameraId("camera-3d:main");
    this.#state = createRuntimeStateFromOrbit({
      target: options.orbit?.target ?? [0, 0, 0],
      distance: options.orbit?.distance ?? 6,
      yaw: options.orbit?.yaw ?? 0,
      pitch: options.orbit?.pitch ?? 0,
      roll: options.orbit?.roll ?? 0
    }, options.projectionMode ?? "perspective");
    this.#backend = new RuntimeThreeCameraBackend(this.descriptor(options.label));
  }

  get activeCamera(): RuntimeThreeCameraObject {
    return this.#backend.object;
  }

  get state(): RuntimeCameraState {
    return cloneRuntimeCameraState(this.#state);
  }

  get projectionMode(): RuntimeCameraProjectionMode {
    return getProjectionMode(this.#state);
  }

  get distance(): number {
    return getOrbitState(this.#state).distance;
  }

  orbitDelta(delta: { readonly yaw: number; readonly pitch: number }): boolean {
    const before = this.#state;
    this.#state = applyOrbitDelta(this.#state, delta);
    return this.#commitIfChanged(before);
  }

  snapAxis(axis: RuntimeCameraAxis): boolean {
    const before = this.#state;
    this.#state = applySnapAxis(this.#state, axis);
    return this.#commitIfChanged(before);
  }

  toggleProjection(): boolean {
    return this.setProjectionMode(this.projectionMode === "orthographic" ? "perspective" : "orthographic");
  }

  setProjectionMode(mode: RuntimeCameraProjectionMode): boolean {
    const before = this.#state;
    this.#state = setProjectionMode(this.#state, mode);
    return this.#commitIfChanged(before);
  }

  resizeProjection(width: number, height: number): boolean {
    assertFinite(width, "resizeProjection.width");
    assertFinite(height, "resizeProjection.height");
    if (width <= 0 || height <= 0) return false;
    const before = this.#state;
    this.#state = resizeProjection(this.#state, width, height);
    return this.#commitIfChanged(before);
  }

  dispose(): void {
    this.#backend.dispose();
  }

  descriptor(label = "Camera3"): RuntimeCameraDescriptor {
    return {
      id: this.id,
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world:scene-3d"),
      state: this.#state,
      label
    };
  }

  #commitIfChanged(previous: RuntimeCameraState): boolean {
    if (sameRuntimeCameraState(previous, this.#state)) return false;
    this.#backend.applyState(this.#state);
    return true;
  }
}

function createRuntimeStateFromOrbit(
  orbit: RuntimeThreeOrbitCameraState,
  projectionMode: RuntimeCameraProjectionMode
): RuntimeCameraState {
  return {
    pose: createPoseFromOrbit(orbit),
    orbit,
    projectionMode,
    projection: {
      mode: projectionMode,
      fov: 45,
      near: 0.1,
      far: 1000
    }
  };
}

function applyOrbitDelta(
  state: RuntimeCameraState,
  delta: { readonly yaw: number; readonly pitch: number }
): RuntimeCameraState {
  const orbit = getOrbitState(state);
  return withOrbit(state, {
    ...orbit,
    yaw: orbit.yaw + delta.yaw,
    pitch: orbit.pitch + delta.pitch,
    snapAxis: undefined
  });
}

function applySnapAxis(state: RuntimeCameraState, axis: RuntimeCameraAxis): RuntimeCameraState {
  const orbit = getOrbitState(state);
  const horizontalYaw = orbit.yaw;
  let nextOrbit: NonNullable<RuntimeCameraState["orbit"]>;
  switch (axis) {
    case "+x":
      nextOrbit = { ...orbit, yaw: Math.PI * 0.5, pitch: 0, snapAxis: axis };
      break;
    case "-x":
      nextOrbit = { ...orbit, yaw: -Math.PI * 0.5, pitch: 0, snapAxis: axis };
      break;
    case "+y":
      nextOrbit = { ...orbit, yaw: horizontalYaw, pitch: Math.PI * 0.5, snapAxis: axis };
      break;
    case "-y":
      nextOrbit = { ...orbit, yaw: horizontalYaw, pitch: -Math.PI * 0.5, snapAxis: axis };
      break;
    case "+z":
      nextOrbit = { ...orbit, yaw: 0, pitch: 0, snapAxis: axis };
      break;
    case "-z":
      nextOrbit = { ...orbit, yaw: Math.PI, pitch: 0, snapAxis: axis };
      break;
  }
  return withOrbit(state, nextOrbit);
}

function setProjectionMode(
  state: RuntimeCameraState,
  mode: RuntimeCameraProjectionMode
): RuntimeCameraState {
  return {
    ...state,
    projectionMode: mode,
    projection: {
      ...state.projection,
      mode
    }
  };
}

function resizeProjection(state: RuntimeCameraState, width: number, height: number): RuntimeCameraState {
  const projection = state.projection;
  const fov = projection?.fov ?? 45;
  const distance = getOrbitState(state).distance;
  const orthographicHeight = 2 * distance * Math.tan((fov * Math.PI / 180) * 0.5);
  return {
    ...state,
    projection: {
      ...projection,
      mode: projection?.mode ?? state.projectionMode ?? "perspective",
      fov,
      near: projection?.near ?? 0.1,
      far: projection?.far ?? 1000,
      viewport: { width, height },
      orthographicHeight
    }
  };
}

function withOrbit(state: RuntimeCameraState, orbit: NonNullable<RuntimeCameraState["orbit"]>): RuntimeCameraState {
  return {
    ...state,
    pose: createPoseFromOrbit({
      target: [orbit.target[0] ?? 0, orbit.target[1] ?? 0, orbit.target[2] ?? 0],
      distance: orbit.distance,
      yaw: orbit.yaw,
      pitch: orbit.pitch,
      roll: orbit.roll
    }),
    orbit
  };
}

function getOrbitState(state: RuntimeCameraState): NonNullable<RuntimeCameraState["orbit"]> {
  return state.orbit ?? {
    target: state.pose.target ?? [0, 0, 0],
    distance: 6,
    yaw: 0,
    pitch: 0,
    roll: 0
  };
}

function createPoseFromOrbit(orbit: RuntimeThreeOrbitCameraState): RuntimeCameraState["pose"] {
  const [targetX = 0, targetY = 0, targetZ = 0] = orbit.target;
  const cosPitch = Math.cos(orbit.pitch);
  const directionX = Math.sin(orbit.yaw) * cosPitch;
  const directionY = Math.sin(orbit.pitch);
  const directionZ = Math.cos(orbit.yaw) * cosPitch;
  const up = createStableScreenUpFromOrbit({
    directionX,
    directionY,
    directionZ,
    yaw: orbit.yaw
  });
  return {
    position: [
      targetX + directionX * orbit.distance,
      targetY + directionY * orbit.distance,
      targetZ + directionZ * orbit.distance
    ],
    target: orbit.target,
    up
  };
}

function createStableScreenUpFromOrbit(options: {
  readonly directionX: number;
  readonly directionY: number;
  readonly directionZ: number;
  readonly yaw: number;
}): [number, number, number] {
  const rightX = Math.cos(options.yaw);
  const rightY = 0;
  const rightZ = -Math.sin(options.yaw);
  const up = cross3(
    options.directionX,
    options.directionY,
    options.directionZ,
    rightX,
    rightY,
    rightZ
  );
  if (normalize3(up)) return up;
  const fallbackUp = cross3(
    options.directionX,
    options.directionY,
    options.directionZ,
    1,
    0,
    0
  );
  if (normalize3(fallbackUp)) return fallbackUp;
  return [0, 1, 0];
}

function cross3(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): [number, number, number] {
  return [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx
  ];
}

function normalize3(value: [number, number, number]): boolean {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (length <= 1e-12) return false;
  value[0] /= length;
  value[1] /= length;
  value[2] /= length;
  return true;
}

function getProjectionMode(state: RuntimeCameraState): RuntimeCameraProjectionMode {
  return state.projection?.mode ?? state.projectionMode ?? "perspective";
}

function cloneRuntimeCameraState(state: RuntimeCameraState): RuntimeCameraState {
  return {
    ...state,
    pose: {
      position: [...state.pose.position],
      target: state.pose.target ? [...state.pose.target] : undefined,
      up: state.pose.up ? [...state.pose.up] : undefined
    },
    orbit: state.orbit ? {
      ...state.orbit,
      target: [...state.orbit.target]
    } : undefined,
    projection: state.projection ? {
      ...state.projection,
      viewport: state.projection.viewport ? { ...state.projection.viewport } : undefined
    } : undefined
  };
}

function sameRuntimeCameraState(a: RuntimeCameraState, b: RuntimeCameraState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`RuntimeThreeOrbitCamera ${label} must be finite.`);
  }
}
