import type { FeatureActorContext } from "../../runtime/ports";
import type { SceneParameterStore, Vec2 } from "../../scene-runtime";
import { sceneParameterPaths, vec2 } from "../../scene-runtime";
import type {
  FloatingWindowParameterPaths,
  FloatingWindowState,
  WindowFrameIntentSink,
  WindowFramePortRegistry,
  WindowTabDragSink,
  WindowViewFactoryRegistry,
  WindowViewLocationSource
} from "../../window-runtime";
import {
  createRenderableSceneView,
  CurrentRenderableSceneViewRegistry
} from "./renderable-scene-view";
import {
  installSceneViewContent,
  type SceneViewContentActorIds
} from "./scene-view-content-installer";

export interface InstallSceneViewFeatureOptions {
  readonly context: FeatureActorContext;
  readonly mount: HTMLElement;
  readonly sceneStore: SceneParameterStore;
  readonly sceneWindowState: FloatingWindowState;
  readonly actorIds: SceneViewContentActorIds;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
  readonly frameIntentSink: WindowFrameIntentSink;
  readonly framePortRegistry: WindowFramePortRegistry;
  readonly tabDragSink: WindowTabDragSink;
}

export interface InstalledSceneViewFeature {
  readonly renderableSceneViews: CurrentRenderableSceneViewRegistry;
}

export function installSceneViewFeature(options: InstallSceneViewFeatureOptions): InstalledSceneViewFeature {
  const renderableSceneViews = new CurrentRenderableSceneViewRegistry();
  options.viewFactories.register({
    viewKey: "scene",
    label: options.actorIds.sceneWindowActorName,
    order: 0,
    createViewRuntime: (createOptions) => {
      const content = installSceneViewContent({
        context: options.context,
        mount: options.mount,
        parentFrameActor: createOptions.parentFrameActor,
        initialState: readFloatingWindowState(options.sceneStore, sceneParameterPaths.sceneWindow, {
          fallback: options.sceneWindowState,
          forceVisible: createOptions.reason === "menu"
        }),
        actorIds: options.actorIds,
        frameIntentSink: options.frameIntentSink,
        framePortRegistry: options.framePortRegistry,
        tabDragSink: options.tabDragSink
      });
      const renderable = createRenderableSceneView({
        actorSystem: options.context.actorSystem,
        locations: options.locations,
        sceneView: content.sceneView,
        camera3Motion: content.camera3Motion
      });
      renderableSceneViews.setCurrent(renderable);
      return {
        viewActor: content.sceneView.viewport.actor,
        content: content.sceneView.viewport,
        title: options.actorIds.sceneWindowActorName,
        disposeViewRuntime: () => {
          renderableSceneViews.clear(renderable);
          content.sceneView.disposeRuntimeTracking?.();
        }
      };
    }
  });
  return { renderableSceneViews };
}

function readFloatingWindowState(
  store: SceneParameterStore,
  paths: FloatingWindowParameterPaths,
  options: {
    readonly fallback: FloatingWindowState;
    readonly forceVisible?: boolean;
  }
): FloatingWindowState {
  const position = readVec2(store, paths.position, options.fallback.position);
  const size = readVec2(store, paths.size, options.fallback.size);
  const visible = options.forceVisible ? true : store.get<boolean>(paths.visible);
  return { position, size, visible };
}

function readVec2(
  store: SceneParameterStore,
  path: FloatingWindowParameterPaths["position"] | FloatingWindowParameterPaths["size"],
  fallback: Vec2
): Vec2 {
  const value = store.get<Vec2>(path);
  return value ? vec2(value.x, value.y) : vec2(fallback.x, fallback.y);
}
