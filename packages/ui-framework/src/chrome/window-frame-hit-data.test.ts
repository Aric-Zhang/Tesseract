import { describe, expect, it } from "vitest";
import type { ActorInputHit } from "actor-input";
import {
  readFloatingWindowSplitterHitData,
  readWindowTabDragSource
} from "./window-frame-hit-data";

describe("floating window hit data", () => {
  it("reads tab drag source identity from structured window-tab hits", () => {
    const hit = createActorInputHit("window", {
      partId: "window-tab",
      data: {
        tab: {
          viewActorId: "debug-view",
          viewKey: "debug",
          title: "Debug Log"
        }
      }
    });

    expect(readWindowTabDragSource("debug-frame", hit)).toEqual({
      frameId: "debug-frame",
      viewActorId: "debug-view",
      viewKey: "debug"
    });
  });

  it("rejects malformed tab drag source hits", () => {
    expect(readWindowTabDragSource("frame", createActorInputHit("window", {
      partId: "window-tab",
      data: { tab: { viewActorId: "debug-view" } }
    }))).toBeNull();
    expect(readWindowTabDragSource("frame", createActorInputHit("window", {
      partId: "window-tab",
      data: { tab: { viewKey: "debug" } }
    }))).toBeNull();
    expect(readWindowTabDragSource("frame", createActorInputHit("window", {
      partId: "window-tab",
      data: null
    }))).toBeNull();
  });

  it("reads splitter hit data only for valid split directions", () => {
    expect(readFloatingWindowSplitterHitData(createActorInputHit("window", {
      partId: "splitter",
      data: {
        splitId: "split:root",
        direction: "horizontal"
      }
    }))).toEqual({
      splitId: "split:root",
      direction: "horizontal"
    });
    expect(readFloatingWindowSplitterHitData(createActorInputHit("window", {
      partId: "splitter",
      data: {
        splitId: "split:root",
        direction: "diagonal"
      }
    }))).toBeNull();
  });
});

function createActorInputHit(
  componentId: string,
  partial: Pick<ActorInputHit, "partId"> & Partial<ActorInputHit>
): ActorInputHit {
  return {
    ...partial,
    componentId,
    partId: partial.partId,
    kind: "chrome",
    region: "window-frame",
    localRoutePriority: 0,
    path: []
  };
}
