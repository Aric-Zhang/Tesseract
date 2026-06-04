import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import { debugLogContentComponentDefinition } from "./components";

export function installDebugLogComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, debugLogContentComponentDefinition);
}
