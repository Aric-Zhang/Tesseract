import { describe, expect, it } from "vitest";
import {
  FrameStateController,
  parameterPath,
  SceneParameterStore,
  sceneParameterPaths,
  vec2
} from "../scene-runtime";
import {
  createDefaultHierarchyPanelState,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters
} from "./hierarchy-panel-state";

describe("hierarchy panel state parameters", () => {
  it("registers independent window state and active selection", () => {
    const store = new SceneParameterStore();
    const initialState = createDefaultHierarchyPanelState({
      viewportWidth: 1280,
      viewportHeight: 720,
      activeObject: "camera-3"
    });

    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(sceneParameterPaths.hierarchyWindow.position)).toEqual(vec2(14, 14));
    expect(store.get(sceneParameterPaths.hierarchyWindow.size)).toEqual(initialState.window.size);
    expect(store.get(sceneParameterPaths.hierarchyWindow.visible)).toBe(true);
    expect(store.get(sceneParameterPaths.selection.activeObject)).toBe("camera-3");
  });

  it("accepts string and null selection values through commands", () => {
    const store = new SceneParameterStore();
    const initialState = createDefaultHierarchyPanelState();
    registerHierarchyPanelParameters(store, initialState);
    const controller = new FrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: sceneParameterPaths.selection.activeObject,
      operation: "set",
      value: "tesseract-4"
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });
    controller.submit({
      source: { id: "test", kind: "script" },
      target: sceneParameterPaths.selection.activeObject,
      operation: "set",
      value: null
    });
    controller.updateFrame({ timeMs: 32, deltaMs: 16, frameIndex: 2 });

    expect(store.get(sceneParameterPaths.selection.activeObject)).toBeNull();
  });

  it("rejects non-string selection values", () => {
    const store = new SceneParameterStore();
    const initialState = createDefaultHierarchyPanelState();
    registerHierarchyPanelParameters(store, initialState);
    const controller = new FrameStateController({ store });

    expect(() => controller.submit({
      source: { id: "test", kind: "script" },
      target: sceneParameterPaths.selection.activeObject,
      operation: "set",
      value: 42
    })).toThrow(/string or null/);
  });

  it("is idempotent for the same store and rejects externally registered selection path", () => {
    const initialState = createDefaultHierarchyPanelState();
    const store = new SceneParameterStore();

    registerHierarchyPanelParameters(store, initialState);
    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(sceneParameterPaths.selection.activeObject)).toBeNull();

    const conflictingStore = new SceneParameterStore();
    conflictingStore.register({
      path: sceneParameterPaths.selection.activeObject,
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
      position: vec2(14, 14),
      size: vec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
      visible: false
    });
    expect(state.activeObject).toBeNull();
  });

  it("does not reuse debug window paths", () => {
    expect(sceneParameterPaths.hierarchyWindow.position).not.toBe(sceneParameterPaths.debugWindow.position);
    expect(sceneParameterPaths.selection.activeObject).toBe(parameterPath<string | null>("selection.activeObject"));
  });
});
