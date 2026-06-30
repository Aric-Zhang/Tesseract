import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-system/core";
import { uiElementComponentType } from "ui-framework/actor-ui";
import { type WindowContentRegistrationPort } from "ui-framework/window";
import { createActorSystemInspectorActorDisplaySource } from "./inspector-actor-display-source";
import {
  inspectorContentComponentType,
  type InspectorContentComponent
} from "./inspector-content-component";
import type { InspectorSelectionSnapshotSource } from "./inspector-selection-source";

export interface InspectorViewActorOptions {
  readonly actorId: string;
  readonly actorName: string;
  readonly parentActor: Actor;
  readonly document?: Pick<Document, "createElement">;
  readonly contentId: string;
  readonly contentRegistration: WindowContentRegistrationPort;
  readonly selectionSource: InspectorSelectionSnapshotSource;
  readonly initialLocked?: boolean;
  readonly initialInspectedActorId?: string | null;
}

export interface RegisteredInspectorViewActor extends RegisteredActor<InspectorContentComponent> {
  disposeRuntimeTracking?(): void;
}

export function createInspectorViewActor(
  context: ActorCreationContext,
  options: InspectorViewActorOptions
): RegisteredInspectorViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName,
    parent: options.parentActor
  });
  try {
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "inspector-window__content",
      document: options.document
    });
    const component = context.componentRegistry.addComponent(actor, inspectorContentComponentType, {
      id: "inspector-content",
      contentId: options.contentId,
      contentRegistration: options.contentRegistration,
      actorDisplaySource: createActorSystemInspectorActorDisplaySource(context.actorSystem),
      selectionSource: options.selectionSource,
      initialLocked: options.initialLocked,
      initialInspectedActorId: options.initialInspectedActorId
    });
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const baseHandle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    const handle: RegisteredInspectorViewActor = {
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
