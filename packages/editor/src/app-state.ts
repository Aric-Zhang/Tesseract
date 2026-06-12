import type { RuntimeFrame } from "runtime-core";

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

export interface AppStateChange<TValue = unknown> {
  readonly path: string;
  readonly previousValue: TValue;
  readonly nextValue: TValue;
  readonly sources: readonly AppStateCommandSource[];
  readonly commands: readonly AppStateCommand[];
}

export interface AppStateChangedEvent {
  readonly frame: RuntimeFrame;
  readonly changes: readonly AppStateChange[];
}

export interface AppStateObserver {
  onStateChanged(event: AppStateChangedEvent): void;
}

export function appStatePath<TValue = unknown>(path: string): AppStatePath<TValue> {
  return path as AppStatePath<TValue>;
}
