import type { ComponentDefinition } from "actor-core";
import { gizmoEventBindingComponentType } from "actor-input";
import { noopEditorCommandSink, type EditorCommandSink } from "../../editor-state";
import { stateObserverBindingComponentType } from "../../state-observer/state-observer-binding-component";
import {
  SceneModeToggleComponent,
  sceneModeToggleComponentType,
  type SceneModeToggleComponentOptions
} from "./scene-mode-toggle-component";
import {
  sceneViewportComponentType
} from "./scene-viewport-component";

export interface SceneModeToggleComponentDefinitionOptions {
  readonly commandSink?: EditorCommandSink;
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
        commandSink: services.commandSink ?? noopEditorCommandSink
      });
    }
  };
}

export const sceneModeToggleComponentDefinition = createSceneModeToggleComponentDefinition();
