import { cloneFloatingWindowState, type FloatingWindowState } from "./floating-window-state";
import type { WindowViewIdentity } from "./window-view-identity";
import type { WindowViewKey } from "./window-view-key";

export type WindowWorkspaceSplitDirection = "horizontal" | "vertical";
export type WindowWorkspaceSplitPlacement = "before" | "after";

export type WindowFrameSplitPlacement = "left" | "right" | "top" | "bottom";
export type WindowWorkspaceFramePresentation = "windowed" | "fullscreen";

export interface WindowWorkspaceViewDescriptor {
  readonly viewKey: WindowViewKey;
  readonly identity?: WindowViewIdentity;
  readonly actorId: string;
  readonly title?: string;
  readonly canDock?: boolean;
}

export interface WindowFrameTabsetNode {
  readonly kind: "tabset";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly tabs: readonly WindowViewKey[];
  readonly activeTabId: WindowViewKey;
}

export interface WindowFrameSplitNode {
  readonly kind: "split";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly direction: WindowWorkspaceSplitDirection;
  readonly ratio: number;
  readonly first: WindowFrameDockNode;
  readonly second: WindowFrameDockNode;
}

export type WindowFrameDockNode = WindowFrameTabsetNode | WindowFrameSplitNode;

export interface WindowWorkspaceFrameDescriptor {
  readonly frameId: string;
  readonly bounds: FloatingWindowState;
  readonly presentation: WindowWorkspaceFramePresentation;
  readonly root: WindowFrameDockNode;
}

export interface WindowWorkspaceFrameLayout {
  readonly views: Readonly<Record<string, WindowWorkspaceViewDescriptor>>;
  readonly frames: readonly WindowWorkspaceFrameDescriptor[];
  readonly hiddenViewKeys: readonly WindowViewKey[];
}

export interface CreateWindowWorkspaceFrameLayoutOptions {
  readonly views?: readonly WindowWorkspaceViewDescriptor[];
  readonly frames?: readonly WindowWorkspaceFrameDescriptor[];
  readonly hiddenViewKeys?: readonly WindowViewKey[];
  readonly defaultBounds?: FloatingWindowState;
}

export interface CreateSingleTabWindowFrameOptions {
  readonly viewKey: WindowViewKey;
  readonly frameId?: string;
  readonly bounds?: FloatingWindowState;
  readonly presentation?: WindowWorkspaceFramePresentation;
}

export interface RestoreViewAsSingleTabFrameOptions {
  readonly view: WindowWorkspaceViewDescriptor;
  readonly frameId?: string;
  readonly bounds?: FloatingWindowState;
  readonly presentation?: WindowWorkspaceFramePresentation;
}

export interface WindowSplitLayoutCommit {
  readonly sourceViewActorId: string;
  readonly targetFrameId: string;
  readonly targetTabsetId: string;
  readonly placement: WindowFrameSplitPlacement;
  readonly ratio?: number;
}

export type WindowSplitLayoutCommitResult =
  | {
      readonly committed: true;
      readonly layout: WindowWorkspaceFrameLayout;
      readonly sourceFrameId: string;
      readonly targetFrameId: string;
      readonly emptySourceFrameId: string | null;
    }
  | {
      readonly committed: false;
      readonly layout: WindowWorkspaceFrameLayout;
      readonly reason: string;
    };

interface RemoveFrameViewResult {
  readonly node: WindowFrameDockNode | null;
  readonly removed: boolean;
}

interface SplitFrameViewResult {
  readonly node: WindowFrameDockNode | null;
  readonly removedSource: boolean;
  readonly splitTarget: boolean;
  readonly targetWouldBeEmpty: boolean;
}

let nextWindowWorkspaceFrameNodeId = 1;

export function createWindowWorkspaceFrameLayout(
  options: CreateWindowWorkspaceFrameLayoutOptions = {}
): WindowWorkspaceFrameLayout {
  const views = createViewDescriptorMap(options.views ?? []);
  const hiddenViewKeys = uniqueViewKeys(options.hiddenViewKeys ?? []);
  const frames = options.frames
    ? options.frames.map(cloneFrameDescriptor)
    : Object.keys(views)
      .filter((viewKey) => !hiddenViewKeys.includes(viewKey))
      .map((viewKey) => createSingleTabWindowFrame({
        viewKey,
        bounds: options.defaultBounds
      }));
  return normalizeWindowWorkspaceFrameLayout({
    views,
    frames,
    hiddenViewKeys
  });
}

