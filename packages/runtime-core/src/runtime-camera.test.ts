import { describe, expect, it } from "vitest";
import { runtimeCameraId, runtimeWorldId } from "./runtime-id";
import { RuntimeCameraRegistry } from "./runtime-camera";

describe("RuntimeCameraRegistry", () => {
  it("tracks independent camera states", () => {
    const registry = new RuntimeCameraRegistry();
    const cameraA = runtimeCameraId("camera-3d:a");
    const cameraB = runtimeCameraId("camera-3d:b");

    registry.add({
      id: cameraA,
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world-3d:a"),
      state: { pose: { position: [0, 0, 5] }, projectionMode: "perspective" }
    });
    registry.add({
      id: cameraB,
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world-3d:b"),
      state: { pose: { position: [0, 0, 10] }, projectionMode: "orthographic" }
    });

    expect(registry.setState(cameraA, {
      pose: { position: [1, 2, 3] },
      projectionMode: "orthographic"
    })).toBe(true);
    expect(registry.get(cameraA)?.state.pose.position).toEqual([1, 2, 3]);
    expect(registry.get(cameraB)?.state.pose.position).toEqual([0, 0, 10]);
  });
});
