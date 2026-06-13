import type { ActorCreationContext } from "actor-core";
import {
  createCamera3GizmoActor,
  createDefaultSceneWindowState,
  createEditorSceneViewHost,
  createSceneViewActor,
  editorWindowLayoutPaths,
  registerSceneWindowParameters,
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP,
  type Camera3GizmoViewFactory,
  type RegisteredSceneViewActor,
  type SceneViewportResizeObserverFactory
} from "editor";
import type { AppStateParameterStore } from "editor";
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
  RuntimeSceneViewRuntimeRegistry,
  type RuntimeSceneViewRuntime
} from "../../runtime/runtime-scene-view-runtime";
import {
  sceneCamera3ViewportBindingComponentType
} from "./components";

const SCENE_VIEW_WINDOW_ACTOR_ID = "scene-window";
const SCENE_VIEW_WINDOW_ACTOR_NAME = "Scene";
const SCENE_VIEW_ACTOR_ID = `${SCENE_VIEW_WINDOW_ACTOR_ID}:view`;
const SCENE_VIEW_ACTOR_NAME = `${SCENE_VIEW_WINDOW_ACTOR_NAME} View`;
const SCENE_VIEW_CAMERA_ACTOR_ID = `${SCENE_VIEW_ACTOR_ID}:camera-3`;
const SCENE_VIEW_CAMERA_ACTOR_NAME = "Camera3";

export interface InstallSceneViewFeatureOptions {
  readonly context: ActorCreationContext;
  readonly mount: HTMLElement;
  readonly runtimeSceneViews: RuntimeSceneViewRuntimeRegistry;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
  readonly createResizeObserver?: SceneViewportResizeObserverFactory;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
}

function createSceneWindowWorkspaceFloatingFramePolicy(
  fallbackState: WindowWorkspaceFloatingFramePolicy["fallbackState"]
): readonly ["scene", WindowWorkspaceFloatingFramePolicy] {
  return ["scene", {
    preferredActorId: SCENE_VIEW_WINDOW_ACTOR_ID,
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

function createSceneDefaultOpenView(): WindowWorkspaceDefaultOpenView {
  return { viewKey: "scene", preferredFrameId: WORKSPACE_ROOT_FRAME_ID };
}

export interface InstalledSceneWorkspacePolicy {
  readonly floatingFramePolicy: readonly ["scene", WindowWorkspaceFloatingFramePolicy];
  readonly defaultOpenView: WindowWorkspaceDefaultOpenView;
}

export function installSceneWorkspacePolicy(store: AppStateParameterStore): InstalledSceneWorkspacePolicy {
  const sceneWindowState = createDefaultSceneWindowState();
  registerSceneWindowParameters(store, sceneWindowState);
  return {
    floatingFramePolicy: createSceneWindowWorkspaceFloatingFramePolicy(sceneWindowState),
    defaultOpenView: createSceneDefaultOpenView()
  };
}

export function installSceneViewFeature(options: InstallSceneViewFeatureOptions): void {
  options.viewFactories.register({
    viewKey: "scene",
    label: SCENE_VIEW_WINDOW_ACTOR_NAME,
    order: 0,
    createViewRuntime: (createOptions) => {
      let sceneView: RegisteredSceneViewActor | null = null;
      const runtimeScene: RuntimeSceneViewRuntime = options.runtimeSceneViews.createRuntime({
        id: `${SCENE_VIEW_WINDOW_ACTOR_ID}:view:render-output`
      });
      try {
        sceneView = createSceneViewActor(options.context, {
          actorId: SCENE_VIEW_ACTOR_ID,
          actorName: SCENE_VIEW_ACTOR_NAME,
          parentActor: createOptions.parentFrameActor,
          document: options.mount.ownerDocument ?? undefined,
          renderTarget: runtimeScene.renderTarget,
          createResizeObserver: options.createResizeObserver,
          devicePixelRatio: options.devicePixelRatio,
          contentId: createWindowWorkspaceContentId(createOptions.identity),
          contentRegistration: createOptions.contentRegistration
        });
        const host = createEditorSceneViewHost({
          actorSystem: options.context.actorSystem,
          locations: options.locations,
          sceneView
        });
        const runtimeContent = runtimeScene.attachSceneView({
          context: options.context,
          sceneActor: sceneView.viewport.actor,
          presentation: host
        });
        const camera3Gizmo = createCamera3GizmoActor(options.context, {
          actorId: SCENE_VIEW_CAMERA_ACTOR_ID,
          actorName: SCENE_VIEW_CAMERA_ACTOR_NAME,
          initialViewState: runtimeContent.camera3Motion.readViewState(),
          commandSink: runtimeContent.camera3Motion,
          parent: sceneView.viewport.overlayElement,
          parentActor: sceneView.viewport.actor
        }, options.createCamera3GizmoView);
        options.context.componentRegistry.addComponent(sceneView.viewport.actor, sceneCamera3ViewportBindingComponentType, {
          camera3GizmoActorId: camera3Gizmo.actor.id
        });
        const installedSceneView = sceneView;
        return {
          viewActor: installedSceneView.viewport.actor,
          content: installedSceneView.viewport,
          title: SCENE_VIEW_WINDOW_ACTOR_NAME,
          disposeViewRuntime: () => {
            try {
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
}
