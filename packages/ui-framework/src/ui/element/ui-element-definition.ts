import type { ComponentDefinition } from "actor-system/core";
import {
  UiElementComponent,
  uiElementComponentType,
  type UiElementComponentOptions
} from "./ui-element-component";

export const uiElementComponentDefinition:
  ComponentDefinition<UiElementComponent, UiElementComponentOptions> = {
    type: uiElementComponentType,
    singleton: true,
    createId(_actor, options) {
      return options?.id ?? "ui-element";
    },
    create(actor, _context, options) {
      return new UiElementComponent(actor, options);
    }
  };
