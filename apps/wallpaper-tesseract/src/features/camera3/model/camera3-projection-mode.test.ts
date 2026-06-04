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
});