export function normalizeWindowWorkspaceFrameLayout(
  layout: WindowWorkspaceFrameLayout
): WindowWorkspaceFrameLayout {
  const views = cloneViewDescriptors(layout.views);
  const framedViewKeys = new Set<WindowViewKey>();
  const frames: WindowWorkspaceFrameDescriptor[] = [];
  for (const frame of layout.frames) {
    const root = normalizeFrameDockNode(frame.root, views, framedViewKeys);
    if (!root) continue;
    frames.push({
      frameId: frame.frameId,
      bounds: cloneFloatingWindowState(frame.bounds),
      presentation: frame.presentation,
      root
    });
  }

  const visibleViewKeys = new Set(frames.flatMap((frame) => collectFrameViewKeys(frame.root)));
  const normalizedViews = Object.fromEntries(
    Object.entries(views).filter(([viewKey]) => visibleViewKeys.has(viewKey))
  );
  const hiddenViewKeys = uniqueViewKeys(layout.hiddenViewKeys)
    .filter((viewKey) => !visibleViewKeys.has(viewKey));

  return {
    views: normalizedViews,
    frames,
    hiddenViewKeys
  };
}

export function createSingleTabWindowFrame(
  options: CreateSingleTabWindowFrameOptions
): WindowWorkspaceFrameDescriptor {
  const bounds = options.bounds ?? createDefaultFrameBounds();
  return {
    frameId: options.frameId ?? createFrameId(options.viewKey),
    bounds: cloneFloatingWindowState(bounds),
    presentation: options.presentation ?? "windowed",
    root: createFrameTabset([options.viewKey], options.viewKey)
  };
}

export function closeFrameInWorkspaceFrameLayout(
  layout: WindowWorkspaceFrameLayout,
  frameId: string
): WindowWorkspaceFrameLayout {
  const targetFrame = layout.frames.find((frame) => frame.frameId === frameId);
  if (!targetFrame) return layout;
  const closedViewKeys = collectFrameViewKeys(targetFrame.root);
  const closedViewKeySet = new Set(closedViewKeys);
  const views = Object.fromEntries(
    Object.entries(layout.views).filter(([viewKey]) => !closedViewKeySet.has(viewKey))
  );
  return normalizeWindowWorkspaceFrameLayout({
    views,
    frames: layout.frames.filter((frame) => frame.frameId !== frameId),
    hiddenViewKeys: uniqueViewKeys([...layout.hiddenViewKeys, ...closedViewKeys])
  });
}

export function restoreViewAsSingleTabFrame(
  layout: WindowWorkspaceFrameLayout,
  options: RestoreViewAsSingleTabFrameOptions
): WindowWorkspaceFrameLayout {
  if (layout.views[options.view.viewKey] || findFrameContainingView(layout, options.view.viewKey)) {
    throw new Error(`Window view is already live: ${options.view.viewKey}.`);
  }
  return normalizeWindowWorkspaceFrameLayout({
    views: {
      ...layout.views,
      [options.view.viewKey]: { ...options.view }
    },
    frames: [
      ...layout.frames,
      createSingleTabWindowFrame({
        viewKey: options.view.viewKey,
        frameId: options.frameId,
        bounds: options.bounds,
        presentation: options.presentation
      })
    ],
    hiddenViewKeys: layout.hiddenViewKeys.filter((viewKey) => viewKey !== options.view.viewKey)
  });
}

export function findFrameContainingView(
  layout: WindowWorkspaceFrameLayout,
  viewKey: WindowViewKey
): WindowWorkspaceFrameDescriptor | null {
  return layout.frames.find((frame) => collectFrameViewKeys(frame.root).includes(viewKey)) ?? null;
}

