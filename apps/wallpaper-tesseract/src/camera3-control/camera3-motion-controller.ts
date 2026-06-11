import type * as THREE from "three";
import type {
  RuntimeCameraId,
  RuntimeCameraProjectionMode,
  RuntimeCameraState
} from "runtime-core";
import { Camera3ProjectionModeController, Camera3Rig } from "../features/camera3/model";
import { Camera3RuntimeCamera } from "../runtime/camera3-runtime-camera";
import type { RuntimeRegistration, UpdateFrame } from "../runtime/ports";
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
  cameraState: RuntimeCameraState;
  commands: readonly Camera3ControlCommand[];
}

export interface Camera3ViewState {
  readonly cameraState: RuntimeCameraState;
  readonly projectionMode: "perspective" | "orthographic";
}

export interface Camera3MotionObserver {
  onCamera3MotionChanged(event: Camera3MotionChangedEvent): void;
}

interface Camera3Snapshot {
  state: RuntimeCameraState;
}

export class Camera3MotionController implements Camera3CommandSink {
  readonly runtimeCameraId: RuntimeCameraId;
  private pendingCommands: Camera3ControlCommand[] = [];
  private readonly observers: Camera3MotionObserver[] = [];
  private readonly rig: Camera3Rig;
  private readonly projectionMode: Camera3ProjectionModeController;
  private readonly runtimeCamera: Camera3RuntimeCamera;

  constructor(options: Camera3MotionControllerOptions) {
    this.rig = options.rig;
    this.projectionMode = options.projectionMode;
    this.runtimeCamera = new Camera3RuntimeCamera({
      orbit: {
        target: [this.rig.target.x, this.rig.target.y, this.rig.target.z],
        distance: this.rig.distance,
        yaw: this.rig.yaw,
        pitch: this.rig.pitch,
        roll: this.rig.roll
      },
      projectionMode: this.projectionMode.mode
    });
    this.runtimeCameraId = this.runtimeCamera.id;
    this.syncEditorModelFromRuntimeState();
  }

  getRuntimeThreeCameraForRender(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.runtimeCamera.activeCamera;
  }

  get distance(): number {
    return this.runtimeCamera.distance;
  }

  get cameraState(): RuntimeCameraState {
    return this.runtimeCamera.state;
  }

  readViewState(): Camera3ViewState {
    return {
      cameraState: this.cameraState,
      projectionMode: getProjectionMode(this.cameraState)
    };
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
    const changed = this.runtimeCamera.resizeProjection(width, height);
    if (changed) {
      this.syncEditorModelFromRuntimeState();
    }
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
      this.notify(frame, commands);
    }
    return { changed, commandCount: commands.length };
  }

  dispose(): void {
    this.pendingCommands = [];
    this.observers.length = 0;
    this.runtimeCamera.dispose();
  }

  private applyCommand(command: Camera3ControlCommand): void {
    switch (command.type) {
      case "orbit-delta":
        if (!this.rig.locked) {
          this.runtimeCamera.orbitDelta({
            yaw: -command.dx * this.rig.orbitSensitivity,
            pitch: command.dy * this.rig.orbitSensitivity
          });
        }
        return;
      case "snap-axis":
        if (!this.rig.locked) {
          this.runtimeCamera.snapAxis(command.axis);
        }
        return;
      case "toggle-projection":
        this.runtimeCamera.toggleProjection();
        return;
      case "set-projection-mode":
        this.runtimeCamera.setProjectionMode(command.mode);
        return;
    }
  }

  private snapshot(): Camera3Snapshot {
    return {
      state: this.runtimeCamera.state
    };
  }

  private syncEditorModelFromRuntimeState(): void {
    const runtimeState = this.runtimeCamera.state;
    const orbit = runtimeState.orbit;
    if (orbit) {
      const [targetX = 0, targetY = 0, targetZ = 0] = orbit.target;
      this.rig.target.set(targetX, targetY, targetZ);
      this.rig.distance = orbit.distance;
      this.rig.yaw = orbit.yaw;
      this.rig.pitch = orbit.pitch;
      this.rig.roll = orbit.roll ?? 0;
    }
    this.projectionMode.setMode(getProjectionMode(runtimeState));
    const projection = runtimeState.projection;
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
      cameraState: this.cameraState,
      commands
    };
    for (const observer of [...this.observers]) {
      observer.onCamera3MotionChanged(event);
    }
  }
}

function getProjectionMode(state: RuntimeCameraState): RuntimeCameraProjectionMode {
  return state.projection?.mode ?? state.projectionMode ?? "perspective";
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
