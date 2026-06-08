import { describe, expect, it } from "vitest";
import {
  addVec2,
  assertVec2,
  cloneVec2,
  equalsVec2,
  FrameStateController,
  SceneParameterStore,
  vec2,
  type SceneStateChangedEvent
} from ".";

function createStore() {
  const store = new SceneParameterStore();
  store.register({
    path: "debugWindow.position",
    initialValue: vec2(10, 20),
    allowedOperations: ["set", "add", "reset"],
    merge: "set-then-add",
    validateValue: assertVec2,
    validateDelta: assertVec2,
    add: addVec2,
    clone: cloneVec2,
    equals: equalsVec2
  });
  return store;
}

const frame = { timeMs: 16, deltaMs: 16, frameIndex: 1 };
const source = { id: "debug-window", kind: "gizmo" as const };

describe("FrameStateController", () => {
  it("rejects commands for unregistered paths", () => {
    const controller = new FrameStateController({ store: createStore() });

    expect(() => {
      controller.submit({
        source,
        target: "missing.path",
        operation: "set",
        value: 1
      });
    }).toThrow(/not registered/);
  });

  it("rejects invalid operations and value types", () => {
    const controller = new FrameStateController({ store: createStore() });

    expect(() => {
      controller.submit({
        source,
        target: "debugWindow.position",
        operation: "set",
        value: 5
      });
    }).toThrow(/Vec2/);
  });

  it("commits multiple additive updates once per frame", () => {
    const store = createStore();
    const controller = new FrameStateController({ store });
    const events: SceneStateChangedEvent[] = [];
    controller.subscribe({ onStateChanged: (event) => events.push(event) });

    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "add",
      delta: vec2(2, 3)
    });
    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "add",
      delta: vec2(5, -1)
    });
    controller.updateFrame(frame);

    expect(store.get("debugWindow.position")).toEqual(vec2(17, 22));
    expect(events).toHaveLength(1);
    expect(events[0]?.changes).toHaveLength(1);
    expect(events[0]?.changes[0]?.previousValue).toEqual(vec2(10, 20));
    expect(events[0]?.changes[0]?.nextValue).toEqual(vec2(17, 22));
  });

  it("uses the last set as base before applying additive updates", () => {
    const store = createStore();
    const controller = new FrameStateController({ store });

    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "add",
      delta: vec2(100, 100)
    });
    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "set",
      value: vec2(40, 50)
    });
    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "add",
      delta: vec2(1, 2)
    });
    controller.updateFrame(frame);

    expect(store.get("debugWindow.position")).toEqual(vec2(141, 152));
  });

  it("defers commands submitted by observers to the next frame", () => {
    const store = createStore();
    const controller = new FrameStateController({ store });
    controller.subscribe({
      onStateChanged: () => {
        controller.submit({
          source: { id: "observer", kind: "script" },
          target: "debugWindow.position",
          operation: "add",
          delta: vec2(5, 0)
        });
      }
    });

    controller.submit({
      source,
      target: "debugWindow.position",
      operation: "add",
      delta: vec2(1, 0)
    });
    controller.updateFrame(frame);
    expect(store.get("debugWindow.position")).toEqual(vec2(11, 20));

    controller.updateFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 });
    expect(store.get("debugWindow.position")).toEqual(vec2(16, 20));
  });
});
