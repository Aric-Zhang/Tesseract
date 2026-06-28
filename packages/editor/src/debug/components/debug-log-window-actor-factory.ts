import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import {
  listViewComponentType,
  scrollViewComponentType,
  uiElementComponentType,
  type WindowContentRegistrationPort
} from "ui-framework";
import {
  debugLogContentComponentType,
  type DebugLogContentComponent
} from "./debug-log-content-component";
import { DebugLogEntryActorReconciler } from "./debug-log-entry-actor-reconciler";

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
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "debug-log-window",
      document: options.document
    });
    context.componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });
    context.componentRegistry.addComponent(actor, listViewComponentType, {
      textStyle: "mono",
      textWrap: "wrap"
    });
    const component = context.componentRegistry.addComponent(actor, debugLogContentComponentType, {
      id: "debug-log-content",
      maxLines: options.maxLines,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration,
      itemReconciler: new DebugLogEntryActorReconciler(context, actor)
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
