import type {
  RuntimeCameraAxis,
  RuntimeCameraProjectionMode,
  RuntimeCameraState
} from "./runtime-camera";

export type RuntimeCameraControlSource = string;

export type RuntimeCameraControlCommand =
  | RuntimeCameraOrbitDeltaCommand
  | RuntimeCameraSnapAxisCommand
  | RuntimeCameraToggleProjectionCommand
  | RuntimeCameraSetProjectionModeCommand;

export interface RuntimeCameraCommandSink {
  submit(command: RuntimeCameraControlCommand): void;
}

export interface RuntimeCameraViewState {
  readonly cameraState: RuntimeCameraState;
  readonly projectionMode: RuntimeCameraProjectionMode;
}

export interface RuntimeCameraOrbitDeltaCommand {
  type: "orbit-delta";
  source: RuntimeCameraControlSource;
  dx: number;
  dy: number;
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
