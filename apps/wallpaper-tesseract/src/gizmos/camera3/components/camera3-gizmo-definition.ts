import type { ComponentDefinition } from "../../../actor-runtime";
import { gizmoEventBindingComponentType } from "../../../gizmo-runtime";
import {
  Camera3GizmoComponent,
  camera3GizmoComponentType,
  type Camera3GizmoComponentOptions
} from "./camera3-gizmo-component";

export const camera3GizmoComponentDefinition:
  ComponentDefinition<Camera3GizmoComponent, Camera3GizmoComponentOptions> = {
    type: camera3GizmoComponentType,
    requires: [{
      type: gizmoEventBindingComponentType,
      autoAdd: true
    }],
    createId() {
      return "camera3-view-gizmo";
    },
    create(actor, _context, options) {
      if (!options) {
        throw new Error("Camera3GizmoComponent options are required.");
      }
      return new Camera3GizmoComponent(actor, options);
    }
  };
