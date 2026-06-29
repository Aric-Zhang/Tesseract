import { installComponentDefinition, type ComponentRegistry } from "actor-system/core";
import { stateObserverBindingComponentDefinition } from "./state-observer-binding-definition";

export function installEditorStateObserverComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, stateObserverBindingComponentDefinition);
}
