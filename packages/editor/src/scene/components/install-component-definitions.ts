import { installComponentDefinition, type ComponentRegistry } from "actor-core";
import { sceneViewContentComponentDefinition } from "./scene-view-content-definition";

export interface InstallSceneComponentDefinitionsOptions {}

export function installSceneComponentDefinitions(
  componentRegistry: ComponentRegistry,
  _options: InstallSceneComponentDefinitionsOptions = {}
): void {
  installComponentDefinition(componentRegistry, sceneViewContentComponentDefinition);
}
