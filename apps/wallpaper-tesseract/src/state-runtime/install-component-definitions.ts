import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import { stateObserverBindingComponentDefinition } from "./state-observer-binding-definition";

export function installStateRuntimeComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, stateObserverBindingComponentDefinition);
}
