import { installComponentDefinition, type ComponentRegistry } from "../../../actor-runtime";
import {
  createSceneModeToggleComponentDefinition,
  sceneModeToggleComponentDefinition,
  type SceneModeToggleComponentDefinitionOptions
} from "./scene-mode-toggle-definition";
import { sceneViewportComponentDefinition } from "./scene-viewport-definition";

export type InstallSceneComponentDefinitionsOptions = SceneModeToggleComponentDefinitionOptions;

export function installSceneComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallSceneComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(componentRegistry, sceneViewportComponentDefinition);
  installComponentDefinition(
    componentRegistry,
    options.commandSink
      ? createSceneModeToggleComponentDefinition(options)
      : sceneModeToggleComponentDefinition
  );
}
