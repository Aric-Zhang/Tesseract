import type { UiFrame } from "./ui-scheduler";

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

export interface UiLayoutStateReader {
  get<TValue = unknown>(path: UiLayoutPath<TValue>): TValue;
}

export interface UiLayoutStateChange<
  TPath extends string = UiLayoutPath,
  TValue = unknown,
  TSource = unknown,
  TCommand = unknown
> {
  path: TPath;
  previousValue: TValue;
  nextValue: TValue;
  sources: readonly TSource[];
  commands: readonly TCommand[];
}

export interface UiLayoutStateChangedEvent<
  TPath extends string = UiLayoutPath,
  TSource = unknown,
  TCommand = unknown
> {
  frame: UiFrame;
  changes: readonly UiLayoutStateChange<TPath, unknown, TSource, TCommand>[];
}

export function uiLayoutPath<TValue = unknown>(path: string): UiLayoutPath<TValue> {
  return path as UiLayoutPath<TValue>;
}
