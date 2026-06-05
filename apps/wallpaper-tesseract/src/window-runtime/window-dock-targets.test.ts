import { describe, expect, it } from "vitest";
import {
  resolveWindowDockPreview,
  type WindowDockTargetFrame
} from "./window-dock-targets";

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}

function frame(
  frameId: string,
  stackPriority: number,
  left = 100,
  top = 100
): WindowDockTargetFrame {
  return {
    frameId,
    stackPriority,
    bounds: rect(left, top, 300, 220),
    tabBounds: rect(left + 10, top + 6, 80, 24),
    contentBounds: rect(left, top + 32, 300, 188)
  };
}

describe("resolveWindowDockPreview", () => {
  it("resolves tab/titlebar drops to merge preview", () => {
    const preview = resolveWindowDockPreview({ x: 130, y: 116 }, [frame("target", 1)], {
      sourceFrameId: "source"
    });

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "target"
    });
  });

  it("resolves content edge drops to split preview", () => {
    expect(resolveWindowDockPreview({ x: 112, y: 210 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "left",
      targetFrameId: "target"
    });
    expect(resolveWindowDockPreview({ x: 390, y: 210 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "right",
      targetFrameId: "target"
    });
    expect(resolveWindowDockPreview({ x: 250, y: 142 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "top",
      targetFrameId: "target"
    });
    expect(resolveWindowDockPreview({ x: 250, y: 310 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "bottom",
      targetFrameId: "target"
    });
  });

  it("treats content center and missing targets as floating preview", () => {
    expect(resolveWindowDockPreview({ x: 250, y: 220 }, [frame("target", 1)])).toMatchObject({
      kind: "floating"
    });
    expect(resolveWindowDockPreview({ x: 20, y: 20 }, [frame("target", 1)])).toMatchObject({
      kind: "floating"
    });
  });

  it("chooses the highest stack priority overlapped target and excludes the source frame", () => {
    const preview = resolveWindowDockPreview({ x: 130, y: 116 }, [
      frame("source", 100),
      frame("back", 10),
      frame("front", 20)
    ], { sourceFrameId: "source" });

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "front"
    });
  });
});
