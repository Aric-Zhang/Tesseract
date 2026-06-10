import type { StateChangedEvent } from "../runtime/ports";

export type AppStatePath<TValue = unknown> = string & {
  readonly __appStateValue?: TValue;
};

export type AppStateCommandOperation = "set" | "add" | "reset";

export interface AppStateCommandSource {
  id: string;
  kind: string;
}

export interface AppStateCommand {
  source: AppStateCommandSource;
  target: string;
  operation: AppStateCommandOperation;
  value?: unknown;
  delta?: unknown;
  priority?: number;
  timeStamp?: number;
}

export interface AppStateCommandSink {
  submit(command: AppStateCommand): void;
}

export type AppStateChangedEvent = StateChangedEvent<AppStatePath, AppStateCommandSource, AppStateCommand>;

export function appStatePath<TValue = unknown>(path: string): AppStatePath<TValue> {
  return path as AppStatePath<TValue>;
}
