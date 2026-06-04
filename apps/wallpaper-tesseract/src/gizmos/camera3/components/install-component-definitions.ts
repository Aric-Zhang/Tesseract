import type { ComponentRegistry } from "../../../actor-runtime";
import { installComponentDefinition } from "../../../component-definitions";
import { camera3GizmoComponentDefinition } from "./camera3-gizmo-definition";

export function installCamera3ComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, camera3GizmoComponentDefinition);
}
