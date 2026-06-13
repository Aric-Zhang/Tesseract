import { installComponentDefinition, type ComponentRegistry } from "actor-core";
import { camera3MotionComponentDefinition } from "./camera3/camera3-motion-definition";
import { installTesseract4ComponentDefinitions } from "./tesseract4/install-component-definitions";

export function installWallpaperRuntimeComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installComponentDefinition(componentRegistry, camera3MotionComponentDefinition);
  installTesseract4ComponentDefinitions(componentRegistry);
}
