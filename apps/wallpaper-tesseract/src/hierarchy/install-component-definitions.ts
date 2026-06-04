import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import { hierarchyPanelComponentDefinition } from "./hierarchy-panel-definition";

export function installHierarchyComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, hierarchyPanelComponentDefinition);
}
