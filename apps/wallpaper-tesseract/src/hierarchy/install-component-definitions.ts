import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import {
  createHierarchyPanelComponentDefinition,
  hierarchyPanelComponentDefinition,
  type HierarchyPanelComponentDefinitionOptions
} from "./hierarchy-panel-definition";

export type InstallHierarchyComponentDefinitionsOptions = HierarchyPanelComponentDefinitionOptions;

export function installHierarchyComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallHierarchyComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(
    componentRegistry,
    options.commandSink
      ? createHierarchyPanelComponentDefinition(options)
      : hierarchyPanelComponentDefinition
  );
}
