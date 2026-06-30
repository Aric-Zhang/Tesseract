import { installComponentDefinition, type ComponentRegistry } from "actor-system/core";
import { inspectorContentComponentDefinition } from "./inspector-content-definition";
import { inspectorRootContentComponentDefinition } from "./inspector-root-content-definition";

export function installInspectorComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, inspectorRootContentComponentDefinition);
  installComponentDefinition(componentRegistry, inspectorContentComponentDefinition);
}
