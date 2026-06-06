import type { ComponentRegistry } from "../../../actor-runtime";
import { installComponentDefinition } from "../../../component-definitions";
import { camera3MotionComponentDefinition } from "./camera3-motion-definition";
import { camera3RigComponentDefinition } from "./camera3-rig-definition";
import { sceneCamera3ViewportBindingComponentDefinition } from "./scene-camera3-viewport-binding-definition";

export function installCamera3FeatureComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, camera3RigComponentDefinition);
  installComponentDefinition(componentRegistry, camera3MotionComponentDefinition);
  installComponentDefinition(componentRegistry, sceneCamera3ViewportBindingComponentDefinition);
}
