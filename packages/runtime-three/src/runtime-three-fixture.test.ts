import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { runtimeCameraId, runtimeFrameSourceId, runtimeWorldId } from "runtime-core";
import { RuntimeThreeCameraBackend } from "./runtime-three-camera-backend";
import { RuntimeThreeFrameSource } from "./runtime-three-frame-source";
import { RuntimeThreeRendererBackend, type RuntimeThreeRendererLike } from "./runtime-three-renderer-backend";
import { RuntimeThreeSceneBackend } from "./runtime-three-scene-backend";
import type { RuntimeThreeRenderable } from "./runtime-three-renderable";

describe("runtime-three backend fixture", () => {
  it("realizes runtime camera, scene renderable, renderer, and frame source without editor/UI ownership", () => {
    const camera = new RuntimeThreeCameraBackend({
      id: runtimeCameraId("camera:main"),
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world:3d"),
      state: {
        pose: {
          position: [1, 2, 3],
          target: [0, 0, 0],
          up: [0, 1, 0]
        },
        projectionMode: "perspective"
      }
    });
    const scene = new RuntimeThreeSceneBackend();
    const disposeRenderable = vi.fn();
    const renderable: RuntimeThreeRenderable = {
      id: runtimeWorldId("world:3d"),
      object: new THREE.Object3D(),
      dispose: disposeRenderable
    };
    scene.attach(renderable);

    const render = vi.fn();
    const setSize = vi.fn();
    const disposeRenderer = vi.fn();
    const rendererLike: RuntimeThreeRendererLike = {
      render,
      setSize,
      dispose: disposeRenderer
    };
    const renderer = new RuntimeThreeRendererBackend(rendererLike);
    renderer.resize(320, 200);
    renderer.render(scene, camera);

    const frameSource = new RuntimeThreeFrameSource(runtimeFrameSourceId("frame:main"));
    const snapshot = frameSource.publishRendered({ width: 320, height: 200 });

    expect(scene.has(renderable.id)).toBe(true);
    expect(setSize).toHaveBeenCalledWith(320, 200);
    expect(render).toHaveBeenCalledWith(scene.scene, camera.object);
    expect(snapshot).toMatchObject({
      revision: 1,
      status: "ready",
      payload: { rendered: true, width: 320, height: 200 }
    });

    scene.dispose();
    renderer.dispose();
    renderer.dispose();
    expect(disposeRenderable).toHaveBeenCalledTimes(1);
    expect(disposeRenderer).toHaveBeenCalledTimes(1);
  });

  it("can switch camera realization between perspective and orthographic state", () => {
    const backend = new RuntimeThreeCameraBackend({
      id: runtimeCameraId("camera:main"),
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world:3d"),
      state: {
        pose: { position: [0, 0, 5], target: [0, 0, 0] },
        projectionMode: "perspective"
      }
    });

    expect(backend.object).toBeInstanceOf(THREE.PerspectiveCamera);
    backend.applyState({
      pose: { position: [0, 0, 5], target: [0, 0, 0] },
      projectionMode: "orthographic"
    });
    expect(backend.object).toBeInstanceOf(THREE.OrthographicCamera);
  });

  it("applies runtime projection viewport and orthographic height to Three cameras", () => {
    const backend = new RuntimeThreeCameraBackend({
      id: runtimeCameraId("camera:main"),
      kind: "camera-3d",
      sourceWorldId: runtimeWorldId("world:3d"),
      state: {
        pose: { position: [0, 0, 5], target: [0, 0, 0] },
        projection: {
          mode: "orthographic",
          fov: 60,
          viewport: { width: 1200, height: 600 },
          orthographicHeight: 8
        }
      }
    });

    expect(backend.object).toBeInstanceOf(THREE.OrthographicCamera);
    const camera = backend.object as THREE.OrthographicCamera;
    expect(camera.left).toBeCloseTo(-8);
    expect(camera.right).toBeCloseTo(8);
    expect(camera.top).toBeCloseTo(4);
    expect(camera.bottom).toBeCloseTo(-4);
  });

  it("publishes render failures explicitly", () => {
    const frameSource = new RuntimeThreeFrameSource(runtimeFrameSourceId("frame:main"));

    expect(frameSource.publishFailed(new Error("lost context"))).toMatchObject({
      revision: 1,
      status: "failed",
      error: {
        code: "runtime-three-render",
        message: "lost context"
      }
    });
  });
});
