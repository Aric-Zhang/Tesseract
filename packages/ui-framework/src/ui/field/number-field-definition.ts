import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "../element";
import {
  NumberFieldComponent,
  numberFieldComponentType,
  type NumberFieldComponentOptions
} from "./number-field-component";

export const numberFieldComponentDefinition:
  ComponentDefinition<NumberFieldComponent, NumberFieldComponentOptions> = {
  type: numberFieldComponentType,
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
    return options?.id ?? "ui-number-field";
  },
  create(actor, context, options) {
    const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
    if (!uiElement) {
      throw new Error("NumberFieldComponent requires UiElementComponent.");
    }
    if (!options?.descriptor) {
      throw new Error("NumberFieldComponent requires descriptor.");
    }
    if (!options.commitSink) {
      throw new Error("NumberFieldComponent requires commit sink.");
    }
    return new NumberFieldComponent(actor, uiElement, options);
  }
};
