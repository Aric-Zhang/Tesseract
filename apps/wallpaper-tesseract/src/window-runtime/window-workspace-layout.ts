import { cloneFloatingWindowState, type FloatingWindowState } from "./floating-window-state";
import type { WindowViewKey } from "./window-view-key";

/**
 * Transitional note:
 * The actor-id based WindowWorkspaceLayout below is retained for existing pure
 * layout tests and should not receive new docking behavior. The frame/view
 * layout types in the second half of this file are the target model for
 * Step24+ tab merge, floating, and split docking work.
 */

export type WindowWorkspaceSplitDirection = "horizontal" | "vertical";
export type WindowWorkspaceSplitPlacement = "before" | "after";

export interface WindowWorkspaceWindowDescriptor {
  readonly actorId: string;
  readonly title?: string;
  readonly canDock?: boolean;
}

export interface WindowWorkspaceFloatingWindow {
  readonly actorId: string;
}

export interface WindowWorkspaceTabsetNode {
  readonly kind: "tabset";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly tabs: readonly string[];
  readonly activeTabId: string | null;
}

export interface WindowWorkspaceSplitNode {
  readonly kind: "split";
  /**
   * Derived from current node content for deterministic tests and debugging.
   * Treat it as volatile: UI and persistence must not cache it as a stable identity.
   */
  readonly id: string;
  readonly direction: WindowWorkspaceSplitDirection;
  readonly ratio: number;
  readonly first: WindowWorkspaceDockNode;
  readonly second: WindowWorkspaceDockNode;
}

export type WindowWorkspaceDockNode = WindowWorkspaceTabsetNode | WindowWorkspaceSplitNode;

export interface WindowWorkspaceLayout {
  readonly windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>;
  readonly floating: readonly WindowWorkspaceFloatingWindow[];
  readonly dockRoot: WindowWorkspaceDockNode | null;
}

export interface CreateWindowWorkspaceLayoutOptions {
  readonly windows?: readonly WindowWorkspaceWindowDescriptor[];
  readonly floating?: readonly string[];
  readonly dockRoot?: WindowWorkspaceDockNode | null;
}

export interface SplitDockTabOptions {
  readonly direction: WindowWorkspaceSplitDirection;
  readonly placement?: WindowWorkspaceSplitPlacement;
  readonly ratio?: number;
}

export type WindowFrameSplitPlacement = "left" | "right" | "top" | "bottom";
export type WindowWorkspaceFramePresentation = "windowed" | "fullscreen";

