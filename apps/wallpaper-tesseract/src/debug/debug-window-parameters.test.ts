import { describe, expect, it } from "vitest";
import { FrameStateController, SceneParameterStore, sceneParameterPaths, vec2 } from "../scene-runtime";
import { createDefaultDebugWindowState, registerDebugWindowParameters } from "./debug-window-parameters";

describe("debug window parameters", () => {
  it("registers position, size, and visible state", () => {
    const store = new SceneParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);

    expect(store.get(sceneParameterPaths.debugWindow.position)).toEqual(initial.position);
    expect(store.get(sceneParameterPaths.debugWindow.size)).toEqual(initial.size);
    expect(store.get(sceneParameterPaths.debugWindow.visible)).toBe(true);
  });

  it("treats repeated equivalent registration as idempotent", () => {
    const store = new SceneParameterStore();
    const initial = createDefaultDebugWindowState();

    registerDebugWindowParameters(store, initial);
    registerDebugWindowParameters(store, initial);

    expect(store.get(sceneParameterPaths.debugWindow.position)).toEqual(initial.position);
    expect(store.get(sceneParameterPaths.debugWindow.size)).toEqual(initial.size);
  });

  it("supports frame-level position deltas", () => {
    const store = new SceneParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);
    const controller = new FrameStateController({ store });

    controller.submit({
      source: { id: "debug-log-window", kind: "gizmo" },
      target: sceneParameterPaths.debugWindow.position,
      operation: "add",
      delta: vec2(12, -8)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(sceneParameterPaths.debugWindow.position)).toEqual({
      x: initial.position.x + 12,
      y: initial.position.y - 8
    });
  });

  it("does not constrain position to the viewport", () => {
    const store = new SceneParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);
    const controller = new FrameStateController({ store });

    controller.submit({
      source: { id: "debug-log-window", kind: "gizmo" },
      target: sceneParameterPaths.debugWindow.position,
      operation: "set",
      value: vec2(-220, 960)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(sceneParameterPaths.debugWindow.position)).toEqual(vec2(-220, 960));
  });
});
