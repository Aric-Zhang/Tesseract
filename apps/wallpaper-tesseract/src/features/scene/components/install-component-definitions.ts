import { installComponentDefinition, type ComponentRegistry } from "../../../actor-runtime";
import { camera3MotionComponentDefinition } from "../../../runtime/camera3/camera3-motion-definition";
import { sceneCamera3ViewportBindingComponentDefinition } from "./scene-camera3-viewport-binding-definition";

export function installSceneCamera3ComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, camera3MotionComponentDefinition);
  installComponentDefinition(componentRegistry, sceneCamera3ViewportBindingComponentDefinition);
}
