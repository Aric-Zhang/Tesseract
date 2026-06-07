import type { UpdateFrame } from "./update-frame";

export interface StateChange<
  TPath extends string = string,
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

export interface StateChangedEvent<
  TPath extends string = string,
  TSource = unknown,
  TCommand = unknown
> {
  frame: UpdateFrame;
  changes: readonly StateChange<TPath, unknown, TSource, TCommand>[];
}

export interface StateObserver<TEvent extends StateChangedEvent = StateChangedEvent> {
  onStateChanged(event: TEvent): void;
}
