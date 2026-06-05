import {
  cloneFloatingWindowState,
  type FloatingWindowState
} from "./floating-window-state";
import { windowViewKey, type WindowViewKey } from "./window-view-key";
import {
  normalizeWindowWorkspaceFrameLayout,
  type WindowFrameDockNode,
  type WindowFrameSplitNode,
  type WindowFrameTabsetNode,
  type WindowWorkspaceFrameDescriptor,
  type WindowWorkspaceFrameLayout,
  type WindowWorkspaceViewDescriptor
} from "./window-workspace-layout";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION = 1;

export interface PersistedWindowWorkspaceViewDescriptor {
  readonly viewKey: WindowViewKey;
  readonly title?: string;
  readonly canDock?: boolean;
}

export interface PersistedWindowWorkspaceFrameDescriptor {
  readonly frameId: string;
  readonly bounds: FloatingWindowState;
  readonly presentation: WindowWorkspaceFrameDescriptor["presentation"];
  readonly root: WindowFrameDockNode;
}

export interface PersistedWindowWorkspaceFrameLayout {
  readonly version: typeof WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION;
  readonly views: readonly PersistedWindowWorkspaceViewDescriptor[];
  readonly frames: readonly PersistedWindowWorkspaceFrameDescriptor[];
  readonly hiddenViewKeys: readonly WindowViewKey[];
}

export function serializeWindowWorkspaceFrameLayout(
  layout: WindowWorkspaceFrameLayout
): PersistedWindowWorkspaceFrameLayout {
  const normalized = normalizeWindowWorkspaceFrameLayout(layout);
  return {
    version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
    views: Object.values(normalized.views).map((view) => ({
      viewKey: view.viewKey,
      title: view.title,
      canDock: view.canDock
    })),
    frames: normalized.frames.map((frame) => ({
      frameId: frame.frameId,
      bounds: cloneFloatingWindowState(frame.bounds),
      presentation: frame.presentation,
      root: cloneFrameDockNode(frame.root)
    })),
    hiddenViewKeys: [...normalized.hiddenViewKeys]
  };
}

export function hydrateWindowWorkspaceFrameLayout(
  persisted: PersistedWindowWorkspaceFrameLayout,
  runtimeViews: readonly WindowWorkspaceViewDescriptor[]
): WindowWorkspaceFrameLayout {
  const runtimeViewsByKey = new Map(runtimeViews.map((view) => [view.viewKey, view]));
  const views = persisted.views
    .map((persistedView): WindowWorkspaceViewDescriptor | null => {
      const runtimeView = runtimeViewsByKey.get(persistedView.viewKey);
      if (!runtimeView) return null;
      return {
        ...runtimeView,
        title: persistedView.title ?? runtimeView.title,
        canDock: persistedView.canDock ?? runtimeView.canDock
      };
    })
    .filter((view): view is WindowWorkspaceViewDescriptor => view !== null);

  return normalizeWindowWorkspaceFrameLayout({
    views: Object.fromEntries(views.map((view) => [view.viewKey, view])),
    frames: persisted.frames.map((frame) => ({
      frameId: frame.frameId,
      bounds: cloneFloatingWindowState(frame.bounds),
      presentation: frame.presentation,
      root: cloneFrameDockNode(frame.root)
    })),
    hiddenViewKeys: persisted.hiddenViewKeys.filter((viewKey) => runtimeViewsByKey.has(viewKey))
  });
}

export function parsePersistedWindowWorkspaceFrameLayout(
  value: unknown
): PersistedWindowWorkspaceFrameLayout | null {
  if (!isRecord(value)) return null;
  if (value.version !== WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION) return null;
  if (!Array.isArray(value.views) || !Array.isArray(value.frames) || !Array.isArray(value.hiddenViewKeys)) {
    return null;
  }
  const views = value.views
    .map(parsePersistedViewDescriptor)
    .filter((view): view is PersistedWindowWorkspaceViewDescriptor => view !== null);
  const frames = value.frames
    .map(parsePersistedFrameDescriptor)
    .filter((frame): frame is PersistedWindowWorkspaceFrameDescriptor => frame !== null);
  const hiddenViewKeys = value.hiddenViewKeys
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .map(windowViewKey);
  return {
    version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
    views,
    frames,
    hiddenViewKeys
  };
}

function parsePersistedViewDescriptor(value: unknown): PersistedWindowWorkspaceViewDescriptor | null {
  if (!isRecord(value) || typeof value.viewKey !== "string" || value.viewKey.length === 0) return null;
  return {
    viewKey: windowViewKey(value.viewKey),
    title: typeof value.title === "string" ? value.title : undefined,
    canDock: typeof value.canDock === "boolean" ? value.canDock : undefined
  };
}

function parsePersistedFrameDescriptor(value: unknown): PersistedWindowWorkspaceFrameDescriptor | null {
  if (!isRecord(value)) return null;
  if (typeof value.frameId !== "string" || value.frameId.length === 0) return null;
  if (value.presentation !== "windowed" && value.presentation !== "fullscreen") return null;
  const bounds = parseFloatingWindowState(value.bounds);
  const root = parseFrameDockNode(value.root);
  if (!bounds || !root) return null;
  return {
    frameId: value.frameId,
    bounds,
    presentation: value.presentation,
    root
  };
}

function parseFrameDockNode(value: unknown): WindowFrameDockNode | null {
  if (!isRecord(value)) return null;
  if (value.kind === "tabset") {
    if (!Array.isArray(value.tabs)) return null;
    const tabs = value.tabs
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .map(windowViewKey);
    if (tabs.length === 0) return null;
    const activeTabId = typeof value.activeTabId === "string"
      ? windowViewKey(value.activeTabId)
      : tabs[0];
    return {
      kind: "tabset",
      id: typeof value.id === "string" ? value.id : "",
      tabs,
      activeTabId
    };
  }
  if (value.kind === "split") {
    if (value.direction !== "horizontal" && value.direction !== "vertical") return null;
    const first = parseFrameDockNode(value.first);
    const second = parseFrameDockNode(value.second);
    if (!first || !second) return null;
    return {
      kind: "split",
      id: typeof value.id === "string" ? value.id : "",
      direction: value.direction,
      ratio: typeof value.ratio === "number" ? value.ratio : 0.5,
      first,
      second
    };
  }
  return null;
}

function parseFloatingWindowState(value: unknown): FloatingWindowState | null {
  if (!isRecord(value) || !isRecord(value.position) || !isRecord(value.size)) return null;
  const positionX = readFiniteNumber(value.position.x);
  const positionY = readFiniteNumber(value.position.y);
  const sizeX = readFiniteNumber(value.size.x);
  const sizeY = readFiniteNumber(value.size.y);
  if (positionX === null || positionY === null || sizeX === null || sizeY === null) return null;
  return {
    position: { x: positionX, y: positionY },
    size: { x: sizeX, y: sizeY },
    visible: typeof value.visible === "boolean" ? value.visible : true
  };
}

function cloneFrameDockNode(node: WindowFrameDockNode): WindowFrameDockNode {
  if (node.kind === "tabset") {
    return cloneFrameTabsetNode(node);
  }
  return cloneFrameSplitNode(node);
}

function cloneFrameTabsetNode(node: WindowFrameTabsetNode): WindowFrameTabsetNode {
  return {
    kind: "tabset",
    id: node.id,
    tabs: [...node.tabs],
    activeTabId: node.activeTabId
  };
}

function cloneFrameSplitNode(node: WindowFrameSplitNode): WindowFrameSplitNode {
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: cloneFrameDockNode(node.first),
    second: cloneFrameDockNode(node.second)
  };
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