export function splitDockViewInFrameLayout(
  layout: WindowWorkspaceFrameLayout,
  commit: WindowSplitLayoutCommit
): WindowSplitLayoutCommitResult {
  const normalized = normalizeWindowWorkspaceFrameLayout(layout);
  const sourceView = Object.values(normalized.views)
    .find((view) => view.actorId === commit.sourceViewActorId);
  if (!sourceView) {
    return invalidSplitCommit(normalized, "source view is not live");
  }
  if (sourceView.canDock === false) {
    return invalidSplitCommit(normalized, "source view cannot be docked");
  }
  const sourceFrameIndex = normalized.frames.findIndex((frame) =>
    collectFrameViewKeys(frame.root).includes(sourceView.viewKey)
  );
  if (sourceFrameIndex < 0) {
    return invalidSplitCommit(normalized, "source frame is missing");
  }
  const targetFrameIndex = normalized.frames.findIndex((frame) => frame.frameId === commit.targetFrameId);
  if (targetFrameIndex < 0) {
    return invalidSplitCommit(normalized, "target frame is missing");
  }
  const targetTabset = findFrameTabsetById(
    normalized.frames[targetFrameIndex]?.root ?? createFrameTabset([sourceView.viewKey], sourceView.viewKey),
    commit.targetTabsetId
  );
  if (!targetTabset) {
    return invalidSplitCommit(normalized, "target tabset is missing");
  }
  if (targetTabset.tabs.some((viewKey) => normalized.views[viewKey]?.canDock === false)) {
    return invalidSplitCommit(normalized, "target tabset contains a non-dockable view");
  }

  const frames: WindowWorkspaceFrameDescriptor[] = [];
  let removedSource = false;
  let splitTarget = false;
  let targetWouldBeEmpty = false;
  let emptySourceFrameId: string | null = null;

  for (let index = 0; index < normalized.frames.length; index += 1) {
    const frame = normalized.frames[index];
    if (!frame) continue;
    let root: WindowFrameDockNode | null = cloneFrameDockNode(frame.root);
    if (index === sourceFrameIndex && index === targetFrameIndex) {
      const split = splitFrameViewInNode(root, sourceView.viewKey, commit);
      root = split.node;
      removedSource = split.removedSource;
      splitTarget = split.splitTarget;
      targetWouldBeEmpty = split.targetWouldBeEmpty;
    } else if (index === sourceFrameIndex) {
      const removed = removeFrameViewFromDockNode(root, sourceView.viewKey);
      root = removed.node;
      removedSource = removed.removed;
    } else if (index === targetFrameIndex) {
      const split = splitTargetFrameTabset(root, sourceView.viewKey, commit);
      root = split.node;
      splitTarget = split.splitTarget;
      targetWouldBeEmpty = split.targetWouldBeEmpty;
    }

    if (!root) {
      if (index === sourceFrameIndex) {
        emptySourceFrameId = frame.frameId;
      }
      continue;
    }
    frames.push({
      ...frame,
      bounds: cloneFloatingWindowState(frame.bounds),
      root
    });
  }

  if (targetWouldBeEmpty) {
    return invalidSplitCommit(normalized, "target tabset would be empty");
  }
  if (!removedSource) {
    return invalidSplitCommit(normalized, "source tab was not found");
  }
  if (!splitTarget) {
    return invalidSplitCommit(normalized, "target tabset was not found");
  }

  return {
    committed: true,
    sourceFrameId: normalized.frames[sourceFrameIndex]?.frameId ?? "",
    targetFrameId: commit.targetFrameId,
    emptySourceFrameId,
    layout: normalizeWindowWorkspaceFrameLayout({
      ...normalized,
      frames
    })
  };
}

function invalidSplitCommit(
  layout: WindowWorkspaceFrameLayout,
  reason: string
): WindowSplitLayoutCommitResult {
  return {
    committed: false,
    layout,
    reason
  };
}

function createViewDescriptorMap(
  views: readonly WindowWorkspaceViewDescriptor[]
): Record<string, WindowWorkspaceViewDescriptor> {
  const descriptors: Record<string, WindowWorkspaceViewDescriptor> = {};
  for (const view of views) {
    if (descriptors[view.viewKey]) {
      throw new Error(`Duplicate window view key: ${view.viewKey}.`);
    }
    descriptors[view.viewKey] = { ...view };
  }
  return descriptors;
}

function cloneViewDescriptors(
  views: Readonly<Record<string, WindowWorkspaceViewDescriptor>>
): Record<string, WindowWorkspaceViewDescriptor> {
  return Object.fromEntries(
    Object.entries(views).map(([viewKey, descriptor]) => [viewKey, { ...descriptor }])
  );
}

