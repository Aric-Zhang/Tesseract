import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "ui-framework";
import {
  Camera3GizmoComponent,
  camera3GizmoComponentType,
  type Camera3GizmoComponentOptions
} from "./camera3-gizmo-component";

export const camera3GizmoComponentDefinition:
  ComponentDefinition<Camera3GizmoComponent, Camera3GizmoComponentOptions> = {
    type: camera3GizmoComponentType,
    requires: [
      {
        type: uiElementComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      {
        type: gizmoEventBindingComponentType,
        autoAdd: true
      }
    ],
    createId() {
      return "camera3-view-gizmo";
    },
    create(actor, context, options) {
      if (!options) {
        throw new Error("Camera3GizmoComponent options are required.");
      }
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("Camera3GizmoComponent requires UiElementComponent.");
      }
      return new Camera3GizmoComponent(actor, uiElement, options);
    }
  };
