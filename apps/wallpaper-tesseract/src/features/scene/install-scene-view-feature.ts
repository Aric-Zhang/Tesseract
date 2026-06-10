import type { FeatureActorContext } from "../../runtime/ports";
import { editorWindowLayoutPaths } from "../../editor/window-layout-state";
import type {
  WindowViewFactoryRegistry,
  WindowViewLocationSource
} from "../../window-runtime";
import { uiVec2 } from "../../window-runtime";
import type {
  WindowWorkspaceDefaultOpenView,
  WindowWorkspaceFloatingFramePolicy
} from "../window-workspace";
import { WORKSPACE_ROOT_FRAME_ID } from "../../window-runtime";
import { createEditorSceneViewHost } from "./editor-scene-view-host";
import {
  createRenderableSceneView,
  SceneViewFrameSourceRegistry
} from "./renderable-scene-view";
import {
  installSceneViewContent,
  type SceneViewContentActorIds
} from "./scene-view-content-installer";
import {
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP
} from "./scene-window-state";

export interface InstallSceneViewFeatureOptions {
  readonly context: FeatureActorContext;
  readonly mount: HTMLElement;
  readonly actorIds: SceneViewContentActorIds;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
}

export interface InstalledSceneViewFeature {
  readonly renderableSceneViews: SceneViewFrameSourceRegistry;
}

export function createSceneWindowWorkspaceFloatingFramePolicy(
  fallbackState: WindowWorkspaceFloatingFramePolicy["fallbackState"]
): readonly ["scene", WindowWorkspaceFloatingFramePolicy] {
  return ["scene", {
    preferredActorId: "scene-window",
    preferredComponentId: "floating-window:scene",
    paths: editorWindowLayoutPaths.sceneWindow,
    fallbackState,
    minSize: uiVec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT),
    className: "scene-window",
    contentClassName: "scene-window__content",
    priority: SCENE_WINDOW_PRIORITY_DEVELOP,
    menuOrder: 0
  }];
}

export function createSceneDefaultOpenView(): WindowWorkspaceDefaultOpenView {
  return { viewKey: "scene", preferredFrameId: WORKSPACE_ROOT_FRAME_ID };
}

export function installSceneViewFeature(options: InstallSceneViewFeatureOptions): InstalledSceneViewFeature {
  const renderableSceneViews = new SceneViewFrameSourceRegistry();
  options.viewFactories.register({
    viewKey: "scene",
    label: options.actorIds.sceneWindowActorName,
    order: 0,
    createViewRuntime: (createOptions) => {
      const content = installSceneViewContent({
        context: options.context,
        mount: options.mount,
        parentFrameActor: createOptions.parentFrameActor,
        actorIds: options.actorIds
      });
      const host = createEditorSceneViewHost({
        actorSystem: options.context.actorSystem,
        locations: options.locations,
        sceneView: content.sceneView
      });
      const renderable = createRenderableSceneView({
        host,
        camera3Motion: content.camera3Motion
      });
      const renderableRegistration = renderableSceneViews.register(renderable);
      return {
        viewActor: content.sceneView.viewport.actor,
        content: content.sceneView.viewport,
        title: options.actorIds.sceneWindowActorName,
        disposeViewRuntime: () => {
          renderableRegistration.dispose();
          content.sceneView.disposeRuntimeTracking?.();
        }
      };
    }
  });
  return { renderableSceneViews };
}