function uniqueViewKeys(viewKeys: readonly WindowViewKey[]): WindowViewKey[] {
  const seen = new Set<WindowViewKey>();
  const normalized: WindowViewKey[] = [];
  for (const viewKey of viewKeys) {
    if (seen.has(viewKey)) continue;
    seen.add(viewKey);
    normalized.push(viewKey);
  }
  return normalized;
}

function normalizeFrameDockNode(
  node: WindowFrameDockNode,
  views: Readonly<Record<string, WindowWorkspaceViewDescriptor>>,
  framedViewKeys: Set<WindowViewKey>
): WindowFrameDockNode | null {
  if (node.kind === "tabset") {
    const tabs: WindowViewKey[] = [];
    const localTabs = new Set<WindowViewKey>();
    for (const viewKey of node.tabs) {
      if (!views[viewKey]) continue;
      if (framedViewKeys.has(viewKey) || localTabs.has(viewKey)) continue;
      framedViewKeys.add(viewKey);
      localTabs.add(viewKey);
      tabs.push(viewKey);
    }
    if (tabs.length === 0) return null;
    const activeTabId = tabs.includes(node.activeTabId) ? node.activeTabId : tabs[0];
    return createFrameTabset(tabs, activeTabId, node.id || undefined);
  }

  const first = normalizeFrameDockNode(node.first, views, framedViewKeys);
  const second = normalizeFrameDockNode(node.second, views, framedViewKeys);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return createFrameSplitNode(node.direction, first, second, node.ratio, node.id || undefined);
}

function removeFrameViewFromDockNode(
  node: WindowFrameDockNode,
  viewKey: WindowViewKey
): RemoveFrameViewResult {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(viewKey)) {
      return { node, removed: false };
    }
    const removedIndex = node.tabs.indexOf(viewKey);
    const tabs = node.tabs.filter((tab) => tab !== viewKey);
    if (tabs.length === 0) {
      return { node: null, removed: true };
    }
    const activeTabId = node.activeTabId === viewKey
      ? tabs[Math.min(removedIndex, tabs.length - 1)] ?? tabs[0]
      : node.activeTabId;
    return {
      node: createFrameTabset(tabs, activeTabId, node.id),
      removed: true
    };
  }

  const first = removeFrameViewFromDockNode(node.first, viewKey);
  const second = removeFrameViewFromDockNode(node.second, viewKey);
  if (!first.removed && !second.removed) {
    return { node, removed: false };
  }
  if (!first.node) return { node: second.node, removed: true };
  if (!second.node) return { node: first.node, removed: true };
  return {
    node: createFrameSplitNode(node.direction, first.node, second.node, node.ratio, node.id),
    removed: true
  };
}

function splitTargetFrameTabset(
  node: WindowFrameDockNode,
  sourceViewKey: WindowViewKey,
  commit: WindowSplitLayoutCommit
): SplitFrameViewResult {
  return splitFrameViewInNode(node, sourceViewKey, commit, { removeOnlyInTarget: true });
}

function splitFrameViewInNode(
  node: WindowFrameDockNode,
  sourceViewKey: WindowViewKey,
  commit: WindowSplitLayoutCommit,
  options: { readonly removeOnlyInTarget?: boolean } = {}
): SplitFrameViewResult {
  if (node.kind === "tabset") {
    const isTarget = node.id === commit.targetTabsetId;
    const hadSource = node.tabs.includes(sourceViewKey);
    if (!isTarget) {
      if (options.removeOnlyInTarget || !hadSource) {
        return {
          node,
          removedSource: false,
          splitTarget: false,
          targetWouldBeEmpty: false
        };
      }
      const removed = removeFrameViewFromDockNode(node, sourceViewKey);
      return {
        node: removed.node,
        removedSource: removed.removed,
        splitTarget: false,
        targetWouldBeEmpty: false
      };
    }

    const targetTabs = node.tabs.filter((tab) => tab !== sourceViewKey);
    if (targetTabs.length === 0) {
      return {
        node: null,
        removedSource: hadSource,
        splitTarget: false,
        targetWouldBeEmpty: true
      };
    }
    const targetActiveTabId = targetTabs.includes(node.activeTabId) ? node.activeTabId : targetTabs[0];
    return {
      node: createFrameSplitNodeForPlacement(
        createFrameTabset([sourceViewKey], sourceViewKey),
        createFrameTabset(targetTabs, targetActiveTabId, node.id),
        commit.placement,
        commit.ratio
      ),
      removedSource: hadSource,
      splitTarget: true,
      targetWouldBeEmpty: false
    };
  }

  const first = splitFrameViewInNode(node.first, sourceViewKey, commit, options);
  const second = splitFrameViewInNode(node.second, sourceViewKey, commit, options);
  const removedSource = first.removedSource || second.removedSource;
  const splitTarget = first.splitTarget || second.splitTarget;
  const targetWouldBeEmpty = first.targetWouldBeEmpty || second.targetWouldBeEmpty;

  if (!removedSource && !splitTarget && !targetWouldBeEmpty) {
    return { node, removedSource, splitTarget, targetWouldBeEmpty };
  }
  if (!first.node) {
    return { node: second.node, removedSource, splitTarget, targetWouldBeEmpty };
  }
  if (!second.node) {
    return { node: first.node, removedSource, splitTarget, targetWouldBeEmpty };
  }
  return {
    node: createFrameSplitNode(node.direction, first.node, second.node, node.ratio, node.id),
    removedSource,
    splitTarget,
    targetWouldBeEmpty
  };
}

