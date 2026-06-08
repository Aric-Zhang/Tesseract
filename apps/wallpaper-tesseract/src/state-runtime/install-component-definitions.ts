import { installComponentDefinition, type ComponentRegistry } from "../actor-runtime";
import { stateObserverBindingComponentDefinition } from "./state-observer-binding-definition";

export function installStateRuntimeComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, stateObserverBindingComponentDefinition);
}
