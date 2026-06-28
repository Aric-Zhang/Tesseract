import type { ComponentDefinition } from "actor-core";
import { gizmoEventBindingComponentType } from "actor-input";
import { uiElementComponentType } from "../element";
import {
  MenuBarComponent,
  menuBarComponentType,
  type MenuBarComponentOptions
} from "./menu-bar-component";

export const menuBarComponentDefinition:
  ComponentDefinition<MenuBarComponent, MenuBarComponentOptions> = {
    type: menuBarComponentType,
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
      return options?.id ?? "ui-menu-bar";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("MenuBarComponent requires UiElementComponent.");
      }
      return new MenuBarComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