function createFrameSplitNodeForPlacement(
  sourceTabset: WindowFrameTabsetNode,
  targetTabset: WindowFrameTabsetNode,
  placement: WindowFrameSplitPlacement,
  ratio = 0.34
): WindowFrameSplitNode {
  const direction: WindowWorkspaceSplitDirection =
    placement === "left" || placement === "right" ? "horizontal" : "vertical";
  const sourceBeforeTarget = placement === "left" || placement === "top";
  const first = sourceBeforeTarget ? sourceTabset : targetTabset;
  const second = sourceBeforeTarget ? targetTabset : sourceTabset;
  const firstRatio = sourceBeforeTarget ? ratio : 1 - ratio;
  return createFrameSplitNode(direction, first, second, firstRatio);
}

function findFrameTabsetById(
  node: WindowFrameDockNode,
  tabsetId: string
): WindowFrameTabsetNode | null {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? node : null;
  }
  return findFrameTabsetById(node.first, tabsetId) ?? findFrameTabsetById(node.second, tabsetId);
}

function cloneFrameDescriptor(frame: WindowWorkspaceFrameDescriptor): WindowWorkspaceFrameDescriptor {
  return {
    frameId: frame.frameId,
    bounds: cloneFloatingWindowState(frame.bounds),
    presentation: frame.presentation,
    root: cloneFrameDockNode(frame.root)
  };
}

function cloneFrameDockNode(node: WindowFrameDockNode): WindowFrameDockNode {
  if (node.kind === "tabset") {
    return {
      ...node,
      tabs: [...node.tabs]
    };
  }
  return {
    ...node,
    first: cloneFrameDockNode(node.first),
    second: cloneFrameDockNode(node.second)
  };
}

function createFrameTabset(
  tabs: readonly WindowViewKey[],
  activeTabId: WindowViewKey,
  id = createFrameTabsetId()
): WindowFrameTabsetNode {
  return {
    kind: "tabset",
    id,
    tabs: [...tabs],
    activeTabId
  };
}

function createFrameSplitNode(
  direction: WindowWorkspaceSplitDirection,
  first: WindowFrameDockNode,
  second: WindowFrameDockNode,
  ratio = 0.5,
  id = createFrameSplitId()
): WindowFrameSplitNode {
  const clampedRatio = Math.min(0.9, Math.max(0.1, ratio));
  return {
    kind: "split",
    id,
    direction,
    ratio: clampedRatio,
    first,
    second
  };
}

export function collectFrameViewKeys(node: WindowFrameDockNode): WindowViewKey[] {
  if (node.kind === "tabset") {
    return [...node.tabs];
  }
  return [
    ...collectFrameViewKeys(node.first),
    ...collectFrameViewKeys(node.second)
  ];
}

function createDefaultFrameBounds(): FloatingWindowState {
  return {
    position: { x: 40, y: 40 },
    size: { x: 360, y: 240 },
    visible: true
  };
}

function createFrameId(viewKey: WindowViewKey): string {
  return `frame:${viewKey}`;
}

function createFrameTabsetId(): string {
  return `frame-tabset:${nextWindowWorkspaceFrameNodeId++}`;
}

function createFrameSplitId(): string {
  return `frame-split:${nextWindowWorkspaceFrameNodeId++}`;
}
