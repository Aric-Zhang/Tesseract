import { describe, expect, it } from "vitest";
import { AppFrameStateController } from "../app-state-controller";
import { AppStateParameterStore } from "../app-state-store";
import { editorWindowLayoutPaths } from "../window-layout-state";
import { uiVec2 } from "ui-framework/actor-ui";
import {
  createDefaultSceneWindowState,
  registerSceneWindowParameters,
  SCENE_WINDOW_MIN_HEIGHT,
  SCENE_WINDOW_MIN_WIDTH
} from "./scene-window-state";

describe("scene window state", () => {
  it("creates a centered default window state", () => {
    const state = createDefaultSceneWindowState({
      viewportWidth: 1000,
      viewportHeight: 800
    });

    expect(state.visible).toBe(true);
    expect(state.size.x).toBeGreaterThanOrEqual(SCENE_WINDOW_MIN_WIDTH);
    expect(state.size.y).toBeGreaterThanOrEqual(SCENE_WINDOW_MIN_HEIGHT);
    expect(state.position).toEqual(uiVec2(160, 152));
  });

  it("registers scene window parameters idempotently", () => {
    const store = new AppStateParameterStore();
    const state = createDefaultSceneWindowState({
      viewportWidth: 1000,
      viewportHeight: 800
    });

    registerSceneWindowParameters(store, state);
    registerSceneWindowParameters(store, state);

    expect(store.get(editorWindowLayoutPaths.sceneWindow.position)).toEqual(state.position);
    expect(store.get(editorWindowLayoutPaths.sceneWindow.size)).toEqual(state.size);
    expect(store.get(editorWindowLayoutPaths.sceneWindow.visible)).toBe(true);
  });

  it("constrains scene window size through the frame state controller", () => {
    const store = new AppStateParameterStore();
    const state = createDefaultSceneWindowState();
    registerSceneWindowParameters(store, state);
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: editorWindowLayoutPaths.sceneWindow.size,
      operation: "set",
      value: uiVec2(10, 10)
    });
    controller.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(store.get(editorWindowLayoutPaths.sceneWindow.size)).toEqual(
      uiVec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT)
    );
  });
});
