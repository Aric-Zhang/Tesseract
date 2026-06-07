import { createRegisteredActor, type Actor, type RegisteredActor } from "../../actor-runtime";
import type { FeatureActorContext } from "../../runtime/ports";
import {
  sceneModeToggleComponentType,
  type SceneModeToggleComponent,
  sceneViewportComponentType,
  type SceneViewportRendererFactory,
  type SceneViewportResizeObserverFactory,
  type SceneViewportComponent
} from "./components";

export interface SceneViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  document?: Pick<Document, "createElement">;
  createRenderer?: SceneViewportRendererFactory;
  createResizeObserver?: SceneViewportResizeObserverFactory;
  devicePixelRatio?: () => number;
}

export interface RegisteredSceneViewActor extends RegisteredActor<SceneViewportComponent> {
  readonly viewport: SceneViewportComponent;
  readonly modeToggle: SceneModeToggleComponent;
  disposeRuntimeTracking?(): void;
}

export function createSceneViewActor(
  context: FeatureActorContext,
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
      createRenderer: options.createRenderer,
      createResizeObserver: options.createResizeObserver,
      devicePixelRatio: options.devicePixelRatio
    });
    const modeToggle = context.componentRegistry.addComponent(actor, sceneModeToggleComponentType, {
      id: "scene-mode-toggle",
      document: options.document
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
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
      dispose: () => baseHandle.dispose(),
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
