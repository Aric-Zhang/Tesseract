import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import type { WindowContentRegistrationPort } from "../../window-runtime";
import {
  sceneModeToggleComponentType,
  type SceneModeToggleComponent,
  sceneViewportComponentType,
  type SceneViewportRenderTarget,
  type SceneViewportResizeObserverFactory,
  type SceneViewportComponent
} from "./components";

export interface SceneViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  document?: Pick<Document, "createElement">;
  createResizeObserver?: SceneViewportResizeObserverFactory;
  renderTarget: SceneViewportRenderTarget;
  devicePixelRatio?: () => number;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
}

export interface RegisteredSceneViewActor extends RegisteredActor<SceneViewportComponent> {
  readonly viewport: SceneViewportComponent;
  readonly modeToggle: SceneModeToggleComponent;
  disposeRuntimeTracking?(): void;
}

export function createSceneViewActor(
  context: ActorCreationContext,
  options: SceneViewActorOptions
): RegisteredSceneViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const viewport = context.componentRegistry.addComponent(actor, sceneViewportComponentType, {
      id: "scene-viewport",
      document: options.document,
      renderTarget: options.renderTarget,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration,
      createResizeObserver: options.createResizeObserver,
      devicePixelRatio: options.devicePixelRatio
    });
    const modeToggle = context.componentRegistry.addComponent(actor, sceneModeToggleComponentType, {
      id: "scene-mode-toggle",
      document: options.document
    });
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component: viewport,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredSceneViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
      viewport,
      modeToggle,
      dispose: () => {
        baseHandle.dispose();
      },
      disposeRuntimeTracking: () => {
        untrack?.dispose();
        untrack = null;
      }
    };
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}
