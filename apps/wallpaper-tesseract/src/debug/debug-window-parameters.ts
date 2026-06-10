import type { SceneParameterStore } from "../scene-runtime";
import { editorWindowLayoutPaths } from "../editor/window-layout-state";
import { registerFloatingWindowParameters } from "../editor/adapters/floating-window-scene-state-adapter";
import {
  createDefaultFloatingWindowState,
  type FloatingWindowState,
  uiVec2
} from "../window-runtime";

export interface DebugWindowState extends FloatingWindowState {}

export interface DebugWindowStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
}

export const DEBUG_WINDOW_MIN_WIDTH = 300;
export const DEBUG_WINDOW_MIN_HEIGHT = 120;

export function createDefaultDebugWindowState(options: DebugWindowStateOptions = {}): DebugWindowState {
  return createDefaultFloatingWindowState({
    viewportWidth: options.viewportWidth,
    viewportHeight: options.viewportHeight,
    minSize: uiVec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT),
    maxSize: uiVec2(720, 240)
  });
}

export function registerDebugWindowParameters(store: SceneParameterStore, initialState: DebugWindowState): void {
  registerFloatingWindowParameters(store, {
    paths: editorWindowLayoutPaths.debugWindow,
    initialState,
    minSize: uiVec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT)
  });
}
