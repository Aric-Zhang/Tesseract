import { describe, expect, it } from "vitest";
import { RuntimeCameraRegistry, type RuntimeCameraCommand } from "./runtime-camera";
import { runtimeCameraId, runtimeWorldId } from "./runtime-id";

function submitCameraCommand(
  registry: RuntimeCameraRegistry,
  command: RuntimeCameraCommand
): boolean {
  const camera = registry.get(command.cameraId);
  if (!camera) return false;
  if (command.type === "set-camera-state") {
    return registry.setState(command.cameraId, command.state);
  }
  if (command.type === "toggle-camera-projection") {
    return registry.setState(command.cameraId, {
      ...camera.state,
      projectionMode: camera.state.projectionMode === "orthographic" ? "perspective" : "orthographic",
      projection: {
        ...camera.state.projection,
        mode: camera.state.projectionMode === "orthographic" ? "perspective" : "orthographic"
      }
    });
  }
  if (command.type === "set-camera-projection-mode") {
    return registry.setState(command.cameraId, {
      ...camera.state,
      projectionMode: command.mode,
      projection: {
        ...camera.state.projection,
        mode: command.mode
      }
    });
  }
  if (command.type === "snap-camera-axis") {
    return registry.setState(command.cameraId, {
      ...camera.state,
      orbit: {
        target: camera.state.orbit?.target ?? camera.state.pose.target ?? [0, 0, 0],
        distance: camera.state.orbit?.distance ?? 1,
        yaw: camera.state.orbit?.yaw ?? 0,
        pitch: camera.state.orbit?.pitch ?? 0,
        roll: camera.state.orbit?.roll,
        snapAxis: command.axis
      }
    });
  }
  if (command.type === "resize-camera-projection") {
    return registry.setState(command.cameraId, {
      ...camera.state,
      projection: {
        ...camera.state.projection,
        mode: camera.state.projection?.mode ?? camera.state.projectionMode ?? "perspective",
        viewport: command.viewport,
        orthographicHeight: command.distance
      }
    });
  }
  return registry.setState(command.cameraId, {
    ...camera.state,
    pose: {
      ...camera.state.pose,
      position: [
        camera.state.pose.position[0] + command.delta.yaw,
        camera.state.pose.position[1] + command.delta.pitch,
        camera.state.pose.position[2]
      ]
    }
  });
}

describe("runtime camera command fixture", () => {
  it("commands cameras by runtime id without direct object mutation", () => {
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

    expect(submitCameraCommand(registry, { type: "orbit-camera-delta", cameraId: cameraA, delta: { yaw: 1, pitch: 2 } })).toBe(true);
    expect(submitCameraCommand(registry, { type: "toggle-camera-projection", cameraId: cameraA })).toBe(true);
    expect(submitCameraCommand(registry, { type: "set-camera-projection-mode", cameraId: cameraA, mode: "perspective" })).toBe(true);
    expect(submitCameraCommand(registry, { type: "resize-camera-projection", cameraId: cameraA, viewport: { width: 1280, height: 720 }, distance: 6 })).toBe(true);
    expect(submitCameraCommand(registry, { type: "snap-camera-axis", cameraId: cameraA, axis: "+z" })).toBe(true);
    expect(submitCameraCommand(registry, { type: "toggle-camera-projection", cameraId: runtimeCameraId("camera-3d:missing") })).toBe(false);

    expect(registry.get(cameraA)?.state).toMatchObject({
      pose: { position: [1, 2, 5] },
      projectionMode: "perspective",
      projection: {
        mode: "perspective",
        viewport: { width: 1280, height: 720 },
        orthographicHeight: 6
      },
      orbit: {
        snapAxis: "+z"
      }
    });
    expect(registry.get(cameraB)?.state.pose.position).toEqual([0, 0, 10]);
  });
});
