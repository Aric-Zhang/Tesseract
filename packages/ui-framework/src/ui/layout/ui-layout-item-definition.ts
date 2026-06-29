import type { ComponentDefinition } from "actor-system/core";
import { uiElementComponentType } from "../element";
import {
  UiLayoutItemComponent,
  uiLayoutItemComponentType
} from "./ui-layout-item-component";
import type { UiLayoutItemComponentOptions } from "./ui-layout-types";

export const uiLayoutItemComponentDefinition:
  ComponentDefinition<UiLayoutItemComponent, UiLayoutItemComponentOptions> = {
    type: uiLayoutItemComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-layout-item";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("UiLayoutItemComponent requires UiElementComponent.");
      }
      return new UiLayoutItemComponent(actor, uiElement, options);
    }
  };
