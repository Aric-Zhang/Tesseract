import type { ComponentDefinition } from "actor-core";
import { uiElementComponentType } from "../element";
import {
  MenuBarItemComponent,
  menuBarItemComponentType,
  type MenuBarItemComponentOptions
} from "./menu-bar-item-component";

export const menuBarItemComponentDefinition:
  ComponentDefinition<MenuBarItemComponent, MenuBarItemComponentOptions> = {
    type: menuBarItemComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-menu-bar-item";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("MenuBarItemComponent requires UiElementComponent.");
      }
      if (!options?.descriptor) {
        throw new Error("MenuBarItemComponent requires descriptor.");
      }
      return new MenuBarItemComponent(actor, uiElement, options);
    }
  };
