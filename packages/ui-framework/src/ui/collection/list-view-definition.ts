import type { ComponentDefinition } from "actor-core";
import { uiElementComponentType } from "../element";
import {
  ListViewComponent,
  listViewComponentType,
  type ListViewComponentOptions
} from "./list-view-component";

export const listViewComponentDefinition:
  ComponentDefinition<ListViewComponent, ListViewComponentOptions> = {
    type: listViewComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "ui-list-view";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("ListViewComponent requires UiElementComponent.");
      }
      return new ListViewComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
