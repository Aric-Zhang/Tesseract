import type {
  RuntimeCameraAxis,
  RuntimeCameraProjectionMode,
  RuntimeCameraState
} from "./runtime-camera";

export type RuntimeCameraControlSource = string;

export type RuntimeCameraControlCommand =
  | RuntimeCameraOrbitDragStartCommand
  | RuntimeCameraOrbitDragDeltaCommand
  | RuntimeCameraOrbitDragEndCommand
  | RuntimeCameraSnapAxisCommand
  | RuntimeCameraToggleProjectionCommand
  | RuntimeCameraSetProjectionModeCommand
  | RuntimeCameraSetProjectionFovCommand;

export interface RuntimeCameraCommandSink {
  submit(command: RuntimeCameraControlCommand): void;
}

export interface RuntimeCameraViewState {
  readonly cameraState: RuntimeCameraState;
  readonly projectionMode: RuntimeCameraProjectionMode;
}

export const runtimeCameraProjectionFovConstraints = Object.freeze({
  min: 1,
  max: 120,
  step: 0.1
});

export type RuntimeCameraOrbitDragEndReason = "pointerup" | "cancel";

export interface RuntimeCameraOrbitDragStartCommand {
  type: "orbit-drag-start";
  source: RuntimeCameraControlSource;
  sessionId: string;
}

export interface RuntimeCameraOrbitDragDeltaCommand {
  type: "orbit-drag-delta";
  source: RuntimeCameraControlSource;
  sessionId: string;
  dx: number;
  dy: number;
}

export interface RuntimeCameraOrbitDragEndCommand {
  type: "orbit-drag-end";
  source: RuntimeCameraControlSource;
  sessionId: string;
  reason: RuntimeCameraOrbitDragEndReason;
}

export interface RuntimeCameraSnapAxisCommand {
  type: "snap-axis";
  source: RuntimeCameraControlSource;
  axis: RuntimeCameraAxis;
}

export interface RuntimeCameraToggleProjectionCommand {
  type: "toggle-projection";
  source: RuntimeCameraControlSource;
}

export interface RuntimeCameraSetProjectionModeCommand {
  type: "set-projection-mode";
  source: RuntimeCameraControlSource;
  mode: RuntimeCameraProjectionMode;
}

export interface RuntimeCameraSetProjectionFovCommand {
  type: "set-projection-fov";
  source: RuntimeCameraControlSource;
  fov: number;
}
