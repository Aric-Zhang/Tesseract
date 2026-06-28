import type { ComponentDefinition } from "actor-core";
import { frameUpdateAttachment } from "../../ports/ui-frame-update-attachment-runtime";
import { uiElementComponentType } from "../element";
import {
  UiLayoutHostComponent,
  uiLayoutHostComponentType,
  type UiLayoutHostComponentOptions
} from "./ui-layout-host-component";

export const uiLayoutHostComponentDefinition:
  ComponentDefinition<UiLayoutHostComponent, UiLayoutHostComponentOptions> = {
    type: uiLayoutHostComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    attachments: [frameUpdateAttachment],
    createId(_actor, options) {
      return options?.id ?? "ui-layout-host";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("UiLayoutHostComponent requires UiElementComponent.");
      }
      return new UiLayoutHostComponent(actor, uiElement, {
        actorSystem: context.actorSystem,
        componentRegistry: context.componentRegistry
      }, options);
    }
  };
