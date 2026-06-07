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
import {
  createSingletonWindowViewIdentity,
  createWindowViewKeyFromTypeAndInstance,
  windowViewInstanceId,
  windowViewTypeKey,
  type WindowViewIdentity,
  type WindowViewInstanceId,
  type WindowViewTypeKey
} from "./window-view-identity";

export const WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION = 2;
export const WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION = 1;

export interface PersistedWindowWorkspaceViewDescriptorV1 {
  readonly viewKey: WindowViewKey;
  readonly title?: string;
  readonly canDock?: boolean;
}

export interface PersistedWindowWorkspaceViewDescriptorV2 {
  readonly typeKey: WindowViewTypeKey;
  readonly instanceId: WindowViewInstanceId;
  readonly title?: string;
  readonly canDock?: boolean;
  readonly singleton?: boolean;
}

export type PersistedWindowWorkspaceViewDescriptor =
  | PersistedWindowWorkspaceViewDescriptorV1
  | PersistedWindowWorkspaceViewDescriptorV2;

export interface PersistedWindowFrameTabsetNode {
  readonly kind: "tabset";
  readonly id: string;
  readonly tabs: readonly string[];
  readonly activeTabId: string;
}

export interface PersistedWindowFrameSplitNode {
  readonly kind: "split";
  readonly id: string;
  readonly direction: WindowFrameSplitNode["direction"];
  readonly ratio: number;
  readonly first: PersistedWindowFrameDockNode;
  readonly second: PersistedWindowFrameDockNode;
}

export type PersistedWindowFrameDockNode =
  | PersistedWindowFrameTabsetNode
  | PersistedWindowFrameSplitNode;

export interface PersistedWindowWorkspaceFrameDescriptor {
  readonly frameId: string;
  readonly bounds: FloatingWindowState;
  readonly presentation: WindowWorkspaceFrameDescriptor["presentation"];
  readonly root: PersistedWindowFrameDockNode;
}

export interface PersistedWindowWorkspaceFrameLayout {
  readonly version: typeof WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION | typeof WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION;
  readonly views: readonly PersistedWindowWorkspaceViewDescriptor[];
  readonly frames: readonly PersistedWindowWorkspaceFrameDescriptor[];
  readonly hiddenViewKeys: readonly WindowViewKey[];
}

export function serializeWindowWorkspaceFrameLayout(
  layout: WindowWorkspaceFrameLayout
): PersistedWindowWorkspaceFrameLayout {
  const normalized = normalizeWindowWorkspaceFrameLayout(layout);
  const identitiesByViewKey = new Map(
    Object.values(normalized.views).map((view) => [view.viewKey, getViewDescriptorIdentity(view)])
  );
  return {
    version: WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION,
    views: Object.values(normalized.views).map((view) => ({
      typeKey: getViewDescriptorIdentity(view).typeKey,
      instanceId: getViewDescriptorIdentity(view).instanceId,
      title: view.title,
      canDock: view.canDock,
      singleton: getViewDescriptorIdentity(view).multiplicity === "singleton" ? true : undefined
    })),
    frames: normalized.frames.map((frame) => ({
      frameId: frame.frameId,
      bounds: cloneFloatingWindowState(frame.bounds),
      presentation: frame.presentation,
      root: serializeFrameDockNode(frame.root, identitiesByViewKey)
    })),
    hiddenViewKeys: []
  };
}

export function hydrateWindowWorkspaceFrameLayout(
  persisted: PersistedWindowWorkspaceFrameLayout,
  runtimeViews: readonly WindowWorkspaceViewDescriptor[]
): WindowWorkspaceFrameLayout {
  const runtimeViewsByKey = new Map(runtimeViews.map((view) => [view.viewKey, view]));
  const runtimeViewsByInstanceId = new Map(
    runtimeViews.map((view) => [getViewDescriptorIdentity(view).instanceId, view])
  );
  const runtimeViewKeyByPersistedTabId = new Map<string, WindowViewKey>();
  const views = persisted.views
    .map((persistedView): WindowWorkspaceViewDescriptor | null => {
      const identity = getPersistedViewDescriptorIdentity(persistedView);
      const runtimeView = isPersistedViewDescriptorV2(persistedView)
        ? runtimeViewsByInstanceId.get(identity.instanceId)
        : runtimeViewsByKey.get(persistedView.viewKey);
      if (!runtimeView) return null;
      runtimeViewKeyByPersistedTabId.set(getPersistedViewTabId(persistedView), runtimeView.viewKey);
      return {
        ...runtimeView,
        identity,
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
      root: hydrateFrameDockNode(frame.root, runtimeViewKeyByPersistedTabId)
    })),
    hiddenViewKeys: persisted.version === WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION
      ? persisted.hiddenViewKeys.filter((viewKey) => runtimeViewsByKey.has(viewKey))
      : []
  });
}

export function parsePersistedWindowWorkspaceFrameLayout(
  value: unknown
): PersistedWindowWorkspaceFrameLayout | null {
  if (!isRecord(value)) return null;
  const version = value.version;
  if (
    version !== WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION &&
    version !== WINDOW_WORKSPACE_FRAME_LAYOUT_PERSISTENCE_VERSION
  ) {
    return null;
  }
  if (!Array.isArray(value.views) || !Array.isArray(value.frames) || !Array.isArray(value.hiddenViewKeys)) {
    return null;
  }
  const views = value.views
    .map((view) => parsePersistedViewDescriptor(view, version))
    .filter((view): view is PersistedWindowWorkspaceViewDescriptor => view !== null);
  const frames = value.frames
    .map(parsePersistedFrameDescriptor)
    .filter((frame): frame is PersistedWindowWorkspaceFrameDescriptor => frame !== null);
  const hiddenViewKeys = value.hiddenViewKeys
    .filter((item): item is string => typeof item === "string" && item.length > 0)
    .map(windowViewKey);
  return {
    version,
    views,
    frames,
    hiddenViewKeys
  };
}

