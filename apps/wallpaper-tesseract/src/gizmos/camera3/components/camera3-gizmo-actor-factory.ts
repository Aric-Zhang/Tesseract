import { createRegisteredActor, type Actor, type RegisteredActor } from "../../../actor-runtime";
import type { FeatureActorContext } from "../../../runtime/ports";
import { camera3GizmoComponentType, type Camera3GizmoViewFactory } from "./camera3-gizmo-component";
import type { Camera3GizmoComponentOptions, Camera3GizmoComponent } from "./camera3-gizmo-component";

export interface Camera3GizmoActorOptions extends Camera3GizmoComponentOptions {
  actorId?: string;
  actorName?: string;
  parentActor?: Actor | string | null;
}

export function createCamera3GizmoActor(
  context: FeatureActorContext,
  options: Camera3GizmoActorOptions,
  createGizmo?: Camera3GizmoViewFactory
): RegisteredActor<Camera3GizmoComponent> {
  const actor = context.actorSystem.createActor({
    id: options.actorId,
    name: options.actorName ?? options.actorId,
    parent: options.parentActor
  });
  try {
    const component = context.componentRegistry.addComponent(actor, camera3GizmoComponentType, {
      ...options,
      createGizmo: createGizmo ?? options.createGizmo
    });
    let untrack: ReturnType<FeatureActorContext["trackRegisteredActor"]> | null = null;
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
