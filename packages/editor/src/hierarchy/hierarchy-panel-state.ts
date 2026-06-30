import type { AppStateParameterStore } from "../app-state-store";
import { editorWindowLayoutPaths } from "../window-layout-state";
import { registerFloatingWindowParameters } from "../adapters/floating-window-editor-state-adapter";
import { createDefaultFloatingWindowState, type FloatingWindowState } from "ui-framework/window";
import { uiVec2 } from "ui-framework/actor-ui";

export interface HierarchyPanelStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  visible?: boolean;
}

export interface HierarchyPanelInitialState {
  window: FloatingWindowState;
}

export const HIERARCHY_WINDOW_MIN_WIDTH = 240;
export const HIERARCHY_WINDOW_MIN_HEIGHT = 180;

export function createDefaultHierarchyPanelState(
  options: HierarchyPanelStateOptions = {}
): HierarchyPanelInitialState {
  const margin = 14;
  const viewportWidth = options.viewportWidth ?? getViewportWidth();
  const viewportHeight = options.viewportHeight ?? getViewportHeight();
  const window = createDefaultFloatingWindowState({
    viewportWidth,
    viewportHeight,
    width: Math.max(HIERARCHY_WINDOW_MIN_WIDTH, Math.min(280, viewportWidth - margin * 2)),
    height: Math.max(HIERARCHY_WINDOW_MIN_HEIGHT, Math.min(360, viewportHeight - margin * 2)),
    minSize: uiVec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT),
    maxSize: uiVec2(420, 560),
    margin,
    visible: options.visible
  });
  return {
    window: {
      ...window,
      position: uiVec2(14, 14)
    }
  };
}

export function registerHierarchyPanelParameters(
  store: AppStateParameterStore,
  initialState: HierarchyPanelInitialState
): void {
  registerFloatingWindowParameters(store, {
    paths: editorWindowLayoutPaths.hierarchyWindow,
    initialState: initialState.window,
    minSize: uiVec2(HIERARCHY_WINDOW_MIN_WIDTH, HIERARCHY_WINDOW_MIN_HEIGHT)
  });
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 720 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 720 : window.innerHeight;
}
