import type { WindowRegisteredContent } from "../ports/window-content-host";
import type {
  WindowWorkspaceContentId,
  WindowWorkspaceGraphCommit,
  WindowWorkspaceGraphTransaction,
  WindowWorkspaceGraphTransactionResult,
  WindowWorkspaceGraphDockNode,
  WindowWorkspaceGraphFrameSnapshot,
  WindowWorkspaceGraphPlacement,
  WindowWorkspaceGraphSnapshot,
  WindowWorkspaceFrameId,
  WindowWorkspaceSplitId,
  WindowWorkspaceTabsetId,
  WindowWorkspaceRealizationMap
} from "../model/window-workspace-graph";
import { reduceWindowWorkspaceGraphTransaction } from "../model/window-workspace-graph";
import type { WindowViewIdentity } from "../model/window-view-identity";
import type { WindowDockRect } from "../model/window-dock-targets";

export interface WindowFrameSurfaceSnapshotTab {
  readonly contentId: WindowWorkspaceContentId;
  readonly viewActorId: string;
  readonly identity: WindowViewIdentity;
  readonly title?: string;
  readonly active: boolean;
}

export interface WindowFrameSurfaceSnapshotTabsetNode {
  readonly kind: "tabset";
  readonly id: WindowWorkspaceTabsetId;
  readonly tabs: readonly WindowFrameSurfaceSnapshotTab[];
  readonly activeContentId: WindowWorkspaceContentId | null;
}

export interface WindowFrameSurfaceSnapshotSplitNode {
  readonly kind: "split";
  readonly id: WindowWorkspaceSplitId;
  readonly direction: "horizontal" | "vertical";
  readonly ratio: number;
  readonly first: WindowFrameSurfaceSnapshotNode;
  readonly second: WindowFrameSurfaceSnapshotNode;
}

export type WindowFrameSurfaceSnapshotNode =
  | WindowFrameSurfaceSnapshotTabsetNode
  | WindowFrameSurfaceSnapshotSplitNode;

export interface WindowFrameSurfaceSnapshot {
  readonly frameId: WindowWorkspaceFrameId;
  readonly kind: WindowWorkspaceGraphFrameSnapshot["kind"];
  readonly presentation: WindowWorkspaceGraphFrameSnapshot["presentation"];
  readonly revision: number;
  readonly root: WindowFrameSurfaceSnapshotNode;
  readonly visible: boolean;
  readonly stackPriority: number;
}

export interface WindowWorkspaceGraphProjectionIssue {
  readonly severity: "soft" | "hard";
  readonly code:
    | "missing-frame-surface"
    | "missing-content"
    | "missing-view-actor"
    | "unrealizable-tabset"
    | "missing-surface-geometry";
  readonly message: string;
}

export interface WindowWorkspaceSurfaceGeometryIssue {
  readonly code:
    | "missing-tabset-target"
    | "missing-splitter"
    | "duplicate-content";
  readonly message: string;
}

export interface WindowWorkspaceSurfaceGeometryTabset {
  readonly tabsetId: WindowWorkspaceTabsetId;
  readonly contentIds: readonly WindowWorkspaceContentId[];
  readonly tabBounds: WindowDockRect;
  readonly contentBounds: WindowDockRect;
}

export interface WindowWorkspaceSurfaceGeometrySplitter {
  readonly splitId: WindowWorkspaceSplitId;
  readonly direction: "horizontal" | "vertical";
  readonly rect: WindowDockRect;
}

export interface WindowWorkspaceSurfaceGeometryProjection {
  readonly frameId: WindowWorkspaceFrameId;
  readonly revision: number;
  readonly tabsets: readonly WindowWorkspaceSurfaceGeometryTabset[];
  readonly splitters: readonly WindowWorkspaceSurfaceGeometrySplitter[];
  readonly issues: readonly WindowWorkspaceSurfaceGeometryIssue[];
}

export interface WindowWorkspaceGraphProjectionResult<TFrameSurface> {
  readonly frameSnapshots: readonly WindowFrameSurfaceSnapshot[];
  readonly frameSurfaces: readonly TFrameSurface[];
  readonly surfaceGeometries: readonly WindowWorkspaceSurfaceGeometryProjection[];
  readonly issues: readonly WindowWorkspaceGraphProjectionIssue[];
}

