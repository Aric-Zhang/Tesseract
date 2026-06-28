import { installComponentDefinition, type ComponentRegistry } from "../../actor-runtime";
import { appMenuAdapterComponentDefinition } from "./app-menu-adapter-definition";

export function installAppMenuComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, appMenuAdapterComponentDefinition);
}
