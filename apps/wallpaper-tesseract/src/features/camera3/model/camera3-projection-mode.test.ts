import { describe, expect, it } from "vitest";
import { Camera3ProjectionModeController } from "./camera3-projection-mode";

describe("Camera3ProjectionModeController", () => {
  it("uses the perspective camera by default", () => {
    const controller = new Camera3ProjectionModeController();

    expect(controller.mode).toBe("perspective");
    expect(controller.activeCamera).toBe(controller.perspectiveCamera);
  });

  it("toggles between orthographic and perspective cameras", () => {
    const controller = new Camera3ProjectionModeController();

    controller.toggle();
    expect(controller.mode).toBe("orthographic");
    expect(controller.activeCamera).toBe(controller.orthographicCamera);

    controller.toggle();
    expect(controller.mode).toBe("perspective");
    expect(controller.activeCamera).toBe(controller.perspectiveCamera);
  });

  it("keeps orthographic bounds finite after resize", () => {
    const controller = new Camera3ProjectionModeController();

    controller.resize(1920, 1080, 6);

    expect(Number.isFinite(controller.orthographicCamera.left)).toBe(true);
    expect(Number.isFinite(controller.orthographicCamera.right)).toBe(true);
    expect(Number.isFinite(controller.orthographicCamera.top)).toBe(true);
    expect(Number.isFinite(controller.orthographicCamera.bottom)).toBe(true);
  });

  it("resizes perspective aspect and orthographic bounds from distance and fov", () => {
    const controller = new Camera3ProjectionModeController({ fov: 45 });
    const width = 1280;
    const height = 640;
    const distance = 6;
    const expectedAspect = 2;
    const expectedOrthoHeight = 2 * distance * Math.tan((45 * Math.PI / 180) * 0.5);
    const expectedOrthoWidth = expectedOrthoHeight * expectedAspect;

    controller.resize(width, height, distance);

    expect(controller.perspectiveCamera.aspect).toBeCloseTo(expectedAspect);
    expect(controller.orthographicCamera.left).toBeCloseTo(-expectedOrthoWidth * 0.5);
    expect(controller.orthographicCamera.right).toBeCloseTo(expectedOrthoWidth * 0.5);
    expect(controller.orthographicCamera.top).toBeCloseTo(expectedOrthoHeight * 0.5);
    expect(controller.orthographicCamera.bottom).toBeCloseTo(-expectedOrthoHeight * 0.5);
  });
});
