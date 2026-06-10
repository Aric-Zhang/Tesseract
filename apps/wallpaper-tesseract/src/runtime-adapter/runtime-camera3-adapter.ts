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
        ok: false,
        blocker: "camera3-state-owned-by-editor-feature",
        reason: "snap-axis needs runtime-owned camera orientation state before it can be a renderer-agnostic command."
      };
    case "set-projection-mode":
      return {
        ok: false,
        blocker: "camera3-state-owned-by-editor-feature",
        reason: "set-projection-mode is currently owned by the Camera3 projection mode controller instead of runtime camera state."
      };
  }
}