export interface WindowWorkspaceViewDescriptor {
  readonly viewKey: WindowViewKey;
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

interface RemoveFromDockResult {
  readonly node: WindowWorkspaceDockNode | null;
  readonly removed: boolean;
}

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

export function createWindowWorkspaceLayout(
  options: CreateWindowWorkspaceLayoutOptions = {}
): WindowWorkspaceLayout {
  const windows = Object.fromEntries(
    (options.windows ?? []).map((window) => [window.actorId, { ...window }])
  );
  return normalizeWindowWorkspaceLayout({
    windows,
    floating: (options.floating ?? Object.keys(windows)).map((actorId) => ({ actorId })),
    dockRoot: options.dockRoot ? cloneDockNode(options.dockRoot) : null
  });
}

export function normalizeWindowWorkspaceLayout(layout: WindowWorkspaceLayout): WindowWorkspaceLayout {
  const windows = cloneWindowDescriptors(layout.windows);
  const dockedActorIds = new Set<string>();
  const dockRoot = normalizeDockNode(layout.dockRoot, windows, dockedActorIds);
  return {
    windows,
    floating: normalizeFloatingWindows(layout.floating, windows, dockedActorIds),
    dockRoot
  };
}

export function dockWindowAsTab(
  layout: WindowWorkspaceLayout,
  actorId: string,
  targetTabsetId?: string
): WindowWorkspaceLayout {
  assertKnownDockableWindow(layout, actorId);
  const detached = removeWindowFromDockRoot(layout.dockRoot, actorId);
  const floating = removeFloatingWindow(layout.floating, actorId);
  const dockRoot = addTabToDockRoot(detached.node, actorId, targetTabsetId);
  return {
    ...layout,
    floating,
    dockRoot
  };
}

export function setActiveDockTab(
  layout: WindowWorkspaceLayout,
  tabsetId: string,
  actorId: string
): WindowWorkspaceLayout {
  if (!findTabsetById(layout.dockRoot, tabsetId)) {
    throw new Error(`Dock tabset not found: ${tabsetId}.`);
  }
  const dockRoot = updateTabset(layout.dockRoot, tabsetId, (tabset) => {
    if (!tabset.tabs.includes(actorId)) {
      throw new Error(`Window ${actorId} is not in dock tabset ${tabsetId}.`);
    }
    return {
      ...tabset,
      activeTabId: actorId
    };
  });
  if (!dockRoot) {
    throw new Error(`Dock tabset not found: ${tabsetId}.`);
  }
  return {
    ...layout,
    dockRoot
  };
}

export function removeWindowFromLayout(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceLayout {
  const { [actorId]: _removedWindow, ...windows } = layout.windows;
  const floating = removeFloatingWindow(layout.floating, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  return {
    windows,
    floating,
    dockRoot: dock.node
  };
}

export function removeWindowFromDock(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceLayout {
  assertKnownWindow(layout, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  if (!dock.removed) return layout;
  return normalizeWindowWorkspaceLayout({
    ...layout,
    dockRoot: dock.node
  });
}

export function undockWindow(layout: WindowWorkspaceLayout, actorId: string): WindowWorkspaceLayout {
  assertKnownWindow(layout, actorId);
  const dock = removeWindowFromDockRoot(layout.dockRoot, actorId);
  if (!dock.removed) return layout;
  return {
    ...layout,
    floating: addFloatingWindow(layout.floating, actorId),
    dockRoot: dock.node
  };
}

export function splitDockTab(
  layout: WindowWorkspaceLayout,
  actorId: string,
  options: SplitDockTabOptions
): WindowWorkspaceLayout {
  assertKnownDockableWindow(layout, actorId);
  if (!layout.dockRoot) {
    throw new Error(`Cannot split ${actorId}; no dock root exists.`);
  }
  const dockRoot = splitTabInNode(layout.dockRoot, actorId, options);
  if (!dockRoot.changed) {
    throw new Error(`Cannot split ${actorId}; dock tab was not found.`);
  }
  return {
    ...layout,
    dockRoot: dockRoot.node
  };
}

export function findDockTabsetContaining(
  layout: WindowWorkspaceLayout,
  actorId: string
): WindowWorkspaceTabsetNode | null {
  return findTabsetContaining(layout.dockRoot, actorId);
}

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

function assertKnownWindow(layout: WindowWorkspaceLayout, actorId: string): void {
  if (!layout.windows[actorId]) {
    throw new Error(`Unknown workspace window: ${actorId}.`);
  }
}

function assertKnownDockableWindow(layout: WindowWorkspaceLayout, actorId: string): void {
  assertKnownWindow(layout, actorId);
  if (layout.windows[actorId]?.canDock === false) {
    throw new Error(`Window ${actorId} cannot be docked.`);
  }
}

function cloneWindowDescriptors(
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>
): Record<string, WindowWorkspaceWindowDescriptor> {
  return Object.fromEntries(
    Object.entries(windows).map(([actorId, descriptor]) => [actorId, { ...descriptor }])
  );
}

function normalizeDockNode(
  node: WindowWorkspaceDockNode | null,
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  dockedActorIds: Set<string>
): WindowWorkspaceDockNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    const tabs: string[] = [];
    for (const actorId of node.tabs) {
      if (!isKnownDockableWindow(windows, actorId)) continue;
      if (dockedActorIds.has(actorId)) continue;
      dockedActorIds.add(actorId);
      tabs.push(actorId);
    }
    if (tabs.length === 0) return null;
    const activeTabId = node.activeTabId && tabs.includes(node.activeTabId)
      ? node.activeTabId
      : tabs[0] ?? null;
    return createTabset(tabs, activeTabId);
  }

  const first = normalizeDockNode(node.first, windows, dockedActorIds);
  const second = normalizeDockNode(node.second, windows, dockedActorIds);
  if (!first && !second) return null;
  if (!first) return second;
  if (!second) return first;
  return createSplitNode(node.direction, first, second, node.ratio);
}

function normalizeFloatingWindows(
  floating: readonly WindowWorkspaceFloatingWindow[],
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  dockedActorIds: ReadonlySet<string>
): readonly WindowWorkspaceFloatingWindow[] {
  const seen = new Set<string>();
  const normalized: WindowWorkspaceFloatingWindow[] = [];
  for (const window of floating) {
    const actorId = window.actorId;
    if (!windows[actorId]) continue;
    if (dockedActorIds.has(actorId)) continue;
    if (seen.has(actorId)) continue;
    seen.add(actorId);
    normalized.push({ actorId });
  }
  return normalized;
}

function isKnownDockableWindow(
  windows: Readonly<Record<string, WindowWorkspaceWindowDescriptor>>,
  actorId: string
): boolean {
  return Boolean(windows[actorId] && windows[actorId]?.canDock !== false);
}

function addTabToDockRoot(
  node: WindowWorkspaceDockNode | null,
  actorId: string,
  targetTabsetId?: string
): WindowWorkspaceDockNode {
  if (!node) {
    return createTabset([actorId], actorId);
  }
  if (!targetTabsetId && node.kind === "tabset") {
    return addTabToTabset(node, actorId);
  }
  if (!targetTabsetId) {
    const firstTabset = findFirstTabset(node);
    if (!firstTabset) return createTabset([actorId], actorId);
    return replaceTabset(node, firstTabset.id, (tabset) => addTabToTabset(tabset, actorId));
  }
  const updated = replaceTabset(node, targetTabsetId, (tabset) => addTabToTabset(tabset, actorId));
  if (updated === node) {
    throw new Error(`Dock tabset not found: ${targetTabsetId}.`);
  }
  return updated;
}

function addTabToTabset(tabset: WindowWorkspaceTabsetNode, actorId: string): WindowWorkspaceTabsetNode {
  const tabs = tabset.tabs.includes(actorId) ? tabset.tabs : [...tabset.tabs, actorId];
  return {
    ...tabset,
    id: createTabsetId(tabs),
    tabs,
    activeTabId: actorId
  };
}

function removeWindowFromDockRoot(
  node: WindowWorkspaceDockNode | null,
  actorId: string
): RemoveFromDockResult {
  if (!node) return { node: null, removed: false };
  return removeWindowFromDockNode(node, actorId);
}

function removeWindowFromDockNode(
  node: WindowWorkspaceDockNode,
  actorId: string
): RemoveFromDockResult {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(actorId)) {
      return { node, removed: false };
    }
    const removedIndex = node.tabs.indexOf(actorId);
    const tabs = node.tabs.filter((tab) => tab !== actorId);
    if (tabs.length === 0) {
      return { node: null, removed: true };
    }
    const activeTabId = node.activeTabId === actorId
      ? tabs[Math.min(removedIndex, tabs.length - 1)] ?? null
      : node.activeTabId;
    return {
      node: {
        ...node,
        id: createTabsetId(tabs),
        tabs,
        activeTabId
      },
      removed: true
    };
  }

  const first = removeWindowFromDockNode(node.first, actorId);
  const second = removeWindowFromDockNode(node.second, actorId);
  if (!first.removed && !second.removed) {
    return { node, removed: false };
  }
  if (!first.node) return { node: second.node, removed: true };
  if (!second.node) return { node: first.node, removed: true };
  return {
    node: {
      ...node,
      first: first.node,
      second: second.node,
      id: createSplitId(node.direction, first.node, second.node)
    },
    removed: true
  };
}

function splitTabInNode(
  node: WindowWorkspaceDockNode,
  actorId: string,
  options: SplitDockTabOptions
): { readonly node: WindowWorkspaceDockNode; readonly changed: boolean } {
  if (node.kind === "tabset") {
    if (!node.tabs.includes(actorId)) {
      return { node, changed: false };
    }
    if (node.tabs.length < 2) {
      throw new Error(`Cannot split ${actorId}; a tabset needs at least two tabs.`);
    }
    const removed = removeWindowFromDockNode(node, actorId);
    if (!removed.node) {
      throw new Error(`Cannot split ${actorId}; source tabset would be empty.`);
    }
    const tabNode = createTabset([actorId], actorId);
    const placement = options.placement ?? "after";
    const first = placement === "before" ? tabNode : removed.node;
    const second = placement === "before" ? removed.node : tabNode;
    return {
      changed: true,
      node: createSplitNode(options.direction, first, second, options.ratio)
    };
  }

  const first = splitTabInNode(node.first, actorId, options);
  if (first.changed) {
    return {
      changed: true,
      node: createSplitNode(node.direction, first.node, node.second, node.ratio)
    };
  }
  const second = splitTabInNode(node.second, actorId, options);
  if (second.changed) {
    return {
      changed: true,
      node: createSplitNode(node.direction, node.first, second.node, node.ratio)
    };
  }
  return { node, changed: false };
}

function updateTabset(
  node: WindowWorkspaceDockNode | null,
  tabsetId: string,
  update: (tabset: WindowWorkspaceTabsetNode) => WindowWorkspaceTabsetNode
): WindowWorkspaceDockNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.id === tabsetId ? update(node) : node;
  }
  const first = updateTabset(node.first, tabsetId, update);
  const second = updateTabset(node.second, tabsetId, update);
  if (first === node.first && second === node.second) return node;
  return {
    ...node,
    first: first ?? node.first,
    second: second ?? node.second
  };
}

