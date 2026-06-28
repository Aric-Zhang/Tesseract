import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-core";
import {
  scrollViewComponentType,
  treeViewComponentType,
  uiElementComponentType,
  type WindowContentRegistrationPort
} from "ui-framework";
import {
  hierarchyPanelComponentType,
  type HierarchyPanelComponent
} from "./hierarchy-panel-component";
import type { HierarchyObjectSource } from "./hierarchy-object-source";
import { HierarchyTreeItemActorReconciler } from "./hierarchy-tree-item-actor-reconciler";

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
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "hierarchy-panel",
      document: options.document
    });
    context.componentRegistry.addComponent(actor, scrollViewComponentType, {
      orientation: "vertical"
    });
    context.componentRegistry.addComponent(actor, treeViewComponentType);
    const component = context.componentRegistry.addComponent(actor, hierarchyPanelComponentType, {
      id: "hierarchy-panel",
      objectSource: options.objectSource,
      contentId: options.contentId,
      contentRegistration: options.contentRegistration,
      itemReconciler: new HierarchyTreeItemActorReconciler(context, actor)
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
