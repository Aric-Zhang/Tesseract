import type { ComponentDefinition } from "actor-system/core";
import { frameUpdateAttachment } from "../../ports/ui-frame-update-attachment-runtime";
import { uiElementComponentType } from "../element";
import {
  ToolbarComponent,
  toolbarComponentType,
  type ToolbarComponentOptions
} from "./toolbar-component";

export const toolbarComponentDefinition:
  ComponentDefinition<ToolbarComponent, ToolbarComponentOptions> = {
    type: toolbarComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    attachments: [frameUpdateAttachment],
    createId(_actor, options) {
      return options?.id ?? "ui-toolbar";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("ToolbarComponent requires UiElementComponent.");
      }
      return new ToolbarComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