function replaceTabset(
  node: WindowWorkspaceDockNode,
  tabsetId: string,
  replace: (tabset: WindowWorkspaceTabsetNode) => WindowWorkspaceTabsetNode
): WindowWorkspaceDockNode {
  if (node.kind === "tabset") {
    return node.id === tabsetId ? replace(node) : node;
  }
  const first = replaceTabset(node.first, tabsetId, replace);
  const second = replaceTabset(node.second, tabsetId, replace);
  if (first === node.first && second === node.second) return node;
  return createSplitNode(node.direction, first, second, node.ratio);
}

function findFirstTabset(node: WindowWorkspaceDockNode | null): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") return node;
  return findFirstTabset(node.first) ?? findFirstTabset(node.second);
}

function findTabsetById(
  node: WindowWorkspaceDockNode | null,
  tabsetId: string
): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.id === tabsetId ? node : null;
  }
  return findTabsetById(node.first, tabsetId) ?? findTabsetById(node.second, tabsetId);
}

function findTabsetContaining(
  node: WindowWorkspaceDockNode | null,
  actorId: string
): WindowWorkspaceTabsetNode | null {
  if (!node) return null;
  if (node.kind === "tabset") {
    return node.tabs.includes(actorId) ? node : null;
  }
  return findTabsetContaining(node.first, actorId) ?? findTabsetContaining(node.second, actorId);
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

function createTabset(tabs: readonly string[], activeTabId: string | null): WindowWorkspaceTabsetNode {
  return {
    kind: "tabset",
    id: createTabsetId(tabs),
    tabs: [...tabs],
    activeTabId
  };
}

function createSplitNode(
  direction: WindowWorkspaceSplitDirection,
  first: WindowWorkspaceDockNode,
  second: WindowWorkspaceDockNode,
  ratio = 0.5
): WindowWorkspaceSplitNode {
  const clampedRatio = Math.min(0.9, Math.max(0.1, ratio));
  return {
    kind: "split",
    id: createSplitId(direction, first, second),
    direction,
    ratio: clampedRatio,
    first,
    second
  };
}

function cloneDockNode(node: WindowWorkspaceDockNode): WindowWorkspaceDockNode {
  if (node.kind === "tabset") {
    return {
      ...node,
      tabs: [...node.tabs]
    };
  }
  return {
    ...node,
    first: cloneDockNode(node.first),
    second: cloneDockNode(node.second)
  };
}

function addFloatingWindow(
  floating: readonly WindowWorkspaceFloatingWindow[],
  actorId: string
): readonly WindowWorkspaceFloatingWindow[] {
  if (floating.some((window) => window.actorId === actorId)) return floating;
  return [...floating, { actorId }];
}

function removeFloatingWindow(
  floating: readonly WindowWorkspaceFloatingWindow[],
  actorId: string
): readonly WindowWorkspaceFloatingWindow[] {
  return floating.filter((window) => window.actorId !== actorId);
}

function createTabsetId(tabs: readonly string[]): string {
  return `tabset:${tabs.join("+")}`;
}

function createSplitId(
  direction: WindowWorkspaceSplitDirection,
  first: WindowWorkspaceDockNode,
  second: WindowWorkspaceDockNode
): string {
  return `split:${direction}:${first.id}|${second.id}`;
}
