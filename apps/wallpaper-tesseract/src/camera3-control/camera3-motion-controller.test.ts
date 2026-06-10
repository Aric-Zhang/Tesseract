import { describe, expect, it } from "vitest";
import { Camera3ProjectionModeController, Camera3Rig } from "../features/camera3/model";
import { Camera3MotionController } from "./camera3-motion-controller";

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };

function createController() {
  const rig = new Camera3Rig();
  const projectionMode = new Camera3ProjectionModeController();
  const controller = new Camera3MotionController({ rig, projectionMode });
  return { controller, rig, projectionMode };
}

describe("Camera3MotionController", () => {
  it("queues commands and applies them during the frame update", () => {
    const { controller, rig } = createController();

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 5 });
    expect(rig.yaw).toBe(0);
    expect(rig.pitch).toBe(0);

    const result = controller.update(frame);

    expect(result).toEqual({ changed: true, commandCount: 1 });
    expect(rig.yaw).toBeCloseTo(-10 * rig.orbitSensitivity);
    expect(rig.pitch).toBeCloseTo(5 * rig.orbitSensitivity);
    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(rig.yaw);
    expect(controller.cameraState.orbit?.pitch).toBeCloseTo(rig.pitch);
  });

  it("notifies observers once after a changed frame", () => {
    const { controller } = createController();
    const calls: unknown[] = [];

    controller.subscribe({
      onCamera3MotionChanged: (event) => calls.push({
        activeCamera: event.activeCamera,
        commandTypes: event.commands.map((command) => command.type),
        frameIndex: event.frame.frameIndex,
        mode: event.projectionMode.mode
      })
    });
    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 2, dy: 0 });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(calls).toEqual([{
      activeCamera: controller.activeCamera,
      commandTypes: ["orbit-delta", "toggle-projection"],
      frameIndex: 1,
      mode: "orthographic"
    }]);
  });

  it("switches the active projection camera through commands", () => {
    const { controller, projectionMode } = createController();

    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(projectionMode.mode).toBe("orthographic");
    expect(controller.activeCamera).toBe(projectionMode.orthographicCamera);
  });

  it("sets explicit projection mode through commands", () => {
    const { controller, projectionMode } = createController();

    controller.submit({ type: "set-projection-mode", source: "camera3-gizmo", mode: "orthographic" });
    controller.update(frame);
    controller.submit({ type: "set-projection-mode", source: "camera3-gizmo", mode: "perspective" });
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(projectionMode.mode).toBe("perspective");
    expect(controller.activeCamera).toBe(projectionMode.perspectiveCamera);
    expect(controller.cameraState.projection?.mode).toBe("perspective");
  });

  it("snaps to axis targets with stable yaw and pitch semantics", () => {
    const { controller, rig } = createController();
    const cases = [
      { axis: "+x" as const, yaw: Math.PI * 0.5, pitch: 0 },
      { axis: "-x" as const, yaw: -Math.PI * 0.5, pitch: 0 },
      { axis: "+y" as const, yaw: -Math.PI * 0.5, pitch: Math.PI * 0.5 },
      { axis: "-y" as const, yaw: -Math.PI * 0.5, pitch: -Math.PI * 0.5 },
      { axis: "+z" as const, yaw: 0, pitch: 0 },
      { axis: "-z" as const, yaw: Math.PI, pitch: 0 }
    ];

    for (const [index, testCase] of cases.entries()) {
      controller.submit({ type: "snap-axis", source: "camera3-gizmo", axis: testCase.axis });
      controller.update({ timeMs: 16 * (index + 1), deltaMs: 16, frameIndex: index + 1 });

      expect(rig.yaw).toBeCloseTo(testCase.yaw);
      expect(rig.pitch).toBeCloseTo(testCase.pitch);
      expect(controller.cameraState.orbit?.yaw).toBeCloseTo(testCase.yaw);
      expect(controller.cameraState.orbit?.pitch).toBeCloseTo(testCase.pitch);
      expect(controller.cameraState.orbit?.snapAxis).toBe(testCase.axis);
    }
  });

  it("ignores rig motion while locked but still allows projection changes", () => {
    const { controller, rig, projectionMode } = createController();
    rig.locked = true;

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 10 });
    controller.submit({ type: "snap-axis", source: "camera3-gizmo", axis: "+y" });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    const result = controller.update(frame);

    expect(result.changed).toBe(true);
    expect(rig.yaw).toBe(0);
    expect(rig.pitch).toBe(0);
    expect(projectionMode.mode).toBe("orthographic");
  });

  it("moves commands submitted by observers into the next frame", () => {
    const { controller, rig } = createController();
    controller.subscribe({
      onCamera3MotionChanged: () => {
        controller.submit({ type: "orbit-delta", source: "script", dx: 4, dy: 0 });
      }
    });

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 2, dy: 0 });
    controller.update(frame);
    const yawAfterFirstFrame = rig.yaw;
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(yawAfterFirstFrame).toBeCloseTo(-2 * rig.orbitSensitivity);
    expect(rig.yaw).toBeCloseTo(-6 * rig.orbitSensitivity);
  });
});
