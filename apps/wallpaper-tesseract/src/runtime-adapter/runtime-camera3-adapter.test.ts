import { describe, expect, it } from "vitest";
import { runtimeCameraId } from "runtime-core";
import { adaptCamera3ControlCommand } from "./runtime-camera3-adapter";

describe("runtime Camera3 adapter", () => {
  const cameraId = runtimeCameraId("camera3-main");

  it("maps orbit and projection toggle commands into runtime-core camera commands", () => {
    expect(adaptCamera3ControlCommand({
      type: "orbit-delta",
      source: "camera3-gizmo",
      dx: 3,
      dy: -2
    }, cameraId)).toEqual({
      ok: true,
      command: {
        type: "orbit-camera-delta",
        cameraId,
        delta: { yaw: 3, pitch: -2 }
      }
    });

    expect(adaptCamera3ControlCommand({
      type: "toggle-projection",
      source: "keyboard"
    }, cameraId)).toEqual({
      ok: true,
      command: {
        type: "toggle-camera-projection",
        cameraId
      }
    });
  });

  it("exposes editor-owned Camera3 command blockers instead of pretending ownership is migrated", () => {
    expect(adaptCamera3ControlCommand({
      type: "snap-axis",
      source: "camera3-gizmo",
      axis: "+x"
    }, cameraId)).toMatchObject({
      ok: false,
      blocker: "camera3-state-owned-by-editor-feature"
    });

    expect(adaptCamera3ControlCommand({
      type: "set-projection-mode",
      source: "debug",
      mode: "orthographic"
    }, cameraId)).toMatchObject({
      ok: false,
      blocker: "camera3-state-owned-by-editor-feature"
    });
  });
});

