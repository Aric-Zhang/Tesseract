import { describe, expect, it } from "vitest";
import { createActorInputEndEvent, createActorInputHit } from "../test-support";
import { handleWindowFrameTabInputEnd } from "./window-frame-tab-input";
import type { WindowDockCommitIntent, WindowFrameIntentSink } from "./window-frame-lifecycle";
import type { WindowTabDragSink } from "./window-dock-preview-component";

describe("handleWindowFrameTabInputEnd", () => {
  it("returns dock preview, intent, and commit result for semantic dock evidence", () => {
    const commits: WindowDockCommitIntent[] = [];
    const frameIntentSink: WindowFrameIntentSink = {
      requestOpenView: () => undefined,
      requestCloseFrame: () => undefined,
      requestCommitDock(intent) {
        commits.push(intent);
        return { committed: false, reason: "graph rejected test dock" };
      }
    };
    const tabDragSink: WindowTabDragSink = {
      beginTabDrag: () => undefined,
      moveTabDrag: () => ({ state: "idle", preview: null, source: null }),
      cancelTabDrag: () => undefined,
      endTabDrag: () => ({
        source: {
          frameId: "debug-frame",
          sourceTabsetId: "debug-tabset",
          viewActorId: "debug-view",
          viewKey: "debug"
        },
        preview: {
          kind: "split",
          operation: "same-frame-split",
          targetFrameId: "scene-frame",
          targetTabsetId: "scene-tabset",
          placement: "bottom",
          rect: { left: 0, top: 50, right: 100, bottom: 100, width: 100, height: 50 }
        }
      })
    };

    const result = handleWindowFrameTabInputEnd({
      event: createActorInputEndEvent(createActorInputHit("titlebar", {
        partId: "titlebar-empty"
      }), {
        wasClick: false
      }),
      frameId: "debug-frame",
      draggingTab: true,
      frameIntentSink,
      tabDragSink
    });

    expect(commits).toEqual([{
      kind: "split-tab",
      operation: "same-frame-split",
      source: {
        frameId: "debug-frame",
        sourceTabsetId: "debug-tabset",
        viewActorId: "debug-view",
        viewKey: "debug"
      },
      targetFrameId: "scene-frame",
      targetTabsetId: "scene-tabset",
      placement: "bottom",
      reason: "dock-drop"
    }]);
    expect(result).toMatchObject({
      handled: true,
      draggingTab: false,
      dockCommit: {
        preview: {
          kind: "split",
          operation: "same-frame-split",
          targetFrameId: "scene-frame",
          targetTabsetId: "scene-tabset",
          placement: "bottom"
        },
        intent: commits[0],
        result: { committed: false, reason: "graph rejected test dock" }
      }
    });
  });
});
