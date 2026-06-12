import { installComponentDefinition, type ComponentRegistry } from "../../../actor-runtime";
import { camera3MotionComponentDefinition } from "./camera3-motion-definition";
import { sceneCamera3ViewportBindingComponentDefinition } from "./scene-camera3-viewport-binding-definition";

export function installCamera3FeatureComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, camera3MotionComponentDefinition);
  installComponentDefinition(componentRegistry, sceneCamera3ViewportBindingComponentDefinition);
}
