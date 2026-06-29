import type { ActorCreationContext } from "actor-system/core";
import {
  createCamera3GizmoActor,
  createDefaultSceneWindowState,
  createSceneViewActor,
  editorWindowLayoutPaths,
  registerSceneWindowParameters,
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH,
  SCENE_WINDOW_PRIORITY_DEVELOP,
  type Camera3GizmoViewFactory,
  type RegisteredSceneViewActor
} from "editor";
import type { AppStateParameterStore } from "editor";
import type {
  FullscreenableViewIntent,
  FullscreenableViewIntentSink,
  RenderViewportResizeObserverFactory
} from "ui-framework";
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
  type RuntimeSceneViewVisibilityPort,
  type RuntimeSceneViewRuntime
} from "wallpaper-runtime";
import {
  sceneCamera3ViewportBindingComponentType
} from "./components/scene-camera3-viewport-binding-component";

const SCENE_VIEW_WINDOW_ACTOR_ID = "scene-window";
const SCENE_VIEW_WINDOW_ACTOR_NAME = "Scene";
const SCENE_VIEW_ACTOR_ID = `${SCENE_VIEW_WINDOW_ACTOR_ID}:view`;
const SCENE_VIEW_ACTOR_NAME = `${SCENE_VIEW_WINDOW_ACTOR_NAME} View`;
const SCENE_VIEW_CAMERA_ACTOR_ID = `${SCENE_VIEW_ACTOR_ID}:camera-3`;
const SCENE_VIEW_CAMERA_ACTOR_NAME = "Camera3";
const CAMERA3_GIZMO_OVERLAY_LAYER = 100;

export interface InstallSceneViewFeatureOptions {
  readonly context: ActorCreationContext;
  readonly mount: HTMLElement;
  readonly runtimeSceneViews: RuntimeSceneViewRuntimeRegistry;
  readonly viewFactories: WindowViewFactoryRegistry;
  readonly locations: WindowViewLocationSource;
  readonly workspacePresentation: SceneFullscreenPresentationPort;
  readonly createResizeObserver?: RenderViewportResizeObserverFactory;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
}

export interface SceneFullscreenPresentationPort {
  enterRunFullscreenForView(viewActorId: string, reason: "programmatic"): void;
  exitRunFullscreen(reason: "programmatic"): void;
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
        const fullscreenIntentSink: FullscreenableViewIntentSink = {
          requestFullscreen(intent) {
            handleSceneFullscreenIntent(intent, sceneView, options.workspacePresentation, () => {
              options.runtimeSceneViews.measureCurrentView();
            });
          }
        };
        sceneView = createSceneViewActor(options.context, {
          actorId: SCENE_VIEW_ACTOR_ID,
          actorName: SCENE_VIEW_ACTOR_NAME,
          parentActor: createOptions.parentFrameActor,
          document: options.mount.ownerDocument ?? undefined,
          renderTarget: runtimeScene.renderTarget,
          createResizeObserver: options.createResizeObserver,
          devicePixelRatio: options.devicePixelRatio,
          contentId: createWindowWorkspaceContentId(createOptions.identity),
          contentRegistration: createOptions.contentRegistration,
          fullscreenIntentSink
        });
        const presentation = createSceneRenderViewPresentation({
          sceneView,
          actorSystem: options.context.actorSystem,
          locations: options.locations
        });
        const runtimeContent = runtimeScene.attachSceneView({
          context: options.context,
          sceneActor: sceneView.sceneActor,
          presentation
        });
        const camera3Gizmo = createCamera3GizmoActor(options.context, {
          actorId: SCENE_VIEW_CAMERA_ACTOR_ID,
          actorName: SCENE_VIEW_CAMERA_ACTOR_NAME,
          initialViewState: runtimeContent.camera3Motion.readViewState(),
          commandSink: runtimeContent.camera3Motion,
          parentActor: sceneView.sceneActor,
          document: options.mount.ownerDocument ?? undefined,
          layoutItem: {
            id: "scene-camera3-overlay-layout-item",
            slot: "overlay",
            layer: CAMERA3_GIZMO_OVERLAY_LAYER,
            stretch: "none"
          }
        }, options.createCamera3GizmoView);
        options.context.componentRegistry.addComponent(sceneView.sceneActor, sceneCamera3ViewportBindingComponentType, {
          camera3GizmoActorId: camera3Gizmo.actor.id,
          renderViewportActorId: sceneView.worldRenderActor.id
        });
        const installedSceneView = sceneView;
        return {
          viewActor: installedSceneView.sceneActor,
          content: installedSceneView.content,
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

function createSceneRenderViewPresentation(options: {
  readonly sceneView: RegisteredSceneViewActor;
  readonly actorSystem: ActorCreationContext["actorSystem"];
  readonly locations: WindowViewLocationSource;
}): RuntimeSceneViewVisibilityPort {
  const viewActorId = options.sceneView.sceneActor.id;
  return {
    viewActorId,
    measureNow() {
      options.sceneView.renderViewport.measureNow();
    },
    isVisibleInCurrentLocation() {
      const location = options.locations.getLocationByViewActorId(viewActorId);
      return location !== null &&
        location.ownerFrameVisible &&
        location.ownerFrameActiveInHierarchy &&
        location.visibleInFrame &&
        options.actorSystem.hasActor(options.sceneView.sceneActor) &&
        options.actorSystem.isActorActive(options.sceneView.sceneActor);
    }
  };
}

function handleSceneFullscreenIntent(
  intent: FullscreenableViewIntent,
  sceneView: RegisteredSceneViewActor | null,
  presentation: SceneFullscreenPresentationPort,
  onPresentationChanged: () => void
): void {
  if (!sceneView) return;
  if (intent.sourceActorId !== sceneView.worldRenderActor.id) return;
  if (intent.kind === "enter") {
    presentation.enterRunFullscreenForView(sceneView.sceneActor.id, "programmatic");
    sceneView.fullscreenableView.setFullscreen(true);
  } else {
    presentation.exitRunFullscreen("programmatic");
    sceneView.fullscreenableView.setFullscreen(false);
  }
  onPresentationChanged();
}
