import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import type { WindowContentRegistrationPort } from "../window-runtime";
import {
  hierarchyPanelComponentType,
  type HierarchyPanelComponent
} from "./hierarchy-panel-component";
import type { HierarchyObjectSource } from "./hierarchy-object-source";

export interface HierarchyPanelViewActorOptions {
  actorId?: string;
  actorName?: string;
  parentActor: Actor;
  objectSource: HierarchyObjectSource;
  document?: Pick<Document, "createElement">;
  contentId: string;
  contentRegistration: WindowContentRegistrationPort;
}

export interface RegisteredHierarchyPanelViewActor extends RegisteredActor<HierarchyPanelComponent> {
  disposeRuntimeTracking?(): void;
}

export function createHierarchyPanelViewActor(
  context: ActorCreationContext,
  options: HierarchyPanelViewActorOptions
): RegisteredHierarchyPanelViewActor {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, hierarchyPanelComponentType, {
      id: "hierarchy-panel",
      objectSource: options.objectSource,
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
    const handle: RegisteredHierarchyPanelViewActor = {
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
