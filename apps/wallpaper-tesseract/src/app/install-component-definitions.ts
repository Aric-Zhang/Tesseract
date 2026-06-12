import type { ComponentRegistry } from "../actor-runtime";
import {
  installGizmoRuntimeComponentDefinitions,
  type GizmoEventBindingComponentDefinitionOptions
} from "../gizmo-runtime";
import { installEditorComponentDefinitions, type EditorCommandSink } from "editor";
import { installAppMenuComponentDefinitions } from "../features/app-menu";
import { installCamera3FeatureComponentDefinitions } from "../features/camera3/components";
import { installTesseract4ComponentDefinitions } from "../tesseract4/components";
import { installWindowComponentDefinitions, type UiLayoutCommandSink } from "../window-runtime";

export interface InstallWallpaperComponentDefinitionsOptions {
  readonly gizmoEventBinding?: GizmoEventBindingComponentDefinitionOptions;
  readonly editorCommandSink?: EditorCommandSink;
  readonly uiLayoutCommandSink?: UiLayoutCommandSink;
}

export function installWallpaperComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallWallpaperComponentDefinitionsOptions = {}
): void {
  installGizmoRuntimeComponentDefinitions(componentRegistry, {
    gizmoEventBinding: options.gizmoEventBinding
  });
  installWindowComponentDefinitions(componentRegistry, {
    commandSink: options.uiLayoutCommandSink
  });
  installAppMenuComponentDefinitions(componentRegistry);
  installEditorComponentDefinitions(componentRegistry, {
    commandSink: options.editorCommandSink
  });
  installCamera3FeatureComponentDefinitions(componentRegistry);
  installTesseract4ComponentDefinitions(componentRegistry);
}
