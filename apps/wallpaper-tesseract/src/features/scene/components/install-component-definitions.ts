import type { ComponentRegistry } from "../../../actor-runtime";
import { installComponentDefinition } from "../../../component-definitions";
import { sceneModeToggleComponentDefinition } from "./scene-mode-toggle-definition";
import { sceneViewportComponentDefinition } from "./scene-viewport-definition";

export function installSceneComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, sceneViewportComponentDefinition);
  installComponentDefinition(componentRegistry, sceneModeToggleComponentDefinition);
}
