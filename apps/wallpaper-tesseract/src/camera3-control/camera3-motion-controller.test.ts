import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Camera3MotionController } from "./camera3-motion-controller";

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };
const orbitSensitivity = 0.008;

function createController(options: ConstructorParameters<typeof Camera3MotionController>[0] = {}) {
  return new Camera3MotionController(options);
}

describe("Camera3MotionController", () => {
  it("queues commands and applies them during the frame update", () => {
    const controller = createController();

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 5 });
    expect(controller.cameraState.orbit?.yaw).toBe(0);
    expect(controller.cameraState.orbit?.pitch).toBe(0);

    const result = controller.update(frame);

    expect(result).toEqual({ changed: true, commandCount: 1 });
    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(-10 * orbitSensitivity);
    expect(controller.cameraState.orbit?.pitch).toBeCloseTo(5 * orbitSensitivity);
  });

  it("notifies observers once after a changed frame", () => {
    const controller = createController();
    const calls: unknown[] = [];

    controller.subscribe({
      onCamera3MotionChanged: (event) => calls.push({
        projectionMode: event.cameraState.projection?.mode,
        commandTypes: event.commands.map((command) => command.type),
        frameIndex: event.frame.frameIndex
      })
    });
    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 2, dy: 0 });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(calls).toEqual([{
      projectionMode: "orthographic",
      commandTypes: ["orbit-delta", "toggle-projection"],
      frameIndex: 1
    }]);
  });

  it("switches the active projection camera through commands", () => {
    const controller = createController();

    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(controller.readViewState().projectionMode).toBe("orthographic");
    expect(controller.getRuntimeThreeCameraForRender()).toBeInstanceOf(THREE.OrthographicCamera);
  });

  it("sets explicit projection mode through commands", () => {
    const controller = createController();

    controller.submit({ type: "set-projection-mode", source: "camera3-gizmo", mode: "orthographic" });
    controller.update(frame);
    controller.submit({ type: "set-projection-mode", source: "camera3-gizmo", mode: "perspective" });
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(controller.readViewState().projectionMode).toBe("perspective");
    expect(controller.getRuntimeThreeCameraForRender()).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(controller.cameraState.projection?.mode).toBe("perspective");
  });

  it("resizes projection through runtime camera state", () => {
    const controller = createController();

    controller.resizeProjection(640, 320);
    controller.submit({ type: "set-projection-mode", source: "camera3-gizmo", mode: "orthographic" });
    controller.update(frame);

    expect(controller.cameraState.projection?.viewport).toEqual({ width: 640, height: 320 });
    expect(controller.cameraState.projection?.orthographicHeight).toBeGreaterThan(0);
    expect(controller.getRuntimeThreeCameraForRender()).toBeInstanceOf(THREE.OrthographicCamera);
  });

  it("snaps to axis targets with stable yaw and pitch semantics", () => {
    const controller = createController();
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

      expect(controller.cameraState.orbit?.yaw).toBeCloseTo(testCase.yaw);
      expect(controller.cameraState.orbit?.pitch).toBeCloseTo(testCase.pitch);
      expect(controller.cameraState.orbit?.snapAxis).toBe(testCase.axis);
    }
  });

  it("ignores camera motion while locked but still allows projection changes", () => {
    const controller = createController({ locked: true });

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 10, dy: 10 });
    controller.submit({ type: "snap-axis", source: "camera3-gizmo", axis: "+y" });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    const result = controller.update(frame);

    expect(result.changed).toBe(true);
    expect(controller.cameraState.orbit?.yaw).toBe(0);
    expect(controller.cameraState.orbit?.pitch).toBe(0);
    expect(controller.readViewState().projectionMode).toBe("orthographic");
  });

  it("moves commands submitted by observers into the next frame", () => {
    const controller = createController();
    controller.subscribe({
      onCamera3MotionChanged: () => {
        controller.submit({ type: "orbit-delta", source: "script", dx: 4, dy: 0 });
      }
    });

    controller.submit({ type: "orbit-delta", source: "camera3-gizmo", dx: 2, dy: 0 });
    controller.update(frame);
    const yawAfterFirstFrame = controller.cameraState.orbit?.yaw ?? 0;
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(yawAfterFirstFrame).toBeCloseTo(-2 * orbitSensitivity);
    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(-6 * orbitSensitivity);
  });
});