function parsePersistedViewDescriptor(
  value: unknown,
  version: PersistedWindowWorkspaceFrameLayout["version"]
): PersistedWindowWorkspaceViewDescriptor | null {
  if (!isRecord(value)) return null;
  if (version === WINDOW_WORKSPACE_FRAME_LAYOUT_LEGACY_VERSION) {
    if (typeof value.viewKey !== "string" || value.viewKey.length === 0) return null;
    return {
      viewKey: windowViewKey(value.viewKey),
      title: typeof value.title === "string" ? value.title : undefined,
      canDock: typeof value.canDock === "boolean" ? value.canDock : undefined
    };
  }
  if (typeof value.typeKey !== "string" || value.typeKey.length === 0) return null;
  if (typeof value.instanceId !== "string" || value.instanceId.length === 0) return null;
  return {
    typeKey: windowViewTypeKey(value.typeKey),
    instanceId: windowViewInstanceId(value.instanceId),
    title: typeof value.title === "string" ? value.title : undefined,
    canDock: typeof value.canDock === "boolean" ? value.canDock : undefined,
    singleton: typeof value.singleton === "boolean" ? value.singleton : undefined
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

function parseFrameDockNode(value: unknown): PersistedWindowFrameDockNode | null {
  if (!isRecord(value)) return null;
  if (value.kind === "tabset") {
    if (!Array.isArray(value.tabs)) return null;
    const tabs = value.tabs
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    if (tabs.length === 0) return null;
    const activeTabId = typeof value.activeTabId === "string" && value.activeTabId.length > 0
      ? value.activeTabId
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

function serializeFrameDockNode(
  node: WindowFrameDockNode,
  identitiesByViewKey: ReadonlyMap<WindowViewKey, WindowViewIdentity>
): PersistedWindowFrameDockNode {
  if (node.kind === "tabset") {
    return serializeFrameTabsetNode(node, identitiesByViewKey);
  }
  return serializeFrameSplitNode(node, identitiesByViewKey);
}

function serializeFrameTabsetNode(
  node: WindowFrameTabsetNode,
  identitiesByViewKey: ReadonlyMap<WindowViewKey, WindowViewIdentity>
): PersistedWindowFrameTabsetNode {
  return {
    kind: "tabset",
    id: node.id,
    tabs: node.tabs.map((viewKey) => identitiesByViewKey.get(viewKey)?.instanceId ?? viewKey),
    activeTabId: identitiesByViewKey.get(node.activeTabId)?.instanceId ?? node.activeTabId
  };
}

function serializeFrameSplitNode(
  node: WindowFrameSplitNode,
  identitiesByViewKey: ReadonlyMap<WindowViewKey, WindowViewIdentity>
): PersistedWindowFrameSplitNode {
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: serializeFrameDockNode(node.first, identitiesByViewKey),
    second: serializeFrameDockNode(node.second, identitiesByViewKey)
  };
}

function hydrateFrameDockNode(
  node: PersistedWindowFrameDockNode,
  viewKeyByPersistedTabId: ReadonlyMap<string, WindowViewKey>
): WindowFrameDockNode {
  if (node.kind === "tabset") {
    const tabs = node.tabs
      .map((tabId) => viewKeyByPersistedTabId.get(tabId))
      .filter((viewKey): viewKey is WindowViewKey => viewKey !== undefined);
    const activeTabId = viewKeyByPersistedTabId.get(node.activeTabId) ?? tabs[0] ?? windowViewKey(node.activeTabId);
    return {
      kind: "tabset",
      id: node.id,
      tabs,
      activeTabId
    };
  }
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    ratio: node.ratio,
    first: hydrateFrameDockNode(node.first, viewKeyByPersistedTabId),
    second: hydrateFrameDockNode(node.second, viewKeyByPersistedTabId)
  };
}

function getViewDescriptorIdentity(view: WindowWorkspaceViewDescriptor): WindowViewIdentity {
  return view.identity ?? createSingletonWindowViewIdentity(view.viewKey);
}

export function getPersistedViewDescriptorIdentity(
  view: PersistedWindowWorkspaceViewDescriptor
): WindowViewIdentity {
  if (isPersistedViewDescriptorV2(view)) {
    return {
      viewKey: createWindowViewKeyFromTypeAndInstance(view.typeKey, view.instanceId),
      typeKey: view.typeKey,
      instanceId: view.instanceId,
      multiplicity: view.singleton ? "singleton" : "multi-instance"
    };
  }
  return createSingletonWindowViewIdentity(view.viewKey);
}

export function getPersistedViewDescriptorRuntimeViewKey(
  view: PersistedWindowWorkspaceViewDescriptor
): WindowViewKey {
  if (!isPersistedViewDescriptorV2(view)) return view.viewKey;
  return view.singleton
    ? windowViewKey(view.typeKey)
    : createWindowViewKeyFromTypeAndInstance(view.typeKey, view.instanceId);
}

function getPersistedViewTabId(view: PersistedWindowWorkspaceViewDescriptor): string {
  return isPersistedViewDescriptorV2(view) ? view.instanceId : view.viewKey;
}

function isPersistedViewDescriptorV2(
  view: PersistedWindowWorkspaceViewDescriptor
): view is PersistedWindowWorkspaceViewDescriptorV2 {
  return "instanceId" in view;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
