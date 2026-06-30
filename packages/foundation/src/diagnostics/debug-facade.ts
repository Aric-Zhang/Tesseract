import { createFacadeSlot, type FacadeProviderRegistration } from "../facade";

import type { DiagnosticLevel, DiagnosticSink } from "./diagnostic-event";

const debugDiagnosticProviderSlot = createFacadeSlot<DiagnosticSink>("Debug diagnostics");

export interface DebugFacade {
  log(message: unknown, data?: unknown): void;
  info(message: unknown, data?: unknown): void;
  warn(message: unknown, data?: unknown): void;
  error(message: unknown, data?: unknown): void;
}

export const Debug: DebugFacade = Object.freeze({
  log(message: unknown, data?: unknown): void {
    emitDebugDiagnostic("log", message, data);
  },

  info(message: unknown, data?: unknown): void {
    emitDebugDiagnostic("info", message, data);
  },

  warn(message: unknown, data?: unknown): void {
    emitDebugDiagnostic("warn", message, data);
  },

  error(message: unknown, data?: unknown): void {
    emitDebugDiagnostic("error", message, data);
  }
});

export function installDiagnosticProvider(provider: DiagnosticSink): FacadeProviderRegistration {
  return debugDiagnosticProviderSlot.install(provider);
}

function emitDebugDiagnostic(level: DiagnosticLevel, message: unknown, data: unknown): void {
  debugDiagnosticProviderSlot.current().emit({
    level,
    message,
    ...(data === undefined ? {} : { data })
  });
}
