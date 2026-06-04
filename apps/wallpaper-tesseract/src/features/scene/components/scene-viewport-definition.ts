import type { ComponentDefinition } from "../../../actor-runtime";
import { floatingWindowComponentType } from "../../../window-runtime";
import {
  SceneViewportComponent,
  sceneViewportComponentType,
  type SceneViewportComponentOptions
} from "./scene-viewport-component";

export const sceneViewportComponentDefinition:
  ComponentDefinition<SceneViewportComponent, SceneViewportComponentOptions> = {
    type: sceneViewportComponentType,
    singleton: true,
    requires: [{
      type: floatingWindowComponentType,
      autoAdd: false
    }],
    createId(_actor, options) {
      return options?.id ?? "scene-viewport";
    },
    create(actor, context, options) {
      const window = context.componentRegistry.getComponent(actor, floatingWindowComponentType);
      if (!window) {
        throw new Error("SceneViewportComponent requires FloatingWindowComponent on the same actor.");
      }
      return new SceneViewportComponent(actor, window, options);
    }
  };
