import type { Actor } from "../../actor-runtime";
import {
  camera3MotionComponentType,
  camera3RigComponentType,
  sceneCamera3ViewportBindingComponentType,
  type Camera3MotionComponent
} from "../camera3/components";
import {
  createCamera3GizmoActor
} from "../../gizmos/camera3";
import type { Camera3GizmoViewFactory } from "../../gizmos/camera3/components";
import type { FeatureActorContext } from "../../runtime/ports";
import { createTesseract4Actor } from "../../tesseract4";
import type {
  FloatingWindowState,
  WindowFrameIntentSink,
  WindowFramePortRegistry,
  WindowTabDragSink
} from "../../window-runtime";
import type {
  SceneViewportRendererFactory,
  SceneViewportResizeObserverFactory
} from "./components";
import {
  createSceneViewActor,
  createSceneWindowActor,
  type RegisteredSceneViewActor,
  type RegisteredSceneWindowActor
} from "./scene-window-actor-factory";

export interface SceneViewContentActorIds {
  readonly sceneWindowActorId: string;
  readonly sceneWindowActorName: string;
  readonly camera3GizmoActorId: string;
  readonly camera3GizmoActorName: string;
  readonly tesseract4ActorId: string;
  readonly tesseract4ActorName: string;
}

export interface InstallSceneViewContentOptions {
  readonly context: FeatureActorContext;
  readonly mount: HTMLElement;
  readonly parentFrameActor?: Actor;
  readonly initialState: FloatingWindowState;
  readonly actorIds: SceneViewContentActorIds;
  readonly createRenderer?: SceneViewportRendererFactory;
  readonly createResizeObserver?: SceneViewportResizeObserverFactory;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
  readonly frameIntentSink?: WindowFrameIntentSink;
  readonly framePortRegistry?: WindowFramePortRegistry;
  readonly tabDragSink?: WindowTabDragSink;
}

export interface InstalledSceneViewContent {
  readonly sceneView: RegisteredSceneViewActor;
  readonly sceneWindow: RegisteredSceneWindowActor | null;
  readonly camera3Motion: Camera3MotionComponent;
  disposeActorTree(): void;
}

export function installSceneViewContent(options: InstallSceneViewContentOptions): InstalledSceneViewContent {
  const { actorIds, context } = options;
  let sceneView: RegisteredSceneViewActor | null = null;
  let sceneWindow: RegisteredSceneWindowActor | null = null;

  try {
    if (options.parentFrameActor) {
      sceneView = createSceneViewActor(context, {
        actorId: `${actorIds.sceneWindowActorId}:view`,
        actorName: `${actorIds.sceneWindowActorName} View`,
        parentActor: options.parentFrameActor,
        document: options.mount.ownerDocument ?? undefined,
        createRenderer: options.createRenderer,
        createResizeObserver: options.createResizeObserver,
        devicePixelRatio: options.devicePixelRatio
      });
    } else {
      sceneWindow = createSceneWindowActor(context, {
        actorId: actorIds.sceneWindowActorId,
        actorName: actorIds.sceneWindowActorName,
        parent: options.mount,
        initialState: options.initialState,
        createRenderer: options.createRenderer,
        createResizeObserver: options.createResizeObserver,
        devicePixelRatio: options.devicePixelRatio,
        frameIntentSink: options.frameIntentSink,
        framePortRegistry: options.framePortRegistry,
        tabDragSink: options.tabDragSink
      });
      sceneView = sceneWindow;
    }

    context.componentRegistry.addComponent(sceneView.viewport.actor, camera3RigComponentType, { distance: 6 });
    const camera3Motion = context.componentRegistry.addComponent(
      sceneView.viewport.actor,
      camera3MotionComponentType
    );
    const camera3Gizmo = createCamera3GizmoActor(context, {
      actorId: actorIds.camera3GizmoActorId,
      actorName: actorIds.camera3GizmoActorName,
      projectionMode: camera3Motion.projectionMode,
      commandSink: camera3Motion,
      parent: sceneView.viewport.overlayElement,
      parentActor: sceneView.viewport.actor
    }, options.createCamera3GizmoView);
    context.componentRegistry.addComponent(sceneView.viewport.actor, sceneCamera3ViewportBindingComponentType, {
      camera3GizmoActorId: camera3Gizmo.actor.id
    });

    createTesseract4Actor(context, {
      actorId: actorIds.tesseract4ActorId,
      actorName: actorIds.tesseract4ActorName,
      scene: sceneView.viewport.scene,
      parentActor: sceneView.viewport.actor
    });

    const installedSceneView = sceneView;
    const installedSceneWindow = sceneWindow;
    return {
      sceneView: installedSceneView,
      sceneWindow,
      camera3Motion,
      disposeActorTree() {
        (installedSceneWindow ?? installedSceneView).dispose();
      }
    };
  } catch (error) {
    (sceneWindow ?? sceneView)?.dispose();
    throw error;
  }
}
