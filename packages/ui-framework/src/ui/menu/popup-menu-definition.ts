import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "../element";
import {
  PopupMenuComponent,
  popupMenuComponentType,
  type PopupMenuComponentOptions
} from "./popup-menu-component";

export const popupMenuComponentDefinition:
  ComponentDefinition<PopupMenuComponent, PopupMenuComponentOptions> = {
    type: popupMenuComponentType,
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
      return options?.id ?? "ui-popup-menu";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("PopupMenuComponent requires UiElementComponent.");
      }
      return new PopupMenuComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
