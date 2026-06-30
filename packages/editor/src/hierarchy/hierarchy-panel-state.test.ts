import { describe, expect, it } from "vitest";
import { AppStateParameterStore } from "../app-state-store";
import { editorWindowLayoutPaths } from "../window-layout-state";
import { uiVec2 } from "ui-framework/actor-ui";
import {
  createDefaultHierarchyPanelState,
  HIERARCHY_WINDOW_MIN_HEIGHT,
  HIERARCHY_WINDOW_MIN_WIDTH,
  registerHierarchyPanelParameters
} from "./hierarchy-panel-state";

describe("hierarchy panel state parameters", () => {
  it("registers independent window state without owning editor selection", () => {
    const store = new AppStateParameterStore();
    const initialState = createDefaultHierarchyPanelState({
      viewportWidth: 1280,
      viewportHeight: 720
    });

    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.position)).toEqual(uiVec2(14, 14));
    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.size)).toEqual(initialState.window.size);
    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.visible)).toBe(true);
  });

  it("is idempotent for the same store", () => {
    const initialState = createDefaultHierarchyPanelState();
    const store = new AppStateParameterStore();

    registerHierarchyPanelParameters(store, initialState);
    registerHierarchyPanelParameters(store, initialState);

    expect(store.get(editorWindowLayoutPaths.hierarchyWindow.position)).toEqual(uiVec2(14, 14));
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
  });

  it("does not reuse debug window paths", () => {
    expect(editorWindowLayoutPaths.hierarchyWindow.position).not.toBe(editorWindowLayoutPaths.debugWindow.position);
  });
});
