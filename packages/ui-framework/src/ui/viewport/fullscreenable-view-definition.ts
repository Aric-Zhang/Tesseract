import type { ComponentDefinition } from "actor-system/core";
import { gizmoEventBindingComponentType } from "actor-system/input";
import { uiElementComponentType } from "../element";
import {
  FullscreenableViewComponent,
  fullscreenableViewComponentType,
  type FullscreenableViewComponentOptions
} from "./fullscreenable-view-component";

export const fullscreenableViewComponentDefinition:
  ComponentDefinition<FullscreenableViewComponent, FullscreenableViewComponentOptions> = {
    type: fullscreenableViewComponentType,
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
      return options?.id ?? "ui-fullscreenable-view";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("FullscreenableViewComponent requires UiElementComponent.");
      }
      if (!options?.intentSink) {
        throw new Error("FullscreenableViewComponent requires an intent sink.");
      }
      return new FullscreenableViewComponent(actor, uiElement, options);
    }
  };
