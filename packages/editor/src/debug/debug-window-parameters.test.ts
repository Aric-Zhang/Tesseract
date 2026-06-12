import { describe, expect, it } from "vitest";
import { AppFrameStateController } from "../app-state-controller";
import { AppStateParameterStore } from "../app-state-store";
import { editorWindowLayoutPaths } from "../window-layout-state";
import { uiVec2 } from "ui-framework";
import { createDefaultDebugWindowState, registerDebugWindowParameters } from "./debug-window-parameters";

describe("debug window parameters", () => {
  it("registers position, size, and visible state", () => {
    const store = new AppStateParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);

    expect(store.get(editorWindowLayoutPaths.debugWindow.position)).toEqual(initial.position);
    expect(store.get(editorWindowLayoutPaths.debugWindow.size)).toEqual(initial.size);
    expect(store.get(editorWindowLayoutPaths.debugWindow.visible)).toBe(true);
  });

  it("treats repeated equivalent registration as idempotent", () => {
    const store = new AppStateParameterStore();
    const initial = createDefaultDebugWindowState();

    registerDebugWindowParameters(store, initial);
    registerDebugWindowParameters(store, initial);

    expect(store.get(editorWindowLayoutPaths.debugWindow.position)).toEqual(initial.position);
    expect(store.get(editorWindowLayoutPaths.debugWindow.size)).toEqual(initial.size);
  });

  it("supports frame-level position deltas", () => {
    const store = new AppStateParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "debug-log-window", kind: "gizmo" },
      target: editorWindowLayoutPaths.debugWindow.position,
      operation: "add",
      delta: uiVec2(12, -8)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(editorWindowLayoutPaths.debugWindow.position)).toEqual({
      x: initial.position.x + 12,
      y: initial.position.y - 8
    });
  });

  it("does not constrain position to the viewport", () => {
    const store = new AppStateParameterStore();
    const initial = createDefaultDebugWindowState();
    registerDebugWindowParameters(store, initial);
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "debug-log-window", kind: "gizmo" },
      target: editorWindowLayoutPaths.debugWindow.position,
      operation: "set",
      value: uiVec2(-220, 960)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(editorWindowLayoutPaths.debugWindow.position)).toEqual(uiVec2(-220, 960));
  });
});
