import {
  installComponentDefinition,
  type ComponentRegistry
} from "actor-core";
import {
  createGizmoEventBindingComponentDefinition,
  gizmoEventBindingComponentDefinition,
  type GizmoEventBindingComponentDefinitionOptions
} from "./gizmo-event-binding-definition";

export interface InstallActorInputComponentDefinitionsOptions {
  readonly gizmoEventBinding?: GizmoEventBindingComponentDefinitionOptions;
}

export function installActorInputComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallActorInputComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(
    componentRegistry,
    options.gizmoEventBinding
      ? createGizmoEventBindingComponentDefinition(options.gizmoEventBinding)
      : gizmoEventBindingComponentDefinition
  );
}
