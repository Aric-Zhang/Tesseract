import type { FacadeProviderRegistration } from "../facade";

export type DiagnosticLevel = "log" | "info" | "warn" | "error";

export interface DiagnosticEventInput {
  readonly level: DiagnosticLevel;
  readonly message: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

export interface DiagnosticEvent {
  readonly id: number;
  readonly timestampMs: number;
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly rawMessage?: unknown;
  readonly data?: unknown;
  readonly source?: string;
  readonly tags?: readonly string[];
}

export interface DiagnosticSink {
  emit(input: DiagnosticEventInput): void;
}

export interface DiagnosticSource {
  snapshot(): readonly DiagnosticEvent[];
  subscribe(listener: DiagnosticEventListener): FacadeProviderRegistration;
}

export type DiagnosticEventListener = (event: DiagnosticEvent) => void;
