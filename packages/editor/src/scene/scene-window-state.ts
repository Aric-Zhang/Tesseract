import type { AppStateParameterStore } from "../app-state-store";
import { registerFloatingWindowParameters } from "../adapters/floating-window-editor-state-adapter";
import { editorWindowLayoutPaths } from "../window-layout-state";
import {
  createDefaultFloatingWindowState,
  type FloatingWindowState,
  uiVec2
} from "ui-framework";

export interface SceneWindowStateOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  visible?: boolean;
}

export interface SceneWindowInitialState extends FloatingWindowState {}

export const SCENE_WINDOW_MIN_WIDTH = 320;
export const SCENE_WINDOW_MIN_HEIGHT = 220;
export const SCENE_WINDOW_PRIORITY_DEVELOP = 900;

export function createDefaultSceneWindowState(
  options: SceneWindowStateOptions = {}
): SceneWindowInitialState {
  const margin = 18;
  const viewportWidth = options.viewportWidth ?? getViewportWidth();
  const viewportHeight = options.viewportHeight ?? getViewportHeight();
  const width = Math.max(
    SCENE_WINDOW_MIN_WIDTH,
    Math.min(viewportWidth - margin * 2, Math.round(viewportWidth * 0.68))
  );
  const height = Math.max(
    SCENE_WINDOW_MIN_HEIGHT,
    Math.min(viewportHeight - margin * 2, Math.round(viewportHeight * 0.62))
  );
  const state = createDefaultFloatingWindowState({
    viewportWidth,
    viewportHeight,
    width,
    height,
    minSize: uiVec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT),
    maxSize: uiVec2(Math.max(width, viewportWidth - margin * 2), Math.max(height, viewportHeight - margin * 2)),
    margin,
    visible: options.visible
  });
  return {
    ...state,
    position: uiVec2(
      Math.max(margin, Math.round((viewportWidth - width) * 0.5)),
      Math.max(margin, Math.round((viewportHeight - height) * 0.5))
    )
  };
}

export function registerSceneWindowParameters(
  store: AppStateParameterStore,
  initialState: SceneWindowInitialState
): void {
  registerFloatingWindowParameters(store, {
    paths: editorWindowLayoutPaths.sceneWindow,
    initialState,
    minSize: uiVec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT)
  });
}

function getViewportWidth(): number {
  return typeof window === "undefined" ? 960 : window.innerWidth;
}

function getViewportHeight(): number {
  return typeof window === "undefined" ? 720 : window.innerHeight;
}
