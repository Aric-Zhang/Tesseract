import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "../element";
import {
  ButtonComponent,
  buttonComponentType,
  type ButtonComponentOptions
} from "./button-component";

export const buttonComponentDefinition:
  ComponentDefinition<ButtonComponent, ButtonComponentOptions> = {
    type: buttonComponentType,
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
      return options?.id ?? "ui-button";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("ButtonComponent requires UiElementComponent.");
      }
      if (!options?.descriptor) {
        throw new Error("ButtonComponent requires descriptor.");
      }
      if (!options.activationSink) {
        throw new Error("ButtonComponent requires activation sink.");
      }
      return new ButtonComponent(actor, uiElement, options);
    }
  };
