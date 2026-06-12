import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import type { WindowContentRegistrationPort } from "../../window-runtime";
import {
  debugLogContentComponentType,
  type DebugLogContentComponent
} from "./debug-log-content-component";

export interface DebugLogViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  maxLines?: number;
  document?: Pick<Document, "createElement">;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
}

export interface RegisteredDebugLogViewActor extends RegisteredActor<DebugLogContentComponent> {
  disposeRuntimeTracking?(): void;
}

export function createDebugLogViewActor(
  context: ActorCreationContext,
  options: DebugLogViewActorOptions
): RegisteredDebugLogViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, debugLogContentComponentType, {
      id: "debug-log-content",
      maxLines: options.maxLines,
      document: options.document,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration
    });
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredDebugLogViewActor = {
      actor: baseHandle.actor,
      component: baseHandle.component,
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
