import { installComponentDefinition, type ComponentRegistry } from "actor-system/core";
import { debugLogContentComponentDefinition } from "./components";

export function installDebugLogComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, debugLogContentComponentDefinition);
}
