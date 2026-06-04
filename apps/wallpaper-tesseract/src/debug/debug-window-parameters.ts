import { sceneParameterPaths, vec2, type SceneParameterStore } from "../scene-runtime";
import {
  createDefaultFloatingWindowState,
  registerFloatingWindowParameters,
  type FloatingWindowState
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
    minSize: vec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT),
    maxSize: vec2(720, 240)
  });
}

export function registerDebugWindowParameters(store: SceneParameterStore, initialState: DebugWindowState): void {
  registerFloatingWindowParameters(store, {
    paths: sceneParameterPaths.debugWindow,
    initialState,
    minSize: vec2(DEBUG_WINDOW_MIN_WIDTH, DEBUG_WINDOW_MIN_HEIGHT)
  });
}
