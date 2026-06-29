import type { ComponentDefinition } from "actor-system/core";
import { uiElementComponentType } from "../element";
import {
  UiThemeComponent,
  uiThemeComponentType,
  type UiThemeComponentOptions
} from "./ui-theme-component";

export const uiThemeComponentDefinition:
  ComponentDefinition<UiThemeComponent, UiThemeComponentOptions> = {
    type: uiThemeComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-theme";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("UiThemeComponent requires UiElementComponent.");
      }
      return new UiThemeComponent(actor, uiElement, options);
    }
  };
