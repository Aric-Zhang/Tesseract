import { describe, expect, it } from "vitest";
import { AppFrameStateController } from "../editor/app-state-controller";
import { AppStateParameterStore } from "../editor/app-state-store";
import { editorStatePath, editorStatePaths } from "../editor/editor-state";
import { editorWindowLayoutPaths } from "../editor/window-layout-state";
import { uiVec2 } from "../window-runtime";
import {
  createDefaultHierarchyPanelState,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters
} from "./hierarchy-panel-state";

describe("hierarchy panel state parameters", () => {
  it("registers independent window state and active selection", () => {
    const store = new AppStateParameterStore();
    const initialState = createDefaultHierarchyPanelState({
      viewportWidth: 1280,
      viewportHeight: 720,
      activeObject: "camera-3"
    });

    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.position)).toEqual(uiVec2(14, 14));
    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.size)).toEqual(initialState.window.size);
    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.visible)).toBe(true);
    expect(store.get(editorStatePaths.selection.activeObject)).toBe("camera-3");
  });

  it("accepts string and null selection values through commands", () => {
    const store = new AppStateParameterStore();
    const initialState = createDefaultHierarchyPanelState();
    registerHierarchyPanelParameters(store, initialState);
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.selection.activeObject,
      operation: "set",
      value: "tesseract-4"
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });
    controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.selection.activeObject,
      operation: "set",
      value: null
    });
    controller.updateFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(store.get(editorStatePaths.selection.activeObject)).toBeNull();
  });

  it("rejects non-string selection values", () => {
    const store = new AppStateParameterStore();
    const initialState = createDefaultHierarchyPanelState();
    registerHierarchyPanelParameters(store, initialState);
    const controller = new AppFrameStateController({ store });

    expect(() => controller.submit({
      source: { id: "test", kind: "script" },
      target: editorStatePaths.selection.activeObject,
      operation: "set",
      value: 42
    })).toThrow(/string or null/);
  });

  it("is idempotent for the same store and rejects externally registered selection path", () => {
    const initialState = createDefaultHierarchyPanelState();
    const store = new AppStateParameterStore();

    registerHierarchyPanelParameters(store, initialState);
    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(editorStatePaths.selection.activeObject)).toBeNull();

    const conflictingStore = new AppStateParameterStore();
    conflictingStore.register({
      path: editorStatePaths.selection.activeObject,
      initialValue: "external",
      allowedOperations: ["set"],
      merge: "last-write-wins"
    });

    expect(() => registerHierarchyPanelParameters(conflictingStore, initialState)).toThrow(/outside hierarchy/);
  });

  it("creates a default top-left hierarchy window constrained by min size", () => {
    const state = createDefaultHierarchyPanelState({
      viewportWidth: 220,
      viewportHeight: 160,
      visible: false
    });

    expect(state.window).toEqual({
      position: uiVec2(14, 14),
      size: uiVec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
      visible: false
    });
    expect(state.activeObject).toBeNull();
  });

  it("does not reuse debug window paths", () => {
    expect(editorWindowLayoutPaths.hierarchyWindow.position).not.toBe(editorWindowLayoutPaths.debugWindow.position);
    expect(editorStatePaths.selection.activeObject).toBe(editorStatePath<string | null>("selection.activeObject"));
  });
});
