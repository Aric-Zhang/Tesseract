import type { ComponentDefinition } from "actor-system/core";
import { frameUpdateAttachment, uiElementComponentType } from "ui-framework/actor-ui";
import { scrollViewComponentType, virtualListViewComponentType } from "ui-framework/controls";
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
        type: virtualListViewComponentType,
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
      if (!options.source) {
        throw new Error("DebugLogContentComponent requires a diagnostic view data source.");
      }
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      const scrollView = context.componentRegistry.getComponent(actor, scrollViewComponentType);
      const virtualList = context.componentRegistry.getComponent(actor, virtualListViewComponentType);
      if (!uiElement || !scrollView || !virtualList) {
        throw new Error("DebugLogContentComponent requires UI element, scroll view, and virtual list components.");
      }
      return new DebugLogContentComponent(actor, uiElement, scrollView, virtualList, options);
    }
  };
