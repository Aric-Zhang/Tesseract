import type { ComponentDefinition } from "../actor-runtime";
import { activeInputCancellationAttachment } from "./active-input-cancellation-runtime";
import { gizmoControllerAttachment } from "./gizmo-controller-attachment-runtime";
import {
  GizmoEventBindingComponent,
  gizmoEventBindingComponentType
} from "./gizmo-event-binding-component";

export const gizmoEventBindingComponentDefinition: ComponentDefinition<GizmoEventBindingComponent> = {
  type: gizmoEventBindingComponentType,
  kind: "binding",
  singleton: true,
  attachments: [gizmoControllerAttachment, activeInputCancellationAttachment],
  createId(actor) {
    return `${actor.id}:${gizmoEventBindingComponentType}`;
  },
  create(actor, context) {
    return new GizmoEventBindingComponent({
      actor,
      id: `${actor.id}:${gizmoEventBindingComponentType}`,
      isActorActive: () => context.actorSystem.isActorActive(actor),
      actorWindowFocus: context.services.actorWindowFocus
    });
  }
};
