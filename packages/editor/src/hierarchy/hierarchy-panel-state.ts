import type { AppStatePath } from "../app-state";
import type { AppStateParameterStore } from "../app-state-store";
import { editorStatePaths } from "../editor-state";
import { editorWindowLayoutPaths } from "../window-layout-state";
import { registerFloatingWindowParameters } from "../adapters/floating-window-editor-state-adapter";
import {
  createDefaultFloatingWindowState,
  type FloatingWindowState,
  uiVec2
} from "ui-framework";

export interface HierarchyPanelStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  visible?: boolean;
  activeObject?: string | null;
}

export interface HierarchyPanelInitialState {
  window: FloatingWindowState;
  activeObject: string | null;
}

export const HIERARCHY_WINDOW_MIN_WIDTH = 240;
export const HIERARCHY_WINDOW_MIN_HEIGHT = 180;

const registeredHierarchySelectionParameters = new WeakSet<AppStateParameterStore>();

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
    },
    activeObject: options.activeObject ?? null
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
  registerSelectionParameter(store, initialState.activeObject);
}

function registerSelectionParameter(store: AppStateParameterStore, initialValue: string | null): void {
  const path = editorStatePaths.selection.activeObject as AppStatePath<string | null>;
  if (store.has(path)) {
    if (registeredHierarchySelectionParameters.has(store)) return;
    throw new Error(`Hierarchy selection parameter path is already registered outside hierarchy: ${path}`);
  }
  assertStringOrNull(initialValue);
  store.register({
    path,
    initialValue,
    allowedOperations: ["set", "reset"],
    merge: "last-write-wins",
    validateValue: assertStringOrNull
  });
  registeredHierarchySelectionParameters.add(store);
}

function assertStringOrNull(value: unknown): asserts value is string | null {
  if (typeof value !== "string" && value !== null) {
    throw new Error("Expected a string or null value.");
  }
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 720 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 720 : window.innerHeight;
}
