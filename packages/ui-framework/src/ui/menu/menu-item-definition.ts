import type { ComponentDefinition } from "actor-core";
import { uiElementComponentType } from "../element";
import {
  MenuItemComponent,
  menuItemComponentType,
  type MenuItemComponentOptions
} from "./menu-item-component";

export const menuItemComponentDefinition:
  ComponentDefinition<MenuItemComponent, MenuItemComponentOptions> = {
    type: menuItemComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-menu-item";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("MenuItemComponent requires UiElementComponent.");
      }
      if (!options?.descriptor) {
        throw new Error("MenuItemComponent requires descriptor.");
      }
      return new MenuItemComponent(actor, uiElement, options);
    }
  };
