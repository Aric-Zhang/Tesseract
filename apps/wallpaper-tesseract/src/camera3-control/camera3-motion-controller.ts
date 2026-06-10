import * as THREE from "three";
import {
  runtimeCameraId,
  runtimeWorldId,
  type RuntimeCameraAxis,
  type RuntimeCameraId,
  type RuntimeCameraState
} from "runtime-core";
import { RuntimeThreeCameraBackend } from "runtime-three";
import { Camera3ProjectionModeController, Camera3Rig } from "../features/camera3/model";
import type { RuntimeObject, RuntimeRegistration, UpdateFrame } from "../runtime/ports";
import type { Camera3CommandSink, Camera3ControlCommand } from "./camera3-control-command";

export interface Camera3MotionControllerOptions {
  rig: Camera3Rig;
  projectionMode: Camera3ProjectionModeController;
}

export interface Camera3MotionUpdateResult {
  changed: boolean;
  commandCount: number;
}

export interface Camera3MotionChangedEvent {
  frame: UpdateFrame;
  rig: Camera3Rig;
  projectionMode: Camera3ProjectionModeController;
  activeCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  commands: readonly Camera3ControlCommand[];
}

export interface Camera3MotionObserver {
  onCamera3MotionChanged(event: Camera3MotionChangedEvent): void;
}

interface Camera3Snapshot {
  state: RuntimeCameraState;
}

export class Camera3MotionController implements Camera3CommandSink, RuntimeObject {
  readonly id = "camera3-motion-controller";
  readonly priority = -100;
  enabled = true;
  readonly runtimeCameraId: RuntimeCameraId;
  private pendingCommands: Camera3ControlCommand[] = [];
  private readonly observers: Camera3MotionObserver[] = [];
  private readonly rig: Camera3Rig;
  private readonly projectionMode: Camera3ProjectionModeController;
  private readonly runtimeCameraBackend: RuntimeThreeCameraBackend;
  private runtimeState: RuntimeCameraState;

  constructor(options: Camera3MotionControllerOptions) {
    this.rig = options.rig;
    this.projectionMode = options.projectionMode;
    this.runtimeCameraId = runtimeCameraId("camera3:main");
    this.runtimeState = createRuntimeStateFromRig(this.rig, this.projectionMode.mode);
    this.runtimeCameraBackend = new RuntimeThreeCameraBackend({
      id: this.runtimeCameraId,
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world:scene-3d"),
      state: this.runtimeState,
      label: "Camera3"
    });
    this.syncCamera();
  }

