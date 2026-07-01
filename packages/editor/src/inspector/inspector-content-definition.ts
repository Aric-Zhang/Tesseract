import type { ComponentDefinition } from "actor-system/core";
import { frameUpdateAttachment, uiElementComponentType } from "ui-framework/actor-ui";
import { stateObserverBindingComponentType } from "../state-observer/state-observer-binding-component";
import {
  InspectorContentComponent,
  inspectorContentComponentType,
  type InspectorContentComponentOptions
} from "./inspector-content-component";

export const inspectorContentComponentDefinition:
  ComponentDefinition<InspectorContentComponent, InspectorContentComponentOptions> = {
  type: inspectorContentComponentType,
  singleton: true,
  attachments: [frameUpdateAttachment],
  requires: [
    {
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    },
    { type: stateObserverBindingComponentType }
  ],
  createId(_actor, options) {
    return options?.id ?? "inspector-content";
  },
  create(actor, context, options) {
    if (!options?.actorDetailsSource || !options.selectionSource || !options.propertyControlReconciler) {
      throw new Error(
        "InspectorContentComponent requires actor details source, selection source, and property control reconciler options."
      );
    }
    const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
    if (!uiElement) {
      throw new Error("InspectorContentComponent requires UiElementComponent.");
    }
    return new InspectorContentComponent(actor, uiElement, options);
  }
};
