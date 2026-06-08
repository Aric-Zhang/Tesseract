import { describe, expect, it } from "vitest";
import { WindowTabDragSession } from "./window-tab-drag-session";
import type { WindowDockTargetRegion } from "./window-dock-targets";

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

const regions: WindowDockTargetRegion[] = [{
  frameId: "target",
  targetTabsetId: "frame-tabset:target",
  targetTabsetTabs: ["target:view"],
  stackPriority: 10,
  bounds: rect(100, 100, 300, 220),
  tabBounds: rect(110, 106, 80, 24),
  contentBounds: rect(100, 132, 300, 188)
}];

const source = {
  frameId: "source",
  viewActorId: "source:view",
  viewKey: "source-view"
} as const;

describe("WindowTabDragSession", () => {
  it("waits for the drag threshold before producing a preview", () => {
    const session = new WindowTabDragSession({ thresholdPx: 8 });

    session.start({ source, startPoint: { x: 10, y: 10 } });
    const pending = session.move({ x: 14, y: 13 }, regions);
    const dragging = session.move({ x: 120, y: 116 }, regions);

    expect(pending).toEqual({ state: "pending", preview: null, source });
    expect(dragging.preview).toMatchObject({
      kind: "merge-tabs",
      targetFrameId: "target",
      targetTabsetId: "frame-tabset:target"
    });
    expect(dragging.source).toBe(source);
    expect(session.state).toBe("dragging");
  });

  it("clears preview and state on end or cancel without mutating layout", () => {
    const session = new WindowTabDragSession({ thresholdPx: 1 });

    session.start({ source, startPoint: { x: 10, y: 10 } });
    session.move({ x: 120, y: 116 }, regions);
    expect(session.preview).toMatchObject({ kind: "merge-tabs" });
    const result = session.end();

    expect(result).toMatchObject({
      source,
      preview: { kind: "merge-tabs" }
    });
    expect(session.state).toBe("idle");
    expect(session.preview).toBeNull();
    expect(session.source).toBeNull();

    session.start({ source, startPoint: { x: 10, y: 10 } });
    session.move({ x: 120, y: 116 }, regions);
    session.cancel();
    expect(session.state).toBe("idle");
    expect(session.preview).toBeNull();
    expect(session.source).toBeNull();
  });
});
