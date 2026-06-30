import { describe, expect, it } from "vitest";

import { DiagnosticHub } from "./diagnostic-hub";

describe("DiagnosticHub", () => {
  it("assigns monotonic ids and injected timestamps", () => {
    let timestamp = 100;
    const hub = new DiagnosticHub({ now: () => timestamp++ });

    hub.emit({ level: "log", message: "first" });
    hub.emit({ level: "warn", message: "second" });

    expect(hub.snapshot()).toMatchObject([
      { id: 1, timestampMs: 100, level: "log", message: "first" },
      { id: 2, timestampMs: 101, level: "warn", message: "second" }
    ]);
  });

  it("trims retained history to capacity", () => {
    const hub = new DiagnosticHub({ capacity: 2, now: () => 0 });

    hub.emit({ level: "log", message: "first" });
    hub.emit({ level: "log", message: "second" });
    hub.emit({ level: "log", message: "third" });

    expect(hub.snapshot().map((event) => event.message)).toEqual(["second", "third"]);
  });

  it("rejects invalid capacity", () => {
    expect(() => new DiagnosticHub({ capacity: 0 })).toThrow("positive integer");
    expect(() => new DiagnosticHub({ capacity: 1.5 })).toThrow("positive integer");
  });

  it("keeps snapshot arrays and event envelopes immutable", () => {
    const hub = new DiagnosticHub({ now: () => 0 });
    hub.emit({ level: "log", message: "message", tags: ["initial"] });

    const snapshot = hub.snapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot[0])).toBe(true);
    expect(Object.isFrozen(snapshot[0]?.tags)).toBe(true);

    expect(() => {
      (snapshot as DiagnosticHubMutationProbe[]).push({ message: "mutated" });
    }).toThrow();
    expect(() => {
      (snapshot[0] as DiagnosticHubMutationProbe).message = "mutated";
    }).toThrow();
    expect(() => {
      (snapshot[0]?.tags as string[]).push("mutated");
    }).toThrow();

    expect(hub.snapshot()[0]?.message).toBe("message");
    expect(hub.snapshot()[0]?.tags).toEqual(["initial"]);
  });

  it("clones tags while keeping data and rawMessage as opaque payload references", () => {
    const tags = ["initial"];
    const data = { count: 1 };
    const rawMessage = { kind: "raw" };
    const hub = new DiagnosticHub({ now: () => 0 });

    hub.emit({ level: "info", message: rawMessage, data, tags });
    tags.push("later");
    data.count = 2;

    const [event] = hub.snapshot();
    expect(event?.message).toBe("{\"kind\":\"raw\"}");
    expect(event?.rawMessage).toBe(rawMessage);
    expect(event?.data).toBe(data);
    expect(event?.data).toEqual({ count: 2 });
    expect(event?.tags).toEqual(["initial"]);
  });

  it("notifies subscribers in order and stops after unsubscribe", () => {
    const hub = new DiagnosticHub({ now: () => 0 });
    const seen: string[] = [];
    const registration = hub.subscribe((event) => {
      seen.push(event.message);
    });

    hub.emit({ level: "log", message: "first" });
    registration.dispose();
    registration.dispose();
    hub.emit({ level: "log", message: "second" });

    expect(seen).toEqual(["first"]);
  });

  it("retains history when a subscriber throws", () => {
    const hub = new DiagnosticHub({ now: () => 0 });
    hub.subscribe(() => {
      throw new Error("listener failed");
    });

    expect(() => hub.emit({ level: "error", message: "boom" })).toThrow("listener failed");
    expect(hub.snapshot().map((event) => event.message)).toEqual(["boom"]);
  });
});

interface DiagnosticHubMutationProbe {
  message: string;
  tags?: string[];
}
