import type * as THREE from "three";
import type {
  RuntimeCameraId,
  RuntimeCameraCommandSink,
  RuntimeCameraControlCommand,
  RuntimeCameraProjectionMode,
  RuntimeCameraState,
  RuntimeCameraViewState,
  RuntimeFrame,
  RuntimeRegistration
} from "runtime-core";
import { RuntimeThreeOrbitCamera } from "./runtime-three-orbit-camera";

export interface RuntimeThreeCameraMotionControllerOptions {
  readonly target?: readonly [number, number, number];
  readonly distance?: number;
  readonly yaw?: number;
  readonly pitch?: number;
  readonly roll?: number;
  readonly locked?: boolean;
  readonly orbitSensitivity?: number;
  readonly projectionMode?: RuntimeCameraProjectionMode;
}

export interface RuntimeThreeCameraMotionUpdateResult {
  changed: boolean;
  commandCount: number;
}

export interface RuntimeThreeCameraMotionChangedEvent {
  frame: RuntimeFrame;
  cameraState: RuntimeCameraState;
  commands: readonly RuntimeCameraControlCommand[];
}

export interface RuntimeThreeCameraMotionObserver {
  onCamera3MotionChanged(event: RuntimeThreeCameraMotionChangedEvent): void;
}

interface RuntimeThreeCameraSnapshot {
  state: RuntimeCameraState;
}

export class RuntimeThreeCameraMotionController implements RuntimeCameraCommandSink {
  readonly runtimeCameraId: RuntimeCameraId;
  private pendingCommands: RuntimeCameraControlCommand[] = [];
  private readonly observers: RuntimeThreeCameraMotionObserver[] = [];
  private readonly runtimeCamera: RuntimeThreeOrbitCamera;
  private readonly locked: boolean;
  private readonly orbitSensitivity: number;

  constructor(options: RuntimeThreeCameraMotionControllerOptions = {}) {
    this.locked = options.locked ?? false;
    this.orbitSensitivity = options.orbitSensitivity ?? 0.008;
    this.runtimeCamera = new RuntimeThreeOrbitCamera({
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

  readViewState(): RuntimeCameraViewState {
    return {
      cameraState: this.cameraState,
      projectionMode: getProjectionMode(this.cameraState)
    };
  }

  submit(command: RuntimeCameraControlCommand): void {
    validateCommand(command);
    this.pendingCommands.push(command);
  }

  subscribe(observer: RuntimeThreeCameraMotionObserver): RuntimeRegistration {
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

  updateFrame(frame: RuntimeFrame): void {
    this.update(frame);
  }

  resizeProjection(width: number, height: number): void {
    this.runtimeCamera.resizeProjection(width, height);
  }

  update(frame: RuntimeFrame): RuntimeThreeCameraMotionUpdateResult {
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

  private applyCommand(command: RuntimeCameraControlCommand): void {
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

  private snapshot(): RuntimeThreeCameraSnapshot {
    return {
      state: this.runtimeCamera.state
    };
  }

  private notify(frame: RuntimeFrame, commands: readonly RuntimeCameraControlCommand[]): void {
    const event: RuntimeThreeCameraMotionChangedEvent = {
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

function validateCommand(command: RuntimeCameraControlCommand): void {
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
      throw new Error(`RuntimeThreeCameraMotionController ${label} must be finite.`);
  }
}

function sameSnapshot(a: RuntimeThreeCameraSnapshot, b: RuntimeThreeCameraSnapshot): boolean {
  return JSON.stringify(a.state) === JSON.stringify(b.state);
}
