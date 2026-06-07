import type { ComponentDefinition } from "../../../actor-runtime";
import type { SceneCommandSink } from "../../../scene-runtime";
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

export interface SceneModeToggleComponentDefinitionOptions {
  readonly commandSink?: SceneCommandSink;
}

export function createSceneModeToggleComponentDefinition(
  services: SceneModeToggleComponentDefinitionOptions = {}
): ComponentDefinition<SceneModeToggleComponent, SceneModeToggleComponentOptions> {
  return {
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
        commandSink: services.commandSink ?? noopSceneCommandSink
      });
    }
  };
}

export const sceneModeToggleComponentDefinition = createSceneModeToggleComponentDefinition();

const noopSceneCommandSink: SceneCommandSink = {
  submit(): void {}
};
