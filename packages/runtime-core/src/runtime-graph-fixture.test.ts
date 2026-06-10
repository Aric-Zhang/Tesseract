import { describe, expect, it } from "vitest";
import { RuntimeFrameClock, RuntimeScheduler, type RuntimeWork } from "./runtime-frame";
import { RuntimeMutableFrameSource } from "./runtime-frame-source";
import {
  runtimeFrameSourceId,
  runtimeProjectionId,
  runtimeWorldId
} from "./runtime-id";
import { RuntimeProjectionGraph } from "./runtime-projection-graph";
import { runtimeCameraId } from "./runtime-id";

describe("headless runtime graph fixture", () => {
  it("updates multiple worlds and frame sources without editor, DOM, or Three", () => {
    const graph = new RuntimeProjectionGraph();
    const sourceA = new RuntimeMutableFrameSource<{ readonly frameIndex: number }>({
      id: runtimeFrameSourceId("frame-source:a")
    });
    const sourceB = new RuntimeMutableFrameSource<{ readonly frameIndex: number }>({
      id: runtimeFrameSourceId("frame-source:b")
    });

    for (const suffix of ["a", "b"]) {
      const world4d = runtimeWorldId(`world-4d:${suffix}`);
      const world3d = runtimeWorldId(`world-3d:${suffix}`);
      const camera4d = runtimeCameraId(`camera-4d:${suffix}`);
      const camera3d = runtimeCameraId(`camera-3d:${suffix}`);
      const frameSource = runtimeFrameSourceId(`frame-source:${suffix}`);
      graph.addWorld({ id: world4d, kind: "world-4d" });
      graph.addWorld({ id: world3d, kind: "world-3d" });
      graph.addCamera({ id: camera4d, kind: "camera-4d", sourceWorldId: world4d, state: { pose: { position: [0, 0, 0, 4] } } });
      graph.addCamera({ id: camera3d, kind: "camera-3d", sourceWorldId: world3d, state: { pose: { position: [0, 0, 5] } } });
      graph.addFrameSource({ id: frameSource });
      graph.addProjection({ id: runtimeProjectionId(`projection-4d-3d:${suffix}`), kind: "4d-to-3d", sourceWorldId: world4d, cameraId: camera4d, targetWorldId: world3d });
      graph.addProjection({ id: runtimeProjectionId(`projection-3d-2d:${suffix}`), kind: "3d-to-2d", sourceWorldId: world3d, cameraId: camera3d, targetFrameSourceId: frameSource });
    }

    const scheduler = new RuntimeScheduler();
    const publishFrameSource = (source: RuntimeMutableFrameSource<{ readonly frameIndex: number }>): RuntimeWork => ({
      updateRuntimeFrame(frame) {
        source.publish({ status: "ready", payload: { frameIndex: frame.frameIndex } });
      }
    });
    scheduler.register(publishFrameSource(sourceA));
    scheduler.register(publishFrameSource(sourceB));
    scheduler.update(new RuntimeFrameClock().tick(100));

    expect(graph.validate()).toEqual([]);
    expect(sourceA.getSnapshot()).toMatchObject({ revision: 1, payload: { frameIndex: 0 } });
    expect(sourceB.getSnapshot()).toMatchObject({ revision: 1, payload: { frameIndex: 0 } });
  });
});