  get activeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.runtimeCameraBackend.object;
  }

  get distance(): number {
    return this.runtimeState.orbit?.distance ?? this.rig.distance;
  }

  get cameraState(): RuntimeCameraState {
    return cloneRuntimeCameraState(this.runtimeState);
  }

  submit(command: Camera3ControlCommand): void {
    validateCommand(command);
    this.pendingCommands.push(command);
  }

  subscribe(observer: Camera3MotionObserver): RuntimeRegistration {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
    }
    return {
      dispose: () => {
        const index = this.observers.indexOf(observer);
        if (index >= 0) {
          this.observers.splice(index, 1);
        }
      }
    };
  }

  updateFrame(frame: UpdateFrame): void {
    this.update(frame);
  }

  resizeProjection(width: number, height: number): void {
    assertFinite(width, "resizeProjection.width");
    assertFinite(height, "resizeProjection.height");
    if (width <= 0 || height <= 0) return;
    this.runtimeState = resizeProjection(this.runtimeState, width, height);
    this.syncEditorModelFromRuntimeState();
    this.syncCamera();
  }

  update(frame: UpdateFrame): Camera3MotionUpdateResult {
    const commands = this.pendingCommands;
    this.pendingCommands = [];
    if (commands.length === 0) {
      return { changed: false, commandCount: 0 };
    }

    const before = this.snapshot();
    for (const command of commands) {
      this.applyCommand(command);
    }
    const changed = !sameSnapshot(before, this.snapshot());
    if (changed) {
      this.syncEditorModelFromRuntimeState();
      this.syncCamera();
      this.notify(frame, commands);
    }
    return { changed, commandCount: commands.length };
  }

  syncCamera(): void {
    this.runtimeCameraBackend.applyState(this.runtimeState);
    this.rig.updateCamera(this.activeCamera);
  }

  dispose(): void {
    this.pendingCommands = [];
    this.observers.length = 0;
    this.runtimeCameraBackend.dispose();
  }

  private applyCommand(command: Camera3ControlCommand): void {
    switch (command.type) {
      case "orbit-delta":
        if (!this.rig.locked) {
          this.runtimeState = applyOrbitDelta(this.runtimeState, {
            yaw: -command.dx * this.rig.orbitSensitivity,
            pitch: command.dy * this.rig.orbitSensitivity
          });
        }
        return;
      case "snap-axis":
        if (!this.rig.locked) {
          this.runtimeState = applySnapAxis(this.runtimeState, command.axis);
        }
        return;
      case "toggle-projection":
        this.runtimeState = setProjectionMode(
          this.runtimeState,
          getProjectionMode(this.runtimeState) === "orthographic" ? "perspective" : "orthographic"
        );
        return;
      case "set-projection-mode":
        this.runtimeState = setProjectionMode(this.runtimeState, command.mode);
        return;
    }
  }

  private snapshot(): Camera3Snapshot {
    return {
      state: this.runtimeState
    };
  }

  private syncEditorModelFromRuntimeState(): void {
    const orbit = this.runtimeState.orbit;
    if (orbit) {
      const [targetX = 0, targetY = 0, targetZ = 0] = orbit.target;
      this.rig.target.set(targetX, targetY, targetZ);
      this.rig.distance = orbit.distance;
      this.rig.yaw = orbit.yaw;
      this.rig.pitch = orbit.pitch;
      this.rig.roll = orbit.roll ?? 0;
    }
    this.projectionMode.setMode(getProjectionMode(this.runtimeState));
    const projection = this.runtimeState.projection;
    if (projection?.viewport) {
      this.projectionMode.resize(
        projection.viewport.width,
        projection.viewport.height,
        this.distance
      );
    }
  }

  private notify(frame: UpdateFrame, commands: readonly Camera3ControlCommand[]): void {
    const event: Camera3MotionChangedEvent = {
      frame,
      rig: this.rig,
      projectionMode: this.projectionMode,
      activeCamera: this.activeCamera,
      commands
    };
    for (const observer of [...this.observers]) {
      observer.onCamera3MotionChanged(event);
    }
  }
}

function createRuntimeStateFromRig(
  rig: Camera3Rig,
  projectionMode: "perspective" | "orthographic"
): RuntimeCameraState {
  const orbit = {
    target: [rig.target.x, rig.target.y, rig.target.z],
    distance: rig.distance,
    yaw: rig.yaw,
    pitch: rig.pitch,
    roll: rig.roll
  };
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
  mode: "perspective" | "orthographic"
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
    pose: createPoseFromOrbit(orbit),
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

function createPoseFromOrbit(orbit: NonNullable<RuntimeCameraState["orbit"]>): RuntimeCameraState["pose"] {
  const [targetX = 0, targetY = 0, targetZ = 0] = orbit.target;
  const cosPitch = Math.cos(orbit.pitch);
  const directionX = Math.sin(orbit.yaw) * cosPitch;
  const directionY = Math.sin(orbit.pitch);
  const directionZ = Math.cos(orbit.yaw) * cosPitch;
  return {
    position: [
      targetX + directionX * orbit.distance,
      targetY + directionY * orbit.distance,
      targetZ + directionZ * orbit.distance
    ],
    target: orbit.target,
    up: [0, 1, 0]
  };
}

function getProjectionMode(state: RuntimeCameraState): "perspective" | "orthographic" {
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

function validateCommand(command: Camera3ControlCommand): void {
  switch (command.type) {
    case "orbit-delta":
      assertFinite(command.dx, "orbit-delta.dx");
      assertFinite(command.dy, "orbit-delta.dy");
      return;
    case "snap-axis":
      return;
    case "toggle-projection":
      return;
    case "set-projection-mode":
      return;
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Camera3MotionController ${label} must be finite.`);
  }
}

function sameSnapshot(a: Camera3Snapshot, b: Camera3Snapshot): boolean {
  return JSON.stringify(a.state) === JSON.stringify(b.state);
}
