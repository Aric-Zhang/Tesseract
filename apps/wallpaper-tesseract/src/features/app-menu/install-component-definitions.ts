import { installComponentDefinition, type ComponentRegistry } from "../../actor-runtime";
import { appMenuAdapterComponentDefinition } from "./app-menu-adapter-definition";
import { themeMenuAdapterComponentDefinition } from "./theme-menu-adapter-definition";

export function installAppMenuComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, appMenuAdapterComponentDefinition);
  installComponentDefinition(componentRegistry, themeMenuAdapterComponentDefinition);
}
