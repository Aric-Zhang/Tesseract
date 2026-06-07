export type UiLayoutPath<TValue = unknown> = string & {
  readonly __uiLayoutValue?: TValue;
};

export type UiLayoutCommandOperation = "set" | "add" | "reset";

export interface UiLayoutCommandSource {
  id: string;
  kind: "pointer" | "keyboard" | "script" | "debug";
}

export interface UiLayoutCommand {
  source: UiLayoutCommandSource;
  target: UiLayoutPath;
  operation: UiLayoutCommandOperation;
  value?: unknown;
  delta?: unknown;
  priority?: number;
  timeStamp?: number;
}

export interface UiLayoutCommandSink {
  submit(command: UiLayoutCommand): void;
}

export function uiLayoutPath<TValue = unknown>(path: string): UiLayoutPath<TValue> {
  return path as UiLayoutPath<TValue>;
}
