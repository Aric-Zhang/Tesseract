import { describe, expect, it } from "vitest";
import { Camera3GizmoHitTester } from "./camera3-gizmo-hit-test";
import { Camera3GizmoState } from "./camera3-gizmo-state";

function createState() {
  const state = new Camera3GizmoState({
    center: 50,
    radius: 32,
    cubeHalfSize: 8,
    axisFadeStart: 8,
    axisFadeEnd: 18
  });
  for (const axis of state.axes) {
    axis.screenX = 1000;
    axis.screenY = 1000;
    axis.screenLength = 32;
    axis.visibility = 1;
  }
  return state;
}

function createCanvas() {
  return {
    getBoundingClientRect() {
      return {
        left: 10,
        top: 20,
        right: 110,
        bottom: 120,
        width: 100,
        height: 100
      };
    }
  } as HTMLCanvasElement;
}

describe("Camera3GizmoHitTester", () => {
  it("returns null outside the canvas", () => {
    const hitTester = new Camera3GizmoHitTester({
      canvas: createCanvas(),
      size: 100,
      state: createState(),
      gizmoId: "camera"
    });

    expect(hitTester.hitTest({ x: 9, y: 20 })).toBeNull();
  });

  it("prefers an axis hit over the center orbit hit", () => {
    const state = createState();
    const xAxis = state.axes.find((axis) => axis.axis === "+x");
    if (!xAxis) throw new Error("Missing +x axis.");
    xAxis.screenX = 70;
    xAxis.screenY = 50;
    const hitTester = new Camera3GizmoHitTester({
      canvas: createCanvas(),
      size: 100,
      state,
      gizmoId: "camera"
    });

    expect(hitTester.hitTest({ x: 80, y: 70 })).toMatchObject({
      gizmoId: "camera",
      partId: "+x",
      kind: "axis",
      priority: 10
    });
  });

  it("does not hit invisible or nearly zero-length axes", () => {
    const state = createState();
    const xAxis = state.axes.find((axis) => axis.axis === "+x");
    if (!xAxis) throw new Error("Missing +x axis.");
    xAxis.screenX = 70;
    xAxis.screenY = 50;
    xAxis.visibility = 0;
    const hitTester = new Camera3GizmoHitTester({
      canvas: createCanvas(),
      size: 100,
      state,
      gizmoId: "camera"
    });

    expect(hitTester.hitTest({ x: 80, y: 70 })).toMatchObject({
      partId: "orbit",
      kind: "center"
    });

    xAxis.visibility = 1;
    xAxis.screenLength = 0.2;
    expect(hitTester.hitTest({ x: 80, y: 70 })).toMatchObject({
      partId: "orbit",
      kind: "center"
    });
  });
});
