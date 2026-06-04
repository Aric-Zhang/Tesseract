import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import { floatingWindowComponentDefinition } from "./floating-window-definition";

export function installWindowComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, floatingWindowComponentDefinition);
}
