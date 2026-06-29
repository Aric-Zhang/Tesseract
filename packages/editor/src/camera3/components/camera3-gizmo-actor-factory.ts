import { createRegisteredActor, type Actor, type ActorCreationContext, type RegisteredActor } from "actor-system/core";
import { uiElementComponentType, uiLayoutItemComponentType, type UiLayoutItemComponentOptions } from "ui-framework/actor-ui";
import { camera3GizmoComponentType, type Camera3GizmoViewFactory } from "./camera3-gizmo-component";
import type { Camera3GizmoComponentOptions, Camera3GizmoComponent } from "./camera3-gizmo-component";

export interface Camera3GizmoActorOptions extends Camera3GizmoComponentOptions {
  actorId?: string;
  actorName?: string;
  parentActor?: Actor | string | null;
  document?: Pick<Document, "createElement">;
  layoutItem?: UiLayoutItemComponentOptions;
}

export function createCamera3GizmoActor(
  context: ActorCreationContext,
  options: Camera3GizmoActorOptions,
  createGizmo?: Camera3GizmoViewFactory
): RegisteredActor<Camera3GizmoComponent> {
  const {
    actorId,
    actorName,
    parentActor,
    document,
    layoutItem,
    createGizmo: optionsCreateGizmo,
    ...componentOptions
  } = options;
  const actor = context.actorSystem.createActor({
    id: actorId,
    name: actorName ?? actorId,
    parent: parentActor
  });
  try {
    context.componentRegistry.addComponent(actor, uiElementComponentType, {
      className: "camera3-gizmo-host",
      document
    });
    if (layoutItem) {
      context.componentRegistry.addComponent(actor, uiLayoutItemComponentType, layoutItem);
    }
    const component = context.componentRegistry.addComponent(actor, camera3GizmoComponentType, {
      ...componentOptions,
      createGizmo: createGizmo ?? optionsCreateGizmo
    });
    let untrack: ReturnType<ActorCreationContext["trackRegisteredActor"]> | null = null;
    const handle = createRegisteredActor({
      actorSystem: context.actorSystem,
      actor,
      component,
      beforeDispose: () => untrack?.dispose()
    });
    untrack = context.trackRegisteredActor(handle);
    return handle;
  } catch (error) {
    if (context.actorSystem.hasActor(actor)) {
      context.actorSystem.destroyActor(actor);
    }
    throw error;
  }
}
