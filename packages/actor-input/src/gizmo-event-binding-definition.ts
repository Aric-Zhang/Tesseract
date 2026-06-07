import type { Actor, ComponentDefinition } from "actor-core";
import type { ActorInputStackPrioritySource } from "./actor-input-stack-priority-source";
import { activeInputCancellationAttachment } from "./active-input-cancellation-runtime";
import { gizmoControllerAttachment } from "./gizmo-controller-attachment-runtime";
import {
  GizmoEventBindingComponent,
  gizmoEventBindingComponentType
} from "./gizmo-event-binding-component";

export interface GizmoEventBindingComponentDefinitionOptions {
  readonly actorInputStackPriority?: ActorInputStackPrioritySource;
  readonly requestPointerFocus?: (actor: Actor) => void;
}

export function createGizmoEventBindingComponentDefinition(
  options: GizmoEventBindingComponentDefinitionOptions = {}
): ComponentDefinition<GizmoEventBindingComponent> {
  return {
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
        actorInputStackPriority: options.actorInputStackPriority,
        requestPointerFocus: options.requestPointerFocus
      });
    }
  };
}

export const gizmoEventBindingComponentDefinition = createGizmoEventBindingComponentDefinition();

