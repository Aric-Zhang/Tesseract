import { describe, expect, it } from "vitest";
import { DebugLogDataSource } from "./debug-log-data-source";

describe("DebugLogDataSource", () => {
  it("stores log lines in a fixed-size ring buffer", () => {
    const source = new DebugLogDataSource(2);

    source.append({ type: "move", message: "first", timeStamp: 1 });
    source.append({ type: "move", message: "second", timeStamp: 2 });
    source.append({ type: "move", message: "third", timeStamp: 3 });

    expect(source.revision).toBe(3);
    expect(source.getItemCount()).toBe(2);
    expect(source.getItem(0)).toMatchObject({
      key: "debug-log-entry:2",
      text: "    2 second"
    });
    expect(source.getItem(1)).toMatchObject({
      key: "debug-log-entry:3",
      text: "    3 third"
    });
  });

  it("uses one placeholder item before the first log entry", () => {
    const source = new DebugLogDataSource(2);

    expect(source.getItemCount()).toBe(1);
    expect(source.getItem(0)).toMatchObject({
      key: "debug-log-placeholder",
      muted: true
    });
    expect(() => source.getItem(1)).toThrow("placeholder index out of range");
  });

  it("rejects invalid fixed capacities", () => {
    expect(() => new DebugLogDataSource(0)).toThrow("Invalid Debug log maxLines");
    expect(() => new DebugLogDataSource(1.5)).toThrow("Invalid Debug log maxLines");
  });
});
