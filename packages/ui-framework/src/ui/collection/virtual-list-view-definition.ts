import type { ComponentDefinition } from "actor-system/core";
import { uiElementComponentType } from "../element";
import { scrollViewComponentType } from "../scroll";
import {
  VirtualListViewComponent,
  virtualListViewComponentType,
  type VirtualListViewComponentOptions
} from "./virtual-list-view-component";

export const virtualListViewComponentDefinition:
  ComponentDefinition<VirtualListViewComponent, VirtualListViewComponentOptions> = {
    type: virtualListViewComponentType,
    singleton: true,
    requires: [
      {
        type: uiElementComponentType,
        autoAdd: false,
        reuseExisting: true
      },
      {
        type: scrollViewComponentType,
        autoAdd: false,
        reuseExisting: true
      }
    ],
    createId(_actor, options) {
      return options?.id ?? "ui-virtual-list-view";
    },
    create(actor, context, options) {
      if (!options?.source) {
        throw new Error("VirtualListViewComponent requires a data source.");
      }
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      const scrollView = context.componentRegistry.getComponent(actor, scrollViewComponentType);
      if (!uiElement || !scrollView) {
        throw new Error("VirtualListViewComponent requires UI element and scroll view components.");
      }
      return new VirtualListViewComponent(actor, uiElement, scrollView, options);
    }
  };
