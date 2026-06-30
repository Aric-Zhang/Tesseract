import type { ComponentDefinition } from "actor-system/core";
import { uiElementComponentType } from "ui-framework/actor-ui";
import {
  InspectorRootContentComponent,
  inspectorRootContentComponentType,
  type InspectorRootContentComponentOptions
} from "./inspector-root-content-component";

export const inspectorRootContentComponentDefinition:
  ComponentDefinition<InspectorRootContentComponent, InspectorRootContentComponentOptions> = {
  type: inspectorRootContentComponentType,
  singleton: true,
  requires: [{
    type: uiElementComponentType,
    autoAdd: false,
    reuseExisting: true
  }],
  createId(_actor, options) {
    return options?.id ?? "inspector-root-content";
  },
  create(actor, context, options) {
    if (!options?.contentRegistration || !options.contentId) {
      throw new Error("InspectorRootContentComponent requires content registration and content id options.");
    }
    const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
    if (!uiElement) {
      throw new Error("InspectorRootContentComponent requires UiElementComponent.");
    }
    return new InspectorRootContentComponent(actor, uiElement, options);
  }
};
