import { describe, expect, it } from "vitest";
import { uiVec2 } from "../window-runtime";
import { AppFrameStateController, type AppStateChangedEvent } from "./app-state-controller";
import { AppStateParameterStore } from "./app-state-store";

function createStore(): AppStateParameterStore {
  const store = new AppStateParameterStore();
  store.register({
    path: "debugWindow.position",
    initialValue: uiVec2(10, 20),
    allowedOperations: ["set", "add", "reset"],
    merge: "set-then-add",
    add: (value, delta) => uiVec2(value.x + delta.x, value.y + delta.y),
    validateValue: assertVec,
    validateDelta: assertVec,
    clone: (value) => uiVec2(value.x, value.y),
    equals: (left, right) => left.x === right.x && left.y === right.y
  });
  return store;
}

describe("AppFrameStateController", () => {
  it("commits queued commands on frame update and notifies observers", () => {
    const store = createStore();
    const controller = new AppFrameStateController({ store });
    const events: AppStateChangedEvent[] = [];
    controller.subscribe({ onStateChanged: (event) => events.push(event) });

    controller.submit({
      source: { id: "window", kind: "pointer" },
      target: "debugWindow.position",
      operation: "add",
      delta: uiVec2(2, 3)
    });
    controller.submit({
      source: { id: "window", kind: "pointer" },
      target: "debugWindow.position",
      operation: "add",
      delta: uiVec2(5, -1)
    });

    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get("debugWindow.position")).toEqual(uiVec2(17, 22));
    expect(events).toHaveLength(1);
    expect(events[0]?.changes[0]?.previousValue).toEqual(uiVec2(10, 20));
    expect(events[0]?.changes[0]?.nextValue).toEqual(uiVec2(17, 22));
  });

  it("applies only the highest priority command group", () => {
    const store = createStore();
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "low", kind: "script" },
      target: "debugWindow.position",
      operation: "add",
      priority: 0,
      delta: uiVec2(100, 100)
    });
    controller.submit({
      source: { id: "high", kind: "script" },
      target: "debugWindow.position",
      operation: "set",
      priority: 10,
      value: uiVec2(40, 50)
    });
    controller.submit({
      source: { id: "high", kind: "script" },
      target: "debugWindow.position",
      operation: "add",
      priority: 10,
      delta: uiVec2(1, 2)
    });

    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get("debugWindow.position")).toEqual(uiVec2(41, 52));
  });
});

function assertVec(value: unknown): asserts value is { x: number; y: number } {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof (value as { x?: unknown }).x !== "number" ||
    typeof (value as { y?: unknown }).y !== "number"
  ) {
    throw new Error("Expected vector.");
  }
}