export interface WindowWorkspaceGraphTransactionReconcileResult<TFrameSurface>
  extends WindowWorkspaceGraphTransactionResult {
  readonly projection: WindowWorkspaceGraphProjectionResult<TFrameSurface> | null;
  readonly hardIssues: readonly WindowWorkspaceGraphProjectionIssue[];
  readonly softIssues: readonly WindowWorkspaceGraphProjectionIssue[];
}

export interface WindowWorkspaceGraphContentPlacement<TContent> {
  readonly content: TContent;
  readonly placement: WindowWorkspaceGraphPlacement;
}

export interface WindowWorkspaceGraphReconcilerSurface<TContent> {
  readonly frameId: string;
  renderFrameSurface(snapshot: WindowFrameSurfaceSnapshot): void;
  measureFrameSurfaceGeometry(snapshot: WindowFrameSurfaceSnapshot): WindowWorkspaceSurfaceGeometryProjection;
  placeContent(placement: WindowWorkspaceGraphContentPlacement<TContent>): void;
}

export interface ProjectWindowWorkspaceGraphCommitOptions<TContent = WindowRegisteredContent, TFrameSurface = unknown> {
  readonly commit: WindowWorkspaceGraphCommit;
  readonly realization: WindowWorkspaceRealizationMap<TContent, TFrameSurface>;
  readonly getTitle?: (identity: WindowViewIdentity) => string | undefined;
}

export function projectWindowWorkspaceGraphCommit<TContent = WindowRegisteredContent, TFrameSurface = unknown>(
  options: ProjectWindowWorkspaceGraphCommitOptions<TContent, TFrameSurface>
): WindowWorkspaceGraphProjectionResult<TFrameSurface> {
  const issues: WindowWorkspaceGraphProjectionIssue[] = [];
  const frameSnapshots: WindowFrameSurfaceSnapshot[] = [];
  const frameSurfaces: TFrameSurface[] = [];
  const placementsByContentId = new Map(
    options.commit.snapshot.placements.map((placement) => [placement.contentId, placement])
  );

  for (const frame of options.commit.snapshot.frames) {
    const surface = options.realization.getFrameSurface(frame.frameId);
    if (!surface) {
      issues.push({
        severity: "hard",
        code: "missing-frame-surface",
        message: `frame ${frame.frameId} has no realized surface`
      });
      continue;
    }
    const root = projectDockNode({
      node: frame.root,
      frame,
      placementsByContentId,
      realization: options.realization,
      getTitle: options.getTitle,
      issues
    });
    if (!root) continue;
    frameSurfaces.push(surface);
    frameSnapshots.push({
      frameId: frame.frameId,
      kind: frame.kind,
      presentation: frame.presentation,
      revision: options.commit.nextRevision,
      root,
      visible: frame.visible,
      stackPriority: frame.stackPriority
    });
  }

  return {
    frameSnapshots,
    frameSurfaces,
    surfaceGeometries: [],
    issues
  };
}

export function reconcileWindowWorkspaceGraphCommit<TContent, TFrameSurface extends WindowWorkspaceGraphReconcilerSurface<TContent>>(
  options: ProjectWindowWorkspaceGraphCommitOptions<TContent, TFrameSurface>
): WindowWorkspaceGraphProjectionResult<TFrameSurface> {
  const result = projectWindowWorkspaceGraphCommit(options);
  if (result.issues.some((issue) => issue.severity === "hard")) {
    return {
      ...result,
      surfaceGeometries: []
    };
  }
  const surfaceGeometries: WindowWorkspaceSurfaceGeometryProjection[] = [];
  const geometryIssues: WindowWorkspaceGraphProjectionIssue[] = [];
  const renderedFrameIds = new Set<string>();
  for (let index = 0; index < result.frameSnapshots.length; index += 1) {
    const snapshot = result.frameSnapshots[index]!;
    const surface = result.frameSurfaces[index];
    surface?.renderFrameSurface(snapshot);
    const geometry = surface?.measureFrameSurfaceGeometry(snapshot);
    if (geometry) {
      surfaceGeometries.push(geometry);
      for (const issue of geometry.issues) {
        geometryIssues.push({
          severity: "soft",
          code: "missing-surface-geometry",
          message: issue.message
        });
      }
    }
    renderedFrameIds.add(snapshot.frameId);
  }
  for (const placement of options.commit.snapshot.placements) {
    if (!renderedFrameIds.has(placement.frameId)) continue;
    const content = options.realization.getContent(placement.contentId);
    if (!content) continue;
    const surface = options.realization.getFrameSurface(placement.frameId);
    surface?.placeContent({ content, placement });
  }
  return {
    ...result,
    surfaceGeometries,
    issues: [...result.issues, ...geometryIssues]
  };
}

