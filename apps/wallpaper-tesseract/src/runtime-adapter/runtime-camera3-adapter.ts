import {
  type RuntimeCameraCommand,
  type RuntimeCameraId
} from "runtime-core";
import type { Camera3ControlCommand } from "../camera3-control";

export type Camera3RuntimeAdapterResult =
  | { readonly ok: true; readonly command: RuntimeCameraCommand }
  | {
      readonly ok: false;
      readonly blocker: "camera3-state-owned-by-editor-feature";
      readonly reason: string;
    };

// Phase 4D bridge. Delete once Camera3 command production is owned by runtime camera ports.
export function adaptCamera3ControlCommand(
  command: Camera3ControlCommand,
  cameraId: RuntimeCameraId
): Camera3RuntimeAdapterResult {
  switch (command.type) {
    case "orbit-delta":
      return {
        ok: true,
        command: {
          type: "orbit-camera-delta",
          cameraId,
          delta: {
            yaw: command.dx,
            pitch: command.dy
          }
        }
      };
    case "toggle-projection":
      return {
        ok: true,
        command: {
          type: "toggle-camera-projection",
          cameraId
        }
      };
    case "snap-axis":
      return {
        ok: true,
        command: {
          type: "snap-camera-axis",
          cameraId,
          axis: command.axis
        }
      };
    case "set-projection-mode":
      return {
        ok: true,
        command: {
          type: "set-camera-projection-mode",
          cameraId,
          mode: command.mode
        }
      };
  }
}
