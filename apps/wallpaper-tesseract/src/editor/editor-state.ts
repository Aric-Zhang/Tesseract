import type { StateChangedEvent } from "../runtime/ports";

export type EditorStatePath<TValue = unknown> = string & {
  readonly __editorStateValue?: TValue;
};

export type EditorStateCommandOperation = "set" | "add" | "reset";

export interface EditorStateCommandSource {
  id: string;
  kind: "gizmo" | "keyboard" | "pointer" | "script" | "debug";
}

export interface EditorStateCommand {
  source: EditorStateCommandSource;
  target: EditorStatePath;
  operation: EditorStateCommandOperation;
  value?: unknown;
  delta?: unknown;
  priority?: number;
  timeStamp?: number;
}

export interface EditorCommandSink {
  submit(command: EditorStateCommand): void;
}

export type EditorStateChangedEvent = StateChangedEvent<
  EditorStatePath,
  EditorStateCommandSource,
  EditorStateCommand
>;

export type EditorWorkspaceMode = "run" | "develop";

export const editorStatePaths = {
  selection: {
    activeObject: editorStatePath<string | null>("selection.activeObject")
  },
  workspace: {
    mode: editorStatePath<EditorWorkspaceMode>("workspace.mode")
  }
} as const;

export function editorStatePath<TValue = unknown>(path: string): EditorStatePath<TValue> {
  return path as EditorStatePath<TValue>;
}

export function assertEditorWorkspaceMode(value: unknown): asserts value is EditorWorkspaceMode {
  if (value !== "run" && value !== "develop") {
    throw new Error("Expected workspace mode to be \"run\" or \"develop\".");
  }
}

export const noopEditorCommandSink: EditorCommandSink = {
  submit(): void {}
};
