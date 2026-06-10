import type {
  EditorCommandSink,
  EditorWorkspaceMode
} from "../editor-state";
import {
  assertEditorWorkspaceMode,
  editorStatePaths
} from "../editor-state";
import type { UiLayoutCommandSink } from "../../window-runtime";
import type {
  ParameterPath,
  SceneCommandSink,
  SceneParameterStore,
  SceneUpdateCommand
} from "../../scene-runtime";

type SceneBackedWorkspaceCommandSink = EditorCommandSink & UiLayoutCommandSink;

const registeredWorkspaceModeParameters = new WeakMap<SceneParameterStore, EditorWorkspaceMode>();

export function registerWorkspaceModeParameters(
  store: SceneParameterStore,
  initialMode: EditorWorkspaceMode = "develop"
): void {
  const path = toSceneParameterPath<EditorWorkspaceMode>(editorStatePaths.workspace.mode);
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

export function createSceneBackedWorkspaceCommandSink(
  commandSink: SceneCommandSink
): SceneBackedWorkspaceCommandSink {
  return {
    submit(command): void {
      commandSink.submit(command as unknown as SceneUpdateCommand);
    }
  };
}

function toSceneParameterPath<TValue>(path: string): ParameterPath<TValue> {
  return path as ParameterPath<TValue>;
}
