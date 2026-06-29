import { describe, expect, it } from "vitest";
import { uiLayoutPath, uiVec2, type UiVec2 } from "ui-framework/actor-ui";
import { type FloatingWindowParameterPaths } from "ui-framework/window";
import { AppFrameStateController } from "../app-state-controller";
import { AppStateParameterStore } from "../app-state-store";
import { registerFloatingWindowParameters } from "./floating-window-editor-state-adapter";

describe("floating window editor state adapter", () => {
  it("registers position, size, and visible state", () => {
    const store = new AppStateParameterStore();
    const paths = createPaths("test");
    const initialState = {
      position: uiVec2(10, 20),
      size: uiVec2(300, 200),
      visible: true
    };

    registerFloatingWindowParameters(store, { paths, initialState });

    expect(store.get(paths.position)).toEqual(initialState.position);
    expect(store.get(paths.size)).toEqual(initialState.size);
    expect(store.get(paths.visible)).toBe(true);
  });

  it("applies additive position commands through AppFrameStateController", () => {
    const store = new AppStateParameterStore();
    const paths = createPaths("test");
    registerFloatingWindowParameters(store, {
      paths,
      initialState: {
        position: uiVec2(10, 20),
        size: uiVec2(300, 200),
        visible: true
      }
    });
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "pointer" },
      target: paths.position,
      operation: "add",
      delta: uiVec2(5, -3)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(paths.position)).toEqual(uiVec2(15, 17));
  });

  it("constrains size to the supplied minimum", () => {
    const store = new AppStateParameterStore();
    const paths = createPaths("test");
    registerFloatingWindowParameters(store, {
      paths,
      initialState: {
        position: uiVec2(10, 20),
        size: uiVec2(300, 200),
        visible: true
      },
      minSize: uiVec2(120, 90)
    });
    const controller = new AppFrameStateController({ store });

    controller.submit({
      source: { id: "test", kind: "pointer" },
      target: paths.size,
      operation: "set",
      value: uiVec2(1, 2)
    });
    controller.updateFrame({ timeMs: 16, deltaMs: 16, frameIndex: 1 });

    expect(store.get(paths.size)).toEqual(uiVec2(120, 90));
  });
});

function createPaths(prefix: string): FloatingWindowParameterPaths {
  return {
    position: uiLayoutPath<UiVec2>(`${prefix}.position`),
    size: uiLayoutPath<UiVec2>(`${prefix}.size`),
    visible: uiLayoutPath<boolean>(`${prefix}.visible`)
  };
}
