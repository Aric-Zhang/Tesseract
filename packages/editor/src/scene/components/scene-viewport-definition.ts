import type { ComponentDefinition } from "actor-core";
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
    create(actor, _context, options) {
      if (!options?.renderTarget) {
        throw new Error("SceneViewportComponent requires a runtime scene render target.");
      }
      if (!options.contentRegistration || !options.contentId) {
        throw new Error("SceneViewportComponent requires content registration options.");
      }
      return new SceneViewportComponent(actor, options);
    }
  };
