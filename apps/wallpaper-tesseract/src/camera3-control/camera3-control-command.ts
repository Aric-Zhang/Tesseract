import type { Camera3Axis, Camera3ProjectionMode } from "../features/camera3/model";

export type Camera3ControlSource = "camera3-gizmo" | "scene-pointer" | "keyboard" | "debug" | "script";

export type Camera3ControlCommand =
  | Camera3OrbitDeltaCommand
  | Camera3SnapAxisCommand
  | Camera3ToggleProjectionCommand
  | Camera3SetProjectionModeCommand;

export interface Camera3CommandSink {
  submit(command: Camera3ControlCommand): void;
}

export interface Camera3OrbitDeltaCommand {
  type: "orbit-delta";
  source: Camera3ControlSource;
  dx: number;
  dy: number;
}

export interface Camera3SnapAxisCommand {
  type: "snap-axis";
  source: Camera3ControlSource;
  axis: Camera3Axis;
}

export interface Camera3ToggleProjectionCommand {
  type: "toggle-projection";
  source: Camera3ControlSource;
}

export interface Camera3SetProjectionModeCommand {
  type: "set-projection-mode";
  source: Camera3ControlSource;
  mode: Camera3ProjectionMode;
}
