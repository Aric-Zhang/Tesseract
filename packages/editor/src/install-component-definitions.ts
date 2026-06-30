import type { ComponentRegistry } from "actor-system/core";
import type { EditorCommandSink } from "./editor-state";
import { installCamera3ComponentDefinitions } from "./camera3";
import { installDebugLogComponentDefinitions } from "./debug";
import { installHierarchyComponentDefinitions } from "./hierarchy";
import { installInspectorComponentDefinitions } from "./inspector/install-component-definitions";
import { installSceneComponentDefinitions } from "./scene";
import { installEditorStateObserverComponentDefinitions } from "./state-observer";

export interface InstallEditorComponentDefinitionsOptions {
  readonly commandSink?: EditorCommandSink;
}

export function installEditorComponentDefinitions(
  componentRegistry: ComponentRegistry,
  options: InstallEditorComponentDefinitionsOptions = {}
): void {
  installEditorStateObserverComponentDefinitions(componentRegistry);
  installInspectorComponentDefinitions(componentRegistry);
  installSceneComponentDefinitions(componentRegistry, {
    commandSink: options.commandSink
  });
  installCamera3ComponentDefinitions(componentRegistry);
  installDebugLogComponentDefinitions(componentRegistry);
  installHierarchyComponentDefinitions(componentRegistry, {
    commandSink: options.commandSink
  });
}
