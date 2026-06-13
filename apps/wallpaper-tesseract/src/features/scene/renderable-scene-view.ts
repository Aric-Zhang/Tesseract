import {
  createRuntimeRegistration,
  RuntimeMutableFrameSource,
  runtimeFrameSourceId,
  type RuntimeFrameSource,
  type RuntimeRegistration
} from "runtime-core";
import type { Camera3MotionComponent } from "../../runtime/camera3/camera3-motion-component";
import type { EditorSceneViewHost } from "editor";
import type { RuntimeThreeSceneRenderOutput } from "runtime-three";

export interface RenderableSceneView {
  readonly viewActorId: string;
  measureNow(): void;
  isRenderable(): boolean;
  render(): void;
}

export interface RenderableSceneViewSource {
  readonly current: RenderableSceneView | null;
}

export interface SceneViewFrameSourcePayload {
  readonly renderable: boolean;
}

export interface RenderableSceneViewRegistry extends RenderableSceneViewSource {
  register(view: RenderableSceneView): RuntimeRegistration;
  listFrameSources(): readonly RuntimeFrameSource<SceneViewFrameSourcePayload>[];
}

interface SceneViewFrameSourceEntry {
  readonly view: RenderableSceneView;
  readonly source: RuntimeMutableFrameSource<SceneViewFrameSourcePayload>;
}

export class SceneViewFrameSourceRegistry implements RenderableSceneViewRegistry {
  readonly #entries = new Map<string, SceneViewFrameSourceEntry>();
  #nextSourceIndex = 0;

  get current(): RenderableSceneView | null {
    for (const entry of this.#entries.values()) {
      const snapshot = refreshSceneViewFrameSource(entry.source, entry.view);
      if (snapshot.status === "ready" && snapshot.payload?.renderable === true) {
        return entry.view;
      }
    }
    return null;
  }

  register(view: RenderableSceneView): RuntimeRegistration {
    const source = new RuntimeMutableFrameSource<SceneViewFrameSourcePayload>({
      id: runtimeFrameSourceId(`scene-view-frame-source:${++this.#nextSourceIndex}`),
      label: "Scene View"
    });
    this.#entries.set(view.viewActorId, { view, source });
    refreshSceneViewFrameSource(source, view);
    return createRuntimeRegistration(() => {
      const entry = this.#entries.get(view.viewActorId);
      if (entry?.view === view) {
        this.#entries.delete(view.viewActorId);
      }
    });
  }

  listFrameSources(): readonly RuntimeFrameSource<SceneViewFrameSourcePayload>[] {
    return [...this.#entries.values()].map((entry) => entry.source);
  }
}

export interface CreateRenderableSceneViewOptions {
  readonly host: EditorSceneViewHost;
  readonly camera3Motion: Camera3MotionComponent;
  readonly renderOutput: RuntimeThreeSceneRenderOutput;
}

export function createRenderableSceneView(options: CreateRenderableSceneViewOptions): RenderableSceneView {
  return {
    viewActorId: options.host.viewActorId,
    measureNow() {
      options.host.measureNow();
    },
    isRenderable() {
      return options.host.isVisibleInCurrentLocation();
    },
    render() {
      if (!options.host.isVisibleInCurrentLocation()) return;
      options.renderOutput.render(options.camera3Motion.getRuntimeThreeCameraForRender());
    }
  };
}

function refreshSceneViewFrameSource(
  source: RuntimeMutableFrameSource<SceneViewFrameSourcePayload>,
  view: RenderableSceneView
) {
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
