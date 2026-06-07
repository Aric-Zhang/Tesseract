import type { ComponentRegistry } from "../actor-runtime";
import type { SceneCommandSink } from "../scene-runtime";
import { installCoreComponentDefinitions } from "../component-definitions";
import { installDebugLogComponentDefinitions } from "../debug";
import { installAppMenuComponentDefinitions } from "../features/app-menu";
import { installCamera3FeatureComponentDefinitions } from "../features/camera3/components";
import { installInspectorComponentDefinitions } from "../features/inspector";
import { installSceneComponentDefinitions } from "../features/scene";
import { installCamera3ComponentDefinitions } from "../gizmos/camera3/components";
import { installHierarchyComponentDefinitions } from "../hierarchy";
import { installTesseract4ComponentDefinitions } from "../tesseract4/components";
import { installWindowComponentDefinitions, type UiLayoutCommandSink } from "../window-runtime";

export interface InstallWallpaperComponentDefinitionsOptions {
  readonly sceneCommandSink?: SceneCommandSink;
  readonly uiLayoutCommandSink?: UiLayoutCommandSink;
}

export function installWallpaperComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallWallpaperComponentDefinitionsOptions = {}
): void {
  installCoreComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry, {
    commandSink: options.uiLayoutCommandSink
  });
  installAppMenuComponentDefinitions(componentRegistry);
  installInspectorComponentDefinitions(componentRegistry);
  installSceneComponentDefinitions(componentRegistry, {
    commandSink: options.sceneCommandSink
  });
  installCamera3FeatureComponentDefinitions(componentRegistry);
  installCamera3ComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  installHierarchyComponentDefinitions(componentRegistry, {
    commandSink: options.sceneCommandSink
  });
  installTesseract4ComponentDefinitions(componentRegistry);
}
