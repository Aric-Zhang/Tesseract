import * as THREE from "three";
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
  targetX: number;
  targetY: number;
  targetZ: number;
  distance: number;
  yaw: number;
  pitch: number;
  roll: number;
  mode: string;
}

export class Camera3MotionController implements Camera3CommandSink, RuntimeObject {
  readonly id = "camera3-motion-controller";
  readonly priority = -100;
  enabled = true;
  private pendingCommands: Camera3ControlCommand[] = [];
  private readonly observers: Camera3MotionObserver[] = [];
  private readonly rig: Camera3Rig;
  private readonly projectionMode: Camera3ProjectionModeController;

  constructor(options: Camera3MotionControllerOptions) {
    this.rig = options.rig;
    this.projectionMode = options.projectionMode;
    this.syncCamera();
  }

  get activeCamera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.projectionMode.activeCamera;
  }

  get distance(): number {
    return this.rig.distance;
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
      this.syncCamera();
      this.notify(frame, commands);
    }
    return { changed, commandCount: commands.length };
  }

  syncCamera(): void {
    this.rig.updateCamera(this.projectionMode.activeCamera);
  }

  dispose(): void {
    this.pendingCommands = [];
    this.observers.length = 0;
  }

  private applyCommand(command: Camera3ControlCommand): void {
    switch (command.type) {
      case "orbit-delta":
        if (!this.rig.locked) {
          this.rig.orbit(command.dx, command.dy);
        }
        return;
      case "snap-axis":
        if (!this.rig.locked) {
          this.rig.snapToAxis(command.axis);
        }
        return;
      case "toggle-projection":
        this.projectionMode.toggle();
        return;
      case "set-projection-mode":
        this.projectionMode.setMode(command.mode);
        return;
    }
  }

  private snapshot(): Camera3Snapshot {
    return {
      targetX: this.rig.target.x,
      targetY: this.rig.target.y,
      targetZ: this.rig.target.z,
      distance: this.rig.distance,
      yaw: this.rig.yaw,
      pitch: this.rig.pitch,
      roll: this.rig.roll,
      mode: this.projectionMode.mode
    };
  }

  private notify(frame: UpdateFrame, commands: readonly Camera3ControlCommand[]): void {
    const event: Camera3MotionChangedEvent = {
      frame,
      rig: this.rig,
      projectionMode: this.projectionMode,
      activeCamera: this.projectionMode.activeCamera,
      commands
    };
    for (const observer of [...this.observers]) {
      observer.onCamera3MotionChanged(event);
    }
  }
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
  return (
    a.targetX === b.targetX &&
    a.targetY === b.targetY &&
    a.targetZ === b.targetZ &&
    a.distance === b.distance &&
    a.yaw === b.yaw &&
    a.pitch === b.pitch &&
    a.roll === b.roll &&
    a.mode === b.mode
  );
}
