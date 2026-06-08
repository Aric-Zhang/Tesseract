import { describe, expect, it } from "vitest";
import {
  cloneFloatingWindowState,
  createDefaultFloatingWindowState
} from "./floating-window-state";
import { uiVec2 } from "../ports/ui-geometry";

describe("floating window state", () => {
  it("creates a default state constrained by viewport and min size", () => {
    expect(createDefaultFloatingWindowState({
      viewportWidth: 420,
      viewportHeight: 720,
      minSize: uiVec2(240, 120)
    })).toEqual({
      position: uiVec2(14, 466),
      size: uiVec2(392, 240),
      visible: true
    });
  });

  it("clones state values without sharing vec objects", () => {
    const state = {
      position: uiVec2(10, 20),
      size: uiVec2(320, 180),
      visible: false
    };
    const clone = cloneFloatingWindowState(state);

    expect(clone).toEqual(state);
    expect(clone.position).not.toBe(state.position);
    expect(clone.size).not.toBe(state.size);
  });
});
