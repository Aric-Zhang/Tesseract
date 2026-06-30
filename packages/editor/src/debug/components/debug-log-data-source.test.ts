import { describe, expect, it } from "vitest";
import { DiagnosticHub } from "foundation/diagnostics";

import { DebugLogDataSource } from "./debug-log-data-source";

describe("DebugLogDataSource", () => {
  it("adapts the initial diagnostic snapshot to virtual list rows", () => {
    const hub = new DiagnosticHub({ capacity: 2, now: () => 12 });
    hub.emit({
      level: "warn",
      message: "first",
      source: "test-source",
      tags: ["tag"]
    });
    const source = new DebugLogDataSource(hub);

    expect(source.revision).toBe(0);
    expect(source.getItemCount()).toBe(1);
    expect(source.getItem(0)).toEqual({
      key: "diagnostic:1",
      text: "   12 WARN test-source [tag] first"
    });

    source.dispose();
  });

  it("updates revision from diagnostic source events", () => {
    const hub = new DiagnosticHub({ capacity: 3, now: () => 1 });
    const source = new DebugLogDataSource(hub);

    hub.emit({ level: "log", message: "first" });
    hub.emit({ level: "error", message: "second" });

    expect(source.revision).toBe(2);
    expect(source.getItemCount()).toBe(2);
    expect(source.getItem(0).key).toBe("diagnostic:1");
    expect(source.getItem(1).key).toBe("diagnostic:2");

    source.dispose();
  });

  it("uses one placeholder item before the first diagnostic event", () => {
    const source = new DebugLogDataSource(new DiagnosticHub());

    expect(source.getItemCount()).toBe(1);
    expect(source.getItem(0)).toMatchObject({
      key: "debug-log-placeholder",
      muted: true
    });
    expect(() => source.getItem(1)).toThrow("placeholder index out of range");

    source.dispose();
  });

  it("does not derive display text from opaque data payloads", () => {
    const hub = new DiagnosticHub({ now: () => 5 });
    const source = new DebugLogDataSource(hub);

    hub.emit({
      level: "log",
      message: "visible",
      data: {
        type: "secret",
        timeStamp: 999,
        message: "hidden"
      }
    });

    expect(source.getItem(0).text).toBe("    5 LOG visible");

    source.dispose();
  });

  it("unsubscribes on dispose", () => {
    const hub = new DiagnosticHub({ now: () => 0 });
    const source = new DebugLogDataSource(hub);

    source.dispose();
    hub.emit({ level: "log", message: "ignored" });

    expect(source.revision).toBe(0);
    expect(source.getItemCount()).toBe(1);
  });

  it("uses diagnostic hub capacity instead of owning a second retained history", () => {
    const hub = new DiagnosticHub({ capacity: 2, now: () => 0 });
    const source = new DebugLogDataSource(hub);

    hub.emit({ level: "log", message: "first" });
    hub.emit({ level: "log", message: "second" });
    hub.emit({ level: "log", message: "third" });

    expect(source.getItemCount()).toBe(2);
    expect(source.getItem(0)).toMatchObject({
      key: "diagnostic:2",
      text: "    0 LOG second"
    });
    expect(source.getItem(1)).toMatchObject({
      key: "diagnostic:3",
      text: "    0 LOG third"
    });

    source.dispose();
  });
});
