import type { ComponentDefinition } from "actor-core";
import { uiElementComponentType } from "../element";
import {
  ScrollViewComponent,
  scrollViewComponentType,
  type ScrollViewComponentOptions
} from "./scroll-view-component";

export const scrollViewComponentDefinition:
  ComponentDefinition<ScrollViewComponent, ScrollViewComponentOptions> = {
    type: scrollViewComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-scroll-view";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("ScrollViewComponent requires UiElementComponent.");
      }
      return new ScrollViewComponent(actor, uiElement, options);
    }
  };
