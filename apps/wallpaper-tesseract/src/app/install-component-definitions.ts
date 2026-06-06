import type { ComponentRegistry } from "../actor-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { installDebugLogComponentDefinitions } from "../debug";
import { installAppMenuComponentDefinitions } from "../features/app-menu";
import { installCamera3FeatureComponentDefinitions } from "../features/camera3/components";
import { installSceneComponentDefinitions } from "../features/scene";
import { installCamera3ComponentDefinitions } from "../gizmos/camera3/components";
import { installHierarchyComponentDefinitions } from "../hierarchy";
import { installTesseract4ComponentDefinitions } from "../tesseract4/components";
import { installWindowComponentDefinitions } from "../window-runtime";

export function installWallpaperComponentDefinitions(componentRegistry: ComponentRegistry): void {
  installCoreComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry);
  installAppMenuComponentDefinitions(componentRegistry);
  installSceneComponentDefinitions(componentRegistry);
  installCamera3FeatureComponentDefinitions(componentRegistry);
  installCamera3ComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  installHierarchyComponentDefinitions(componentRegistry);
  installTesseract4ComponentDefinitions(componentRegistry);
}
