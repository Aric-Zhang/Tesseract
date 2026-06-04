import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Camera3GizmoState } from "./camera3-gizmo-state";

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
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const state = createState();

    state.updateAxisProjection(camera);

    const zAxis = state.axes.find((axis) => axis.axis === "+z");
    const xAxis = state.axes.find((axis) => axis.axis === "+x");
    expect(zAxis?.screenLength).toBeCloseTo(0);
    expect(zAxis?.visibility).toBeCloseTo(0);
    expect(xAxis?.visibility).toBeCloseTo(1);
  });

  it("keeps cube projection values finite", () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    const state = createState();

    state.updateAxisProjection(camera);
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
