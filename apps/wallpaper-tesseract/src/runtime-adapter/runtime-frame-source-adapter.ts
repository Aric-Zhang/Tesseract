import {
  RuntimeMutableFrameSource,
  runtimeFrameSourceId,
  type RuntimeFrameSourceId,
  type RuntimeFrameSourceSnapshot
} from "runtime-core";
import type { RenderableSceneView } from "../features/scene";

export interface RenderableSceneViewFrameSourcePayload {
  readonly renderable: boolean;
}

export interface RenderableSceneViewFrameSourceOptions {
  readonly sourceId: RuntimeFrameSourceId | string;
  readonly label?: string;
  readonly view: RenderableSceneView;
}

// Phase 4D bridge. It observes Scene View renderability but does not own rendering or disposal.
export function createRenderableSceneViewFrameSource(
  options: RenderableSceneViewFrameSourceOptions
): RuntimeMutableFrameSource<RenderableSceneViewFrameSourcePayload> {
  const source = new RuntimeMutableFrameSource<RenderableSceneViewFrameSourcePayload>({
    id: typeof options.sourceId === "string" ? runtimeFrameSourceId(options.sourceId) : options.sourceId,
    label: options.label ?? "Renderable Scene View"
  });
  refreshRenderableSceneViewFrameSource(source, options.view);
  return source;
}

export function refreshRenderableSceneViewFrameSource(
  source: RuntimeMutableFrameSource<RenderableSceneViewFrameSourcePayload>,
  view: RenderableSceneView
): RuntimeFrameSourceSnapshot<RenderableSceneViewFrameSourcePayload> {
  try {
    return source.publish({
      status: "ready",
      payload: {
        renderable: view.isRenderable()
      }
    });
  } catch (error) {
    return source.publish({
      status: "failed",
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: "scene-view-frame-source"
      }
    });
  }
}

