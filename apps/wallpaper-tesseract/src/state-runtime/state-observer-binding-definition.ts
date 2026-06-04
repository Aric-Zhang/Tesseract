import type { ComponentDefinition } from "../actor-runtime";
import {
  StateObserverBindingComponent,
  stateObserverBindingComponentType
} from "./state-observer-binding-component";

export const stateObserverBindingComponentDefinition:
  ComponentDefinition<StateObserverBindingComponent> = {
    type: stateObserverBindingComponentType,
    kind: "binding",
    singleton: true,
    capabilities: ["state-observer-binding"],
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
