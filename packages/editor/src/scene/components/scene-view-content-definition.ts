import type { ComponentDefinition } from "actor-system/core";
import {
  sceneViewContentComponentType,
  SceneViewContentComponent,
  type SceneViewContentComponentOptions
} from "./scene-view-content-component";
import { uiElementComponentType } from "ui-framework";

export const sceneViewContentComponentDefinition:
  ComponentDefinition<SceneViewContentComponent, SceneViewContentComponentOptions> = {
    type: sceneViewContentComponentType,
    singleton: true,
    requires: [{
      type: uiElementComponentType,
      autoAdd: false,
      reuseExisting: true
    }],
    createId(_actor, options) {
      return options?.id ?? "scene-view-content";
    },
    create(actor, context, options) {
      const uiElement = context.componentRegistry.getComponent(actor, uiElementComponentType);
      if (!uiElement) {
        throw new Error("SceneViewContentComponent requires UiElementComponent.");
      }
      if (!options?.contentRegistration || !options.contentId) {
        throw new Error("SceneViewContentComponent requires content registration options.");
      }
      return new SceneViewContentComponent(actor, uiElement, options);
    }
  };
