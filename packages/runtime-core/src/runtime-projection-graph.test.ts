import { describe, expect, it } from "vitest";
import {
  runtimeCameraId,
  runtimeFrameSourceId,
  runtimeProjectionId,
  runtimeWorldId
} from "./runtime-id";
import { RuntimeProjectionGraph } from "./runtime-projection-graph";

function createChain(graph: RuntimeProjectionGraph, suffix: string): void {
  const world4d = runtimeWorldId(`world-4d:${suffix}`);
  const world3d = runtimeWorldId(`world-3d:${suffix}`);
  const camera4d = runtimeCameraId(`camera-4d:${suffix}`);
  const camera3d = runtimeCameraId(`camera-3d:${suffix}`);
  const frameSource = runtimeFrameSourceId(`frame-source:${suffix}`);

  graph.addWorld({ id: world4d, kind: "world-4d" });
  graph.addWorld({ id: world3d, kind: "world-3d" });
  graph.addCamera({
    id: camera4d,
    kind: "camera-4d",
    sourceWorldId: world4d,
    state: { pose: { position: [0, 0, 0, 4] } }
  });
  graph.addCamera({
    id: camera3d,
    kind: "camera-3d",
    sourceWorldId: world3d,
    state: { pose: { position: [0, 0, 5] } }
  });
  graph.addFrameSource({ id: frameSource });
  graph.addProjection({
    id: runtimeProjectionId(`projection-4d-3d:${suffix}`),
    kind: "4d-to-3d",
    sourceWorldId: world4d,
    cameraId: camera4d,
    targetWorldId: world3d
  });
  graph.addProjection({
    id: runtimeProjectionId(`projection-3d-2d:${suffix}`),
    kind: "3d-to-2d",
    sourceWorldId: world3d,
    cameraId: camera3d,
    targetFrameSourceId: frameSource
  });
}

describe("RuntimeProjectionGraph", () => {
  it("represents independent 4D to 3D to 2D projection chains", () => {
    const graph = new RuntimeProjectionGraph();

    createChain(graph, "a");
    createChain(graph, "b");

    expect(graph.listWorlds()).toHaveLength(4);
    expect(graph.listCameras()).toHaveLength(4);
    expect(graph.listFrameSources()).toHaveLength(2);
    expect(graph.listProjections()).toHaveLength(4);
    expect(graph.validate()).toEqual([]);
  });

  it("rejects dimension mismatches and dangling targets", () => {
    const graph = new RuntimeProjectionGraph();
    graph.addWorld({ id: runtimeWorldId("world-3d:a"), kind: "world-3d" });

    expect(() => graph.addCamera({
      id: runtimeCameraId("camera-4d:a"),
      kind: "camera-4d",
      sourceWorldId: runtimeWorldId("world-3d:a"),
      state: { pose: { position: [0, 0, 0, 4] } }
    })).toThrow(/cannot project/);
  });

  it("removes dependent projections when graph nodes are removed", () => {
    const graph = new RuntimeProjectionGraph();
    createChain(graph, "a");

    graph.removeCamera(runtimeCameraId("camera-4d:a"));
    expect(graph.getProjection(runtimeProjectionId("projection-4d-3d:a"))).toBeNull();
    expect(graph.getProjection(runtimeProjectionId("projection-3d-2d:a"))).not.toBeNull();

    graph.removeWorld(runtimeWorldId("world-3d:a"));
    expect(graph.getProjection(runtimeProjectionId("projection-3d-2d:a"))).toBeNull();
  });
});
