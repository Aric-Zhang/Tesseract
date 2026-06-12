import { describe, expect, it } from "vitest";
import { Camera3GizmoState } from "./camera3-gizmo-state";
import type { RuntimeCameraState } from "runtime-core";

function createState() {
  return new Camera3GizmoState({
    center: 66,
    radius: 42.24,
    cubeHalfSize: 9,
    axisFadeStart: 9.24,
    axisFadeEnd: 23.76
  });
}

describe("Camera3GizmoState", () => {
  it("fades an axis that points along the screen normal", () => {
    const state = createState();

    state.updateAxisProjection(createCameraState());

    const zAxis = state.axes.find((axis) => axis.axis === "+z");
    const xAxis = state.axes.find((axis) => axis.axis === "+x");
    expect(zAxis?.screenLength).toBeCloseTo(0);
    expect(zAxis?.visibility).toBeCloseTo(0);
    expect(xAxis?.visibility).toBeCloseTo(1);
  });

  it("keeps cube projection values finite", () => {
    const state = createState();

    state.updateAxisProjection(createCameraState());
    state.updateCubeProjection();

    for (const vertex of state.cubeVertices) {
      expect(Number.isFinite(vertex.screenX)).toBe(true);
      expect(Number.isFinite(vertex.screenY)).toBe(true);
      expect(Number.isFinite(vertex.depth)).toBe(true);
    }
    for (const face of state.cubeFaces) {
      expect(Number.isFinite(face.depth)).toBe(true);
      expect(Number.isFinite(face.normalDepth)).toBe(true);
    }
  });
});

function createCameraState(): RuntimeCameraState {
  return {
    pose: {
      position: [0, 0, 6],
      target: [0, 0, 0],
      up: [0, 1, 0]
    },
    projectionMode: "perspective",
    projection: {
      mode: "perspective"
    }
  };
}
