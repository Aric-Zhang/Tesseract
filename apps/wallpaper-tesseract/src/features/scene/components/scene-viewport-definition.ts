import type { ComponentDefinition } from "../../../actor-runtime";
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
      if (!options?.renderOutput) {
        throw new Error("SceneViewportComponent requires a runtime scene render output.");
      }
      if (!options.contentRegistration || !options.contentId) {
        throw new Error("SceneViewportComponent requires content registration options.");
      }
      return new SceneViewportComponent(actor, options);
    }
  };
