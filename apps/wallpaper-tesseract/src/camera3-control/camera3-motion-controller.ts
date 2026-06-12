import type * as THREE from "three";
import type {
  RuntimeCameraId,
  RuntimeCameraProjectionMode,
  RuntimeCameraState
} from "runtime-core";
import { Camera3RuntimeCamera } from "../runtime/camera3-runtime-camera";
import type { RuntimeRegistration, UpdateFrame } from "../runtime/ports";
import type { Camera3CommandSink, Camera3ControlCommand } from "./camera3-control-command";

export interface Camera3MotionControllerOptions {
  readonly target?: readonly [number, number, number];
  readonly distance?: number;
  readonly yaw?: number;
  readonly pitch?: number;
  readonly roll?: number;
  readonly locked?: boolean;
  readonly orbitSensitivity?: number;
  readonly projectionMode?: RuntimeCameraProjectionMode;
}

export interface Camera3MotionUpdateResult {
  changed: boolean;
  commandCount: number;
}

export interface Camera3MotionChangedEvent {
  frame: UpdateFrame;
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
  private readonly runtimeCamera: Camera3RuntimeCamera;
  private readonly locked: boolean;
  private readonly orbitSensitivity: number;

  constructor(options: Camera3MotionControllerOptions = {}) {
    this.locked = options.locked ?? false;
    this.orbitSensitivity = options.orbitSensitivity ?? 0.008;
    this.runtimeCamera = new Camera3RuntimeCamera({
      orbit: {
        target: options.target ?? [0, 0, 0],
        distance: options.distance ?? 6,
        yaw: options.yaw ?? 0,
        pitch: options.pitch ?? 0,
        roll: options.roll ?? 0
      },
      projectionMode: options.projectionMode
    });
    this.runtimeCameraId = this.runtimeCamera.id;
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
    this.runtimeCamera.resizeProjection(width, height);
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
        if (!this.locked) {
          this.runtimeCamera.orbitDelta({
            yaw: -command.dx * this.orbitSensitivity,
            pitch: command.dy * this.orbitSensitivity
          });
        }
        return;
      case "snap-axis":
        if (!this.locked) {
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

  private notify(frame: UpdateFrame, commands: readonly Camera3ControlCommand[]): void {
    const event: Camera3MotionChangedEvent = {
      frame,
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
