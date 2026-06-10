import { describe, expect, it, vi } from "vitest";
import { createRenderableSceneViewFrameSource, refreshRenderableSceneViewFrameSource } from "./runtime-frame-source-adapter";
import type { RenderableSceneView } from "../features/scene";

describe("runtime frame source adapter", () => {
  it("publishes Scene View renderability without owning render or dispose behavior", () => {
    const view: RenderableSceneView = {
      viewActorId: "scene-view-actor",
      measureNow: vi.fn(),
      isRenderable: vi.fn(() => true),
      render: vi.fn()
    };

    const source = createRenderableSceneViewFrameSource({
      sourceId: "scene-frame-source",
      view
    });

    expect(source.getSnapshot()).toMatchObject({
      revision: 1,
      status: "ready",
      payload: { renderable: true }
    });
    expect(view.render).not.toHaveBeenCalled();
    expect(view.measureNow).not.toHaveBeenCalled();
  });

  it("publishes failure status when the current Scene View cannot report renderability", () => {
    const view: RenderableSceneView = {
      viewActorId: "scene-view-actor",
      measureNow: vi.fn(),
      isRenderable: vi.fn(() => {
        throw new Error("stale scene location");
      }),
      render: vi.fn()
    };

    const source = createRenderableSceneViewFrameSource({
      sourceId: "scene-frame-source",
      view
    });
    const snapshot = refreshRenderableSceneViewFrameSource(source, view);

    expect(snapshot).toMatchObject({
      revision: 2,
      status: "failed",
      error: {
        code: "scene-view-frame-source",
        message: "stale scene location"
      }
    });
    expect(view.render).not.toHaveBeenCalled();
  });
});

