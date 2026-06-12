import { installComponentDefinition, type ComponentRegistry } from "actor-core";
import { inspectorContentComponentDefinition } from "./inspector-content-definition";

export function installInspectorComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, inspectorContentComponentDefinition);
}
