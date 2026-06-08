import { describe, expect, it } from "vitest";
import { FrameStateController, parameterPath, SceneParameterStore, vec2 } from "../../scene-runtime";
import type { FloatingWindowParameterPaths } from "ui-framework";
import { registerFloatingWindowParameters } from "./floating-window-scene-state-adapter";

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: parameterPath(`${prefix}.position`),
    size: parameterPath(`${prefix}.size`),
    visible: parameterPath(`${prefix}.visible`)
  };
}

describe("floating window scene state adapter", () => {
  it("registers position, size, and visible state", () => {
    const store = new SceneParameterStore();
    const paths = createPaths("testWindow");
    const initialState = {
      position: vec2(12, 24),
      size: vec2(300, 180),
      visible: true
    };

    registerFloatingWindowParameters(store, { paths, initialState });

    expect(store.get(paths.position)).toEqual(initialState.position);
    expect(store.get(paths.size)).toEqual(initialState.size);
    expect(store.get(paths.visible)).toBe(true);
  });

  it("constrains size to minSize", () => {
    const store = new SceneParameterStore();
    const paths = createPaths("testWindow");
    registerFloatingWindowParameters(store, {
      paths,
      initialState: {
        position: vec2(0, 0),
        size: vec2(100, 80),
        visible: true
      },
      minSize: vec2(240, 120)
    });
    const controller = new FrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: paths.size,
      operation: "set",
      value: vec2(120, 40)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(paths.size)).toEqual(vec2(240, 120));
  });

  it("allows multiple windows with different paths", () => {
    const store = new SceneParameterStore();
    const first = createPaths("firstWindow");
    const second = createPaths("secondWindow");

    registerFloatingWindowParameters(store, {
      paths: first,
      initialState: { position: vec2(0, 0), size: vec2(300, 180), visible: true }
    });
    registerFloatingWindowParameters(store, {
      paths: second,
      initialState: { position: vec2(40, 60), size: vec2(360, 220), visible: false }
    });

    expect(store.get(first.position)).toEqual(vec2(0, 0));
    expect(store.get(second.position)).toEqual(vec2(40, 60));
    expect(store.get(second.visible)).toBe(false);
  });

  it("treats identical repeated registrations as idempotent", () => {
    const store = new SceneParameterStore();
    const paths = createPaths("testWindow");
    const initialState = {
      position: vec2(12, 24),
      size: vec2(300, 180),
      visible: true
    };

    registerFloatingWindowParameters(store, { paths, initialState, minSize: vec2(240, 120) });
    registerFloatingWindowParameters(store, { paths, initialState, minSize: vec2(240, 120) });

    expect(store.get(paths.position)).toEqual(initialState.position);
    expect(store.get(paths.size)).toEqual(initialState.size);
  });

  it("rejects repeated registrations with different definitions", () => {
    const store = new SceneParameterStore();
    const paths = createPaths("testWindow");
    registerFloatingWindowParameters(store, {
      paths,
      initialState: { position: vec2(12, 24), size: vec2(300, 180), visible: true },
      minSize: vec2(240, 120)
    });

    expect(() => registerFloatingWindowParameters(store, {
      paths,
      initialState: { position: vec2(12, 24), size: vec2(300, 180), visible: true },
      minSize: vec2(320, 160)
    })).toThrow(/different definition/);
  });

  it("rejects reused paths that were registered outside window-runtime", () => {
    const store = new SceneParameterStore();
    const paths = createPaths("testWindow");
    store.register({
      path: paths.position,
      initialValue: vec2(0, 0),
      allowedOperations: ["set"],
      merge: "last-write-wins"
    });

    expect(() => registerFloatingWindowParameters(store, {
      paths,
      initialState: { position: vec2(0, 0), size: vec2(300, 180), visible: true }
    })).toThrow(/outside window-runtime/);
  });
});
