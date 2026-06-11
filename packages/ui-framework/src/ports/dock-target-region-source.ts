import type { WindowDockTargetRegion } from "../model/window-dock-targets";
import type { WindowDockRect } from "../model/window-dock-targets";
import type { WindowFrameTargetabilitySource } from "./window-frame-targetability-source";
import type {
  WindowFrameSurfaceSnapshot,
  WindowFrameSurfaceSnapshotNode,
  WindowWorkspaceSurfaceGeometryProjection,
  WindowWorkspaceSurfaceGeometryTabset
} from "../services/window-workspace-graph-reconciler";
import type { WindowWorkspaceTabsetId } from "../model/window-workspace-graph";

export interface DockTargetRegionGraphProjection {
  readonly frameSnapshots: readonly WindowFrameSurfaceSnapshot[];
  readonly surfaceGeometries: readonly WindowWorkspaceSurfaceGeometryProjection[];
}

export interface DockTargetRegionSourceOptions {
  readonly frameTargetability: WindowFrameTargetabilitySource;
  readonly graphProjection: () => DockTargetRegionGraphProjection | null;
}

export interface DockTargetRegionSource {
  listDockTargetRegions(): readonly WindowDockTargetRegion[];
}

export function createDockTargetRegionSource(options: DockTargetRegionSourceOptions): DockTargetRegionSource {
  return {
    listDockTargetRegions() {
      const projection = options.graphProjection();
      if (!projection) return [];
      const frameSnapshotsById = new Map(projection.frameSnapshots.map((snapshot) => [snapshot.frameId, snapshot]));
      const targetabilityByFrameId = new Map(options.frameTargetability.listTargetableFrames().map((frame) => [frame.frameId, frame]));
      return projection.surfaceGeometries.flatMap((geometry, index) => {
        const snapshot = frameSnapshotsById.get(geometry.frameId);
        const targetability = targetabilityByFrameId.get(geometry.frameId);
        if (!snapshot || !targetability) return [];
        if (
          !snapshot.visible ||
          !targetability.canReceiveDockTargets ||
          !targetability.activeInHierarchy
        ) {
          return [];
        }
        return toDockTargetRegions({
          geometry,
          snapshot,
          stackPriority: targetability.stackPriority + index * 0.001
        });
      });
    }
  };
}

function toDockTargetRegions(options: {
  readonly geometry: WindowWorkspaceSurfaceGeometryProjection;
  readonly snapshot: WindowFrameSurfaceSnapshot;
  readonly stackPriority: number;
}): readonly WindowDockTargetRegion[] {
  const frameBounds = boundsFromGeometry(options.geometry);
  if (!frameBounds) return [];
  return options.geometry.tabsets.map((target: WindowWorkspaceSurfaceGeometryTabset) => ({
    frameId: options.geometry.frameId,
    targetTabsetId: target.tabsetId,
    targetTabsetTabs: listSnapshotTabsetViewActorIds(options.snapshot.root, target.tabsetId),
    stackPriority: options.stackPriority,
    bounds: frameBounds,
    tabBounds: target.tabBounds,
    contentBounds: target.contentBounds
  }));
}

function listSnapshotTabsetViewActorIds(
  node: WindowFrameSurfaceSnapshotNode,
  tabsetId: WindowWorkspaceTabsetId
): readonly string[] {
  if (node.kind === "tabset") {
    return node.id === tabsetId
      ? node.tabs.map((tab) => tab.viewActorId)
      : [];
  }
  return [
    ...listSnapshotTabsetViewActorIds(node.first, tabsetId),
    ...listSnapshotTabsetViewActorIds(node.second, tabsetId)
  ];
}

function boundsFromGeometry(geometry: WindowWorkspaceSurfaceGeometryProjection): WindowDockRect | null {
  const rects = geometry.tabsets.flatMap((tabset) => [tabset.tabBounds, tabset.contentBounds]);
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.left));
  const top = Math.min(...rects.map((rect) => rect.top));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}
