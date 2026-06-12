import type { ComponentDefinition } from "actor-core";
import { stateObserverAttachment } from "./state-observer-attachment-runtime";
import {
  StateObserverBindingComponent,
  stateObserverBindingComponentType
} from "./state-observer-binding-component";

export const stateObserverBindingComponentDefinition:
  ComponentDefinition<StateObserverBindingComponent> = {
    type: stateObserverBindingComponentType,
    kind: "binding",
    singleton: true,
    attachments: [stateObserverAttachment],
    createId(actor) {
      return `${actor.id}:${stateObserverBindingComponentType}`;
    },
    create(actor) {
      return new StateObserverBindingComponent({
        actor,
        id: `${actor.id}:${stateObserverBindingComponentType}`
      });
    }
  };
