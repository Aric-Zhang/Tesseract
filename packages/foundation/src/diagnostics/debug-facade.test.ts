import { describe, expect, it } from "vitest";

import { Debug, installDiagnosticProvider } from "./debug-facade";
import type { DiagnosticEventInput, DiagnosticSink } from "./diagnostic-event";

describe("Debug", () => {
  it("throws before a diagnostic provider is installed", () => {
    expect(() => Debug.log("message")).toThrow("Debug diagnostics");
  });

  it("forwards log levels to the installed provider", () => {
    const sink = new RecordingDiagnosticSink();
    const registration = installDiagnosticProvider(sink);

    try {
      Debug.log("log");
      Debug.info("info");
      Debug.warn("warn", { detail: true });
      Debug.error("error");

      expect(sink.events).toEqual([
        { level: "log", message: "log" },
        { level: "info", message: "info" },
        { level: "warn", message: "warn", data: { detail: true } },
        { level: "error", message: "error" }
      ]);
    } finally {
      registration.dispose();
    }
  });

  it("rejects double provider install and restores uninstalled state after dispose", () => {
    const registration = installDiagnosticProvider(new RecordingDiagnosticSink());

    try {
      expect(() => installDiagnosticProvider(new RecordingDiagnosticSink())).toThrow("already installed");
    } finally {
      registration.dispose();
    }

    expect(() => Debug.log("message")).toThrow("Debug diagnostics");
  });
});

class RecordingDiagnosticSink implements DiagnosticSink {
  readonly events: DiagnosticEventInput[] = [];

  emit(input: DiagnosticEventInput): void {
    this.events.push(input);
  }
}
