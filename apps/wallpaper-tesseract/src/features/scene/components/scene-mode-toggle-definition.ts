import type { ComponentDefinition } from "../../../actor-runtime";
import { gizmoEventBindingComponentType } from "../../../gizmo-runtime";
import { stateObserverBindingComponentType } from "../../../state-runtime";
import {
  SceneModeToggleComponent,
  sceneModeToggleComponentType,
  type SceneModeToggleComponentOptions
} from "./scene-mode-toggle-component";
import {
  sceneViewportComponentType
} from "./scene-viewport-component";

export const sceneModeToggleComponentDefinition:
  ComponentDefinition<SceneModeToggleComponent, SceneModeToggleComponentOptions> = {
    type: sceneModeToggleComponentType,
    singleton: true,
    requires: [
      { type: sceneViewportComponentType, autoAdd: false },
      { type: gizmoEventBindingComponentType },
      { type: stateObserverBindingComponentType }
    ],
    createId(_actor, options) {
      return options?.id ?? "scene-mode-toggle";
    },
    create(actor, context, options) {
      const viewport = context.componentRegistry.getComponent(actor, sceneViewportComponentType);
      if (!viewport) {
        throw new Error("SceneModeToggleComponent requires SceneViewportComponent on the same actor.");
      }
      return new SceneModeToggleComponent(actor, viewport, options ?? {}, {
        commandSink: context.services.commandSink
      });
    }
  };
