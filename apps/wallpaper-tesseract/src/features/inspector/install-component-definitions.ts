import type { ComponentRegistry } from "../../actor-runtime";
import { installComponentDefinition } from "../../component-definitions";
import { inspectorContentComponentDefinition } from "./inspector-content-definition";

export function installInspectorComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, inspectorContentComponentDefinition);
}
