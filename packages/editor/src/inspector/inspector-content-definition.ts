import type { ComponentDefinition } from "actor-system/core";
import { uiElementComponentType } from "ui-framework/actor-ui";
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
    if (!options?.actorDisplaySource || !options.selectionSource) {
      throw new Error("InspectorContentComponent requires display source and selection source options.");
    }
    const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
    if (!uiElement) {
      throw new Error("InspectorContentComponent requires UiElementComponent.");
    }
    return new InspectorContentComponent(actor, uiElement, options);
  }
};