export function reconcileWindowWorkspaceGraphTransaction<TContent, TFrameSurface extends WindowWorkspaceGraphReconcilerSurface<TContent>>(
  options: {
    readonly snapshot: WindowWorkspaceGraphSnapshot;
    readonly transaction: WindowWorkspaceGraphTransaction;
    readonly realization: WindowWorkspaceRealizationMap<TContent, TFrameSurface>;
    readonly getTitle?: (identity: WindowViewIdentity) => string | undefined;
  }
): WindowWorkspaceGraphTransactionReconcileResult<TFrameSurface> {
  const reduced = reduceWindowWorkspaceGraphTransaction({
    snapshot: options.snapshot,
    transaction: options.transaction
  });
  if (!reduced.committed || !reduced.commit) {
    return {
      ...reduced,
      projection: null,
      hardIssues: [],
      softIssues: []
    };
  }
  const projection = reconcileWindowWorkspaceGraphCommit({
    commit: reduced.commit,
    realization: options.realization,
    getTitle: options.getTitle
  });
  const hardIssues = projection.issues.filter((issue) => issue.severity === "hard");
  const softIssues = projection.issues.filter((issue) => issue.severity === "soft");
  if (hardIssues.length > 0) {
    return {
      ...reduced,
      committed: false,
      nextSnapshot: reduced.rollbackSnapshot,
      commit: null,
      changedContentIds: [],
      createdFrameIds: [],
      removedFrameIds: [],
      warnings: [
        ...reduced.warnings,
        ...hardIssues.map((issue) => issue.message)
      ],
      projection,
      hardIssues,
      softIssues
    };
  }
  return {
    ...reduced,
    projection,
    hardIssues,
    softIssues
  };
}

function projectDockNode<TContent, TFrameSurface>(options: {
  readonly node: WindowWorkspaceGraphDockNode;
  readonly frame: WindowWorkspaceGraphFrameSnapshot;
  readonly placementsByContentId: ReadonlyMap<WindowWorkspaceContentId, WindowWorkspaceGraphPlacement>;
  readonly realization: WindowWorkspaceRealizationMap<TContent, TFrameSurface>;
  readonly getTitle?: (identity: WindowViewIdentity) => string | undefined;
  readonly issues: WindowWorkspaceGraphProjectionIssue[];
}): WindowFrameSurfaceSnapshotNode | null {
  const { node } = options;
  if (node.kind === "split") {
    const first = projectDockNode({ ...options, node: node.first });
    const second = projectDockNode({ ...options, node: node.second });
    if (!first || !second) return null;
    return {
      kind: "split",
      id: node.id,
      direction: node.direction,
      ratio: node.ratio,
      first,
      second
    };
  }

  const tabs: WindowFrameSurfaceSnapshotTab[] = [];
  for (const contentId of node.contentIds) {
    const placement = options.placementsByContentId.get(contentId);
    if (!placement) {
      options.issues.push({
        severity: "hard",
        code: "unrealizable-tabset",
        message: `tabset ${node.id} references content ${contentId} without placement`
      });
      continue;
    }
    const content = options.realization.getContent(contentId);
    if (!content) {
      options.issues.push({
        severity: "hard",
        code: "missing-content",
        message: `content ${contentId} is not registered`
      });
      continue;
    }
    const viewActorId = options.realization.getViewActorId(placement.identity);
    if (!viewActorId) {
      options.issues.push({
        severity: "hard",
        code: "missing-view-actor",
        message: `content ${contentId} has no realized view actor`
      });
      continue;
    }
    tabs.push({
      contentId,
      viewActorId,
      identity: placement.identity,
      title: options.getTitle?.(placement.identity),
      active: placement.active
    });
  }
  if (node.contentIds.length > 0 && tabs.length === 0) return null;
  return {
    kind: "tabset",
    id: node.id,
    tabs,
    activeContentId: node.activeContentId
  };
}
