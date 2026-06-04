import type { SceneUpdateSource } from "./scene-update-source";

export type ParameterPath<TValue = unknown> = string & {
  readonly __parameterValue?: TValue;
};
export type SceneUpdateOperation = "set" | "add" | "reset";

export function parameterPath<TValue = unknown>(path: string): ParameterPath<TValue> {
  return path as ParameterPath<TValue>;
}

export interface SceneUpdateCommand {
  source: SceneUpdateSource;
  target: ParameterPath;
  operation: SceneUpdateOperation;
  value?: unknown;
  delta?: unknown;
  priority?: number;
  timeStamp?: number;
}

export interface SceneCommandSink {
  submit(command: SceneUpdateCommand): void;
}
