import type { RuntimeNodeId } from "./runtime-id";

export interface RuntimeCommand<Type extends string = string, Payload = unknown> {
  readonly type: Type;
  readonly targetId?: RuntimeNodeId;
  readonly payload?: Payload;
}

export type RuntimeCommandResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: RuntimeCommandError };

export interface RuntimeCommandError {
  readonly code: "unknown-target" | "invalid-command" | "rejected";
  readonly message: string;
}

export interface RuntimeCommandSink<Command extends RuntimeCommand = RuntimeCommand> {
  submit(command: Command): RuntimeCommandResult;
}

export interface RuntimeQuery<Type extends string = string, Payload = unknown> {
  readonly type: Type;
  readonly targetId?: RuntimeNodeId;
  readonly payload?: Payload;
}

export type RuntimeQueryResult<Value = unknown> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: RuntimeCommandError };

export interface RuntimeQuerySource<Query extends RuntimeQuery = RuntimeQuery> {
  query<Value = unknown>(query: Query): RuntimeQueryResult<Value>;
}
