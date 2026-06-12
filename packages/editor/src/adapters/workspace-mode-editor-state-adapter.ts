import type {
  EditorCommandSink,
  EditorWorkspaceMode
} from "../editor-state";
import {
  assertEditorWorkspaceMode,
  editorStatePaths
} from "../editor-state";
import type { UiLayoutCommandSink } from "ui-framework";
import type { AppStateCommandSink } from "../app-state";
import type { AppStateParameterStore } from "../app-state-store";

type EditorBackedWorkspaceCommandSink = EditorCommandSink & UiLayoutCommandSink;

const registeredWorkspaceModeParameters = new WeakMap<AppStateParameterStore, EditorWorkspaceMode>();

export function registerWorkspaceModeParameters(
  store: AppStateParameterStore,
  initialMode: EditorWorkspaceMode = "develop"
): void {
  const path = editorStatePaths.workspace.mode;
  assertEditorWorkspaceMode(initialMode);
  if (store.has(path)) {
    const existingInitialMode = registeredWorkspaceModeParameters.get(store);
    if (existingInitialMode === initialMode) return;
    throw new Error(`Workspace mode parameter path is already registered outside workspace mode: ${path}`);
  }
  store.register({
    path,
    initialValue: initialMode,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertEditorWorkspaceMode
  });
  registeredWorkspaceModeParameters.set(store, initialMode);
}

export function createEditorBackedWorkspaceCommandSink(
  commandSink: AppStateCommandSink
): EditorBackedWorkspaceCommandSink {
  return {
    submit(command): void {
      commandSink.submit(command);
    }
  };
}
