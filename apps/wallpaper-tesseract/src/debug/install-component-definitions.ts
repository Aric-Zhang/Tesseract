import { installComponentDefinition, type ComponentRegistry } from "../actor-runtime";
import { debugLogContentComponentDefinition } from "./components";

export function installDebugLogComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, debugLogContentComponentDefinition);
}
