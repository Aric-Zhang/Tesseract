import type { Actor } from "../../actor-runtime";
import {
  createRuntimeSceneRenderOutput,
  type RuntimeSceneRendererFactory,
  type RuntimeSceneRenderOutput
} from "../../runtime/scene-render-output";
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
import type { ActorCreationContext } from "actor-core";
import type { WindowContentRegistrationPort } from "ui-framework";
import { createTesseract4Actor } from "../../tesseract4";
import type {
  SceneViewportResizeObserverFactory
} from "editor";
import {
  createSceneViewActor,
  type RegisteredSceneViewActor
} from "editor";

export interface SceneViewContentActorIds {
  readonly sceneWindowActorId: string;
  readonly sceneWindowActorName: string;
  readonly camera3GizmoActorId: string;
  readonly camera3GizmoActorName: string;
  readonly tesseract4ActorId: string;
  readonly tesseract4ActorName: string;
}

export interface InstallSceneViewContentOptions {
  readonly context: ActorCreationContext;
  readonly mount: HTMLElement;
  readonly parentFrameActor: Actor;
  readonly actorIds: SceneViewContentActorIds;
  readonly createRenderer?: RuntimeSceneRendererFactory;
  readonly createResizeObserver?: SceneViewportResizeObserverFactory;
  readonly createCamera3GizmoView?: Camera3GizmoViewFactory;
  readonly devicePixelRatio?: () => number;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
}

export interface InstalledSceneViewContent {
  readonly sceneView: RegisteredSceneViewActor;
  readonly camera3Motion: Camera3MotionComponent;
  readonly renderOutput: RuntimeSceneRenderOutput;
  disposeActorTree(): void;
}

export function installSceneViewContent(options: InstallSceneViewContentOptions): InstalledSceneViewContent {
  const { actorIds, context } = options;
  let sceneView: RegisteredSceneViewActor | null = null;

  try {
    const renderOutput = createRuntimeSceneRenderOutput({
      id: `${actorIds.sceneWindowActorId}:view:render-output`,
      createRenderer: options.createRenderer
    });
    sceneView = createSceneViewActor(context, {
      actorId: `${actorIds.sceneWindowActorId}:view`,
      actorName: `${actorIds.sceneWindowActorName} View`,
      parentActor: options.parentFrameActor,
      document: options.mount.ownerDocument ?? undefined,
      renderTarget: renderOutput,
      createResizeObserver: options.createResizeObserver,
      devicePixelRatio: options.devicePixelRatio,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration
    });

    context.componentRegistry.addComponent(sceneView.viewport.actor, camera3RigComponentType, { distance: 6 });
    const camera3Motion = context.componentRegistry.addComponent(
      sceneView.viewport.actor,
      camera3MotionComponentType
    );
    const camera3Gizmo = createCamera3GizmoActor(context, {
      actorId: actorIds.camera3GizmoActorId,
      actorName: actorIds.camera3GizmoActorName,
      initialViewState: camera3Motion.readViewState(),
      commandSink: camera3Motion,
      parent: sceneView.viewport.overlayElement,
      parentActor: sceneView.viewport.actor
    }, options.createCamera3GizmoView);
    context.componentRegistry.addComponent(sceneView.viewport.actor, sceneCamera3ViewportBindingComponentType, {
      camera3GizmoActorId: camera3Gizmo.actor.id
    });

    const tesseract4 = createTesseract4Actor(context, {
      actorId: actorIds.tesseract4ActorId,
      actorName: actorIds.tesseract4ActorName,
      parentActor: sceneView.viewport.actor
    });
    tesseract4.component.attachToOutput(renderOutput);

    const installedSceneView = sceneView;
    return {
      sceneView: installedSceneView,
      camera3Motion,
      renderOutput,
      disposeActorTree() {
        installedSceneView.dispose();
      }
    };
  } catch (error) {
    sceneView?.dispose();
    throw error;
  }
}
