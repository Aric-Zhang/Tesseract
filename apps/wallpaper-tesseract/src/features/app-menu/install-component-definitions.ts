import { installComponentDefinition, type ComponentRegistry } from "../../actor-runtime";
import { appMenuBarComponentDefinition } from "./app-menu-bar-definition";

export function installAppMenuComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, appMenuBarComponentDefinition);
}
