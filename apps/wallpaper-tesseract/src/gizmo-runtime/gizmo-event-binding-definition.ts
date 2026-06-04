import type { ComponentDefinition } from "../actor-runtime";
import {
  GizmoEventBindingComponent,
  gizmoEventBindingComponentType
} from "./gizmo-event-binding-component";

export const gizmoEventBindingComponentDefinition: ComponentDefinition<GizmoEventBindingComponent> = {
  type: gizmoEventBindingComponentType,
  kind: "binding",
  singleton: true,
  capabilities: ["gizmo-controller-binding"],
  createId(actor) {
    return `${actor.id}:${gizmoEventBindingComponentType}`;
  },
  create(actor, context) {
    return new GizmoEventBindingComponent({
      actor,
      id: `${actor.id}:${gizmoEventBindingComponentType}`,
      isActorActive: () => context.actorSystem.isActorActive(actor)
    });
  }
};
