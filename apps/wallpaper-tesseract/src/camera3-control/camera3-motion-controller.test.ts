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
  });

  it("notifies observers once after a changed frame", () => {
    const { controller } = createController();
    const calls: number[] = [];

    controller.subscribe({
      onCamera3MotionChanged: (event) => calls.push(event.commands.length)
    });
    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 2, dy: 0 });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(calls).toEqual([2]);
  });

  it("switches the active projection camera through commands", () => {
    const { controller, projectionMode } = createController();

    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(projectionMode.mode).toBe("orthographic");
    expect(controller.activeCamera).toBe(projectionMode.orthographicCamera);
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
