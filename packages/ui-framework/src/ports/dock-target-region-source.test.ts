import { describe, expect, it } from "vitest";
import { createDockTargetRegionSource } from "./dock-target-region-source";
import type { WindowFrameTargetability, WindowFrameTargetabilitySource } from "./window-frame-targetability-source";
import type { WindowDockRect } from "../model/window-dock-targets";
import {
  windowWorkspaceContentId,
  windowWorkspaceFrameId,
  windowWorkspaceTabsetId
} from "../model/window-workspace-graph";
import { createSingletonWindowViewIdentity } from "../model/window-view-identity";
import type { DockTargetRegionGraphProjection } from "./dock-target-region-source";

describe("createDockTargetRegionSource", () => {
  it("lists registered frame port tabset targets", () => {
    const source = createDockTargetRegionSource({
      frameTargetability: createTargetabilitySource([createTargetability("workspace-root-frame", 100)]),
      graphProjection: () => createGraphProjection("workspace-root-frame", rect(0, 24, 1024, 720), 100)
    });

    expect(source.listDockTargetRegions()).toEqual([{
      frameId: "workspace-root-frame",
      targetTabsetId: "workspace-root-frame:tabset",
      targetTabsetTabs: ["workspace-root-frame:view"],
      stackPriority: 100,
      bounds: rect(0, 24, 1024, 720),
      tabBounds: rect(0, 24, 1024, 24),
      contentBounds: rect(0, 48, 1024, 696)
    }]);
  });

  it("filters hidden, inactive, and non-targetable frames", () => {
    const source = createDockTargetRegionSource({
      frameTargetability: createTargetabilitySource([
        createTargetability("visible", 10),
        createTargetability("hidden", 20),
        createTargetability("inactive", 30, { activeInHierarchy: false }),
        createTargetability("disabled-target", 40, { canReceiveDockTargets: false })
      ]),
      graphProjection: () => ({
        frameSnapshots: [
          createFrameSnapshot("visible", 10),
          createFrameSnapshot("hidden", 20, false),
          createFrameSnapshot("inactive", 30),
          createFrameSnapshot("disabled-target", 40)
        ],
        surfaceGeometries: [
          createSurfaceGeometry("visible", rect(0, 0, 100, 100)),
          createSurfaceGeometry("hidden", rect(0, 0, 100, 100)),
          createSurfaceGeometry("inactive", rect(0, 0, 100, 100)),
          createSurfaceGeometry("disabled-target", rect(0, 0, 100, 100))
        ]
      })
    });

    expect(source.listDockTargetRegions().map((region) => region.frameId)).toEqual(["visible"]);
  });

  it("keeps stack priority stable while preserving registry order as a tiebreaker", () => {
    const source = createDockTargetRegionSource({
      frameTargetability: createTargetabilitySource([
        createTargetability("first", 10),
        createTargetability("second", 10)
      ]),
      graphProjection: () => ({
        frameSnapshots: [
          createFrameSnapshot("first", 10),
          createFrameSnapshot("second", 10)
        ],
        surfaceGeometries: [
          createSurfaceGeometry("first", rect(0, 0, 100, 100)),
          createSurfaceGeometry("second", rect(0, 0, 100, 100))
        ]
      })
    });

    expect(source.listDockTargetRegions().map((region) => region.stackPriority)).toEqual([10, 10.001]);
  });
});

function createTargetabilitySource(frames: readonly WindowFrameTargetability[]): WindowFrameTargetabilitySource {
  return {
    listTargetableFrames: () => frames
  };
}

function createTargetability(
  frameId: string,
  stackPriority: number,
  options: {
    readonly activeInHierarchy?: boolean;
    readonly canReceiveDockTargets?: boolean;
  } = {}
): WindowFrameTargetability {
  return {
    frameId,
    frameActorId: frameId,
    activeInHierarchy: options.activeInHierarchy ?? true,
    canReceiveDockTargets: options.canReceiveDockTargets ?? true,
    stackPriority
  };
}

function createGraphProjection(frameId: string, bounds: WindowDockRect, stackPriority: number): DockTargetRegionGraphProjection {
  return {
    frameSnapshots: [createFrameSnapshot(frameId, stackPriority)],
    surfaceGeometries: [createSurfaceGeometry(frameId, bounds)]
  };
}

function createFrameSnapshot(
  frameId: string,
  stackPriority: number,
  visible = true
): DockTargetRegionGraphProjection["frameSnapshots"][number] {
  const contentId = windowWorkspaceContentId(`${frameId}:content`);
  return {
    frameId: windowWorkspaceFrameId(frameId),
    kind: "persistent",
    presentation: "windowed",
    revision: 1,
    visible,
    stackPriority,
    root: {
      kind: "tabset",
      id: windowWorkspaceTabsetId(`${frameId}:tabset`),
      activeContentId: contentId,
      tabs: [{
        contentId,
        viewActorId: `${frameId}:view`,
        identity: createSingletonWindowViewIdentity(frameId),
        title: frameId,
        active: true
      }]
    }
  };
}

function createSurfaceGeometry(
  frameId: string,
  bounds: WindowDockRect
): DockTargetRegionGraphProjection["surfaceGeometries"][number] {
  return {
    frameId: windowWorkspaceFrameId(frameId),
    revision: 1,
    tabsets: [{
      tabsetId: windowWorkspaceTabsetId(`${frameId}:tabset`),
      contentIds: [windowWorkspaceContentId(`${frameId}:content`)],
      tabBounds: rect(bounds.left, bounds.top, bounds.width, 24),
      contentBounds: rect(bounds.left, bounds.top + 24, bounds.width, bounds.height - 24)
    }],
    splitters: [],
    issues: []
  };
}

function rect(left: number, top: number, width: number, height: number): WindowDockRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height
  };
}
