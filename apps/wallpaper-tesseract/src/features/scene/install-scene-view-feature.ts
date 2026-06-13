import type { ActorCreationContext } from "actor-core";
import {
  createCamera3GizmoActor,
  createEditorSceneViewHost,
  createSceneViewActor,
  editorWindowLayoutPaths,
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP,
  type Camera3GizmoViewFactory,
  type RegisteredSceneViewActor,
  type SceneViewportResizeObserverFactory
} from "editor";
import type {
  WindowViewFactoryRegistry,
  WindowViewLocationSource
} from "../../window-runtime";
import { createWindowWorkspaceContentId, uiVec2 } from "../../window-runtime";
import type {
  WindowWorkspaceDefaultOpenView,
  WindowWorkspaceFloatingFramePolicy
} from "../window-workspace";
import { WORKSPACE_ROOT_FRAME_ID } from "../../window-runtime";
import {
  createRenderableSceneView,
  SceneViewFrameSourceRegistry
} from "./renderable-scene-view";
import {
  createRuntimeSceneSession
} from "../../runtime/runtime-scene-session";
import {
  createRuntimeSceneContent,
  type RuntimeSceneContentActorIds
} from "../../runtime/runtime-scene-content";
import {
  sceneCamera3ViewportBindingComponentType
} from "./components";

export interface SceneViewContentActorIds extends RuntimeSceneContentActorIds {
  readonly sceneWindowActorName: string;
  readonly camera3GizmoActorId: string;
  readonly camera3GizmoActorName: string;
}

export interface InstallSceneViewFeatureOptions {
  readonly context: ActorCreationContext;
  readonly mount: HTMLElement;
  readonly actorIds: SceneViewContentActorIds;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
  readonly createResizeObserver?: SceneViewportResizeObserverFactory;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
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
      let sceneView: RegisteredSceneViewActor | null = null;
      const runtimeScene = createRuntimeSceneSession({
        id: `${options.actorIds.sceneWindowActorId}:view:render-output`
      });
      try {
        sceneView = createSceneViewActor(options.context, {
          actorId: `${options.actorIds.sceneWindowActorId}:view`,
          actorName: `${options.actorIds.sceneWindowActorName} View`,
          parentActor: createOptions.parentFrameActor,
          document: options.mount.ownerDocument ?? undefined,
          renderTarget: runtimeScene.renderTarget,
          createResizeObserver: options.createResizeObserver,
          devicePixelRatio: options.devicePixelRatio,
          contentId: createWindowWorkspaceContentId(createOptions.identity),
          contentRegistration: createOptions.contentRegistration
        });
        const runtimeContent = createRuntimeSceneContent({
          context: options.context,
          actorIds: options.actorIds,
          sceneActor: sceneView.viewport.actor,
          runtimeScene
        });
        const camera3Gizmo = createCamera3GizmoActor(options.context, {
          actorId: options.actorIds.camera3GizmoActorId,
          actorName: options.actorIds.camera3GizmoActorName,
          initialViewState: runtimeContent.camera3Motion.readViewState(),
          commandSink: runtimeContent.camera3Motion,
          parent: sceneView.viewport.overlayElement,
          parentActor: sceneView.viewport.actor
        }, options.createCamera3GizmoView);
        options.context.componentRegistry.addComponent(sceneView.viewport.actor, sceneCamera3ViewportBindingComponentType, {
          camera3GizmoActorId: camera3Gizmo.actor.id
        });
        const host = createEditorSceneViewHost({
          actorSystem: options.context.actorSystem,
          locations: options.locations,
          sceneView
        });
        const renderable = createRenderableSceneView({
          host,
          camera3Motion: runtimeContent.camera3Motion,
          renderOutput: runtimeContent.renderOutput
        });
        const renderableRegistration = renderableSceneViews.register(renderable);
        const installedSceneView = sceneView;
        return {
          viewActor: installedSceneView.viewport.actor,
          content: installedSceneView.viewport,
          title: options.actorIds.sceneWindowActorName,
          disposeViewRuntime: () => {
            try {
              renderableRegistration.dispose();
              installedSceneView.disposeRuntimeTracking?.();
            } finally {
              runtimeScene.dispose();
            }
          }
        };
      } catch (error) {
        try {
          sceneView?.dispose();
        } finally {
          runtimeScene.dispose();
        }
        throw error;
      }
    }
  });
  return { renderableSceneViews };
}
