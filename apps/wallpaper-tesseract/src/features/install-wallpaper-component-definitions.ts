import type { ComponentRegistry } from "../actor-runtime";
import {
  installGizmoRuntimeComponentDefinitions,
  type GizmoEventBindingComponentDefinitionOptions
} from "../gizmo-runtime";
import { installEditorComponentDefinitions, type EditorCommandSink } from "editor";
import { installAppMenuComponentDefinitions } from "./app-menu";
import { installSceneCamera3ComponentDefinitions } from "./scene/components";
import { installTesseract4ComponentDefinitions } from "../runtime/tesseract4";
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
  installSceneCamera3ComponentDefinitions(componentRegistry);
  installTesseract4ComponentDefinitions(componentRegistry);
}
