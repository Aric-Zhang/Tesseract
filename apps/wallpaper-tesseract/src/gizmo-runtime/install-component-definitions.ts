import type { ComponentRegistry } from "../actor-runtime";
import { installComponentDefinition } from "../component-definitions";
import {
  createGizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentDefinition,
  type GizmoEventBindingComponentDefinitionOptions
} from "actor-input";

export interface InstallGizmoRuntimeComponentDefinitionsOptions {
  readonly gizmoEventBinding?: GizmoEventBindingComponentDefinitionOptions;
}

export function installGizmoRuntimeComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallGizmoRuntimeComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(
    componentRegistry,
    options.gizmoEventBinding
      ? createGizmoEventBindingComponentDefinition(options.gizmoEventBinding)
      : gizmoEventBindingComponentDefinition
  );
}
