import { describe, expect, it } from "vitest";
import { FrameStateController, SceneParameterStore, sceneParameterPaths, vec2 } from "../../scene-runtime";
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
    expect(state.position).toEqual(vec2(160, 152));
  });

  it("registers scene window parameters idempotently", () => {
    const store = new SceneParameterStore();
    const state = createDefaultSceneWindowState({
      viewportWidth: 1000,
      viewportHeight: 800
    });

    registerSceneWindowParameters(store, state);
    registerSceneWindowParameters(store, state);

    expect(store.get(sceneParameterPaths.sceneWindow.position)).toEqual(state.position);
    expect(store.get(sceneParameterPaths.sceneWindow.size)).toEqual(state.size);
    expect(store.get(sceneParameterPaths.sceneWindow.visible)).toBe(true);
  });

  it("constrains scene window size through the frame state controller", () => {
    const store = new SceneParameterStore();
    const state = createDefaultSceneWindowState();
    registerSceneWindowParameters(store, state);
    const controller = new FrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "script" },
      target: sceneParameterPaths.sceneWindow.size,
      operation: "set",
      value: vec2(10, 10)
    });
    controller.updateFrame({ timeMs: 0, deltaMs: 0, frameIndex: 0 });

    expect(store.get(sceneParameterPaths.sceneWindow.size)).toEqual(
      vec2(SCENE_WINDOW_MIN_WIDTH, SCENE_WINDOW_MIN_HEIGHT)
    );
  });
});
