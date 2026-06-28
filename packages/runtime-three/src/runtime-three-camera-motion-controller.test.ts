import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { RuntimeThreeCameraMotionController } from "./runtime-three-camera-motion-controller";

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };
const orbitSensitivity = 0.008;

function createController(options: ConstructorParameters<typeof RuntimeThreeCameraMotionController>[0] = {}) {
  return new RuntimeThreeCameraMotionController(options);
}

function submitOrbitDrag(
  controller: RuntimeThreeCameraMotionController,
  delta: { readonly dx: number; readonly dy: number },
  sessionId = "test-drag"
): void {
  controller.submit({ type: "orbit-drag-start", source: "camera3-gizmo", sessionId });
  controller.submit({ type: "orbit-drag-delta", source: "camera3-gizmo", sessionId, ...delta });
}

describe("RuntimeThreeCameraMotionController", () => {
  it("queues commands and applies them during the frame update", () => {
    const controller = createController();

    submitOrbitDrag(controller, { dx: 10, dy: 5 });
    expect(controller.cameraState.orbit?.yaw).toBe(0);
    expect(controller.cameraState.orbit?.pitch).toBe(0);

    const result = controller.update(frame);

    expect(result).toEqual({ changed: true, commandCount: 2 });
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
    submitOrbitDrag(controller, { dx: 2, dy: 0 });
    controller.submit({ type: "toggle-projection", source: "camera3-gizmo" });
    controller.update(frame);

    expect(calls).toEqual([{
      projectionMode: "orthographic",
      commandTypes: ["orbit-drag-start", "orbit-drag-delta", "toggle-projection"],
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

  it("keeps screen up continuous when orbit pitch passes vertical", () => {
    const controller = createController({ yaw: 0, pitch: Math.PI * 0.75 });
    const up = controller.cameraState.pose.up;

    expect(up?.[0]).toBeCloseTo(0);
    expect(up?.[1]).toBeLessThan(0);
    expect(up?.[2]).toBeLessThan(0);
    expect(controller.getRuntimeThreeCameraForRender().up.y).toBeLessThan(0);
  });

  it("uses stable screen-up vectors for vertical axis snaps", () => {
    const top = createController({ yaw: 0 });
    top.submit({ type: "snap-axis", source: "camera3-gizmo", axis: "+y" });
    top.update(frame);

    expect(top.cameraState.pose.up?.[0]).toBeCloseTo(0);
    expect(top.cameraState.pose.up?.[1]).toBeCloseTo(0);
    expect(top.cameraState.pose.up?.[2]).toBeCloseTo(-1);

    const bottom = createController({ yaw: 0 });
    bottom.submit({ type: "snap-axis", source: "camera3-gizmo", axis: "-y" });
    bottom.update(frame);

    expect(bottom.cameraState.pose.up?.[0]).toBeCloseTo(0);
    expect(bottom.cameraState.pose.up?.[1]).toBeCloseTo(0);
    expect(bottom.cameraState.pose.up?.[2]).toBeCloseTo(1);
  });

  it("flips horizontal orbit drag when the drag starts upside down", () => {
    const controller = createController({ yaw: 0, pitch: Math.PI * 0.75 });

    submitOrbitDrag(controller, { dx: 10, dy: 0 });
    controller.update(frame);

    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(10 * orbitSensitivity);
  });

  it("locks horizontal orbit drag direction for the active drag session", () => {
    const controller = createController({ yaw: 0, pitch: 0 });
    const sessionId = "continuous-drag";

    controller.submit({ type: "orbit-drag-start", source: "camera3-gizmo", sessionId });
    controller.submit({ type: "orbit-drag-delta", source: "camera3-gizmo", sessionId, dx: 0, dy: 400 });
    controller.update(frame);
    expect(controller.cameraState.pose.up?.[1]).toBeLessThan(0);

    controller.submit({ type: "orbit-drag-delta", source: "camera3-gizmo", sessionId, dx: 10, dy: 0 });
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(-10 * orbitSensitivity);
  });

  it("recomputes horizontal orbit drag direction after the previous session ends", () => {
    const controller = createController({ yaw: 0, pitch: 0 });
    const firstSessionId = "first-drag";
    const secondSessionId = "second-drag";

    controller.submit({ type: "orbit-drag-start", source: "camera3-gizmo", sessionId: firstSessionId });
    controller.submit({ type: "orbit-drag-delta", source: "camera3-gizmo", sessionId: firstSessionId, dx: 0, dy: 400 });
    controller.submit({ type: "orbit-drag-end", source: "camera3-gizmo", sessionId: firstSessionId, reason: "pointerup" });
    controller.update(frame);
    expect(controller.cameraState.pose.up?.[1]).toBeLessThan(0);

    controller.submit({ type: "orbit-drag-start", source: "camera3-gizmo", sessionId: secondSessionId });
    controller.submit({ type: "orbit-drag-delta", source: "camera3-gizmo", sessionId: secondSessionId, dx: 10, dy: 0 });
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(10 * orbitSensitivity);
  });

  it("ignores camera motion while locked but still allows projection changes", () => {
    const controller = createController({ locked: true });

    submitOrbitDrag(controller, { dx: 10, dy: 10 });
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
        submitOrbitDrag(controller, { dx: 4, dy: 0 }, "observer-drag");
      }
    });

    submitOrbitDrag(controller, { dx: 2, dy: 0 });
    controller.update(frame);
    const yawAfterFirstFrame = controller.cameraState.orbit?.yaw ?? 0;
    controller.update({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(yawAfterFirstFrame).toBeCloseTo(-2 * orbitSensitivity);
    expect(controller.cameraState.orbit?.yaw).toBeCloseTo(-6 * orbitSensitivity);
  });
});
