import { installComponentDefinition, type ComponentRegistry } from "../../../actor-runtime";
import { sceneCamera3ViewportBindingComponentDefinition } from "./scene-camera3-viewport-binding-definition";

export function installSceneComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, sceneCamera3ViewportBindingComponentDefinition);
}
