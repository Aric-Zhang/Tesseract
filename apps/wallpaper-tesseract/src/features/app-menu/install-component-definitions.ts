import type { ComponentRegistry } from "../../actor-runtime";
import { installComponentDefinition } from "../../component-definitions";
import { appMenuBarComponentDefinition } from "./app-menu-bar-definition";

export function installAppMenuComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, appMenuBarComponentDefinition);
}
