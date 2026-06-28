import type { ComponentDefinition } from "actor-core";
import {
  frameUpdateAttachment,
  listViewComponentType,
  scrollViewComponentType,
  uiElementComponentType
} from "ui-framework";
import {
  DebugLogContentComponent,
  debugLogContentComponentType,
  type DebugLogContentComponentOptions
} from "./debug-log-content-component";

export const debugLogContentComponentDefinition:
  ComponentDefinition<DebugLogContentComponent, DebugLogContentComponentOptions> = {
    type: debugLogContentComponentType,
    singleton: true,
    attachments: [frameUpdateAttachment],
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
      },
      {
        type: listViewComponentType,
        autoAdd: false,
        reuseExisting: true
      }
    ],
    createId(_actor, options) {
      return options?.id ?? "debug-log-content";
    },
    create(actor, context, options) {
      if (!options?.contentRegistration || !options.contentId) {
        throw new Error("DebugLogContentComponent requires content registration options.");
      }
      if (!options.itemReconciler) {
        throw new Error("DebugLogContentComponent requires itemReconciler option.");
      }
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      const scrollView = context.componentRegistry.getComponent(actor, scrollViewComponentType);
      const listView = context.componentRegistry.getComponent(actor, listViewComponentType);
      if (!uiElement || !scrollView || !listView) {
        throw new Error("DebugLogContentComponent requires UI element, scroll view, and list view components.");
      }
      return new DebugLogContentComponent(actor, uiElement, scrollView, listView, options);
    }
  };
