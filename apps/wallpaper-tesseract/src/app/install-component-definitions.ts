import type { ComponentRegistry } from "../actor-runtime";
import {
  installGizmoRuntimeComponentDefinitions,
  type GizmoEventBindingComponentDefinitionOptions
} from "../gizmo-runtime";
import { installEditorStateObserverComponentDefinitions } from "editor";
import type { EditorCommandSink } from "editor";
import { installDebugLogComponentDefinitions } from "editor";
import { installAppMenuComponentDefinitions } from "../features/app-menu";
import { installCamera3FeatureComponentDefinitions } from "../features/camera3/components";
import { installInspectorComponentDefinitions } from "editor";
import { installSceneComponentDefinitions } from "editor";
import { installCamera3ComponentDefinitions } from "../gizmos/camera3/components";
import { installHierarchyComponentDefinitions } from "editor";
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
  installEditorStateObserverComponentDefinitions(componentRegistry);
  installWindowComponentDefinitions(componentRegistry, {
    commandSink: options.uiLayoutCommandSink
  });
  installAppMenuComponentDefinitions(componentRegistry);
  installInspectorComponentDefinitions(componentRegistry);
  installSceneComponentDefinitions(componentRegistry, {
    commandSink: options.editorCommandSink
  });
  installCamera3FeatureComponentDefinitions(componentRegistry);
  installCamera3ComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  installHierarchyComponentDefinitions(componentRegistry, {
    commandSink: options.editorCommandSink
  });
  installTesseract4ComponentDefinitions(componentRegistry);
}
