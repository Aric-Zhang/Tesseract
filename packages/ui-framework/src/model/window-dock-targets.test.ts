import { describe, expect, it } from "vitest";
import {
  resolveWindowDockPreview,
  type WindowDockTargetRegion
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
): WindowDockTargetRegion {
  return {
    frameId,
    targetTabsetId: `frame-tabset:${frameId}`,
    stackPriority,
    bounds: rect(left, top, 300, 220),
    tabBounds: rect(left + 10, top + 6, 80, 24),
    contentBounds: rect(left, top + 32, 300, 188)
  };
}

function splitRegion(
  targetTabsetId: string,
  tabBounds: ReturnType<typeof rect>,
  contentBounds: ReturnType<typeof rect>
): WindowDockTargetRegion {
  return {
    frameId: "split-frame",
    targetTabsetId,
    stackPriority: 10,
    bounds: rect(100, 100, 300, 220),
    tabBounds,
    contentBounds
  };
}

describe("resolveWindowDockPreview", () => {
  it("resolves tab/titlebar drops to merge preview", () => {
    const preview = resolveWindowDockPreview({ x: 130, y: 116 }, [frame("target", 1)], {
      sourceFrameId: "source"
    });

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
  });

  it("resolves content edge drops to split preview", () => {
    expect(resolveWindowDockPreview({ x: 112, y: 210 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "left",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(resolveWindowDockPreview({ x: 390, y: 210 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "right",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(resolveWindowDockPreview({ x: 250, y: 142 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "top",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(resolveWindowDockPreview({ x: 250, y: 310 }, [frame("target", 1)])).toMatchObject({
      kind: "split",
      placement: "bottom",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
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

  it("treats drops over the source frame as floating so self-drops do not re-dock", () => {
    expect(resolveWindowDockPreview({ x: 130, y: 116 }, [frame("source", 10)], {
      sourceFrameId: "source"
    })).toMatchObject({
      kind: "floating"
    });
  });

  it("resolves same-frame content edge drops when the source tabset is known", () => {
    expect(resolveWindowDockPreview({ x: 112, y: 210 }, [frame("source", 10)], {
      sourceFrameId: "source",
      sourceTabsetId: "frame-tabset:source"
    })).toMatchObject({
      kind: "split",
      operation: "same-frame-split",
      placement: "left",
      targetFrameId: "source",
      targetTabsetId: "frame-tabset:source"
    });
  });

  it("marks same-tabset tabbar drops as no-op instead of cross-frame merge", () => {
    expect(resolveWindowDockPreview({ x: 130, y: 116 }, [frame("source", 10)], {
      sourceFrameId: "source",
      sourceTabsetId: "frame-tabset:source"
    })).toMatchObject({
      kind: "merge-tabs",
      operation: "no-op",
      targetFrameId: "source",
      targetTabsetId: "frame-tabset:source"
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
      targetFrameId: "front",
      targetTabsetId: "frame-tabset:front"
    });
  });

  it("resolves merge drops against the concrete tabset region under the pointer", () => {
    const preview = resolveWindowDockPreview({ x: 302, y: 116 }, [
      splitRegion("left-tabset", rect(110, 106, 120, 24), rect(100, 132, 145, 188)),
      splitRegion("right-tabset", rect(260, 106, 120, 24), rect(255, 132, 145, 188))
    ]);

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "split-frame",
      targetTabsetId: "right-tabset"
    });
  });

  it("resolves split drops against the concrete tabset content region under the pointer", () => {
    const preview = resolveWindowDockPreview({ x: 262, y: 230 }, [
      splitRegion("left-tabset", rect(110, 106, 120, 24), rect(100, 132, 145, 188)),
      splitRegion("right-tabset", rect(260, 106, 120, 24), rect(255, 132, 145, 188))
    ]);

    expect(preview).toMatchObject({
      kind: "split",
      placement: "left",
      targetFrameId: "split-frame",
      targetTabsetId: "right-tabset"
    });
  });

  it("keeps content centers floating even when a split frame has multiple tabset targets", () => {
    expect(resolveWindowDockPreview({ x: 330, y: 230 }, [
      splitRegion("left-tabset", rect(110, 106, 120, 24), rect(100, 132, 145, 188)),
      splitRegion("right-tabset", rect(260, 106, 120, 24), rect(255, 132, 145, 188))
    ])).toMatchObject({
      kind: "floating"
    });
  });

  it("prefers tab merge over content split when target regions overlap at the same priority", () => {
    const preview = resolveWindowDockPreview({ x: 140, y: 142 }, [
      {
        ...frame("split-target", 10),
        targetTabsetId: "split-target",
        tabBounds: rect(100, 100, 20, 20),
        contentBounds: rect(100, 132, 300, 188)
      },
      {
        ...frame("merge-target", 10),
        targetTabsetId: "merge-target",
        tabBounds: rect(120, 132, 140, 30),
        contentBounds: rect(100, 132, 300, 188)
      }
    ]);

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetTabsetId: "merge-target"
    });
  });

  it("uses source order only after priority, preview kind, and area specificity tie", () => {
    const preview = resolveWindowDockPreview({ x: 130, y: 116 }, [
      { ...frame("first", 10), targetTabsetId: "first-tabset" },
      { ...frame("second", 10), targetTabsetId: "second-tabset" }
    ]);

    expect(preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "first",
      targetTabsetId: "first-tabset"
    });
  });
});
