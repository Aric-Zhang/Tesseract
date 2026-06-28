import { installComponentDefinition, type ComponentRegistry } from "../../../actor-runtime";
import { sceneCamera3ViewportBindingComponentDefinition } from "./scene-camera3-viewport-binding-definition";

export function installSceneIntegrationComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, sceneCamera3ViewportBindingComponentDefinition);
}
