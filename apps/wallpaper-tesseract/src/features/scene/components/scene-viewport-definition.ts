import type { ComponentDefinition } from "../../../actor-runtime";
import { findOwningWindowContentHost } from "../../../window-runtime";
import {
  SceneViewportComponent,
  sceneViewportComponentType,
  type SceneViewportComponentOptions
} from "./scene-viewport-component";

export const sceneViewportComponentDefinition:
  ComponentDefinition<SceneViewportComponent, SceneViewportComponentOptions> = {
    type: sceneViewportComponentType,
    singleton: true,
    requires: [],
    createId(_actor, options) {
      return options?.id ?? "scene-viewport";
    },
    create(actor, context, options) {
      const window = findOwningWindowContentHost(context.actorSystem, context.componentRegistry, actor);
      if (!window) {
        throw new Error("SceneViewportComponent requires an owning FloatingWindowComponent.");
      }
      return new SceneViewportComponent(actor, window, options);
    }
  };
