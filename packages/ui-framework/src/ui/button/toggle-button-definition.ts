import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "../element";
import {
  ToggleButtonComponent,
  toggleButtonComponentType,
  type ToggleButtonComponentOptions
} from "./toggle-button-component";

export const toggleButtonComponentDefinition:
  ComponentDefinition<ToggleButtonComponent, ToggleButtonComponentOptions> = {
    type: toggleButtonComponentType,
    singleton: true,
    requires: [
      {
        type: uiElementComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      {
        type: gizmoEventBindingComponentType,
        autoAdd: true,
        reuseExisting: true
      }
    ],
    createId(_actor, options) {
      return options?.id ?? "ui-toggle-button";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("ToggleButtonComponent requires UiElementComponent.");
      }
      if (!options?.descriptor) {
        throw new Error("ToggleButtonComponent requires descriptor.");
      }
      if (!options.activationSink) {
        throw new Error("ToggleButtonComponent requires activation sink.");
      }
      return new ToggleButtonComponent(actor, uiElement, options);
    }
  };
